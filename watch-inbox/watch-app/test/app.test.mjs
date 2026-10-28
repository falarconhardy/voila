// Runs the real page, shortcut card, phone-side service and receiver (Code.gs)
// against fakes of the Zepp OS and Apps Script APIs. This checks the app's
// logic, not the Zepp runtime: the simulator and the watch are still needed.
//
// Run from watch-app/: npm test
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { env, resetEnv } from './fakes/env.mjs'
import { makeReceiver, TOKEN } from '../../receiver/test/apps-script-fake.mjs'

const captured = {}
globalThis.Page = (o) => (captured.page = o)
globalThis.AppSideService = (o) => (captured.side = o)
globalThis.AppWidget = (o) => (captured.card = o)
globalThis.AppSettingsPage = (o) => (captured.settings = o)
// Settings-screen components render to plain objects so the tree can be inspected.
for (const name of ['View', 'Section', 'TextInput', 'Button', 'Text']) {
  globalThis[name] = (props, children) => ({ name, props, children })
}
await import('../page/index.js')
await import('../app-side/index.js')
await import('../app-widget/index.js')
await import('../setting/index.js')

const RECEIVER_URL = 'https://script.google.com/macros/s/FAKE/exec'

let receiver
let net

// Fake Zepp fetch in front of the fake receiver. With redirect on, it answers
// like Apps Script: 302 to an echo URL that serves the JSON on GET.
function makeNet(rcv) {
  const state = { online: true, redirect: true, loseResponses: 0, posts: 0 }
  const echoes = new Map()
  state.fetch = async ({ url, method, body }) => {
    if (!state.online) throw new Error('network down')
    if (method === 'POST') {
      assert.equal(url, RECEIVER_URL)
      state.posts += 1
      const result = rcv.post(body)
      if (state.loseResponses > 0) {
        state.loseResponses -= 1
        throw new Error('connection reset')
      }
      if (!state.redirect) return { status: 200, headers: {}, body: JSON.stringify(result) }
      const key = 'e' + state.posts
      echoes.set(key, result)
      return {
        status: 302,
        headers: { Location: 'https://script.googleusercontent.com/macros/echo?k=' + key },
        body: '<html>Moved Temporarily</html>'
      }
    }
    const key = new URL(url).searchParams.get('k')
    return { status: 200, headers: {}, body: JSON.stringify(echoes.get(key)) }
  }
  return state
}

function newPage(params) {
  const page = { ...captured.page, state: structuredClone(captured.page.state) }
  env.watchPage = page
  page.onInit(params)
  page.build()
  return page
}

function newSide() {
  const side = { ...captured.side }
  side.onInit()
  env.sideService = side
  return side
}

// Lets timers fire and promise chains settle, in 250 ms steps of fake time.
async function run(ms) {
  for (let t = 0; t <= ms; t += 250) {
    mock.timers.tick(250)
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
  }
}

const buttons = () => env.widgets.filter((w) => w.type === 'BUTTON')
const texts = () => env.widgets.filter((w) => w.type === 'TEXT')
const statusLine = () => texts()[0].params.text
const messageLine = () => texts()[1].params.text
const queue = () => JSON.parse(env.storage.get('queue') || '[]')
const tap = (i) => buttons()[i].params.click_func()

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] })
  resetEnv()
  env.nowMs = Date.UTC(2026, 0, 15, 17, 30, 5)
  env.offsetMinutes = -180
  receiver = makeReceiver()
  net = makeNet(receiver)
  globalThis.fetch = net.fetch
  env.settings.set('receiverUrl', RECEIVER_URL)
  env.settings.set('token', TOKEN)
  newSide()
})

afterEach(() => {
  mock.timers.reset()
})

test('a tap buzzes, sends one line and shows Saved', async () => {
  newPage()
  tap(1)
  assert.equal(env.vibrations, 1)
  assert.equal(messageLine(), 'Sending...')
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.match(receiver.paragraphs[0], /^2026-01-15 14:30 \(UTC-03:00\) · Trip idea · id [0-9a-z]{6}$/)
  assert.deepEqual(queue(), [])
  assert.equal(messageLine(), 'Saved')
  assert.equal(statusLine(), 'All sent')
})

test('also works when fetch follows the redirect itself', async () => {
  net.redirect = false
  newPage()
  tap(0)
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.deepEqual(queue(), [])
})

test('spaces pasted into the URL or token, where a long line wrapped, are ignored', async () => {
  env.settings.set('receiverUrl', ' ' + RECEIVER_URL.slice(0, 30) + '\n        ' + RECEIVER_URL.slice(30) + ' ')
  env.settings.set('token', TOKEN.slice(0, 4) + ' ' + TOKEN.slice(4))
  newPage()
  tap(1)
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.deepEqual(queue(), [])
  assert.equal(messageLine(), 'Saved')
})

test('phone offline (Bluetooth off): three notes queue, then send in order on reconnect', async () => {
  env.bleConnected = false
  const page = newPage()
  tap(0)
  env.nowMs += 60000
  tap(1)
  env.nowMs += 60000
  tap(2)
  assert.equal(messageLine(), 'Queued')
  await run(30000)
  assert.equal(receiver.paragraphs.length, 0)
  assert.equal(queue().length, 3)
  assert.equal(statusLine(), '3 queued\nphone not connected')

  env.bleConnected = true
  page.onBleChanged()
  await run(2000)
  assert.deepEqual(
    receiver.paragraphs.map((p) => p.split(' · ').slice(0, 2).join(' | ')),
    ['2026-01-15 14:30 (UTC-03:00) | Remind me', '2026-01-15 14:31 (UTC-03:00) | Trip idea', '2026-01-15 14:32 (UTC-03:00) | Hike done']
  )
  assert.deepEqual(queue(), [])
  assert.equal(statusLine(), 'All sent')
})

test('internet down on the phone: notes queue, then send when the retry timer fires', async () => {
  net.online = false
  newPage()
  tap(0)
  tap(1)
  await run(9000)
  assert.equal(messageLine(), '')
  assert.equal(receiver.paragraphs.length, 0)
  assert.equal(queue().length, 2)

  net.online = true
  await run(70000)
  assert.equal(receiver.paragraphs.length, 2)
  assert.deepEqual(queue(), [])
})

test('the queue survives an app restart and sends on next open', async () => {
  env.bleConnected = false
  newPage()
  tap(3)
  tap(4)
  assert.equal(queue().length, 2)
  env.bleConnected = true
  newPage() // reopening the app
  await run(2000)
  assert.equal(receiver.paragraphs.length, 2)
  assert.deepEqual(queue(), [])
})

test('a resent note (lost response) is not duplicated in the Doc', async () => {
  net.loseResponses = 1
  newPage()
  tap(5)
  await run(10000)
  assert.equal(net.posts, 2)
  assert.equal(receiver.paragraphs.length, 1)
  assert.deepEqual(queue(), [])
})

test('a wrong token is rejected, the note stays queued, and sends once the token is fixed', async () => {
  env.settings.set('token', 'wrong-token')
  newPage()
  tap(0)
  await run(1000)
  assert.equal(receiver.paragraphs.length, 0)
  assert.equal(net.posts, 1) // no pointless retries on the phone for a wrong token
  assert.equal(queue().length, 1)
  assert.equal(messageLine(), 'Queued: check token')
  assert.equal(statusLine(), '1 queued\nwrong token')

  env.settings.set('token', TOKEN)
  await run(10000)
  assert.equal(receiver.paragraphs.length, 1)
  assert.deepEqual(queue(), [])
})

test('missing receiver settings keep notes queued with a hint', async () => {
  env.settings.delete('receiverUrl')
  newPage()
  tap(0)
  await run(1000)
  assert.equal(net.posts, 0)
  assert.equal(queue().length, 1)
  assert.equal(messageLine(), 'Queued: set up phone')
})

test('the queue is capped at 200, dropping the oldest and saying so', async () => {
  env.bleConnected = false
  newPage()
  for (let i = 0; i < 200; i++) tap(0)
  const first = queue()[0].id
  tap(1)
  assert.equal(queue().length, 200)
  assert.notEqual(queue()[0].id, first)
  assert.equal(queue()[199].label, 'Trip idea')
  assert.equal(messageLine(), 'Full: oldest note dropped')
  assert.match(statusLine(), /^200 queued \(full\)/)
})

test('labels edited in the Zepp app reach the watch buttons and the card', async () => {
  const page = newPage()
  env.settings.set('label1', 'Groceries')
  captured.side.onSettingsChange.call(env.sideService, { key: 'label1', newValue: 'Groceries' })
  assert.equal(buttons()[1].params.text, 'Groceries')
  assert.equal(page.state.labels[1], 'Groceries')

  env.widgets = []
  const card = { ...captured.card, state: structuredClone(captured.card.state) }
  card.build()
  assert.deepEqual(
    buttons().map((b) => b.params.text),
    ['Remind me', 'Groceries', 'Hike done', 'Call back', 'Buy', 'Question']
  )
  // Every card button sits inside the card.
  for (const b of buttons()) {
    assert.ok(b.params.x >= 0 && b.params.x + b.params.w <= 448)
    assert.ok(b.params.y >= 0 && b.params.y + b.params.h <= 280)
  }
})

test('a card tap opens the page, which logs that label', async () => {
  const card = { ...captured.card, state: structuredClone(captured.card.state) }
  card.build()
  buttons()[2].params.click_func()
  assert.equal(env.pushes.length, 1)
  assert.equal(env.pushes[0].url, 'page/index')

  env.widgets = []
  newPage(env.pushes[0].params)
  assert.equal(env.vibrations, 1)
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.match(receiver.paragraphs[0], /· Hike done ·/)
})

test('watch time and offset are used, including a positive offset', async () => {
  env.offsetMinutes = 330
  env.nowMs = Date.UTC(2026, 5, 30, 20, 0, 0)
  newPage()
  tap(0)
  await run(500)
  assert.match(receiver.paragraphs[0], /^2026-07-01 01:30 \(UTC\+05:30\)/)
})

test('Send test note in settings posts a note and reports the result', async () => {
  captured.side.onSettingsChange.call(env.sideService, { key: 'testRequest', newValue: '1' })
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.match(receiver.paragraphs[0], /· Test note ·/)
  assert.match(env.settings.get('testResult'), /^Test note sent at \d{2}:\d{2}\. Check the Doc\.$/)

  env.settings.set('token', 'nope')
  captured.side.onSettingsChange.call(env.sideService, { key: 'testRequest', newValue: '2' })
  await run(500)
  assert.match(env.settings.get('testResult'), /^Test failed at \d{2}:\d{2}: unauthorized$/)
})

test('the page lays out six buttons inside the round screen', () => {
  newPage()
  assert.equal(buttons().length, 6)
  const r = 240
  for (const w of env.widgets) {
    const { x, y, w: width, h } = w.params
    // Check the corners, inset by the pill radius for buttons.
    const inset = w.type === 'BUTTON' ? h / 2 : 0
    for (const [cx, cy] of [[x + inset, y], [x + width - inset, y], [x + inset, y + h], [x + width - inset, y + h]]) {
      assert.ok(Math.hypot(cx - r, cy - r) <= r, `${w.type} "${w.params.text}" corner (${cx}, ${cy}) is off screen`)
    }
  }
})

test('the settings screen edits the keys the phone side reads', () => {
  const settingsStorage = {
    getItem: (k) => env.settings.get(k),
    setItem: (k, v) => env.settings.set(k, v)
  }
  const page = { ...captured.settings, state: structuredClone(captured.settings.state) }
  const tree = page.build({ settingsStorage })
  const flat = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    flat.push(n)
    ;[].concat(n.children || []).forEach(walk)
  }
  walk(tree)
  const inputs = flat.filter((n) => n.name === 'TextInput')
  assert.deepEqual(inputs.map((n) => n.props.label), ['Receiver URL', 'Token', 'Button 1', 'Button 2', 'Button 3', 'Button 4', 'Button 5', 'Button 6'])
  assert.equal(inputs[0].props.value, RECEIVER_URL)
  inputs[1].props.onChange('  new-token  ')
  assert.equal(env.settings.get('token'), 'new-token')
  inputs[7].props.onChange('Podcast')
  assert.equal(env.settings.get('label5'), 'Podcast')
  flat.find((n) => n.name === 'Button').props.onClick()
  assert.ok(env.settings.get('testRequest'))
})

test('closing the app mid-send still clears the confirmed note and touches no widgets', async () => {
  const page = newPage()
  tap(0)
  page.onDestroy()
  const before = env.widgets.map((w) => w.params.text)
  await run(500)
  assert.equal(receiver.paragraphs.length, 1)
  assert.deepEqual(queue(), [])
  assert.deepEqual(env.widgets.map((w) => w.params.text), before)
})
