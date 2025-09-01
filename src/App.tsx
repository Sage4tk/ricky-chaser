import rickyImg from "./assets/sfx/rickyimg.png";
import seedsImg from "./assets/seeds.png";
// SFX imports
import sfx1 from "./assets/sfx/ricky3.mp3";
import sfx2 from "./assets/sfx/ricky4.mp3";
import sfx3 from "./assets/sfx/ricky5.mp3";
import sfx4 from "./assets/sfx/ricky6.mp3";
import sfx5 from "./assets/sfx/ricky7.mp3";
import swipeBgm from "./assets/swipe.wav";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import "./App.css";

// Persistent BGM audio object for the app lifetime
let bgmAudio: HTMLAudioElement | null = null;

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const DEBRIS_WIDTH = 30;
const DEBRIS_HEIGHT = 30;
const INITIAL_DEBRIS_SPEED = 3;
const MAX_DEBRIS_SPEED = 12;
const SPEED_INCREASE_INTERVAL = 2000; // ms
const SPEED_INCREASE_AMOUNT = 0.3;
const PLAYER_SPEED = 4;
const DEBRIS_INTERVAL = 1000; // ms

function getRandomX() {
  return Math.floor(Math.random() * (GAME_WIDTH - DEBRIS_WIDTH));
}

function App() {
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
  const [debris, setDebris] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [debrisSpeed, setDebrisSpeed] = useState(INITIAL_DEBRIS_SPEED);
  const debrisSpeedRef = useRef(INITIAL_DEBRIS_SPEED);
  useEffect(() => {
    debrisSpeedRef.current = debrisSpeed;
  }, [debrisSpeed]);
  const gameRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null) as MutableRefObject<
    number | null
  >;
  const debrisId = useRef(0);
  const leftPressedRef = useRef(false);
  const rightPressedRef = useRef(false);
  const moveIntervalRef = useRef<number | null>(null);

  // Debris speed increases over time
  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setDebrisSpeed((speed) =>
        speed < MAX_DEBRIS_SPEED ? speed + SPEED_INCREASE_AMOUNT : speed
      );
    }, SPEED_INCREASE_INTERVAL);
    return () => clearInterval(interval);
  }, [gameOver]);
  useEffect(() => {
    if (!bgmAudio) {
      bgmAudio = new Audio(swipeBgm);
      bgmAudio.loop = true;
      bgmAudio.volume = 0.5;
    }
    let started = !bgmAudio.paused;
    function startAudio() {
      if (!started && bgmAudio) {
        bgmAudio.play().catch(() => {});
        started = true;
      }
    }
    window.addEventListener("keydown", startAudio, { once: true });
    window.addEventListener("mousedown", startAudio, { once: true });
    return () => {
      window.removeEventListener("keydown", startAudio);
      window.removeEventListener("mousedown", startAudio);
    };
  }, []);

  // Player movement: smooth movement when holding arrow keys
  useEffect(() => {
    if (gameOver) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === "ArrowLeft") {
        leftPressedRef.current = true;
        if (!moveIntervalRef.current) {
          moveIntervalRef.current = window.setInterval(() => {
            setPlayerX((x) => Math.max(0, x - PLAYER_SPEED));
          }, 16);
        }
      } else if (e.key === "ArrowRight") {
        rightPressedRef.current = true;
        if (!moveIntervalRef.current) {
          moveIntervalRef.current = window.setInterval(() => {
            setPlayerX((x) =>
              Math.min(GAME_WIDTH - PLAYER_WIDTH, x + PLAYER_SPEED)
            );
          }, 16);
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        leftPressedRef.current = false;
      } else if (e.key === "ArrowRight") {
        rightPressedRef.current = false;
      }
      if (
        !leftPressedRef.current &&
        !rightPressedRef.current &&
        moveIntervalRef.current
      ) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
      leftPressedRef.current = false;
      rightPressedRef.current = false;
    };
  }, [gameOver]);

  // Debris falling logic and scoring per block dodged
  useEffect(() => {
    if (gameOver) return;
    const sfxList = [sfx1, sfx2, sfx3, sfx4, sfx5];
    function playRandomSfx() {
      const idx = Math.floor(Math.random() * sfxList.length);
      const audio = new Audio(sfxList[idx]);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    }
    function spawnDebris() {
      // 25% chance to spawn 2-3 blocks, otherwise 1 block
      const burst = Math.random() < 0.25;
      const count = burst ? 2 + Math.floor(Math.random() * 2) : 1;
      setDebris((ds) => {
        // Try to avoid overlapping blocks in a burst
        let xs: number[] = [];
        for (let i = 0; i < count; ++i) {
          let x: number;
          let attempts = 0;
          do {
            x = getRandomX();
            attempts++;
          } while (
            xs.some((xx) => Math.abs(xx - x) < DEBRIS_WIDTH + 5) &&
            attempts < 10
          );
          xs.push(x);
        }
        return [...ds, ...xs.map((x) => ({ id: debrisId.current++, x, y: 0 }))];
      });
    }

    let debrisTimer = setInterval(spawnDebris, DEBRIS_INTERVAL);

    function animate() {
      setDebris((ds) => {
        let dodged = 0;
        const next = ds
          .map((d) => ({ ...d, y: d.y + debrisSpeedRef.current }))
          .filter((d) => {
            if (d.y >= GAME_HEIGHT) {
              dodged++;
              return false;
            }
            return true;
          });
        if (dodged > 0) {
          setScore((s) => s + dodged);
          // 30% chance to play a random SFX per score event
          if (Math.random() < 0.1) playRandomSfx();
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(animate);
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      clearInterval(debrisTimer);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameOver]);

  // Collision detection
  useEffect(() => {
    for (let d of debris) {
      if (
        d.y + DEBRIS_HEIGHT > GAME_HEIGHT - PLAYER_HEIGHT &&
        d.x < playerX + PLAYER_WIDTH &&
        d.x + DEBRIS_WIDTH > playerX
      ) {
        setGameOver(true);
        break;
      }
    }
  }, [debris, playerX]);

  function handleRestart() {
    setPlayerX(GAME_WIDTH / 2 - PLAYER_WIDTH / 2);
    setDebris([]);
    setGameOver(false);
    setScore(0);
    setDebrisSpeed(INITIAL_DEBRIS_SPEED);
    debrisId.current = 0;
  }

  return (
    <>
      <div
        className="game-container"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        ref={gameRef}
      >
        <div className="kerb kerb-left" />
        <div className="kerb kerb-right" />
        <div className="track" />
        {/* Mobile touch controls */}
        <div
          className="mobile-controls"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            justifyContent: "space-between",
            pointerEvents: "auto",
            zIndex: 20,
          }}
        >
          <button
            className="mobile-btn"
            style={{
              width: 60,
              height: 60,
              margin: 12,
              opacity: 0.5,
              fontSize: 32,
              borderRadius: 30,
              border: "none",
              background: "#fff",
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              setPlayerX((x) => Math.max(0, x - PLAYER_WIDTH));
            }}
            onMouseDown={() => setPlayerX((x) => Math.max(0, x - PLAYER_WIDTH))}
            tabIndex={-1}
          >
            ◀
          </button>
          <button
            className="mobile-btn"
            style={{
              width: 60,
              height: 60,
              margin: 12,
              opacity: 0.5,
              fontSize: 32,
              borderRadius: 30,
              border: "none",
              background: "#fff",
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              setPlayerX((x) =>
                Math.min(GAME_WIDTH - PLAYER_WIDTH, x + PLAYER_WIDTH)
              );
            }}
            onMouseDown={() =>
              setPlayerX((x) =>
                Math.min(GAME_WIDTH - PLAYER_WIDTH, x + PLAYER_WIDTH)
              )
            }
            tabIndex={-1}
          >
            ▶
          </button>
        </div>
        <img
          src={rickyImg}
          className="player"
          alt="player"
          style={{
            left: playerX,
            width: PLAYER_WIDTH * 2,
            height: PLAYER_HEIGHT * 2,
            bottom: 0,
            position: "absolute",
            pointerEvents: "none",
          }}
        />
        {debris.map((d) => (
          <img
            key={d.id}
            src={seedsImg}
            className="debris"
            alt="seed"
            style={{
              left: d.x,
              top: d.y,
              width: DEBRIS_WIDTH,
              height: DEBRIS_HEIGHT,
              position: "absolute",
              pointerEvents: "none",
            }}
          />
        ))}
        <div className="score">Score: {score}</div>
        {gameOver && (
          <div className="game-over">
            <div>Game Over!</div>
            <div>Score: {score}</div>
            <button onClick={handleRestart}>Restart</button>
          </div>
        )}
      </div>
      <div className="music-credit">SWIPE by Ricky</div>
    </>
  );
}

export default App;
