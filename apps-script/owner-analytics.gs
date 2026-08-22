/*******************************************************************************
 * OWNER ANALYTICS — additive module for the Screenshot Library Apps Script
 * -----------------------------------------------------------------------------
 * Purpose: an "Owner" tab in the tracking spreadsheet showing how many times
 * each screenshot Owner's content has been used by agents.
 *
 * Design: it JOINS the click log (DB_Logs) to the live catalog by screenshot
 * title, reading the `owner` field from the published data.json. This means it
 * works on ALL existing history (no need to change the client or wait for new
 * clicks), and needs no change to how DB_Logs is written.
 *
 * HOW TO INSTALL (mirrors the v8.3 request/survey setup):
 *   1. Open the bound Apps Script project for the tracking spreadsheet
 *      (Extensions → Apps Script).
 *   2. Paste this whole file in as a new script file (e.g. "OwnerAnalytics.gs")
 *      or append it to Code.gs.
 *   3. In your existing doGet(e), add this near the top (before other branches):
 *
 *        if (e.parameter.getOwnerStats) {
 *          return ContentService
 *            .createTextOutput(JSON.stringify(rebuildOwnerStats()))
 *            .setMimeType(ContentService.MimeType.JSON);
 *        }
 *
 *   4. Run createOwnerSheetNow() once (authorize when prompted) to create and
 *      fill the "Owner" tab.
 *   5. Deploy → Manage Deployments → ✏️ → New Version → Deploy  (a plain save
 *      does NOT update the live Web App URL).
 *   6. Verify: open the Web App URL with ?getOwnerStats=true — it should return
 *      a JSON array, and the "Owner" tab should be populated.
 *
 * Optional: run installOwnerDailyTrigger() once to auto-refresh the tab daily.
 ******************************************************************************/

// Published catalog (same file the app loads). Change if your Pages URL differs.
var OWNER_DATA_URL = 'https://gorkemtikic.github.io/screenshot-library/data.json';

// Sheet names.
var OWNER_SHEET   = 'Owner';
var OWNER_LOGS_SHEET = 'DB_Logs';

// Which logged events count as "using" a screenshot.
var OWNER_USAGE_EVENTS = [
  'copy_text', 'view_image', 'preview_text', 'switch_lang',
  'favorite_add', 'right_click_image'
];

/** Build a { title -> owner } map from the live catalog. */
function _ownerMap_() {
  var res = UrlFetchApp.fetch(OWNER_DATA_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Could not fetch catalog (' + res.getResponseCode() + ') from ' + OWNER_DATA_URL);
  }
  var data = JSON.parse(res.getContentText());
  var map = {};
  (data || []).forEach(function (it) {
    if (it && it.title && it.owner) {
      map[String(it.title).trim()] = String(it.owner).trim();
    }
  });
  return map;
}

/** Case-insensitive header lookup; returns first matching column index or -1. */
function _ownerCol_(header, names) {
  var lower = header.map(function (h) { return String(h).trim().toLowerCase(); });
  for (var i = 0; i < names.length; i++) {
    var idx = lower.indexOf(String(names[i]).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Scan DB_Logs, attribute each usage event to the screenshot's Owner, and
 * (re)write the "Owner" tab. Returns the aggregated rows (also used by the API).
 */
function rebuildOwnerStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logs = ss.getSheetByName(OWNER_LOGS_SHEET);
  if (!logs) throw new Error('Sheet "' + OWNER_LOGS_SHEET + '" not found');

  var values = logs.getDataRange().getValues();
  if (values.length < 2) { _writeOwnerSheet_([]); return []; }

  var header = values[0];
  var cEvent = _ownerCol_(header, ['event', 'event_type', 'type']);
  var cTitle = _ownerCol_(header, ['title', 'screenshot', 'name']);
  var cHash  = _ownerCol_(header, ['hash', 'deviceHash', 'device_hash', 'device', 'uid', 'device_id']);
  var cTime  = _ownerCol_(header, ['timestamp', 'time', 'date', 'datetime', 'created', 'createdAt']);
  if (cEvent < 0 || cTitle < 0) {
    throw new Error('DB_Logs needs at least "event" and "title" columns (found headers: ' + header.join(', ') + ')');
  }

  var map = _ownerMap_();
  var agg = {}; // owner -> stats

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var ev = String(row[cEvent] || '').trim();
    if (OWNER_USAGE_EVENTS.indexOf(ev) < 0) continue;

    var title = String(row[cTitle] || '').trim();
    var owner = map[title];
    if (!owner) continue; // screenshot has no Owner, or title no longer in catalog

    var a = agg[owner] || (agg[owner] = {
      owner: owner, total: 0, copies: 0, views: 0,
      titles: {}, agents: {}, last: ''
    });
    a.total++;
    if (ev === 'copy_text') a.copies++;
    if (ev === 'view_image') a.views++;
    a.titles[title] = (a.titles[title] || 0) + 1;
    if (cHash >= 0) { var h = String(row[cHash] || '').trim(); if (h) a.agents[h] = 1; }
    if (cTime >= 0 && row[cTime]) {
      var t = row[cTime];
      var ts = (t instanceof Date) ? t.toISOString() : String(t);
      if (ts > a.last) a.last = ts;
    }
  }

  var rows = Object.keys(agg).map(function (o) {
    var a = agg[o];
    return {
      owner: a.owner,
      total: a.total,
      copies: a.copies,
      views: a.views,
      screenshots: Object.keys(a.titles).length,
      agents: Object.keys(a.agents).length,
      last: a.last
    };
  }).sort(function (x, y) { return y.total - x.total; });

  _writeOwnerSheet_(rows);
  return rows;
}

/** Write the aggregated rows into the "Owner" tab. */
function _writeOwnerSheet_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(OWNER_SHEET) || ss.insertSheet(OWNER_SHEET);
  sh.clear();

  var header = ['Owner', 'Total Uses', 'Copies', 'Views', 'Screenshots Used', 'Distinct Agents', 'Last Used (UTC)', 'Refreshed (UTC)'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');

  var now = new Date().toISOString();
  if (rows.length) {
    var body = rows.map(function (r) {
      return [r.owner, r.total, r.copies, r.views, r.screenshots, r.agents, r.last, now];
    });
    sh.getRange(2, 1, body.length, header.length).setValues(body);
  }
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
}

/** One-time: create + fill the Owner tab. */
function createOwnerSheetNow() {
  return rebuildOwnerStats();
}

/** Optional: refresh the Owner tab automatically once a day. */
function installOwnerDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rebuildOwnerStats') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rebuildOwnerStats').timeBased().everyDays(1).atHour(1).create();
}
