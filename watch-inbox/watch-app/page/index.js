import { createWidget, widget, prop, align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { Vibrator, VIBRATOR_SCENE_SHORT_STRONG, Time } from '@zos/sensor'
import { connectStatus } from '@zos/ble'
import { BasePage } from '@zeppos/zml/base-page'
import {
  enqueue,
  makeNote,
  normalizeLabels,
  offsetMinutesFromTime,
  parseJson,
  QUEUE_CAP,
  removeById,
  retryDelayMs
} from '../utils/notes'
import { loadLabels, loadQueue, saveLabels, saveQueue } from '../utils/store'

// Layout for the 480 x 480 round screen: 3 rows of 2 pill buttons, a status
// line above and a message line below, all inside the circle.
const CENTER = px(240)
const BTN_W = px(176)
const BTN_H = px(88)
const GAP = px(12)
const GRID_TOP = px(100)
const COLUMN_X = [CENTER - GAP / 2 - BTN_W, CENTER + GAP / 2]

// If the receiver has not confirmed a tapped note within this time, show "Queued".
// The note stays in the queue and keeps sending.
const FEEDBACK_DEADLINE_MS = 8000
// Longer than the phone side's 3 attempts of up to 12 s each plus backoff.
const REQUEST_TIMEOUT_MS = 50000

const ERROR_TEXT = {
  no_phone: 'phone not connected',
  unauthorized: 'wrong token',
  not_configured: 'set up in Zepp app',
  url_not_https: 'URL must be https'
}
const QUEUED_HINT = {
  unauthorized: 'Queued: check token',
  not_configured: 'Queued: set up phone',
  url_not_https: 'Queued: check URL'
}

Page(
  BasePage({
    state: {
      labels: [],
      buttons: [],
      statusText: null,
      messageText: null,
      flushing: false,
      attempt: 0,
      lastError: null,
      retryTimer: null,
      messageTimer: null,
      feedbackId: null,
      feedbackTimer: null,
      launchLabel: null,
      destroyed: false
    },

    onInit(params) {
      // Set when the app is opened from a shortcut card button.
      const p = parseJson(params, null)
      this.state.launchLabel = p && typeof p.label === 'string' ? p.label : null
      this.vibrator = new Vibrator()
      this.time = new Time()
    },

    build() {
      this.state.statusText = createWidget(widget.TEXT, {
        x: px(124),
        y: px(30),
        w: px(232),
        h: px(64),
        color: 0xaaaaaa,
        text_size: px(22),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
        text: ''
      })

      this.state.labels = loadLabels()
      this.state.labels.forEach((label, i) => {
        const geometry = {
          x: COLUMN_X[i % 2],
          y: GRID_TOP + Math.floor(i / 2) * (BTN_H + GAP),
          w: BTN_W,
          h: BTN_H
        }
        const button = createWidget(widget.BUTTON, {
          ...geometry,
          radius: BTN_H / 2,
          normal_color: 0x1f3a5f,
          press_color: 0x3d6fa8,
          color: 0xffffff,
          text_size: px(30),
          text: label,
          click_func: () => this.logNote(this.state.labels[i])
        })
        this.state.buttons.push({ button, geometry })
      })

      this.state.messageText = createWidget(widget.TEXT, {
        x: px(114),
        y: px(396),
        w: px(252),
        h: px(48),
        color: 0xffffff,
        text_size: px(28),
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text: ''
      })

      this.requestLabels()
      if (this.state.launchLabel) {
        this.logNote(this.state.launchLabel)
      } else {
        this.flush()
      }
    },

    onDestroy() {
      this.state.destroyed = true
      this.clearRetry()
      clearTimeout(this.state.messageTimer)
      clearTimeout(this.state.feedbackTimer)
    },

    // ZML calls this when the Bluetooth link to the phone changes.
    onBleChanged() {
      if (connectStatus()) {
        this.state.attempt = 0
        this.requestLabels()
        this.flush()
      } else {
        this.refreshStatus()
      }
    },

    // Messages pushed from the phone side.
    onCall(data) {
      if (data && data.method === 'labels.update' && data.params) {
        this.applyLabels(data.params.labels)
      }
    },

    logNote(label) {
      try {
        this.vibrator.start({ mode: VIBRATOR_SCENE_SHORT_STRONG })
      } catch (e) {
        // A missed buzz must not stop the note from being saved.
      }
      const note = makeNote(label, this.time.getTime(), offsetMinutesFromTime(this.time))
      const { queue, dropped } = enqueue(loadQueue(), note)
      saveQueue(queue)

      if (dropped) {
        this.showMessage('Full: oldest note dropped', 4000)
      } else if (connectStatus()) {
        this.showMessage('Sending...', 0)
      } else {
        this.showMessage('Queued')
      }

      if (connectStatus()) {
        clearTimeout(this.state.feedbackTimer)
        this.state.feedbackId = dropped ? null : note.id
        this.state.feedbackTimer = setTimeout(() => this.failFeedback(), FEEDBACK_DEADLINE_MS)
        this.state.attempt = 0
      }
      this.flush()
    },

    // Sends queued notes one at a time, oldest first, so the Doc keeps tap order.
    flush() {
      if (this.state.flushing || this.state.destroyed) return
      this.clearRetry()
      const queue = loadQueue()
      this.refreshStatus(queue)
      if (!queue.length) return
      if (!connectStatus()) {
        this.onSendFailed('no_phone')
        return
      }

      const note = queue[0]
      this.state.flushing = true
      this.request({ method: 'note.send', params: note }, { timeout: REQUEST_TIMEOUT_MS })
        .then((res) => {
          this.state.flushing = false
          if (res && res.ok) {
            saveQueue(removeById(loadQueue(), note.id))
            this.state.attempt = 0
            this.state.lastError = null
            if (note.id === this.state.feedbackId) {
              this.clearFeedback()
              this.showMessage('Saved')
            }
            this.flush()
          } else {
            this.onSendFailed((res && res.error) || 'send_failed')
          }
        })
        .catch(() => {
          this.state.flushing = false
          this.onSendFailed('no_phone')
        })
    },

    onSendFailed(error) {
      if (this.state.destroyed) return
      this.state.lastError = error
      this.failFeedback()
      this.refreshStatus()
      const delay = retryDelayMs(this.state.attempt)
      this.state.attempt += 1
      this.state.retryTimer = setTimeout(() => {
        this.state.retryTimer = null
        this.flush()
      }, delay)
    },

    clearRetry() {
      if (this.state.retryTimer) {
        clearTimeout(this.state.retryTimer)
        this.state.retryTimer = null
      }
    },

    // The tapped note was not confirmed in time, or sending failed.
    failFeedback() {
      if (!this.state.feedbackId) return
      this.clearFeedback()
      this.showMessage(QUEUED_HINT[this.state.lastError] || 'Queued')
    },

    clearFeedback() {
      clearTimeout(this.state.feedbackTimer)
      this.state.feedbackTimer = null
      this.state.feedbackId = null
    },

    refreshStatus(queue = loadQueue()) {
      if (!this.state.statusText || this.state.destroyed) return
      const n = queue.length
      let line1 = n === 0 ? 'All sent' : n + ' queued'
      if (n >= QUEUE_CAP) line1 += ' (full)'
      const line2 = n && this.state.lastError ? ERROR_TEXT[this.state.lastError] || 'send failed' : ''
      this.state.statusText.setProperty(prop.TEXT, line2 ? line1 + '\n' + line2 : line1)
    },

    showMessage(text, ms = 2500) {
      // A send can finish after the page has closed; its widgets are gone by then.
      if (this.state.destroyed) return
      clearTimeout(this.state.messageTimer)
      this.state.messageText.setProperty(prop.TEXT, text)
      if (ms > 0) {
        this.state.messageTimer = setTimeout(() => {
          if (!this.state.destroyed) this.state.messageText.setProperty(prop.TEXT, '')
        }, ms)
      }
    },

    requestLabels() {
      if (!connectStatus()) return
      this.request({ method: 'config.get' }, { timeout: 10000 })
        .then((res) => res && res.labels && this.applyLabels(res.labels))
        .catch(() => {})
    },

    applyLabels(raw) {
      if (this.state.destroyed) return
      const labels = normalizeLabels(raw)
      saveLabels(labels)
      this.state.labels = labels
      this.state.buttons.forEach(({ button, geometry }, i) => {
        button.setProperty(prop.MORE, { ...geometry, text: labels[i] })
      })
    }
  })
)
