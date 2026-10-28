import { env } from './env.mjs'
export const VIBRATOR_SCENE_SHORT_STRONG = 3
export class Vibrator {
  start() {
    env.vibrations += 1
  }
}
// Local fields are derived from env.nowMs and env.offsetMinutes, like the watch clock.
export class Time {
  local() {
    return new Date(env.nowMs + env.offsetMinutes * 60000)
  }
  getTime() { return env.nowMs }
  getFullYear() { return this.local().getUTCFullYear() }
  getMonth() { return this.local().getUTCMonth() + 1 }
  getDate() { return this.local().getUTCDate() }
  getHours() { return this.local().getUTCHours() }
  getMinutes() { return this.local().getUTCMinutes() }
  getSeconds() { return this.local().getUTCSeconds() }
}
