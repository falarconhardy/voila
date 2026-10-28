// Receiver tests. Run with: node --test receiver/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeReceiver, TOKEN } from './apps-script-fake.mjs'

const note = (over = {}) => ({
  token: TOKEN,
  id: 'k3j9x0qa-lzq1x2c4',
  ts: '2026-01-15T14:30:05-03:00',
  label: 'Trip idea',
  ...over
})

test('a valid note appends one line in the agreed format', () => {
  const r = makeReceiver()
  assert.deepEqual(r.post(note()), { ok: true })
  assert.deepEqual(r.paragraphs, ['2026-01-15 14:30 (UTC-03:00) · Trip idea · id k3j9x0'])
  assert.equal(r.isLocked(), false)
})

test('a duplicate id is ignored', () => {
  const r = makeReceiver()
  r.post(note())
  assert.deepEqual(r.post(note()), { ok: true, duplicate: true })
  assert.equal(r.paragraphs.length, 1)
  assert.equal(r.isLocked(), false)
})

test('a wrong token is rejected and nothing is appended', () => {
  const r = makeReceiver()
  assert.deepEqual(r.post(note({ token: 'wrong' })), { ok: false, error: 'unauthorized' })
  assert.deepEqual(r.post(note({ token: undefined })), { ok: false, error: 'unauthorized' })
  assert.equal(r.paragraphs.length, 0)
})

test('requests are rejected when no TOKEN property is set', () => {
  const r = makeReceiver({ token: null })
  assert.deepEqual(r.post(note()), { ok: false, error: 'unauthorized' })
  assert.equal(r.paragraphs.length, 0)
})

test('malformed bodies are rejected', () => {
  const r = makeReceiver()
  assert.equal(r.post('not json').error, 'bad_json')
  assert.equal(r.post(note({ id: 'a,b' })).error, 'bad_request')
  assert.equal(r.post(note({ label: '   ' })).error, 'bad_request')
  assert.equal(r.post(note({ ts: '15/01/2026' })).error, 'bad_request')
  assert.equal(r.paragraphs.length, 0)
})

test('UTC and positive offsets format correctly', () => {
  const r = makeReceiver()
  r.post(note({ id: 'aaaaaa-1', ts: '2026-06-01T08:05:00Z' }))
  r.post(note({ id: 'bbbbbb-2', ts: '2026-06-01T08:05:00+05:30' }))
  assert.deepEqual(r.paragraphs, [
    '2026-06-01 08:05 (UTC+00:00) · Trip idea · id aaaaaa',
    '2026-06-01 08:05 (UTC+05:30) · Trip idea · id bbbbbb'
  ])
})

test('only the last 500 ids are remembered, oldest dropped first', () => {
  const r = makeReceiver()
  for (let i = 0; i < 501; i++) {
    assert.equal(r.post(note({ id: 'n' + String(i).padStart(5, '0') + '-xxxxxxxxxxxxxxxx' })).ok, true)
  }
  assert.equal(r.paragraphs.length, 501)
  // id 0 has rotated out, so it is accepted again; id 1 is still remembered.
  assert.deepEqual(r.post(note({ id: 'n00001-xxxxxxxxxxxxxxxx' })), { ok: true, duplicate: true })
  assert.deepEqual(r.post(note({ id: 'n00000-xxxxxxxxxxxxxxxx' })), { ok: true })
  const total = [0, 1, 2, 3, 4].reduce((n, i) => n + r.store.get('SEEN_' + i).split(',').length, 0)
  assert.equal(total, 500)
})

test('64-character ids still fit the property size limit when the list is full', () => {
  const r = makeReceiver()
  for (let i = 0; i < 500; i++) {
    const id = String(i).padStart(6, '0') + 'x'.repeat(58)
    assert.equal(r.post(note({ id })).ok, true)
  }
})
