import { LocalStorage } from '@zos/storage'
import { DEFAULT_LABELS, normalizeLabels, parseJson } from './notes'

// Watch-side persistent state. A fresh LocalStorage instance is created on each
// read, because the page and the shortcut card each keep their own in-memory copy.
const KEY_QUEUE = 'queue'
const KEY_LABELS = 'labels'

function storage() {
  return new LocalStorage()
}

export function loadQueue() {
  const q = parseJson(storage().getItem(KEY_QUEUE), [])
  return Array.isArray(q) ? q : []
}

export function saveQueue(queue) {
  storage().setItem(KEY_QUEUE, JSON.stringify(queue))
}

export function loadLabels() {
  return normalizeLabels(parseJson(storage().getItem(KEY_LABELS), DEFAULT_LABELS))
}

export function saveLabels(labels) {
  storage().setItem(KEY_LABELS, JSON.stringify(normalizeLabels(labels)))
}
