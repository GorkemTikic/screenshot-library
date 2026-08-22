/**
 * 🚀 ADVANCED IDENTITY RESOLUTION ENGINE (v8.3)
 * v8.1 base preserved.
 * v8.2: screenshot_request → DB_Screenshot_Requests + ?getRequests=true.
 * v8.3: survey_response   → DB_Survey_Responses   + ?getSurvey=true.
 *       Nothing in v8.1/v8.2 is changed.
 * v8.4: owner usage        → Owner / Owner Details + ?getOwnerStats=true.
 *       (Logic lives in owner-analytics.gs; doGet just routes to it.)
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const params = (e && e.parameter) || {};

  // 1. Initialize Relational Tabs (unchanged)
  const logSheet  = ss.getSheetByName("DB_Logs")  || ss.insertSheet("DB_Logs");
  const userSheet = ss.getSheetByName("DB_Users") || ss.insertSheet("DB_Users");

  // 2. FORCE HEADERS (unchanged)
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(["Timestamp", "Device_ID", "Event", "Title", "Topic", "Screen", "TZ", "User_Agent"]);
  }
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(["Unique_Device_ID", "IP", "OS", "First_Seen", "Last_Seen", "Browser_History", "Total_Events"]);
  }

  // v8.2: Read endpoint for the in-app Screenshot Requests table
  if (params.getRequests === 'true') {
    return ContentService
      .createTextOutput(JSON.stringify(getScreenshotRequests_(ss)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // NEW (v8.3): Read endpoint for the in-app Survey Responses table
  if (params.getSurvey === 'true') {
    return ContentService
      .createTextOutput(JSON.stringify(getSurveyResponses_(ss)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // NEW (v8.4): Read endpoint for the in-app Owners table (owner-analytics.gs)
  if (params.getOwnerStats === 'true') {
    return ContentService
      .createTextOutput(JSON.stringify(rebuildOwnerStats()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Handle Stats Request (unchanged)
  if (params.getStats === 'true') {
    const userData = userSheet.getDataRange().getValues();
    const logData  = logSheet.getDataRange().getValues();

    let topScreenshot = "N/A";
    let maxClicks = 0;
    const clicks = {};

    const interactionEvents = ['view_image', 'copy_text', 'right_click_image', 'preview_text', 'favorite_add'];

    for (let i = 1; i < logData.length; i++) {
      const eventType = logData[i][2];
      const title     = logData[i][3];
      if (title && title !== "English" && interactionEvents.includes(eventType)) {
        clicks[title] = (clicks[title] || 0) + 1;
        if (clicks[title] > maxClicks) { maxClicks = clicks[title]; topScreenshot = title; }
      }
    }

    if (topScreenshot === "N/A") {
      for (let i = 1; i < logData.length; i++) {
        const title = logData[i][3];
        if (title && title !== "English") {
          clicks[title] = (clicks[title] || 0) + 1;
          if (clicks[title] > maxClicks) { maxClicks = clicks[title]; topScreenshot = title; }
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      uniqueUsers:   Math.max(0, userData.length - 1),
      topScreenshot: topScreenshot,
      totalEvents:   Math.max(0, logData.length - 1)
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 4. GUARD (unchanged)
  if (!params.event || !params.hash) {
    return ContentService.createTextOutput("Ignored (Invalid Parameters)").setMimeType(ContentService.MimeType.TEXT);
  }

  // 5. Identity Resolution (unchanged)
  const ts       = new Date();
  const hash     = String(params.hash).trim();
  const ua       = params.ua || "N/A";
  const os       = params.platform || "Unknown";
  const screen   = params.screen || "N/A";
  const tz       = params.tz || "N/A";
  const deviceId = hash;
  const ip       = params.ip || "Unknown";

  const users = userSheet.getDataRange().getValues();
  let userRowIndex = -1;

  for (let i = 1; i < users.length; i++) {
    if (String(users[i][0]).trim() === hash) { userRowIndex = i + 1; break; }
  }

  if (userRowIndex > 0) {
    userSheet.getRange(userRowIndex, 2).setValue(ip);
    userSheet.getRange(userRowIndex, 5).setValue(ts);
    const currentEvents = Number(users[userRowIndex - 1][6] || 0);
    userSheet.getRange(userRowIndex, 7).setValue(currentEvents + 1);

    const history = String(users[userRowIndex - 1][5] || "");
    const browser = ua.split(' ')[0] || "Unknown";
    if (!history.includes(browser)) {
      userSheet.getRange(userRowIndex, 6).setValue(history + (history ? ", " : "") + browser);
    }
  } else {
    userSheet.appendRow([deviceId, ip, os, ts, ts, ua.split(' ')[0], 1]);
  }

  // 6. Append Raw Log (unchanged) — screenshot_request and survey_response still show up here too
  logSheet.appendRow([ts, deviceId, params.event, params.title || "N/A", params.topic || "N/A", screen, tz, ua]);

  // v8.2: additionally record screenshot_request in its dedicated tab
  if (params.event === 'screenshot_request') {
    appendScreenshotRequest_(ss, params, ts, deviceId, screen, tz, ua);
  }

  // NEW (v8.3): additionally record survey_response in its dedicated tab
  if (params.event === 'survey_response') {
    appendSurveyResponse_(ss, params, ts, deviceId, screen, tz, ua);
  }

  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

// ---------- v8.2 helpers: Screenshot Requests tab (unchanged) ----------

const REQUESTS_SHEET_NAME = "DB_Screenshot_Requests";
const REQUESTS_HEADERS = [
  "Submitted_At", "Device_ID", "Topic", "Language", "Platform",
  "Description", "Context", "Search_Terms", "Screen", "TZ", "User_Agent"
];

function getOrCreateRequestsSheet_(ss) {
  let sheet = ss.getSheetByName(REQUESTS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(REQUESTS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REQUESTS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, REQUESTS_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#FCD535");
  }
  return sheet;
}

function appendScreenshotRequest_(ss, params, ts, deviceId, screen, tz, ua) {
  const sheet = getOrCreateRequestsSheet_(ss);
  sheet.appendRow([
    params.req_submitted_at || ts,
    deviceId,
    params.topic             || "N/A",
    params.req_language      || "N/A",
    params.req_platform      || "N/A",
    params.req_description   || "",
    params.req_context       || "",
    params.req_search_terms  || "",
    screen,
    tz,
    ua
  ]);
}

function getScreenshotRequests_(ss) {
  const sheet = getOrCreateRequestsSheet_(ss);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const keyMap = {
    "Submitted_At":  "submitted_at",
    "Device_ID":     "device_hash",
    "Topic":         "topic",
    "Language":      "language",
    "Platform":      "platform",
    "Description":   "description",
    "Context":       "context",
    "Search_Terms":  "search_terms",
    "Screen":        "screen",
    "TZ":            "tz",
    "User_Agent":    "ua"
  };

  const headers = data[0];
  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) {
      const key = keyMap[h] || h;
      let val = row[i];
      if (val instanceof Date) val = val.toISOString();
      obj[key] = val;
    });
    return obj;
  });
}

function createRequestsSheetNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateRequestsSheet_(ss);
  Logger.log('DB_Screenshot_Requests tab is ready.');
}

// ---------- v8.3 helpers: Survey Responses tab (NEW) ----------

const SURVEY_SHEET_NAME = "DB_Survey_Responses";
const SURVEY_HEADERS = [
  "Submitted_At", "Device_ID",
  "Usage_Frequency", "Satisfaction", "Search_Ease",
  "Under_Covered_Topic", "Languages_Needed", "Platform_Preference",
  "Request_Feature_Experience", "Top_Feature", "Biggest_Frustration", "Other_Feedback",
  "Screen", "TZ", "User_Agent"
];

function getOrCreateSurveySheet_(ss) {
  let sheet = ss.getSheetByName(SURVEY_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SURVEY_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SURVEY_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SURVEY_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#8B5CF6")
      .setFontColor("#ffffff");
  }
  return sheet;
}

function appendSurveyResponse_(ss, params, ts, deviceId, screen, tz, ua) {
  const sheet = getOrCreateSurveySheet_(ss);
  sheet.appendRow([
    params.srv_submitted_at               || ts,
    deviceId,
    params.srv_usage_frequency            || "",
    params.srv_satisfaction               || "",
    params.srv_search_ease                || "",
    params.srv_under_covered_topic        || "",
    params.srv_languages_needed           || "",
    params.srv_platform_preference        || "",
    params.srv_request_feature_experience || "",
    params.srv_top_feature                || "",
    params.srv_biggest_frustration        || "",
    params.srv_other_feedback             || "",
    screen,
    tz,
    ua
  ]);
}

function getSurveyResponses_(ss) {
  const sheet = getOrCreateSurveySheet_(ss);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const keyMap = {
    "Submitted_At":               "submitted_at",
    "Device_ID":                  "device_hash",
    "Usage_Frequency":            "usage_frequency",
    "Satisfaction":               "satisfaction",
    "Search_Ease":                "search_ease",
    "Under_Covered_Topic":        "under_covered_topic",
    "Languages_Needed":           "languages_needed",
    "Platform_Preference":        "platform_preference",
    "Request_Feature_Experience": "request_feature_experience",
    "Top_Feature":                "top_feature",
    "Biggest_Frustration":        "biggest_frustration",
    "Other_Feedback":             "other_feedback",
    "Screen":                     "screen",
    "TZ":                         "tz",
    "User_Agent":                 "ua"
  };

  const headers = data[0];
  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) {
      const key = keyMap[h] || h;
      let val = row[i];
      if (val instanceof Date) val = val.toISOString();
      obj[key] = val;
    });
    return obj;
  });
}

// Run this from the editor dropdown to create the tab on demand
// (no real survey submission needed). Also useful if you delete the tab.
function createSurveySheetNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSurveySheet_(ss);
  Logger.log('DB_Survey_Responses tab is ready.');
}
