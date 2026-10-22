# INU 벽돌깨기 개발 과정 및 프롬프트 보고서

본 문서는 **인천대학교 마스코트 '횃불이' 특별 에디션 INU 벽돌깨기** 웹 게임 프로젝트의 개발 과정, 요구사항 분석, 프롬프트 히스토리 및 구현 상세를 기록한 보고서입니다.

---

## 1. 프로젝트 개요

- **프로젝트 명**: INU 벽돌깨기 (Next.js 웹 게임)
- **개발 환경**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **미디어 자산**:
  - 배경 음악: `Hyper_Speed_Run.mp3` (`public/Hyper_Speed_Run.mp3`)
  - 마스코트: 인천대학교 마스코트 횃불이 `Mascot.jpg` (`public/Mascot.jpg`)
- **주요 기능**:
  - HTML5 Canvas 기반 벽돌깨기 물리 및 렌더링 엔진 (60 FPS)
  - 연한 빨강 3개 타격 시 미션 완료 클리어 규칙
  - 분:초 (`mm:ss`) 실시간 시간 측정 및 실패 시 시간 미측정 처리
  - 구글 시트 Webhook 연동 명예의 전당 (Top 3)
  - Web Audio API를 활용한 블록 충돌음 및 승리/실패 효과음
  - 폭죽(Confetti) 축하 효과
  - 모바일 반응형 터치 스와이프 및 PC 방향키 조작 지원

---

## 2. 요구사항 및 반영 내역 매핑

| 요구사항 항목 | 구현 내용 | 반영 위치 |
| :--- | :--- | :--- |
| **메인 페이지 title** | `metadata.title`을 `'INU 벽돌깨기'`로 설정 | [layout.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/layout.tsx) |
| **첫 화면 구성** | 마스코트(횃불이) 이미지, 학과/학번/이름, 플레이어 이름 입력란, 게임 시작 버튼 배치 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) |
| **자산 파일 이동** | `Mascot.jpg`, `Hyper_Speed_Run.mp3` 파일을 Next.js `public/` 디렉터리로 이동 | `public/` |
| **벽돌 기본 구성** | 5행 × 8열 = 40개 블록. 6가지 파스텔톤 컬러 (연한 빨강, 연한 주황, 연한 노랑, 연한 파랑, 연한 녹색, 연한 보라) | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) `initBricks()` |
| **미션 규칙** | 전체의 30%(12개)를 연한 빨강으로 배치, **연한 빨강 3개 제거 시 미션 성공 클리어** | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) 충돌 판정부 |
| **시작 카운트다운** | 게임 시작 시 3, 2, 1 카운트다운 후 공 이동 개시 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) `gameState === 'COUNTDOWN'` |
| **PC 조작** | 좌우 방향키(`ArrowLeft`, `ArrowRight`)로만 패들 부드럽게 이동 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) 이벤트 리스너 |
| **모바일 조작** | 모바일 화면 좌우 터치 스와이프 제어 지원 및 반응형 UI 제공 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) `onTouchMove` |
| **생명 및 실패 처리** | 생명 3개 구성, 공 추락 시 생명 감소, 3번 놓치면 게임 미션 실패 메시지 출력 (시간 미측정) | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) |
| **배경음악 및 효과음** | `Hyper_Speed_Run.mp3` 적정 볼륨(0.25) 재생 및 음소거 토글, Web Audio API 내장 충돌음 생성 | [sound.ts](file:///c:/Users/psch0/Desktop/breakout/src/utils/sound.ts) |
| **컨트롤 버튼** | 상단에 **멈춤(일시정지/재개)**, **다시 시작(이름 입력 화면으로 이동)**, **게임 종료** 버튼 구성 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) |
| **미션 성공 및 축하** | 폭죽(`canvas-confetti`) 효과 발사, 분:초 단위 완료 시간 표시 | [page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) |
| **구글 시트 & Top 3** | 게임 클리어 시 완료 시간 저장 API 제공 및 상위 Top 3 명예의 전당 실시간 출력 | [route.ts](file:///c:/Users/psch0/Desktop/breakout/src/app/api/scores/route.ts), [google-apps-script.js](file:///c:/Users/psch0/Desktop/breakout/google-apps-script.js) |

---

## 3. 프롬프트 및 개발 단계별 히스토리

### [단계 1] 프로젝트 생성 및 환경 설정
* **프롬프트**:
  ```text
  npx create-next-app@latest .
  ```
* **수행 내용 및 해결**:
  1. Windows PowerShell 환경의 스크립트 실행 제한 정책(`PSSecurityException`) 발견 → `npm.cmd` 및 `npx.cmd` 직접 호출로 전환.
  2. 디렉터리 내에 `Mascot.jpg`와 `Hyper_Speed_Run.mp3`가 존재하여 충돌 발생 → 임시 디렉터리로 안전하게 이동 후 `create-next-app` 실행, 완료 후 `public/` 디렉터리로 복원.
  3. Next.js 16 최신 App Router 프로젝트 템플릿(Tailwind CSS, TypeScript) 생성 완료.

---

### [단계 2] 핵심 요구사항 및 구조 설계
* **프롬프트**:
  ```text
  ○ MD 문서로 개발 과정과 프롬프트를 작성하며 제작하시오.
  ○ 수업 시간에 다루고 있는 Next.js 환경에서 제작하시오.
  ○ Mascot.jpg과 Hyper_Speed_Run.mp3 파일을 제작 폴더 내로 옮기시오.
  ○ 지시 사항
  ▪ 메인 페이지 title을 'INU 벽돌깨기'로 설정
  ▪ 디자인은 자유 구성
  ▪ 첫 화면은 사용자 이름란과 게임 시작 버튼을 구성
  ▪ 우리대학 마스코트 횃불이 이미지를 첫 페이지에 배치
  ▪ 사용자 이름을 입력하는 첫 페이지에 제작자의 학과, 학번, 이름 추가
  ▪ 벽돌 기본 구성: 5행 × 8열 (40개). 연한 빨강, 연한 주황, 연한 노랑색, 연한 파랑, 연한 녹색, 연한 보라색으로 랜덤 구성
  ▪ PC 버전에서는 좌우 방향키로만 패들이 자연스럽게 이동하도록 설정
  ▪ 패들이 공을 놓쳐 화면 하단으로 떨어지면 생명 감소 또는 게임 오버. 생명은 세번으로 설정
  ▪ 미션을 실패하면 시간을 측정하지 말고 게임 미션 실패 메시지 출력
  ▪ 게임이 시작되면 ‘Hyper_Speed_Run.mp3’ 파일을 배경 음악으로 사용하고 볼륨이 너무 크지 않도록 설정
  ▪ 게임이 처음 시작할 때만 준비 카운트 3, 2, 1 후 공의 움직임 시작
  ▪ 공이 블록에 충돌하면 효과음 출력
  ▪ (벽돌깨기가 종료되려면 시간이 많이 걸릴 수 있으므로) 연한 빨강색 블록을 세 개 제거하면 게임 종료
  ▪ 테스트를 위해 연한 빨강 블록을 전체 블록에 30% 배치
  ▪ 메인 화면에는 게임을 중간에 멈출 수 있는 버튼과 다시 시작 버튼, 게임 종료 버튼을 구성
  ▪ 다시 시작 버튼을 클릭하면 이름을 작성하는 화면으로 이동
  ▪ 게임 미션이 완료되면 폭죽 효과 추가
  ▪ 게임 미션이 완료될 때까지 시간을 분:초 단위로 측정. 게임이 완료되면 완료 시간을 측정해서 출력. 분:초 지정은 참고 게임과 동일하게 표시해야 함
  ▪ 게임이 미션이 성공하면 완료시간을 구글시트에 저장하고 완료시간이 빠른 Top3 구성
  ▪ 모바일에서도 게임이 가능하도록 반응형으로 동작할 수 있도록 하고 모바일 버전에서는 패들을 왼쪽과 오른쪽으로 스와이프하여 이동하도록 할 것. 본인의 모바일폰에서 테스트 해볼 것
  ```
* **수행 내용**:
  - `canvas-confetti`, `@types/canvas-confetti`, `lucide-react` 패키지 설치.
  - 외부 오디오 파일 없이도 브라우저에서 딜레이 없이 즉각 반응하는 **Web Audio API 오실레이터 사운드 엔진**(`src/utils/sound.ts`) 제작 (벽돌 타격음, 패들 튕김음, 라이프 감소음, 승리 팡파르음).

---

### [단계 3] 기능 구현
1. **메타데이터 설정 (`src/app/layout.tsx`)**:
   - `metadata.title = "INU 벽돌깨기"` 설정 및 한국어 `lang="ko"` 지정.
2. **구글 시트 연동 API (`src/app/api/scores/route.ts`)**:
   - Google Apps Script 웹앱 URL이 환경변수(`GOOGLE_SHEET_API_URL`)에 지정되어 있으면 구글 시트로 POST 및 GET 동기화.
   - 설정되어 있지 않아도 자체 인메모리 랭킹 저장소로 자동 동작하여 언제나 원활하게 플레이 가능.
3. **게임 인터페이스 및 물리 캔버스 엔진 (`src/app/page.tsx`)**:
   - 상태 머신: `START` -> `COUNTDOWN` -> `PLAYING` -> `PAUSED` / `FAILED` / `CLEARED`.
   - 첫 화면: 횃불이 마스코트, 제작자 학과/학번/이름, 사용자 이름 입력폼, 게임 시작 버튼, 명예의 전당 Top 3.
   - 게임 헤더: 생명 하트 3개 표시, 빨강 블록 달성률(X / 3), 경과 시간(분:초), 멈춤/재시작/종료 버튼.
   - 키보드 조작: 좌우 방향키(`ArrowLeft`, `ArrowRight`)로만 패들 가감속 제어.
   - 모바일 스와이프: `onTouchStart`, `onTouchMove`, `onTouchEnd`로 스와이프 델타값을 계산하여 자연스럽게 패들 이동.
   - 오디오: `Hyper_Speed_Run.mp3` 자동 루프 재생(볼륨 0.25) 및 원클릭 음소거 기능.
   - 카운트다운: 첫 시작 시 3초 카운트다운 후 공 발사.
   - 충돌음: 일반 블록 및 타겟 빨강 블록 충돌 시 주파수가 다른 효과음 출력.
   - 미션 완료: 연한 빨강 3개 파괴 시 폭죽 효과 + 완료 시간(분:초) 출력 + 구글 시트 저장.
   - 미션 실패: 공 3회 추락 시 시간 기록 없이 실패 메시지 출력.

---

### [단계 4] 구글 시트 연동 스크립트 작성
- `google-apps-script.js` 파일에 Google 스프레드시트용 배포 코드 작성.
- 스프레드시트에 A1~E1 헤더 설정 후 배포하면 실시간으로 전 세계 사용자 랭킹 Top3 취합 가능.

---

## 4. 빌드 및 동작 테스트 결과

- `npm run build` 테스트 완료:
  ```text
  ✓ Compiled successfully in 12.6s
  ✓ Generating static pages using 6 workers (5/5) in 1780ms
  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  └ ƒ /api/scores
  ```
- TypeScript 타입 에러 0건, 정적 빌드 성공.

---

## 5. 실행 방법

1. **개발 서버 실행**:
   ```bash
   npm run dev
   ```
2. **브라우저 접속**:
   - PC: [http://localhost:3000](http://localhost:3000)
   - 모바일: 동일 와이파이 네트워크에서 PC의 IP 주소로 접속 (예: `http://192.168.x.x:3000`)
3. **제작자 정보 변경 방법**:
   - [src/app/page.tsx](file:///c:/Users/psch0/Desktop/breakout/src/app/page.tsx) 파일 상단의 `studentInfo` 객체(`dept`, `id`, `name`)에서 본인의 실제 학과, 학번, 이름으로 수정하실 수 있습니다.
