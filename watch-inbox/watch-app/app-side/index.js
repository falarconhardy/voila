import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { LABEL_COUNT, makeNote, normalizeLabels } from '../utils/notes'
import { deliverNote } from '../utils/deliver'

// Settings keys written by the settings screen (setting/index.js).
const KEY_URL = 'receiverUrl'
const KEY_TOKEN = 'token'
const KEY_TEST_REQUEST = 'testRequest'
const KEY_TEST_RESULT = 'testResult'

const deps = {
  fetch: (opts) => fetch(opts),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

// URL and token never contain whitespace, but a pasted value can pick up spaces
// where a long line wrapped, so remove all of it, not just at the ends.
const noSpaces = (s) => String(s || '').replace(/\s+/g, '')

function readConfig() {
  return {
    url: noSpaces(settingsLib.getItem(KEY_URL)),
    token: noSpaces(settingsLib.getItem(KEY_TOKEN))
  }
}

function readLabels() {
  const raw = []
  for (let i = 0; i < LABEL_COUNT; i++) raw.push(settingsLib.getItem('label' + i))
  return normalizeLabels(raw)
}

function clockTime(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

AppSideService(
  BaseSideService({
    onInit() {},

    onRequest(req, res) {
      if (req.method === 'note.send') {
        // The watch removes the note from its queue only when this returns ok:true.
        deliverNote(readConfig(), req.params || {}, deps).then((result) => res(null, result))
      } else if (req.method === 'config.get') {
        res(null, { labels: readLabels() })
      } else {
        res(null, { ok: false, error: 'unknown_method' })
      }
    },

    onSettingsChange({ key, newValue }) {
      if (/^label\d$/.test(key)) {
        try {
          this.call({ method: 'labels.update', params: { labels: readLabels() } })
        } catch (e) {
          // Watch not connected. It asks for labels the next time the app opens.
        }
      } else if (key === KEY_TEST_REQUEST && newValue) {
        this.sendTestNote()
      }
    },

    sendTestNote() {
      settingsLib.setItem(KEY_TEST_RESULT, 'Sending test note...')
      const now = new Date()
      const note = makeNote('Test note', now.getTime(), -now.getTimezoneOffset())
      deliverNote(readConfig(), note, deps).then((result) => {
        settingsLib.setItem(
          KEY_TEST_RESULT,
          result.ok
            ? 'Test note sent at ' + clockTime(now) + '. Check the Doc.'
            : 'Test failed at ' + clockTime(now) + ': ' + result.error
        )
      })
    },

    onRun() {},

    onDestroy() {}
  })
)
