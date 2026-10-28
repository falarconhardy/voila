// Runs Code.gs in a Node vm with stand-ins for the Apps Script services it uses.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const SOURCE = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8')
export const TOKEN = 'test-token-123'

export function makeReceiver({ token = TOKEN } = {}) {
  const store = new Map()
  if (token !== null) store.set('TOKEN', token)
  const paragraphs = []
  let lockHeld = false
  const props = {
    getProperty: (k) => (store.has(k) ? store.get(k) : null),
    setProperties: (obj) => {
      for (const [k, v] of Object.entries(obj)) {
        // Assumes the 9 KB per-value Script Properties limit from Google's quotas page (not re-checked here).
        if (v.length > 9 * 1024) throw new Error('property value too large: ' + k)
        store.set(k, v)
      }
    },
    deleteProperty: (k) => store.delete(k)
  }
  const doc = {
    getBody: () => ({ appendParagraph: (t) => paragraphs.push(t) }),
    saveAndClose: () => {}
  }
  const sandbox = {
    PropertiesService: { getScriptProperties: () => props },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          if (lockHeld) throw new Error('lock busy')
          lockHeld = true
        },
        releaseLock: () => {
          lockHeld = false
        }
      })
    },
    DocumentApp: { getActiveDocument: () => doc, openById: () => doc },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ setMimeType: () => ({ body: s }) })
    },
    Session: { getScriptTimeZone: () => 'America/Santiago' },
    Utilities: { formatDate: () => '2026-01-15 14:30' }
  }
  vm.createContext(sandbox)
  vm.runInContext(SOURCE, sandbox)
  const post = (obj) => {
    const raw = typeof obj === 'string' ? obj : JSON.stringify(obj)
    return JSON.parse(sandbox.doPost({ postData: { contents: raw, type: 'application/json' } }).body)
  }
  return { post, paragraphs, store, isLocked: () => lockHeld }
}

