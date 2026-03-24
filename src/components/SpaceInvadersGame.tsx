import { useEffect, useRef, useState } from "react";
import { playPlayerShoot, playEnemyShoot, playPlayerExplosion, playEnemyExplosion } from "@/lib/sounds";

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
}

interface GameState {
  player: Entity;
  invaders: (Entity & { row: number })[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  score: number;
  lives: number;
  invaderDir: number;
  invaderSpeed: number;
  gameOver: boolean;
  won: boolean;
  stars: { x: number; y: number; size: number; speed: number }[];
}

function createStars(count: number) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.5 + 0.1,
  }));
}

function initGame(): GameState {
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
  return {
    player: { x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2, y: CANVAS_HEIGHT - 50, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, alive: true },
    invaders,
    bullets: [],
    enemyBullets: [],
    score: 0,
    lives: 3,
    invaderDir: 1,
    invaderSpeed: 1,
    gameOver: false,
    won: false,
    stars: createStars(80),
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
  const color = INVADER_COLORS[row % INVADER_COLORS.length];
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

function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, isEnemy: boolean) {
  ctx.fillStyle = isEnemy ? "#ff0000" : "#00ffff";
  ctx.shadowColor = isEnemy ? "#ff0000" : "#00ffff";
  ctx.shadowBlur = 8;
  ctx.fillRect(x, y, BULLET_WIDTH, BULLET_HEIGHT);
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
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);

  const resetGame = () => {
    gameRef.current = initGame();
    setDisplayScore(0);
    setDisplayLives(3);
    setGameOver(false);
    setWon(false);
    setStarted(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        setGameOver(g.gameOver);
        setWon(g.won);
        return;
      }

      frameRef.current++;
      const frame = frameRef.current;

      // Input
      if (keysRef.current.has("ArrowLeft")) g.player.x = Math.max(0, g.player.x - PLAYER_SPEED);
      if (keysRef.current.has("ArrowRight")) g.player.x = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, g.player.x + PLAYER_SPEED);
      if (keysRef.current.has(" ") && frame - lastShotRef.current > 15) {
        g.bullets.push({ x: g.player.x + PLAYER_WIDTH / 2 - 2, y: g.player.y, dy: -BULLET_SPEED });
        lastShotRef.current = frame;
      }

      // Move bullets
      g.bullets = g.bullets.filter((b) => { b.y += b.dy; return b.y > -BULLET_HEIGHT; });
      g.enemyBullets = g.enemyBullets.filter((b) => { b.y += b.dy; return b.y < CANVAS_HEIGHT; });

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
        }
      }

      // Bullet-invader collision
      for (const bullet of g.bullets) {
        for (const inv of g.invaders) {
          if (inv.alive && collides(bullet, inv)) {
            inv.alive = false;
            bullet.y = -100;
            g.score += (INVADER_ROWS - inv.row) * 10;
            g.invaderSpeed = 1 + (g.invaders.filter((i) => !i.alive).length / g.invaders.length) * 3;
          }
        }
      }

      // Enemy bullet-player collision
      for (const bullet of g.enemyBullets) {
        if (collides(bullet, g.player)) {
          bullet.y = CANVAS_HEIGHT + 100;
          g.lives--;
          if (g.lives <= 0) g.gameOver = true;
        }
      }

      // Check invaders reaching player
      for (const inv of aliveInvaders) {
        if (inv.y + inv.height >= g.player.y) g.gameOver = true;
      }

      // Win check
      if (aliveInvaders.length === 0) g.won = true;

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
      for (const inv of g.invaders) {
        if (inv.alive) drawInvader(ctx, inv.x, inv.y, inv.row, Math.floor(frame / 30));
      }

      // Player
      drawPlayer(ctx, g.player.x, g.player.y);

      // Bullets
      for (const b of g.bullets) drawBullet(ctx, b.x, b.y, false);
      for (const b of g.enemyBullets) drawBullet(ctx, b.x, b.y, true);

      setDisplayScore(g.score);
      setDisplayLives(g.lives);

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

      <div className="flex gap-8 font-arcade text-xs">
        <span className="text-neon-cyan" style={{ textShadow: "0 0 10px hsl(180,100%,50%,0.7)" }}>
          SCORE: {displayScore}
        </span>
        <span className="text-neon-magenta" style={{ textShadow: "0 0 10px hsl(300,100%,60%,0.7)" }}>
          LIVES: {"♥".repeat(displayLives)}
        </span>
      </div>

      <div className="relative border-2 border-primary/30 rounded-sm" style={{ boxShadow: "0 0 30px hsl(120,100%,50%,0.15), inset 0 0 30px hsl(120,100%,50%,0.05)" }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />

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
      </div>

      <p className="text-muted-foreground font-arcade text-[8px]">← → MOVE &nbsp;&nbsp; SPACE SHOOT</p>
    </div>
  );
}
