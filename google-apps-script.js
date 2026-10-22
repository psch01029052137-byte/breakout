/**
 * Google Apps Script 코드
 * 현재 구글 시트 C열 헤더가 'finishtime'으로 되어 있으므로,
 * [A열: timestamp, B열: name, C열: finishtime] 순서로 저장합니다.
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    var timestamp = data.timestamp || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    var name = data.name || "익명";
    // 구글 시트가 시간 서식으로 멋대로 바꾸지 않도록 작은따옴표를 붙여 텍스트로 보존
    var finishtime = data.finishtime ? "'" + data.finishtime : "";

    // A: timestamp | B: name | C: finishtime
    sheet.appendRow([timestamp, name, finishtime]);

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "정상적으로 저장되었습니다." 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getDisplayValues();
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // D열에 시간이 있는 경우와 C열에 시간이 있는 경우 둘 다 대응
    var timeVal = (row[3] && row[3].indexOf(":") !== -1) ? row[3] : row[2];
    if (row[1] && timeVal) {
      rows.push({
        timestamp: row[0],
        name: row[1],
        finishtime: timeVal
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
