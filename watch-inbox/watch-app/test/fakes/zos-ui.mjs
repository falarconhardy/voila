import { env } from './env.mjs'
export const widget = { TEXT: 'TEXT', BUTTON: 'BUTTON' }
export const prop = { TEXT: 'text', MORE: 'more' }
export const align = { CENTER_H: 'center_h', CENTER_V: 'center_v' }
export const text_style = { WRAP: 'wrap', NONE: 'none' }
export function createWidget(type, params) {
  const w = {
    type,
    params: { ...params },
    setProperty(p, v) {
      if (p === prop.MORE) Object.assign(this.params, v)
      else this.params[p] = v
    }
  }
  env.widgets.push(w)
  return w
}
export function getAppWidgetSize() {
  return { w: 448, h: 240, margin: 16, radius: 36 }
}
export function setAppWidgetSize() {}
