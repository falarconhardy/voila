// Minimal ZML stand-in: page.request goes to the side service's onRequest over a
// "Bluetooth link" that fails when env.bleConnected is false.
import { env } from './env.mjs'

export function BasePage(opts) {
  return {
    ...opts,
    request(data, options = {}) {
      if (!env.bleConnected || !env.sideService) return Promise.reject(new Error('ble disconnect'))
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), options.timeout || 60000)
        env.sideService.onRequest(data, (err, res) => {
          clearTimeout(timer)
          if (!env.bleConnected) return reject(new Error('ble disconnect'))
          err ? reject(err) : resolve(res)
        })
      })
    }
  }
}

export function BaseSideService(opts) {
  return {
    ...opts,
    call(data) {
      if (!env.bleConnected) throw new Error('ble disconnect')
      env.calls.push(data)
      if (env.watchPage) env.watchPage.onCall(data)
    }
  }
}

export const settingsLib = {
  getItem: (k) => (env.settings.has(k) ? env.settings.get(k) : undefined),
  setItem: (k, v) => env.settings.set(k, v)
}
