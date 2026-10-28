/**
 * @OnlyCurrentDoc
 *
 * Watch Inbox receiver.
 *
 * Bound to the "Watch Inbox" Google Doc and deployed as a web app.
 * Accepts POST bodies of the form {token, id, ts, label} and appends
 * one paragraph per note to the end of the Doc:
 *
 *   YYYY-MM-DD HH:MM (UTC-03:00) · <label> · id <first 6 characters>
 *
 * Script Properties used:
 *   TOKEN     required, the shared secret (set it in Project Settings)
 *   SEEN_0..4 managed by this script, the last 500 note ids
 *
 * @OnlyCurrentDoc limits the script's access to the Doc it is bound to.
 */

var MAX_IDS = 500;
var IDS_PER_CHUNK = 100;
var CHUNK_COUNT = MAX_IDS / IDS_PER_CHUNK;
var SEP = ' · '; // " · "
var ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
var MAX_LABEL_LENGTH = 100;
var LOCK_WAIT_MS = 20000;

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return respond_({ ok: false, error: 'bad_json' });
  }
  if (!body || typeof body !== 'object') {
    return respond_({ ok: false, error: 'bad_json' });
  }

  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty('TOKEN');
  if (!expected || typeof body.token !== 'string' || !safeEqual_(body.token, expected)) {
    return respond_({ ok: false, error: 'unauthorized' });
  }

  var id = typeof body.id === 'string' ? body.id : '';
  var label = typeof body.label === 'string' ? body.label.replace(/\s+/g, ' ').trim() : '';
  var when = formatTimestamp_(body.ts);
  if (!ID_PATTERN.test(id) || !label || label.length > MAX_LABEL_LENGTH || !when) {
    return respond_({ ok: false, error: 'bad_request' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (err) {
    return respond_({ ok: false, error: 'busy' });
  }
  try {
    var ids = loadIds_(props);
    if (ids.indexOf(id) !== -1) {
      return respond_({ ok: true, duplicate: true });
    }
    var doc = DocumentApp.getActiveDocument();
    doc.getBody().appendParagraph(when + SEP + label + SEP + 'id ' + id.slice(0, 6));
    // Flush the Doc while we still hold the lock, so concurrent posts keep their order.
    doc.saveAndClose();
    ids.push(id);
    saveIds_(props, ids.slice(-MAX_IDS));
    return respond_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// Compares without returning early, so response time does not leak how much of the token matched.
function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * The watch sends ts as local time with its UTC offset, for example
 * "2026-01-15T14:30:05-03:00". The Doc shows that wall-clock time as is.
 * A plain number (milliseconds since epoch) is also accepted and shown in
 * the script's time zone.
 */
function formatTimestamp_(ts) {
  if (typeof ts === 'string') {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(ts);
    if (!m) return null;
    var zone = m[6] === 'Z' ? '+00:00' : m[6];
    return m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ' (UTC' + zone + ')';
  }
  if (typeof ts === 'number' && isFinite(ts) && ts > 0) {
    var tz = Session.getScriptTimeZone();
    return Utilities.formatDate(new Date(ts), tz, 'yyyy-MM-dd HH:mm') + ' (' + tz + ')';
  }
  return null;
}

// Ids are kept in 5 properties of up to 100 ids each, to stay well under the per-value size limit.
function loadIds_(props) {
  var ids = [];
  for (var i = 0; i < CHUNK_COUNT; i++) {
    var chunk = props.getProperty('SEEN_' + i);
    if (chunk) ids = ids.concat(chunk.split(','));
  }
  return ids;
}

function saveIds_(props, ids) {
  var update = {};
  for (var i = 0; i < CHUNK_COUNT; i++) {
    var chunk = ids.slice(i * IDS_PER_CHUNK, (i + 1) * IDS_PER_CHUNK);
    if (chunk.length) {
      update['SEEN_' + i] = chunk.join(',');
    } else {
      props.deleteProperty('SEEN_' + i);
    }
  }
  props.setProperties(update);
}
