/*******************************************************************************
 * OWNER-HISTORY ANALYTICS (v9)
 * Credits usage to the owner interval active when the event happened.
 * Resolution order: stable recordId, then unique normalized exact title.
 * Ambiguous historical titles are skipped and reported, never guessed.
 ******************************************************************************/

var OWNER_DATA_URL = 'https://gorkemtikic.github.io/screenshot-library/data.json';
var OWNER_SHEET = 'Owner';
var OWNER_DETAILS_SHEET = 'Owner Details';
var OWNER_LOGS_SHEET = 'DB_Logs';
var OWNER_USAGE_EVENTS = ['copy_text', 'view_image', 'preview_text', 'switch_lang', 'favorite_add', 'right_click_image'];

function _ownerKey_(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function _normalizeOwnerTitle_(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function _toMs_(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value > 1e11 ? value : null;
  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T00:00:00Z';
  var parsed = Date.parse(text);
  return isNaN(parsed) ? null : parsed;
}

function _ownerCol_(header, names) {
  var lower = header.map(function (value) { return String(value).trim().toLowerCase(); });
  for (var index = 0; index < names.length; index++) {
    var found = lower.indexOf(String(names[index]).toLowerCase());
    if (found >= 0) return found;
  }
  return -1;
}

function _ownerHistory_(item) {
  if (item.ownerHistory && item.ownerHistory.length) return item.ownerHistory.map(function (interval) {
    return {
      ownerKey: interval.ownerKey || _ownerKey_(interval.owner),
      owner: String(interval.owner || '').trim(),
      from: _toMs_(interval.from),
      to: _toMs_(interval.to)
    };
  });
  if (!item.owner) return [];
  return [{ ownerKey: item.ownerKey || _ownerKey_(item.owner), owner: String(item.owner).trim(), from: _toMs_(item.ownerSince), to: null }];
}

function _ownerCatalog_() {
  var response = UrlFetchApp.fetch(OWNER_DATA_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Could not fetch catalog (' + response.getResponseCode() + ')');
  var source = JSON.parse(response.getContentText()) || [];
  var byId = {};
  var byTitle = {};
  var ambiguous = {};
  var records = [];

  source.forEach(function (item) {
    if (!item || !item.id || !item.title || !item.owner) return;
    var record = {
      id: String(item.id),
      title: String(item.title).trim(),
      currentOwner: String(item.owner).trim(),
      currentOwnerKey: item.ownerKey || _ownerKey_(item.owner),
      archived: Boolean(item.archivedAt),
      history: _ownerHistory_(item)
    };
    byId[record.id] = record;
    var normalizedTitle = _normalizeOwnerTitle_(record.title);
    if (byTitle[normalizedTitle]) {
      ambiguous[normalizedTitle] = true;
      delete byTitle[normalizedTitle];
    } else if (!ambiguous[normalizedTitle]) byTitle[normalizedTitle] = record;
    records.push(record);
  });
  return { byId: byId, byTitle: byTitle, ambiguous: ambiguous, records: records };
}

function _ownerIntervalAt_(record, eventMs) {
  for (var index = 0; index < record.history.length; index++) {
    var interval = record.history[index];
    if (eventMs == null) {
      if (interval.from == null && interval.to == null) return interval;
      continue;
    }
    if ((interval.from == null || eventMs >= interval.from) && (interval.to == null || eventMs < interval.to)) return interval;
  }
  return null;
}

function _ensureOwnerAgg_(agg, owner, ownerKey) {
  var key = ownerKey || _ownerKey_(owner);
  if (!agg[key]) agg[key] = {
    owner: owner, ownerKey: key, owned: 0, lifetimeIds: {}, total: 0, copies: 0, views: 0,
    titles: {}, agents: {}, last: '', lastContribution: ''
  };
  return agg[key];
}

function rebuildOwnerStats() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var logs = spreadsheet.getSheetByName(OWNER_LOGS_SHEET);
  if (!logs) throw new Error('Sheet "' + OWNER_LOGS_SHEET + '" not found');
  var catalog = _ownerCatalog_();
  var agg = {};
  var skippedCollisions = 0;

  catalog.records.forEach(function (record) {
    if (!record.archived) _ensureOwnerAgg_(agg, record.currentOwner, record.currentOwnerKey).owned++;
    record.history.forEach(function (interval) {
      var ownerAgg = _ensureOwnerAgg_(agg, interval.owner, interval.ownerKey);
      ownerAgg.lifetimeIds[record.id] = true;
      var contribution = interval.from == null ? '' : new Date(interval.from).toISOString();
      if (contribution > ownerAgg.lastContribution) ownerAgg.lastContribution = contribution;
    });
  });

  var values = logs.getDataRange().getValues();
  if (values.length >= 2) {
    var header = values[0];
    var cEvent = _ownerCol_(header, ['event', 'event_type', 'type']);
    var cTitle = _ownerCol_(header, ['title', 'screenshot', 'name']);
    var cRecordId = _ownerCol_(header, ['record_id', 'recordid']);
    var cHash = _ownerCol_(header, ['hash', 'devicehash', 'device_hash', 'device', 'uid', 'device_id']);
    var cTime = _ownerCol_(header, ['timestamp', 'time', 'date', 'datetime', 'created', 'createdat']);
    if (cEvent < 0 || cTitle < 0) throw new Error('DB_Logs needs event and title columns.');

    for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
      var row = values[rowIndex];
      var eventName = String(row[cEvent] || '').trim();
      if (OWNER_USAGE_EVENTS.indexOf(eventName) < 0) continue;
      var recordId = cRecordId >= 0 ? String(row[cRecordId] || '').trim() : '';
      var record = recordId ? catalog.byId[recordId] : null;
      if (!record) {
        var normalizedTitle = _normalizeOwnerTitle_(row[cTitle]);
        if (catalog.ambiguous[normalizedTitle]) { skippedCollisions++; continue; }
        record = catalog.byTitle[normalizedTitle];
      }
      if (!record) continue;
      var eventMs = cTime >= 0 ? _toMs_(row[cTime]) : null;
      var interval = _ownerIntervalAt_(record, eventMs);
      if (!interval) continue;
      var ownerAgg = _ensureOwnerAgg_(agg, interval.owner, interval.ownerKey);
      var iso = eventMs == null ? '' : new Date(eventMs).toISOString();
      var device = cHash >= 0 ? String(row[cHash] || '').trim() : '';
      ownerAgg.total++;
      if (eventName === 'copy_text') ownerAgg.copies++;
      if (eventName === 'view_image') ownerAgg.views++;
      if (device) ownerAgg.agents[device] = true;
      if (iso > ownerAgg.last) ownerAgg.last = iso;
      var detail = ownerAgg.titles[record.id] || (ownerAgg.titles[record.id] = { id: record.id, title: record.title, total: 0, copies: 0, views: 0, agents: {}, last: '' });
      detail.total++;
      if (eventName === 'copy_text') detail.copies++;
      if (eventName === 'view_image') detail.views++;
      if (device) detail.agents[device] = true;
      if (iso > detail.last) detail.last = iso;
    }
  }

  var rows = Object.keys(agg).map(function (key) {
    var ownerAgg = agg[key];
    var items = Object.keys(ownerAgg.titles).map(function (id) {
      var detail = ownerAgg.titles[id];
      return { recordId: detail.id, title: detail.title, total: detail.total, copies: detail.copies, views: detail.views, agents: Object.keys(detail.agents).length, last: detail.last };
    }).sort(function (left, right) { return right.total - left.total; });
    return {
      owner: ownerAgg.owner, ownerKey: ownerAgg.ownerKey, owned: ownerAgg.owned,
      lifetime: Object.keys(ownerAgg.lifetimeIds).length, total: ownerAgg.total, copies: ownerAgg.copies, views: ownerAgg.views,
      screenshots: items.length, agents: Object.keys(ownerAgg.agents).length, last: ownerAgg.last,
      lastContribution: ownerAgg.lastContribution, skippedCollisions: skippedCollisions, items: items
    };
  }).sort(function (left, right) { return (right.total - left.total) || (right.owned - left.owned); });

  _writeOwnerSheet_(rows);
  _writeOwnerDetailsSheet_(rows);
  return rows;
}

function _writeOwnerSheet_(rows) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(OWNER_SHEET) || spreadsheet.insertSheet(OWNER_SHEET);
  sheet.clear();
  var header = ['Owner', 'Owner Key', 'Current Owned', 'Lifetime Contributed', 'Total Uses', 'Copies', 'Views', 'Screenshots Used', 'Distinct Agents', 'Last Used (UTC)', 'Last Contribution (UTC)', 'Skipped Collisions', 'Refreshed (UTC)'];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  var refreshed = new Date().toISOString();
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows.map(function (row) {
    return [row.owner, row.ownerKey, row.owned, row.lifetime, row.total, row.copies, row.views, row.screenshots, row.agents, row.last, row.lastContribution, row.skippedCollisions, refreshed];
  }));
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
}

function _writeOwnerDetailsSheet_(rows) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(OWNER_DETAILS_SHEET) || spreadsheet.insertSheet(OWNER_DETAILS_SHEET);
  sheet.clear();
  var header = ['Owner', 'Owner Key', 'Record ID', 'Screenshot', 'Total Uses', 'Copies', 'Views', 'Distinct Agents', 'Last Used (UTC)'];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  var body = [];
  rows.forEach(function (row) { (row.items || []).forEach(function (item) {
    body.push([row.owner, row.ownerKey, item.recordId, item.title, item.total, item.copies, item.views, item.agents, item.last]);
  }); });
  if (body.length) sheet.getRange(2, 1, body.length, header.length).setValues(body);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, header.length);
}

function createOwnerSheetNow() { return rebuildOwnerStats(); }

function installOwnerLiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'rebuildOwnerStats') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('rebuildOwnerStats').timeBased().everyMinutes(5).create();
}

function installOwnerDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'rebuildOwnerStats') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('rebuildOwnerStats').timeBased().everyDays(1).atHour(1).create();
}
