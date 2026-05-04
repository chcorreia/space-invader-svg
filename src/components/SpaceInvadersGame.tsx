import { useEffect, useRef, useState } from "react";
import { playPlayerShoot, playEnemyShoot, playPlayerExplosion, playEnemyExplosion, playSiren, playRaverKill, playTada, suspendAudio, resumeAudio } from "@/lib/sounds";

function LifeIcon() {
  return (
    <svg width="20" height="15" viewBox="0 0 40 30" aria-label="life">
      <polygon points="20,0 40,30 34,26 20,22 6,26 0,30" fill="#00ff00" />
      <circle cx="20" cy="12" r="4" fill="#00ffff" />
      <rect x="17" y="24" width="6" height="4" fill="#ff6600" />
    </svg>
  );
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let r = "", n = num;
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 30;
const INVADER_WIDTH = 30;
const INVADER_HEIGHT = 24;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 12;
const INVADER_COLS = 8;
const INVADER_ROWS = 4;
const INVADER_PADDING = 12;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const INVADER_BULLET_SPEED = 3;
const INVADER_SHOOT_CHANCE = 0.003;

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  dy: number;
  dx?: number;
  homing?: boolean;
  color?: string;
}

interface Explosion {
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
  color: string;
  size: number;
}

interface GameState {
  player: Entity;
  invaders: (Entity & { row: number })[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  explosions: Explosion[];
  score: number;
  lives: number;
  invaderDir: number;
  invaderSpeed: number;
  gameOver: boolean;
  won: boolean;
  playerRespawnTimer: number;
  stars: { x: number; y: number; size: number; speed: number }[];
  wave: number;
  baseSpeed: number;
  waveStartFrame: number;
  bossIndex: number | null;
  bossActivateFrame: number | null;
  bossEndFrame: number | null;
  bossLastShot: number;
  raverCount: number;
  nextRaverDelay: number;
  nextLifeScore: number;
  stopSiren: (() => void) | null;
}

function createStars(count: number) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.5 + 0.1,
  }));
}

function createInvaders(): (Entity & { row: number })[] {
  const invaders: (Entity & { row: number })[] = [];
  const startX = (CANVAS_WIDTH - (INVADER_COLS * (INVADER_WIDTH + INVADER_PADDING))) / 2;
  for (let row = 0; row < INVADER_ROWS; row++) {
    for (let col = 0; col < INVADER_COLS; col++) {
      invaders.push({
        x: startX + col * (INVADER_WIDTH + INVADER_PADDING),
        y: 50 + row * (INVADER_HEIGHT + INVADER_PADDING),
        width: INVADER_WIDTH,
        height: INVADER_HEIGHT,
        alive: true,
        row,
      });
    }
  }
  return invaders;
}

function initGame(): GameState {
  return {
    player: { x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, alive: true },
    invaders: createInvaders(),
    bullets: [],
    enemyBullets: [],
    explosions: [],
    score: 0,
    lives: 3,
    invaderDir: 1,
    invaderSpeed: 1,
    gameOver: false,
    won: false,
    playerRespawnTimer: 0,
    stars: createStars(80),
    wave: 1,
    baseSpeed: 1,
    waveStartFrame: 0,
    bossIndex: null,
    bossActivateFrame: null,
    bossEndFrame: null,
    bossLastShot: 0,
    raverCount: 0,
    nextRaverDelay: 0,
    nextLifeScore: 5000,
    stopSiren: null,
  };
}

const INVADER_COLORS = ["#00ff00", "#00ffff", "#ff00ff", "#ffff00"];

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#00ff00";
  // Ship body
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_WIDTH / 2, y);
  ctx.lineTo(x + PLAYER_WIDTH, y + PLAYER_HEIGHT);
  ctx.lineTo(x + PLAYER_WIDTH - 6, y + PLAYER_HEIGHT - 4);
  ctx.lineTo(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT - 8);
  ctx.lineTo(x + 6, y + PLAYER_HEIGHT - 4);
  ctx.lineTo(x, y + PLAYER_HEIGHT);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = "#00ffff";
  ctx.beginPath();
  ctx.arc(x + PLAYER_WIDTH / 2, y + 12, 4, 0, Math.PI * 2);
  ctx.fill();
  // Engine glow
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(x + PLAYER_WIDTH / 2 - 3, y + PLAYER_HEIGHT - 6, 6, 4);
}

function drawInvader(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, frame: number) {
  const color = row === -1 ? "#ffff00" : INVADER_COLORS[row % INVADER_COLORS.length];
  ctx.fillStyle = color;
  const w = INVADER_WIDTH;
  const h = INVADER_HEIGHT;
  // Body
  ctx.fillRect(x + 4, y, w - 8, h - 6);
  // Eyes
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(x + 8, y + 4, 4, 4);
  ctx.fillRect(x + w - 12, y + 4, 4, 4);
  // Eye glow
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 9, y + 5, 2, 2);
  ctx.fillRect(x + w - 11, y + 5, 2, 2);
  // Tentacles (animated)
  ctx.fillStyle = color;
  const tentacleOffset = frame % 2 === 0 ? 2 : -2;
  ctx.fillRect(x, y + h - 10 + tentacleOffset, 4, 8);
  ctx.fillRect(x + w - 4, y + h - 10 - tentacleOffset, 4, 8);
  ctx.fillRect(x + 10, y + h - 6, 4, 6);
  ctx.fillRect(x + w - 14, y + h - 6, 4, 6);
}

function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, isEnemy: boolean) {
  const color = b.color || (isEnemy ? "#ff0000" : "#00ffff");
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  if (b.homing) {
    ctx.beginPath();
    ctx.arc(b.x + BULLET_WIDTH / 2, b.y + BULLET_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
  }
  ctx.shadowBlur = 0;
}

function collides(a: { x: number; y: number; width?: number; height?: number }, b: { x: number; y: number; width: number; height: number }) {
  const aw = a.width || BULLET_WIDTH;
  const ah = a.height || BULLET_HEIGHT;
  return a.x < b.x + b.width && a.x + aw > b.x && a.y < b.y + b.height && a.y + ah > b.y;
}

export default function SpaceInvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(initGame());
  const keysRef = useRef<Set<string>>(new Set());
  const frameRef = useRef(0);
  const animFrameRef = useRef(0);
  const lastShotRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayWave, setDisplayWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const pausedRef = useRef(false);
  const godModeRef = useRef(false);

  const resetGame = () => {
    gameRef.current = initGame();
    frameRef.current = 0;
    lastShotRef.current = 0;
    setDisplayScore(0);
    setDisplayLives(3);
    setDisplayWave(1);
    setGameOver(false);
    setWon(false);
    setStarted(false);
    setTimeout(() => setStarted(true), 0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") {
        godModeRef.current = !godModeRef.current;
        setGodMode(godModeRef.current);
        return;
      }
      if (e.key === "Escape") {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        if (pausedRef.current) suspendAudio(); else resumeAudio();
        return;
      }
      keysRef.current.add(e.key);
      if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = () => {
      const g = gameRef.current;
      if (g.gameOver || g.won) {
        if (g.stopSiren) { g.stopSiren(); g.stopSiren = null; }
        setGameOver(g.gameOver);
        setWon(g.won);
        return;
      }
      if (pausedRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      frameRef.current++;
      const frame = frameRef.current;

      // Input
      if (keysRef.current.has("ArrowLeft")) g.player.x = Math.max(0, g.player.x - PLAYER_SPEED);
      if (keysRef.current.has("ArrowRight")) g.player.x = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, g.player.x + PLAYER_SPEED);
      if (keysRef.current.has(" ") && frame - lastShotRef.current > 15 && g.bullets.length < 3 && g.playerRespawnTimer <= 0) {
        g.bullets.push({ x: g.player.x + PLAYER_WIDTH / 2 - 2, y: g.player.y, dy: -BULLET_SPEED });
        lastShotRef.current = frame;
        playPlayerShoot();
      }

      // Move bullets
      g.bullets = g.bullets.filter((b) => { b.y += b.dy; return b.y > -BULLET_HEIGHT; });
      const playerCx = g.player.x + PLAYER_WIDTH / 2;
      const homingMaxDx = PLAYER_SPEED * 0.7; // 30% slower than player horizontally
      g.enemyBullets = g.enemyBullets.filter((b) => {
        if (b.homing) {
          const targetDx = playerCx - (b.x + BULLET_WIDTH / 2);
          const desired = Math.sign(targetDx) * Math.min(Math.abs(targetDx), homingMaxDx);
          // smooth steering
          b.dx = (b.dx ?? 0) + (desired - (b.dx ?? 0)) * 0.1;
          b.x += b.dx;
        } else if (b.dx) {
          b.x += b.dx;
        }
        b.y += b.dy;
        return b.y < CANVAS_HEIGHT && b.x > -20 && b.x < CANVAS_WIDTH + 20;
      });

      // Invader movement
      if (frame % Math.max(1, Math.floor(30 / g.invaderSpeed)) === 0) {
        let hitEdge = false;
        for (const inv of g.invaders) {
          if (!inv.alive) continue;
          if ((g.invaderDir > 0 && inv.x + inv.width >= CANVAS_WIDTH - 10) || (g.invaderDir < 0 && inv.x <= 10)) {
            hitEdge = true;
            break;
          }
        }
        if (hitEdge) {
          g.invaderDir *= -1;
          for (const inv of g.invaders) if (inv.alive) inv.y += 12;
        }
        for (const inv of g.invaders) if (inv.alive) inv.x += g.invaderDir * 8;
      }

      // Invader shooting
      const aliveInvaders = g.invaders.filter((i) => i.alive);
      for (const inv of aliveInvaders) {
        if (Math.random() < INVADER_SHOOT_CHANCE) {
          g.enemyBullets.push({ x: inv.x + inv.width / 2 - 2, y: inv.y + inv.height, dy: INVADER_BULLET_SPEED });
          playEnemyShoot();
        }
      }

      // Raver scheduling (wave 1+)
      if (g.waveStartFrame === 0) {
        g.waveStartFrame = frame;
        g.raverCount = 0;
        const lower = Math.max(0, 30 - 5 * (g.wave - 1));
        const upper = Math.max(20, 50 - 5 * (g.wave - 1));
        g.nextRaverDelay = 60 * (lower + Math.random() * (upper - lower));
        g.bossActivateFrame = frame + g.nextRaverDelay;
        g.bossEndFrame = null;
        g.bossIndex = null;
      }
      // Activate raver
      if (g.bossActivateFrame !== null && frame >= g.bossActivateFrame && g.bossEndFrame === null) {
        const aliveIdx = g.invaders.map((inv, i) => inv.alive ? i : -1).filter((i) => i >= 0);
        if (aliveIdx.length > 0) {
          g.bossIndex = aliveIdx[Math.floor(Math.random() * aliveIdx.length)];
          g.bossEndFrame = frame + 60 * 10;
          g.bossLastShot = 0;
          if (g.stopSiren) g.stopSiren();
          g.stopSiren = playSiren();
        }
        g.bossActivateFrame = null;
      }
      // Raver active
      if (g.bossEndFrame !== null && g.bossIndex !== null) {
        const boss = g.invaders[g.bossIndex];
        const bossEnded = !boss || !boss.alive || frame >= g.bossEndFrame;
        if (bossEnded) {
          if (g.stopSiren) { g.stopSiren(); g.stopSiren = null; }
          g.bossEndFrame = null;
          g.bossIndex = null;
          // Restart timer with 50% shorter delay each new raver
          g.raverCount++;
          g.nextRaverDelay = g.nextRaverDelay * 0.5;
          g.bossActivateFrame = frame + g.nextRaverDelay;
        } else {
          // Only shoot if no active raver bomb exists
          const hasActiveBomb = g.enemyBullets.some((b) => b.homing);
          if (!hasActiveBomb && frame - g.bossLastShot > 30) {
            g.enemyBullets.push({
              x: boss.x + boss.width / 2 - 2,
              y: boss.y + boss.height,
              dy: INVADER_BULLET_SPEED * 0.5,
              dx: 0,
              homing: true,
              color: "#ffff00",
            });
            g.bossLastShot = frame;
            playEnemyShoot();
          }
        }
      }

      // Bullet-invader collision
      for (const bullet of g.bullets) {
        for (let idx = 0; idx < g.invaders.length; idx++) {
          const inv = g.invaders[idx];
          if (inv.alive && collides(bullet, inv)) {
            const isRaver = g.bossIndex === idx && g.bossEndFrame !== null;
            inv.alive = false;
            bullet.y = -100;
            g.score += (INVADER_ROWS - inv.row) * 10;
            if (isRaver) {
              g.score += 50;
              playRaverKill();
            }
            g.invaderSpeed = g.baseSpeed * (1 + (g.invaders.filter((i) => !i.alive).length / g.invaders.length) * 3);
            const color = isRaver ? "#ffff00" : INVADER_COLORS[inv.row % INVADER_COLORS.length];
            g.explosions.push({ x: inv.x + inv.width / 2, y: inv.y + inv.height / 2, frame: 0, maxFrames: 12, color, size: 20 });
            playEnemyExplosion();
          }
        }
      }

      // Enemy bullet-player collision
      if (g.playerRespawnTimer > 0) {
        g.playerRespawnTimer--;
      } else if (!godModeRef.current) {
        for (const bullet of g.enemyBullets) {
          if (collides(bullet, g.player)) {
            bullet.y = CANVAS_HEIGHT + 100;
            g.lives--;
            g.explosions.push({ x: g.player.x + PLAYER_WIDTH / 2, y: g.player.y + PLAYER_HEIGHT / 2, frame: 0, maxFrames: 30, color: "#00ff00", size: 35 });
            playPlayerExplosion();
            if (g.lives <= 0) {
              g.gameOver = true;
            } else {
              g.playerRespawnTimer = 60;
            }
            break;
          }
        }
      }

      // Update explosions
      g.explosions = g.explosions.filter((e) => { e.frame++; return e.frame < e.maxFrames; });

      // Check invaders reaching player
      if (!godModeRef.current) {
        for (const inv of aliveInvaders) {
          if (inv.y + inv.height >= g.player.y) g.gameOver = true;
        }
      }

      // Extra life every 5000 points
      while (g.score >= g.nextLifeScore) {
        g.lives++;
        g.nextLifeScore += 5000;
      }

      // Next wave
      if (aliveInvaders.length === 0) {
        playTada();
        if (g.wave % 10 === 0) g.lives++;
        g.wave++;
        g.baseSpeed *= 1.2;
        g.invaderSpeed = g.baseSpeed;
        g.invaderDir = 1;
        g.invaders = createInvaders();
        g.bullets = [];
        g.enemyBullets = [];
        g.waveStartFrame = 0;
        g.bossIndex = null;
        g.bossActivateFrame = null;
        g.bossEndFrame = null;
        if (g.stopSiren) { g.stopSiren(); g.stopSiren = null; }
      }

      // Stars
      for (const star of g.stars) {
        star.y += star.speed;
        if (star.y > CANVAS_HEIGHT) { star.y = 0; star.x = Math.random() * CANVAS_WIDTH; }
      }

      // Draw
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      for (const star of g.stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + star.size * 0.3})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      // Invaders
      const flashOn = Math.floor(frame / 6) % 2 === 0;
      for (let i = 0; i < g.invaders.length; i++) {
        const inv = g.invaders[i];
        if (!inv.alive) continue;
        const isBoss = g.bossIndex === i && g.bossEndFrame !== null;
        if (isBoss && flashOn) {
          ctx.save();
          ctx.shadowColor = "#ffff00";
          ctx.shadowBlur = 20;
        }
        drawInvader(ctx, inv.x, inv.y, isBoss && flashOn ? -1 : inv.row, Math.floor(frame / 30));
        if (isBoss && flashOn) ctx.restore();
      }

      // Player (blink during respawn, transparent in god mode)
      if (g.playerRespawnTimer <= 0 || Math.floor(frame / 4) % 2 === 0) {
        if (godModeRef.current) ctx.globalAlpha = 0.4;
        drawPlayer(ctx, g.player.x, g.player.y);
        ctx.globalAlpha = 1;
      }

      // Explosions
      for (const e of g.explosions) {
        const progress = e.frame / e.maxFrames;
        const radius = e.size * progress;
        const alpha = 1 - progress;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Particles
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + progress * 2;
          const dist = radius * 1.2;
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x + Math.cos(angle) * dist - 2, e.y + Math.sin(angle) * dist - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      // Bullets
      for (const b of g.bullets) drawBullet(ctx, b, false);
      for (const b of g.enemyBullets) drawBullet(ctx, b, true);

      setDisplayScore(g.score);
      setDisplayLives(g.lives);
      setDisplayWave(g.wave);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [started]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 select-none">
      <h1 className="text-xl md:text-2xl font-arcade text-primary tracking-wider"
          style={{ textShadow: "0 0 20px hsl(120,100%,50%), 0 0 40px hsl(120,100%,50%,0.5)" }}>
        SPACE INVADERS
      </h1>

      <div className="font-arcade text-xs">
        <span className="text-neon-cyan" style={{ textShadow: "0 0 10px hsl(180,100%,50%,0.7)" }}>
          SCORE: {displayScore}
        </span>
      </div>

      <div className="relative border-2 border-primary/30 rounded-sm" style={{ boxShadow: "0 0 30px hsl(120,100%,50%,0.15), inset 0 0 30px hsl(120,100%,50%,0.05)" }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />

        <div className="absolute top-2 left-2 flex gap-1">
          {Array.from({ length: displayLives }).map((_, i) => (
            <LifeIcon key={i} />
          ))}
        </div>

        <div className="absolute top-2 right-2 font-arcade text-xs text-neon-yellow"
             style={{ textShadow: "0 0 10px hsl(60,100%,50%,0.8)" }}>
          {toRoman(displayWave)}
        </div>

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-6">
            <p className="text-primary font-arcade text-sm animate-pulse"
               style={{ textShadow: "0 0 15px hsl(120,100%,50%,0.8)" }}>
              PRESS START
            </p>
            <button onClick={resetGame}
              className="font-arcade text-xs px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              style={{ boxShadow: "0 0 15px hsl(120,100%,50%,0.3)" }}>
              START GAME
            </button>
            <p className="text-muted-foreground font-arcade text-[8px] mt-2">← → MOVE &nbsp; SPACE SHOOT</p>
          </div>
        )}

        {(gameOver || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm gap-4">
            <p className={`font-arcade text-lg ${won ? "text-neon-yellow" : "text-destructive"}`}
               style={{ textShadow: `0 0 20px ${won ? "hsl(60,100%,50%,0.8)" : "hsl(0,100%,50%,0.8)"}` }}>
              {won ? "YOU WIN!" : "GAME OVER"}
            </p>
            <p className="text-neon-cyan font-arcade text-xs">SCORE: {displayScore}</p>
            <button onClick={resetGame}
              className="font-arcade text-xs px-6 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all mt-2"
              style={{ boxShadow: "0 0 15px hsl(120,100%,50%,0.3)" }}>
              PLAY AGAIN
            </button>
          </div>
        )}

        {paused && started && !gameOver && !won && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <p className="font-arcade text-lg text-primary"
               style={{ textShadow: "0 0 20px hsl(120,100%,50%,0.8)" }}>
              GAME PAUSED
            </p>
          </div>
        )}

        {godMode && (
          <div className="absolute bottom-2 right-2 font-arcade text-[8px] text-neon-yellow"
               style={{ textShadow: "0 0 10px hsl(60,100%,50%,0.8)" }}>
            GOD MODE
          </div>
        )}
      </div>

      <p className="text-muted-foreground font-arcade text-[8px]">← → MOVE &nbsp;&nbsp; SPACE SHOOT</p>
    </div>
  );
}
