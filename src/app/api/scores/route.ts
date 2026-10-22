import { NextResponse } from "next/server";

interface ScoreRecord {
  id: string;
  name: string;
  timeSeconds: number;
  formattedTime: string;
  createdAt: string;
}

const SHEET_ID = "1qPX-id8vlnkPWe7lz51uTC1ylHVQWtKiSgrnMA5nSMc";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

// "0:19", "00:25", "1:05" 등의 문자열을 순수 초(seconds)로 변환
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 999999;
  const cleaned = timeStr.trim().replace(/^"|"$/g, "").replace(/^'/, "");

  const parts = cleaned.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  const numeric = parseInt(cleaned, 10);
  return isNaN(numeric) ? 999999 : numeric;
}

// 0:19 형태를 보기 좋은 00:19 형태로 정규화
function normalizeDisplayTime(timeStr: string): string {
  const seconds = parseTimeToSeconds(timeStr);
  if (seconds >= 999999) return timeStr || "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export async function GET() {
  try {
    // 구글 스프레드시트의 CSV를 직접 읽어서 정확한 컬럼 매핑
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (res.ok) {
      const csvText = await res.text();
      const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const parsedScores: ScoreRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        // CSV 따옴표 고려 파싱
        const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        const cols = match
          ? match.map((c) => c.replace(/^"|"$/g, "").trim())
          : lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());

        if (cols.length >= 2) {
          const timestamp = cols[0];
          const name = cols[1];

          // 실제 finishtime은 D열(인덱스 3) 또는 C열(인덱스 2)에 있을 수 있음
          // 100 같은 score가 C열에 들어간 경우 실제 시간(예: 0:19)은 D열(cols[3])에 위치
          let rawTime = "";
          if (cols.length >= 4 && cols[3].includes(":")) {
            rawTime = cols[3];
          } else if (cols.length >= 3 && cols[2].includes(":")) {
            rawTime = cols[2];
          } else if (cols.length >= 4 && cols[3]) {
            rawTime = cols[3];
          } else if (cols.length >= 3) {
            rawTime = cols[2];
          }

          if (name && rawTime && rawTime !== "100") {
            const timeSeconds = parseTimeToSeconds(rawTime);
            parsedScores.push({
              id: `${i}-${name}`,
              name,
              timeSeconds,
              formattedTime: normalizeDisplayTime(rawTime),
              createdAt: timestamp,
            });
          }
        }
      }

      if (parsedScores.length > 0) {
        // 완료 시간(초)이 가장 빠른 순서(오름차순)로 정렬
        parsedScores.sort((a, b) => a.timeSeconds - b.timeSeconds);
        return NextResponse.json({
          success: true,
          topScores: parsedScores.slice(0, 3),
          source: "google-sheet",
        });
      }
    }
  } catch (err) {
    console.error("CSV fetch error:", err);
  }

  return NextResponse.json({
    success: true,
    topScores: [],
    source: "empty",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, timeSeconds, formattedTime, isCleared } = body;

    // 미션 완료 시에만 저장
    if (isCleared === false) {
      return NextResponse.json({ success: false, message: "Only cleared games are saved." }, { status: 400 });
    }

    if (!name || typeof timeSeconds !== "number") {
      return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    const timestamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const formatted = formattedTime || `${Math.floor(timeSeconds / 60).toString().padStart(2, "0")}:${(timeSeconds % 60).toString().padStart(2, "0")}`;

    // Apps Script 웹 앱으로 전송: C열 finishtime에 정확히 기록되도록 [timestamp, name, finishtime] 3개만 전송
    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
    let savedToAppsScript = false;

    if (scriptUrl) {
      try {
        const response = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp,
            name,
            finishtime: formatted, // score를 빼고 C열(finishtime)로 바로 들어가도록 전송
          }),
        });
        if (response.ok) {
          savedToAppsScript = true;
        }
      } catch (err) {
        console.error("Google Apps Script fetch error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      savedToAppsScript,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
