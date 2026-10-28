import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LABELS,
  enqueue,
  isoWithOffset,
  makeId,
  normalizeLabels,
  offsetMinutesFromTime,
  removeById,
  retryDelayMs
} from '../utils/notes.js'

test('ids start with 8 random characters and are unique across rapid taps', () => {
  const now = Date.UTC(2026, 0, 15)
  const ids = new Set()
  for (let i = 0; i < 2000; i++) ids.add(makeId(now))
  assert.equal(ids.size, 2000)
  for (const id of ids) assert.match(id, /^[0-9a-z]{8}-[0-9a-z]+$/)
})

test('isoWithOffset writes local wall-clock time with the offset', () => {
  const utc = Date.UTC(2026, 0, 15, 2, 5, 9)
  assert.equal(isoWithOffset(utc, -180), '2026-01-14T23:05:09-03:00')
  assert.equal(isoWithOffset(utc, 0), '2026-01-15T02:05:09+00:00')
  assert.equal(isoWithOffset(utc, 345), '2026-01-15T07:50:09+05:45')
})

test('offset is derived from the Time sensor and survives a second rolling over', () => {
  const utc = Date.UTC(2026, 0, 15, 17, 30, 59, 900)
  const local = new Date(utc - 180 * 60000 + 1000) // local fields read one second later
  const time = {
    getTime: () => utc,
    getFullYear: () => local.getUTCFullYear(),
    getMonth: () => local.getUTCMonth() + 1,
    getDate: () => local.getUTCDate(),
    getHours: () => local.getUTCHours(),
    getMinutes: () => local.getUTCMinutes(),
    getSeconds: () => local.getUTCSeconds()
  }
  assert.equal(offsetMinutesFromTime(time), -180)
})

test('enqueue drops only the oldest notes beyond the cap', () => {
  let q = []
  for (let i = 0; i < 3; i++) q = enqueue(q, { id: String(i) }, 3).queue
  const r = enqueue(q, { id: '3' }, 3)
  assert.equal(r.dropped, 1)
  assert.deepEqual(r.queue.map((n) => n.id), ['1', '2', '3'])
  assert.deepEqual(removeById(r.queue, '2').map((n) => n.id), ['1', '3'])
})

test('labels fall back to defaults when blank or missing', () => {
  assert.deepEqual(normalizeLabels(null), DEFAULT_LABELS)
  const l = normalizeLabels(['  Groceries  ', '', undefined, 'x'.repeat(60)])
  assert.equal(l[0], 'Groceries')
  assert.equal(l[1], DEFAULT_LABELS[1])
  assert.equal(l[2], DEFAULT_LABELS[2])
  assert.equal(l[3].length, 40)
  assert.equal(l.length, 6)
})

test('retry delays back off and cap at one minute', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(retryDelayMs), [5000, 15000, 30000, 60000, 60000])
})
