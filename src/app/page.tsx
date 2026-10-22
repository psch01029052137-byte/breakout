"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { soundEffects } from "@/utils/sound";
import {
  Play,
  Pause,
  RotateCcw,
  LogOut,
  Trophy,
  Heart,
  Timer as TimerIcon,
  Flame,
  Volume2,
  VolumeX,
  Target,
  Sparkles,
} from "lucide-react";

// 블록 색상 정의 (5행 × 8열 = 40개)
// 연한 빨강(30%), 연한 주황, 연한 노랑, 연한 파랑, 연한 녹색, 연한 보라
type BrickColorType = "light-red" | "light-orange" | "light-yellow" | "light-blue" | "light-green" | "light-purple";

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  colorType: BrickColorType;
  colorCode: string;
  isAlive: boolean;
}

interface ScoreRecord {
  id: string;
  name: string;
  timeSeconds: number;
  formattedTime: string;
  createdAt: string;
}

export default function BreakoutGame() {
  // 화면 상태: 'START' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'FAILED' | 'CLEARED'
  const [gameState, setGameState] = useState<"START" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "FAILED" | "CLEARED">("START");

  // 사용자 정보 및 학적 정보 (제작자 정보)
  const [playerName, setPlayerName] = useState("");
  const studentInfo = {
    dept: "경제학과",
    id: "202400678",
    name: "박수철",
  };

  // 게임 변수
  const [lives, setLives] = useState(3);
  const [redClearedCount, setRedClearedCount] = useState(0); // 연한 빨강 3개 제거 시 승리
  const [showThumbsUp, setShowThumbsUp] = useState(false); // 빨간 블록 맞출 때 엄지척 애니메이션 표시
  const [countdown, setCountdown] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalTimeStr, setFinalTimeStr] = useState("00:00");
  const [isMuted, setIsMuted] = useState(false);
  const [topScores, setTopScores] = useState<ScoreRecord[]>([]);
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  // 캔버스 및 오디오 Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 게임 루프 내부 상태 Ref (60fps 애니메이션 동기화)
  const paddleRef = useRef({
    x: 320,
    width: 110,
    height: 14,
    speed: 8,
  });
  const ballRef = useRef({
    x: 375,
    y: 420,
    vx: 4.2,
    vy: -4.2,
    radius: 7,
  });
  const bricksRef = useRef<Brick[]>([]);
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const touchStartRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // 랭킹 불러오기
  const fetchTopScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      if (res.ok) {
        const data = await res.json();
        if (data.topScores) {
          setTopScores(data.topScores);
        }
      }
    } catch (e) {
      console.error("Top scores fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchTopScores();
  }, [fetchTopScores]);

  // 분:초 포맷 함수 (mm:ss 형태)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 블록 초기화 (5행 x 8열 = 40개, 연한 빨강 30% = 12개, 나머지 28개 균등/랜덤 분배)
  const initBricks = () => {
    const rows = 5;
    const cols = 8;
    const totalBricks = rows * cols;
    const redTargetCount = Math.round(totalBricks * 0.3); // 12개 (30%)

    const colors: { type: BrickColorType; code: string }[] = [
      { type: "light-red", code: "#f87171" }, // 연한 빨강 (미션 목표)
      { type: "light-orange", code: "#fb923c" }, // 연한 주황
      { type: "light-yellow", code: "#fde047" }, // 연한 노랑
      { type: "light-green", code: "#4ade80" }, // 연한 녹색
      { type: "light-blue", code: "#60a5fa" }, // 연한 파랑
      { type: "light-purple", code: "#c084fc" }, // 연한 보라
    ];

    // 색상 배열 생성
    const brickTypes: { type: BrickColorType; code: string }[] = [];
    for (let i = 0; i < redTargetCount; i++) {
      brickTypes.push(colors[0]); // light-red
    }
    const otherColors = colors.slice(1);
    for (let i = redTargetCount; i < totalBricks; i++) {
      const randomColor = otherColors[Math.floor(Math.random() * otherColors.length)];
      brickTypes.push(randomColor);
    }

    // 셔플
    for (let i = brickTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [brickTypes[i], brickTypes[j]] = [brickTypes[j], brickTypes[i]];
    }

    const canvasWidth = 750;
    const padding = 10;
    const offsetTop = 45;
    const offsetSide = 25;
    const brickWidth = (canvasWidth - offsetSide * 2 - (cols - 1) * padding) / cols;
    const brickHeight = 22;

    const newBricks: Brick[] = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const item = brickTypes[idx++];
        newBricks.push({
          x: offsetSide + c * (brickWidth + padding),
          y: offsetTop + r * (brickHeight + padding),
          width: brickWidth,
          height: brickHeight,
          colorType: item.type,
          colorCode: item.code,
          isAlive: true,
        });
      }
    }

    bricksRef.current = newBricks;
  };

  // 공 및 패들 위치 초기화
  const resetBallAndPaddle = () => {
    paddleRef.current.x = (750 - paddleRef.current.width) / 2;
    ballRef.current.x = 375;
    ballRef.current.y = 410;
    // 약간의 랜덤 각도 상향 발사
    const angle = (Math.random() * 0.4 - 0.2) + Math.PI / 4; // 약 45도 내외
    const speed = 5.2;
    const direction = Math.random() > 0.5 ? 1 : -1;
    ballRef.current.vx = speed * Math.cos(angle) * direction;
    ballRef.current.vy = -Math.abs(speed * Math.sin(angle));
  };

  // 게임 시작 트리거
  const handleStartGame = () => {
    if (!playerName.trim()) {
      alert("사용자 이름을 입력해주세요!");
      return;
    }

    initBricks();
    resetBallAndPaddle();
    setLives(3);
    setRedClearedCount(0);
    setElapsedSeconds(0);
    setFinalTimeStr("00:00");
    setGameState("COUNTDOWN");
    setCountdown(3);

    // 배경음악 준비 및 재생 (볼륨 낮게 0.25)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.25;
      audioRef.current.play().catch(() => {});
    }
  };

  // 준비 카운트다운 (3, 2, 1) 타이머
  useEffect(() => {
    if (gameState !== "COUNTDOWN") return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setGameState("PLAYING");
    }
  }, [gameState, countdown]);

  // 플레이 중 경과 시간 타이머
  useEffect(() => {
    if (gameState === "PLAYING") {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState]);

  // 폭죽 효과 트리거
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 300);
    } catch (e) {
      console.error("Confetti error:", e);
    }
  };

  // 게임 클리어 처리
  const handleGameClear = useCallback(async (seconds: number) => {
    setGameState("CLEARED");
    const formatted = formatTime(seconds);
    setFinalTimeStr(formatted);
    soundEffects.playVictory();
    triggerConfetti();

    // 점수 저장 요청 (구글시트 API - 미션 성공 시에만 isCleared: true로 전송)
    setIsSubmittingScore(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName,
          score: 100, // 성공 점수
          timeSeconds: seconds,
          formattedTime: formatted,
          isCleared: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.topScores) {
          setTopScores(data.topScores);
        }
      }
    } catch (e) {
      console.error("Save score error:", e);
    } finally {
      setIsSubmittingScore(false);
    }
  }, [playerName]);

  // 게임 실패 처리
  const handleGameOver = useCallback(() => {
    setGameState("FAILED");
    soundEffects.playLifeLost();
  }, []);

  // 일시정지 및 재개
  const togglePause = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      if (audioRef.current) audioRef.current.pause();
    } else if (gameState === "PAUSED") {
      setGameState("PLAYING");
      if (audioRef.current && !isMuted) audioRef.current.play().catch(() => {});
    }
  };

  // 다시 시작 (이름 작성 화면으로 이동)
  const handleRestartToNameScreen = () => {
    setGameState("START");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
  };

  // 게임 종료 (초기화)
  const handleQuitGame = () => {
    setGameState("START");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // 오디오 음소거 토글
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // 키보드 방향키 리스너 (좌우 방향키로만 패들 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.code === "ArrowLeft") {
        keysRef.current.left = true;
      }
      if (e.key === "ArrowRight" || e.code === "ArrowRight") {
        keysRef.current.right = true;
      }
      if (e.code === "Space" && (gameStateRef.current === "PLAYING" || gameStateRef.current === "PAUSED")) {
        togglePause();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.code === "ArrowLeft") {
        keysRef.current.left = false;
      }
      if (e.key === "ArrowRight" || e.code === "ArrowRight") {
        keysRef.current.right = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 모바일 터치 및 스와이프 제어
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = touch.clientX;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (touchStartRef.current === null) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current;

    // 감도 조절 및 패들 이동
    const sensitivity = 1.35;
    const newPaddleX = paddleRef.current.x + diffX * sensitivity;
    paddleRef.current.x = Math.max(0, Math.min(750 - paddleRef.current.width, newPaddleX));

    touchStartRef.current = touch.clientX;
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // 캔버스 렌더링 및 물리 엔진 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localRedCleared = redClearedCount;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. 패들 키보드 입력 처리
      if (gameStateRef.current === "PLAYING") {
        if (keysRef.current.left) {
          paddleRef.current.x -= paddleRef.current.speed;
        }
        if (keysRef.current.right) {
          paddleRef.current.x += paddleRef.current.speed;
        }
        paddleRef.current.x = Math.max(0, Math.min(canvas.width - paddleRef.current.width, paddleRef.current.x));
      }

      // 2. 공 물리 업데이트 (PLAYING 상태일 때만)
      if (gameStateRef.current === "PLAYING") {
        const ball = ballRef.current;
        const paddle = paddleRef.current;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // 좌우 벽 충돌
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx;
        } else if (ball.x + ball.radius >= canvas.width) {
          ball.x = canvas.width - ball.radius;
          ball.vx = -ball.vx;
        }

        // 상단 벽 충돌
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = -ball.vy;
        }

        // 패들 충돌 판정
        if (
          ball.y + ball.radius >= 460 &&
          ball.y - ball.radius <= 460 + paddle.height &&
          ball.x >= paddle.x &&
          ball.x <= paddle.x + paddle.width &&
          ball.vy > 0
        ) {
          soundEffects.playPaddleHit();
          // 패들 부딪힌 위치에 따른 각도 변형 반사
          const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
          const maxBounceAngle = Math.PI / 3; // 60도
          const bounceAngle = hitPoint * maxBounceAngle;
          const currentSpeed = Math.hypot(ball.vx, ball.vy);
          ball.vx = currentSpeed * Math.sin(bounceAngle);
          ball.vy = -Math.abs(currentSpeed * Math.cos(bounceAngle));
        }

        // 벽돌 충돌 판정
        for (const brick of bricksRef.current) {
          if (!brick.isAlive) continue;

          if (
            ball.x + ball.radius >= brick.x &&
            ball.x - ball.radius <= brick.x + brick.width &&
            ball.y + ball.radius >= brick.y &&
            ball.y - ball.radius <= brick.y + brick.height
          ) {
            brick.isAlive = false;
            ball.vy = -ball.vy;

            const isRed = brick.colorType === "light-red";
            soundEffects.playBrickHit(isRed);

            if (isRed) {
              localRedCleared += 1;
              setRedClearedCount(localRedCleared);

              // 빨간 블록 타격 시 엄지척 팝업 효과 (1.2초간 표시)
              setShowThumbsUp(true);
              setTimeout(() => {
                setShowThumbsUp(false);
              }, 1200);

              // 연한 빨강 3개 제거 시 승리 미션 완료!
              if (localRedCleared >= 3) {
                handleGameClear(elapsedSeconds);
                return;
              }
            }
            break;
          }
        }

        // 바닥 추락 판정 (생명 감소 또는 게임 오버)
        if (ball.y - ball.radius > canvas.height) {
          soundEffects.playLifeLost();
          setLives((prevLives) => {
            const nextLives = prevLives - 1;
            if (nextLives <= 0) {
              handleGameOver();
            } else {
              resetBallAndPaddle();
            }
            return nextLives;
          });
        }
      }

      // 3. 그리기: 벽돌
      for (const brick of bricksRef.current) {
        if (!brick.isAlive) continue;

        // 입체감 있는 둥근 사각형 그리기
        ctx.fillStyle = brick.colorCode;
        ctx.beginPath();
        const r = 4;
        ctx.roundRect(brick.x, brick.y, brick.width, brick.height, r);
        ctx.fill();

        // 연한 빨강 타겟 블록은 강조 테두리 표시
        if (brick.colorType === "light-red") {
          ctx.strokeStyle = "#fecaca";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 반짝이는 심볼
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(brick.x + brick.width / 2, brick.y + brick.height / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. 그리기: 패들
      const paddle = paddleRef.current;
      const paddleGradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
      paddleGradient.addColorStop(0, "#38bdf8");
      paddleGradient.addColorStop(0.5, "#818cf8");
      paddleGradient.addColorStop(1, "#c084fc");
      ctx.fillStyle = paddleGradient;
      ctx.beginPath();
      ctx.roundRect(paddle.x, 460, paddle.width, paddle.height, 6);
      ctx.fill();

      // 패들 하이라이트 라인
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 5. 그리기: 공 (인천대 횃불이 오라 효과)
      const ball = ballRef.current;
      const ballGlow = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.radius * 2);
      ballGlow.addColorStop(0, "#fbbf24");
      ballGlow.addColorStop(0.6, "#f97316");
      ballGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = ballGlow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // 다음 프레임 요청
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [redClearedCount, elapsedSeconds, handleGameClear, handleGameOver]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col items-center p-3 md:p-6 select-none">
      {/* 배경 오디오 엘리먼트 */}
      <audio ref={audioRef} src="/Hyper_Speed_Run.mp3" loop preload="auto" />

      {/* 헤더 및 타이틀 */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-amber-400/50 shadow-md">
            <Image src="/Mascot.jpg" alt="횃불이" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent flex items-center gap-1.5">
              <span>INU 벽돌깨기</span>
              <Flame className="w-5 h-5 text-amber-400 fill-amber-400 inline animate-pulse" />
            </h1>
            <p className="text-xs text-slate-400">인천대학교 공식 마스코트 횃불이 특별 에디션</p>
          </div>
        </div>

        {/* 배경음 볼륨 제어 버튼 */}
        <button
          onClick={toggleMute}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 transition-all border border-slate-700"
          title={isMuted ? "배경음 켜기" : "배경음 음소거"}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          <span>{isMuted ? "음소거" : "BGM ON"}</span>
        </button>
      </header>

      {/* 화면 1: 시작 화면 (이름 입력, 학적 정보, 횃불이 마스코트, 랭킹 Top3) */}
      {gameState === "START" && (
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center my-auto transition-all animate-in fade-in zoom-in-95">
          {/* 마스코트 이미지 */}
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-xl border-2 border-amber-400/60 mb-4 group hover:scale-105 transition-transform duration-300">
            <Image src="/Mascot.jpg" alt="인천대학교 마스코트 횃불이" fill priority className="object-cover" />
          </div>

          <h2 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
            <span>횃불이와 함께하는 벽돌깨기</span>
          </h2>
          <p className="text-xs text-amber-300/90 mb-5 flex items-center justify-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            연한 빨강 블록을 3개 깨뜨리면 미션 클리어!
          </p>

          {/* 플레이어 이름 입력 */}
          <div className="w-full mb-5">
            <label htmlFor="playerName" className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
              플레이어 이름
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="이름을 입력하세요 (예: 횃불이)"
              maxLength={12}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStartGame();
              }}
            />
          </div>

          {/* 게임 시작 버튼 */}
          <button
            onClick={handleStartGame}
            className="w-full py-3 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 active:scale-95 transition-all text-base flex items-center justify-center gap-2 mb-6"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>게임 시작</span>
          </button>

          {/* 명예의 전당 Top 3 */}
          <div className="w-full border-t border-slate-800/80 pt-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                명예의 전당 Top 3
              </span>
              <span className="text-[10px] text-slate-500">구글시트 실시간 연동</span>
            </div>
            <div className="space-y-1.5">
              {topScores.length > 0 ? (
                topScores.map((score, index) => (
                  <div
                    key={score.id || index}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          index === 0
                            ? "bg-amber-400 text-black"
                            : index === 1
                            ? "bg-slate-300 text-black"
                            : "bg-amber-700 text-white"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-slate-200 font-medium">{score.name}</span>
                    </span>
                    <span className="font-mono text-amber-300 font-semibold">{score.formattedTime}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 text-center py-2">등록된 랭킹 기록이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 화면 2: 게임 플레이 / 카운트다운 / 일시정지 / 게임 결과 화면 */}
      {gameState !== "START" && (
        <div className="w-full max-w-3xl flex flex-col items-center">
          {/* 상태 표시 바 (생명, 시간, 미션 목표, 컨트롤 버튼) */}
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-lg backdrop-blur-sm">
            {/* 좌측: 생명 및 타겟 블록 진행 상황 */}
            <div className="flex items-center gap-4">
              {/* 생명 표시 (3개) */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-1 hidden sm:inline">생명</span>
                {[1, 2, 3].map((heart) => (
                  <Heart
                    key={heart}
                    className={`w-5 h-5 transition-all ${
                      heart <= lives ? "text-rose-500 fill-rose-500 scale-100" : "text-slate-700 scale-90"
                    }`}
                  />
                ))}
              </div>

              {/* 연한 빨강 블록 미션 카운트 (3개) */}
              <div className="flex items-center gap-1.5 bg-rose-950/50 border border-rose-800/50 px-2.5 py-1 rounded-lg">
                <Target className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-rose-300 font-medium">
                  빨강 블록: <strong className="text-rose-200 font-bold">{redClearedCount}</strong> / 3
                </span>
              </div>
            </div>

            {/* 중앙: 경과 시간 (분:초) */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-lg">
              <TimerIcon className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-mono font-bold text-amber-300">{formatTime(elapsedSeconds)}</span>
            </div>

            {/* 우측: 멈춤 / 재시작 / 종료 버튼 */}
            <div className="flex items-center gap-1.5">
              {/* 중간 멈춤 / 재개 버튼 */}
              <button
                onClick={togglePause}
                disabled={gameState === "COUNTDOWN" || gameState === "FAILED" || gameState === "CLEARED"}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition-all disabled:opacity-50"
              >
                {gameState === "PAUSED" ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    <span>재개</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current text-amber-400" />
                    <span>멈춤</span>
                  </>
                )}
              </button>

              {/* 다시 시작 버튼 (이름 작성 화면으로 이동) */}
              <button
                onClick={handleRestartToNameScreen}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition-all"
                title="이름 작성 화면으로 이동"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                <span>다시 시작</span>
              </button>

              {/* 게임 종료 버튼 */}
              <button
                onClick={handleQuitGame}
                className="px-2.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800/80 text-xs font-semibold text-rose-200 flex items-center gap-1 transition-all border border-rose-800/50"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span>종료</span>
              </button>
            </div>
          </div>

          {/* 연한 빨강 블록 타격 시 엄지척 팝업 효과 */}
          {showThumbsUp && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in zoom-in-75 fade-in duration-200">
              <div className="bg-slate-900/90 border-2 border-amber-400 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce">
                <span className="text-4xl">👍</span>
                <div>
                  <div className="text-amber-300 font-extrabold text-lg flex items-center gap-1">
                    <span>나이스 샷!</span>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xs text-rose-300 font-semibold">빨간 블록 명중!</div>
                </div>
              </div>
            </div>
          )}

          {/* 캔버스 게임 화면 영역 */}
          <div className="relative w-full max-w-[750px] aspect-[750/500] bg-slate-900/90 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={750}
              height={500}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full object-contain touch-none cursor-ew-resize"
            />

            {/* 1. 카운트다운 오버레이 (3, 2, 1) */}
            {gameState === "COUNTDOWN" && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
                <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-2">Ready</span>
                <span className="text-8xl font-black text-white animate-ping duration-700 font-mono">
                  {countdown}
                </span>
                <p className="text-xs text-slate-400 mt-4">좌우 방향키 또는 좌우 스와이프로 패들을 움직이세요!</p>
              </div>
            )}

            {/* 2. 일시정지 오버레이 */}
            {gameState === "PAUSED" && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
                <h3 className="text-3xl font-extrabold text-amber-400 mb-2">게임 일시정지</h3>
                <p className="text-xs text-slate-400 mb-6">스페이스바를 누르거나 아래 재개 버튼을 누르세요.</p>
                <button
                  onClick={togglePause}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>게임 재개</span>
                </button>
              </div>
            )}

            {/* 3. 게임 미션 실패 오버레이 */}
            {gameState === "FAILED" && (
              <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/40 mb-3">
                  <Heart className="w-8 h-8 text-rose-500" />
                </div>
                <h3 className="text-2xl font-black text-rose-300 mb-1">게임 미션 실패</h3>
                <p className="text-xs text-rose-200/80 mb-5">공을 세 번 놓쳐 미션을 완수하지 못했습니다.</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRestartToNameScreen}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>처음으로 이동</span>
                  </button>
                  <button
                    onClick={handleStartGame}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>바로 재도전</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. 게임 미션 성공/완료 오버레이 (폭죽 + 완료 시간 출력 + Top3) */}
            {gameState === "CLEARED" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 mb-3 shadow-lg">
                  <Image src="/Mascot.jpg" alt="횃불이" fill className="object-cover" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent mb-1">
                  게임 미션 완료! 🎉
                </h3>
                <p className="text-xs text-slate-300 mb-4">
                  <span className="font-bold text-amber-300">{playerName}</span> 님이 연한 빨강 블록 3개를 모두 제거했습니다!
                </p>

                {/* 최종 완료 시간 (분:초) */}
                <div className="bg-slate-900 border border-amber-400/40 rounded-xl px-6 py-3 mb-5 shadow-inner">
                  <div className="text-[11px] text-slate-400">최종 완료 시간</div>
                  <div className="text-3xl font-black font-mono text-amber-300 tracking-wider">
                    {finalTimeStr}
                  </div>
                  {isSubmittingScore && <div className="text-[10px] text-slate-400 mt-1">구글 시트 랭킹 기록 중...</div>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRestartToNameScreen}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>새 게임 시작 (이름 변경)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 모바일 & PC 조작 가이드 안내 */}
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 px-2 mt-3">
            <span className="hidden sm:inline">💻 PC 조작: 좌우 방향키 [←] [→] 로 이동 / 스페이스바로 멈춤</span>
            <span className="sm:hidden">📱 모바일 조작: 화면을 좌우로 스와이프하여 패들 조작</span>
            <span className="text-slate-500">인천대학교 횃불이 에디션</span>
          </div>
        </div>
      )}
    </main>
  );
}
