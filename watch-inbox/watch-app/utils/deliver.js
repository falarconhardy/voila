// Phone-side delivery to the receiver. Takes fetch and sleep as arguments so it
// can be tested in Node with a fake receiver.

const ATTEMPT_DELAYS_MS = [0, 2000, 4000]
const ATTEMPT_TIMEOUT_MS = 12000
// The receiver answered and the problem will not fix itself by retrying.
const FINAL_ERRORS = ['unauthorized', 'bad_request', 'bad_json']

function parseBody(body) {
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch (e) {
    return null
  }
}

function header(headers, name) {
  if (!headers) return undefined
  return headers[name] || headers[name.toLowerCase()] || headers[name.charAt(0).toUpperCase() + name.slice(1)]
}

function withTimeout(promise, ms, deps) {
  return new Promise((resolve, reject) => {
    const timer = deps.setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        deps.clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        deps.clearTimeout(timer)
        reject(e)
      }
    )
  })
}

// Apps Script answers a POST with a redirect to the actual response. If the
// Zepp fetch does not follow it, follow it here with a GET.
async function postOnce(url, payload, deps) {
  const res = await withTimeout(
    deps.fetch({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    ATTEMPT_TIMEOUT_MS,
    deps
  )
  let status = res && res.status
  let data = parseBody(res && res.body)
  const location = header(res && res.headers, 'location')
  if (status >= 300 && status < 400 && location) {
    const res2 = await withTimeout(deps.fetch({ url: location, method: 'GET' }), ATTEMPT_TIMEOUT_MS, deps)
    status = res2 && res2.status
    data = parseBody(res2 && res2.body)
  }
  if (data && typeof data.ok === 'boolean') return data
  return { ok: false, error: 'http_' + (status === undefined ? 'unknown' : status) }
}

export function checkConfig(url, token) {
  if (!url || !token) return 'not_configured'
  if (!/^https:\/\//i.test(url)) return 'url_not_https'
  return null
}

// Returns {ok:true} once the receiver confirms (including a duplicate), otherwise
// {ok:false, error}. Never throws.
export async function deliverNote(config, note, deps) {
  const configError = checkConfig(config.url, config.token)
  if (configError) return { ok: false, error: configError }
  const payload = { token: config.token, id: note.id, ts: note.ts, label: note.label }
  let last = { ok: false, error: 'not_sent' }
  for (let i = 0; i < ATTEMPT_DELAYS_MS.length; i++) {
    if (ATTEMPT_DELAYS_MS[i]) await deps.sleep(ATTEMPT_DELAYS_MS[i])
    try {
      last = await postOnce(config.url, payload, deps)
    } catch (e) {
      last = { ok: false, error: (e && e.message) || 'network_error' }
    }
    if (last.ok || FINAL_ERRORS.indexOf(last.error) !== -1) return last
  }
  return last
}
