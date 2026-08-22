/*******************************************************************************
 * OWNER ANALYTICS — additive module for the Screenshot Library Apps Script
 * -----------------------------------------------------------------------------
 * Purpose: an "Owner" tab in the tracking spreadsheet showing how many times
 * each screenshot Owner's content has been used by agents.
 *
 * Design: it JOINS the click log (DB_Logs) to the live catalog by screenshot
 * title, reading `owner` + `ownerSince` from the published data.json. Each click
 * is counted toward the screenshot's owner only if it was logged on/after that
 * screenshot's ownerSince date ("since ownership"; entries without ownerSince
 * count all-time). Needs no client change and no change to how DB_Logs is written.
 * Produces two tabs: "Owner" (summary) and "Owner Details" (per screenshot).
 *
 * HOW TO INSTALL (mirrors the v8.3 request/survey setup):
 *   1. Open the bound Apps Script project for the tracking spreadsheet
 *      (Extensions → Apps Script).
 *   2. Paste this whole file in as a new script file (e.g. "OwnerAnalytics.gs")
 *      or append it to Code.gs.
 *   3. In your existing doGet(e), add this as the VERY FIRST lines inside the
 *      function — it MUST come before the code that logs events / returns
 *      "Ignored (...)", otherwise the dashboard gets that text instead of JSON:
 *
 *        function doGet(e) {
 *          if (e && e.parameter && e.parameter.getOwnerStats) {
 *            return ContentService
 *              .createTextOutput(JSON.stringify(rebuildOwnerStats()))
 *              .setMimeType(ContentService.MimeType.JSON);
 *          }
 *          // ...your existing getStats / getRequests / getSurvey / logging code...
 *        }
 *
 *   4. Run createOwnerSheetNow() once (authorize when prompted) to create and
 *      fill the "Owner" and "Owner Details" tabs.
 *   5. Run installOwnerLiveTrigger() once so the tabs auto-refresh every 5 min.
 *   6. Deploy → Manage Deployments → ✏️ → New Version → Deploy  (a plain save
 *      does NOT update the live Web App URL).
 *   7. Verify: open the Web App URL with ?getOwnerStats=true — it should return
 *      a JSON array (not the text "Ignored ..."), and both tabs should populate.
 *
 * Auto-refresh: installOwnerLiveTrigger() rebuilds every 5 minutes; each
 * dashboard open/refresh rebuilds instantly. (Apps Script cannot run on every
 * single click, so "live" = every 5 min + on dashboard view.)
 ******************************************************************************/

// Published catalog (same file the app loads). Change if your Pages URL differs.
var OWNER_DATA_URL = 'https://gorkemtikic.github.io/screenshot-library/data.json';

// Sheet names.
var OWNER_SHEET         = 'Owner';          // per-owner summary
var OWNER_DETAILS_SHEET = 'Owner Details';  // per-owner × per-screenshot breakdown
var OWNER_LOGS_SHEET    = 'DB_Logs';

// Which logged events count as "using" a screenshot.
var OWNER_USAGE_EVENTS = [
  'copy_text', 'view_image', 'preview_text', 'switch_lang',
  'favorite_add', 'right_click_image'
];

/**
 * Build a { title -> { owner, since } } map from the live catalog.
 * `since` is the epoch-ms of the screenshot's ownerSince date (when the owner
 * took it over), or null if not set. Clicks logged before `since` are NOT counted
 * toward that owner ("since ownership" model).
 */
function _ownerMap_() {
  var res = UrlFetchApp.fetch(OWNER_DATA_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('Could not fetch catalog (' + res.getResponseCode() + ') from ' + OWNER_DATA_URL);
  }
  var data = JSON.parse(res.getContentText());
  var map = {};
  (data || []).forEach(function (it) {
    if (it && it.title && it.owner) {
      map[String(it.title).trim()] = {
        owner: String(it.owner).trim(),
        since: _toMs_(it.ownerSince)  // null when ownerSince absent -> count all-time
      };
    }
  });
  return map;
}

/** Best-effort parse of a cell/date value into epoch-ms; null if not parseable. */
function _toMs_(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v > 1e11 ? v : null; // epoch-ms only; ignore sheet serials
  var s = String(v).trim();
  // Plain YYYY-MM-DD -> treat as UTC midnight so the whole day counts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = s + 'T00:00:00Z';
  var t = Date.parse(s);
  return isNaN(t) ? null : t;
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
    var info = map[title];
    if (!info) continue; // screenshot has no Owner, or title no longer in catalog
    var owner = info.owner;

    // "Since ownership": if this screenshot has an ownerSince date, only count
    // clicks logged on/after it. Rows we cannot time-stamp are skipped when a
    // cutoff exists (conservative); with no cutoff, everything counts.
    var rowMs = (cTime >= 0) ? _toMs_(row[cTime]) : null;
    if (info.since != null) {
      if (rowMs == null || rowMs < info.since) continue;
    }

    var iso = (rowMs != null) ? new Date(rowMs).toISOString() : '';
    var h = (cHash >= 0) ? String(row[cHash] || '').trim() : '';

    var a = agg[owner] || (agg[owner] = {
      owner: owner, total: 0, copies: 0, views: 0,
      titles: {}, agents: {}, last: ''
    });
    a.total++;
    if (ev === 'copy_text') a.copies++;
    if (ev === 'view_image') a.views++;
    if (h) a.agents[h] = 1;
    if (iso > a.last) a.last = iso;

    // per-screenshot detail
    var ti = a.titles[title] || (a.titles[title] = {
      title: title, total: 0, copies: 0, views: 0, agents: {}, last: ''
    });
    ti.total++;
    if (ev === 'copy_text') ti.copies++;
    if (ev === 'view_image') ti.views++;
    if (h) ti.agents[h] = 1;
    if (iso > ti.last) ti.last = iso;
  }

  var rows = Object.keys(agg).map(function (o) {
    var a = agg[o];
    var items = Object.keys(a.titles).map(function (t) {
      var ti = a.titles[t];
      return {
        title: ti.title,
        total: ti.total,
        copies: ti.copies,
        views: ti.views,
        agents: Object.keys(ti.agents).length,
        last: ti.last
      };
    }).sort(function (x, y) { return y.total - x.total; });

    return {
      owner: a.owner,
      total: a.total,
      copies: a.copies,
      views: a.views,
      screenshots: items.length,
      agents: Object.keys(a.agents).length,
      last: a.last,
      items: items
    };
  }).sort(function (x, y) { return y.total - x.total; });

  _writeOwnerSheet_(rows);
  _writeOwnerDetailsSheet_(rows);
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

/** Write the per-screenshot breakdown into the "Owner Details" tab. */
function _writeOwnerDetailsSheet_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(OWNER_DETAILS_SHEET) || ss.insertSheet(OWNER_DETAILS_SHEET);
  sh.clear();

  var header = ['Owner', 'Screenshot', 'Total Uses', 'Copies', 'Views', 'Distinct Agents', 'Last Used (UTC)'];
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');

  var body = [];
  rows.forEach(function (r) {
    (r.items || []).forEach(function (it) {
      body.push([r.owner, it.title, it.total, it.copies, it.views, it.agents, it.last]);
    });
  });
  if (body.length) {
    sh.getRange(2, 1, body.length, header.length).setValues(body);
  }
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
}

/** One-time: create + fill the Owner + Owner Details tabs. */
function createOwnerSheetNow() {
  return rebuildOwnerStats();
}

/**
 * Recommended: keep the Owner tabs fresh automatically. Apps Script cannot fire
 * on every single click, but this rebuilds every 5 minutes — near-live. Also,
 * every dashboard open/refresh (?getOwnerStats=true) rebuilds instantly.
 * Run this ONCE.
 */
function installOwnerLiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rebuildOwnerStats') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rebuildOwnerStats').timeBased().everyMinutes(5).create();
}

/** Optional: daily instead of every 5 minutes (run once; removes other rebuild triggers). */
function installOwnerDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rebuildOwnerStats') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rebuildOwnerStats').timeBased().everyDays(1).atHour(1).create();
}
