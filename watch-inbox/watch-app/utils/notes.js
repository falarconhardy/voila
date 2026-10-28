// Pure helpers shared by the watch page, the shortcut card and the phone side.
// No @zos imports here, so the logic can be unit tested in Node.

export const DEFAULT_LABELS = ['Remind me', 'Trip idea', 'Hike done', 'Call back', 'Buy', 'Question']
export const LABEL_COUNT = DEFAULT_LABELS.length
export const QUEUE_CAP = 200
export const MAX_LABEL_LENGTH = 40

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'

// Random part first, so the "id <first 6>" shown in the Doc differs between notes.
export function makeId(nowMs, random = Math.random) {
  let r = ''
  for (let i = 0; i < 8; i++) r += ID_CHARS[Math.floor(random() * ID_CHARS.length)]
  return r + '-' + Math.floor(nowMs).toString(36)
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}

// Local wall-clock time with offset, for example "2026-01-15T14:30:05-03:00".
export function isoWithOffset(utcMs, offsetMinutes) {
  const d = new Date(utcMs + offsetMinutes * 60000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return (
    d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) +
    sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60)
  )
}

// Zepp OS has no time-zone API for apps, so the offset is derived from the
// Time sensor: its local date fields minus its UTC timestamp, rounded to 15 minutes.
export function offsetMinutesFromTime(time) {
  const utcMs = time.getTime()
  const localAsUtc = Date.UTC(
    time.getFullYear(),
    time.getMonth() - 1, // the sensor returns 1 to 12
    time.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds()
  )
  return Math.round((localAsUtc - utcMs) / 60000 / 15) * 15
}

export function makeNote(label, utcMs, offsetMinutes, random) {
  return { id: makeId(utcMs, random), ts: isoWithOffset(utcMs, offsetMinutes), label }
}

// Returns a new queue plus how many of the oldest notes were dropped to stay under the cap.
export function enqueue(queue, note, cap = QUEUE_CAP) {
  const next = queue.concat([note])
  const dropped = Math.max(0, next.length - cap)
  return { queue: dropped ? next.slice(dropped) : next, dropped }
}

export function removeById(queue, id) {
  return queue.filter((n) => n.id !== id)
}

// Blank or missing labels fall back to the defaults.
export function normalizeLabels(raw) {
  return DEFAULT_LABELS.map((def, i) => {
    const v = raw && typeof raw[i] === 'string' ? raw[i].replace(/\s+/g, ' ').trim() : ''
    return v ? v.slice(0, MAX_LABEL_LENGTH) : def
  })
}

// Retry delays while the app is open: 5 s, 15 s, 30 s, then every 60 s.
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000]
export function retryDelayMs(attempt) {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
}

export function parseJson(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}
