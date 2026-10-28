import { env } from './env.mjs'
export class LocalStorage {
  getItem(k, d) { return env.storage.has(k) ? env.storage.get(k) : d }
  setItem(k, v) { env.storage.set(k, v) }
}
