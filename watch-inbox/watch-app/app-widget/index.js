import { createWidget, widget, prop, getAppWidgetSize, setAppWidgetSize } from '@zos/ui'
import { push } from '@zos/router'
import { px } from '@zos/utils'
import { loadLabels } from '../utils/store'

// Shortcut card: swipe right from the watch face, tap a button. The tap opens
// the app page with that label, and the page saves, buzzes and sends the note.
// Cards can only respond to taps and cannot use Bluetooth, so the page does the work.

// Cards may be 20% to 60% of the screen height. 280 px stays just under 60% of 480.
const CARD_H = px(280)
const GAP = px(8)

AppWidget({
  state: {
    labels: [],
    buttons: []
  },

  build() {
    try {
      setAppWidgetSize({ h: CARD_H })
      const { w } = getAppWidgetSize()
      const btnW = Math.floor((w - GAP * 3) / 2)
      const btnH = Math.floor((CARD_H - GAP * 4) / 3)

      this.state.labels = loadLabels()
      this.state.labels.forEach((label, i) => {
        const geometry = {
          x: GAP + (i % 2) * (btnW + GAP),
          y: GAP + Math.floor(i / 2) * (btnH + GAP),
          w: btnW,
          h: btnH
        }
        const button = createWidget(widget.BUTTON, {
          ...geometry,
          radius: px(20),
          normal_color: 0x1f3a5f,
          press_color: 0x3d6fa8,
          color: 0xffffff,
          text_size: px(26),
          text: label,
          click_func: () => this.open(i)
        })
        this.state.buttons.push({ button, geometry })
      })
    } catch (e) {
      console.log('card build error', e)
    }
  },

  // Labels may have changed in the Zepp app since the card was built.
  onResume() {
    try {
      const labels = loadLabels()
      this.state.labels = labels
      this.state.buttons.forEach(({ button, geometry }, i) => {
        button.setProperty(prop.MORE, { ...geometry, text: labels[i] })
      })
    } catch (e) {
      console.log('card resume error', e)
    }
  },

  open(i) {
    push({ url: 'page/index', params: JSON.stringify({ label: this.state.labels[i] }) })
  }
})
