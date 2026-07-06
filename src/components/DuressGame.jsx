import { useEffect, useRef, useState, useCallback } from "react";

// ─── CipherRun: 2D Cyber Endless Runner ───────────────────────────────────
// The player is an encrypted data packet sprinting through a network.
// Dodge firewalls and spam bots. Collect encryption keys for score.
// Chat-themed context: you are delivering a secret message across the net.

export default function DuressGame({ onExit }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    try { return parseInt(localStorage.getItem("cr_hs") || "0", 10); } catch { return 0; }
  });
  const [started, setStarted] = useState(false);

  const startGame = useCallback(() => {
    setScore(0);
    setGameOver(false);
    setStarted(true);
    if (gameRef.current) {
      gameRef.current.reset();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Responsive canvas sizing
    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Game State ──────────────────────────────────────────────────────
    const G = {
      player: { x: 80, y: 0, w: 28, h: 28, vy: 0, grounded: false, lane: 1 },
      obstacles: [],
      collectibles: [],
      particles: [],
      bgStars: [],
      networkLines: [],
      speed: 4,
      gravity: 0.55,
      jumpForce: -11,
      groundY: 0,
      frameCount: 0,
      score: 0,
      gameOver: false,
      started: false,
      spawnTimer: 0,
      collectTimer: 0,
      difficulty: 1,
      reset() {
        this.player.vy = 0;
        this.player.grounded = false;
        this.obstacles = [];
        this.collectibles = [];
        this.particles = [];
        this.speed = 4;
        this.frameCount = 0;
        this.score = 0;
        this.gameOver = false;
        this.started = true;
        this.spawnTimer = 0;
        this.collectTimer = 0;
        this.difficulty = 1;
        this.groundY = canvas.height - 60;
        this.player.y = this.groundY - this.player.h;
        this.player.x = 80;

        // Generate background stars
        this.bgStars = [];
        for (let i = 0; i < 60; i++) {
          this.bgStars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 80),
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.5 + 0.2,
            opacity: Math.random() * 0.6 + 0.2
          });
        }

        // Generate network grid lines
        this.networkLines = [];
        for (let i = 0; i < 8; i++) {
          this.networkLines.push({
            x: Math.random() * canvas.width,
            y1: Math.random() * (canvas.height - 100),
            y2: Math.random() * (canvas.height - 100),
            speed: Math.random() * 1 + 0.5,
            opacity: Math.random() * 0.15 + 0.05
          });
        }
      }
    };

    gameRef.current = G;
    G.groundY = canvas.height - 60;
    G.player.y = G.groundY - G.player.h;

    // Init background stars
    for (let i = 0; i < 60; i++) {
      G.bgStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height - 80),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.6 + 0.2
      });
    }

    for (let i = 0; i < 8; i++) {
      G.networkLines.push({
        x: Math.random() * canvas.width,
        y1: Math.random() * (canvas.height - 100),
        y2: Math.random() * (canvas.height - 100),
        speed: Math.random() * 1 + 0.5,
        opacity: Math.random() * 0.15 + 0.05
      });
    }

    // ── Input Handling ─────────────────────────────────────────────────
    const keys = {};
    const onKeyDown = (e) => {
      keys[e.code] = true;
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && G.started && !G.gameOver) {
        if (G.player.grounded) {
          G.player.vy = G.jumpForce;
          G.player.grounded = false;
          // Jump particles
          for (let i = 0; i < 6; i++) {
            G.particles.push({
              x: G.player.x + G.player.w / 2,
              y: G.player.y + G.player.h,
              vx: (Math.random() - 0.5) * 3,
              vy: Math.random() * 2 + 1,
              life: 20 + Math.random() * 10,
              color: `hsla(180, 100%, 70%, ${Math.random() * 0.8 + 0.2})`,
              size: Math.random() * 3 + 1
            });
          }
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => { keys[e.code] = false; };

    // Touch / tap support for mobile
    const onTouchStart = (e) => {
      if (G.started && !G.gameOver && G.player.grounded) {
        G.player.vy = G.jumpForce;
        G.player.grounded = false;
        for (let i = 0; i < 6; i++) {
          G.particles.push({
            x: G.player.x + G.player.w / 2,
            y: G.player.y + G.player.h,
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 2 + 1,
            life: 20 + Math.random() * 10,
            color: `hsla(180, 100%, 70%, ${Math.random() * 0.8 + 0.2})`,
            size: Math.random() * 3 + 1
          });
        }
      }
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });

    // ── Spawn Helpers ──────────────────────────────────────────────────
    const spawnObstacle = () => {
      const types = ["firewall", "spam", "virus"];
      const type = types[Math.floor(Math.random() * types.length)];
      let h, w;
      if (type === "firewall") { w = 22; h = 45 + Math.random() * 25; }
      else if (type === "spam") { w = 30; h = 30; }
      else { w = 24; h = 24; }

      const isFlying = Math.random() < 0.25 && type !== "firewall";
      const y = isFlying ? G.groundY - h - 50 - Math.random() * 40 : G.groundY - h;

      G.obstacles.push({ x: canvas.width + 20, y, w, h, type, passed: false });
    };

    const spawnCollectible = () => {
      const types = ["key", "shield", "packet"];
      const type = types[Math.floor(Math.random() * types.length)];
      const y = G.groundY - 30 - Math.random() * 80;
      G.collectibles.push({ x: canvas.width + 10, y, w: 18, h: 18, type, glow: 0 });
    };

    // ── Drawing Helpers ────────────────────────────────────────────────
    const drawPlayer = () => {
      const p = G.player;
      // Glow effect
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 12;

      // Body — envelope/packet shape
      const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      gradient.addColorStop(0, "#00e5ff");
      gradient.addColorStop(1, "#7c4dff");
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.moveTo(p.x + 4, p.y);
      ctx.lineTo(p.x + p.w - 4, p.y);
      ctx.quadraticCurveTo(p.x + p.w, p.y, p.x + p.w, p.y + 4);
      ctx.lineTo(p.x + p.w, p.y + p.h - 4);
      ctx.quadraticCurveTo(p.x + p.w, p.y + p.h, p.x + p.w - 4, p.y + p.h);
      ctx.lineTo(p.x + 4, p.y + p.h);
      ctx.quadraticCurveTo(p.x, p.y + p.h, p.x, p.y + p.h - 4);
      ctx.lineTo(p.x, p.y + 4);
      ctx.quadraticCurveTo(p.x, p.y, p.x + 4, p.y);
      ctx.closePath();
      ctx.fill();

      // Envelope flap
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y + 2);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h * 0.45);
      ctx.lineTo(p.x + p.w - 2, p.y + 2);
      ctx.stroke();

      // Lock icon on envelope
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${p.w * 0.35}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("🔒", p.x + p.w / 2, p.y + p.h * 0.82);

      ctx.shadowBlur = 0;
    };

    const drawObstacle = (o) => {
      if (o.type === "firewall") {
        // Red firewall wall
        const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
        grad.addColorStop(0, "#ff1744");
        grad.addColorStop(1, "#b71c1c");
        ctx.fillStyle = grad;
        ctx.fillRect(o.x, o.y, o.w, o.h);

        // Flame glow
        ctx.shadowColor = "#ff1744";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ff5252";
        for (let i = 0; i < 3; i++) {
          const fx = o.x + Math.random() * o.w;
          const fy = o.y - 4 - Math.random() * 8;
          ctx.beginPath();
          ctx.arc(fx, fy, 3 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Text
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("FIREWALL", 0, 3);
        ctx.restore();
      } else if (o.type === "spam") {
        ctx.fillStyle = "#ff9100";
        ctx.shadowColor = "#ff9100";
        ctx.shadowBlur = 6;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SPAM", o.x + o.w / 2, o.y + o.h / 2 + 3);
      } else {
        // Virus — pulsing purple circle
        ctx.fillStyle = "#e040fb";
        ctx.shadowColor = "#e040fb";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2 + Math.sin(G.frameCount * 0.15) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BUG", o.x + o.w / 2, o.y + o.h / 2 + 3);
      }
    };

    const drawCollectible = (c) => {
      c.glow = (c.glow + 0.06) % (Math.PI * 2);
      const pulse = Math.sin(c.glow) * 3;

      if (c.type === "key") {
        ctx.fillStyle = "#ffd740";
        ctx.shadowColor = "#ffd740";
        ctx.shadowBlur = 8 + pulse;
        ctx.font = "16px serif";
        ctx.textAlign = "center";
        ctx.fillText("🔑", c.x + c.w / 2, c.y + c.h - 1);
        ctx.shadowBlur = 0;
      } else if (c.type === "shield") {
        ctx.fillStyle = "#69f0ae";
        ctx.shadowColor = "#69f0ae";
        ctx.shadowBlur = 8 + pulse;
        ctx.font = "15px serif";
        ctx.textAlign = "center";
        ctx.fillText("🛡️", c.x + c.w / 2, c.y + c.h - 1);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#40c4ff";
        ctx.shadowColor = "#40c4ff";
        ctx.shadowBlur = 8 + pulse;
        ctx.font = "14px serif";
        ctx.textAlign = "center";
        ctx.fillText("📨", c.x + c.w / 2, c.y + c.h - 1);
        ctx.shadowBlur = 0;
      }
    };

    // ── Main Loop ──────────────────────────────────────────────────────
    const loop = () => {
      const W = canvas.width;
      const H = canvas.height;
      G.groundY = H - 60;

      // ── Clear & Background ──
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, W, H);

      // Background stars
      G.bgStars.forEach(s => {
        s.x -= s.speed * (G.started && !G.gameOver ? G.speed / 4 : 0.3);
        if (s.x < 0) { s.x = W; s.y = Math.random() * (H - 80); }
        ctx.fillStyle = `rgba(120, 200, 255, ${s.opacity})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Network scan lines
      G.networkLines.forEach(l => {
        l.x -= l.speed * (G.started && !G.gameOver ? G.speed / 3 : 0.5);
        if (l.x < -50) { l.x = W + 50; }
        ctx.strokeStyle = `rgba(0, 229, 255, ${l.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y1);
        ctx.lineTo(l.x + 40, l.y2);
        ctx.stroke();
      });

      // Ground line / cyber floor
      const groundGrad = ctx.createLinearGradient(0, G.groundY, 0, H);
      groundGrad.addColorStop(0, "#1a237e");
      groundGrad.addColorStop(1, "#0d1137");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, G.groundY, W, H - G.groundY);

      // Grid on ground
      ctx.strokeStyle = "rgba(0, 229, 255, 0.12)";
      ctx.lineWidth = 1;
      const gridOffset = (G.frameCount * G.speed) % 30;
      for (let gx = -gridOffset; gx < W; gx += 30) {
        ctx.beginPath();
        ctx.moveTo(gx, G.groundY);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = G.groundY; gy < H; gy += 15) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // Top border glow
      ctx.strokeStyle = "rgba(0, 229, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, G.groundY);
      ctx.lineTo(W, G.groundY);
      ctx.stroke();

      if (!G.started || G.gameOver) {
        // Draw idle player
        G.player.y = G.groundY - G.player.h;
        drawPlayer();

        animRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Update ────────────────────
      G.frameCount++;

      // Difficulty scales
      G.difficulty = 1 + Math.floor(G.score / 15) * 0.15;
      G.speed = 4 + G.difficulty * 0.8;

      // Player physics
      G.player.vy += G.gravity;
      G.player.y += G.player.vy;
      if (G.player.y >= G.groundY - G.player.h) {
        G.player.y = G.groundY - G.player.h;
        G.player.vy = 0;
        G.player.grounded = true;
      }

      // Spawn obstacles
      G.spawnTimer++;
      const spawnRate = Math.max(55, 110 - G.difficulty * 8);
      if (G.spawnTimer >= spawnRate) {
        spawnObstacle();
        G.spawnTimer = 0;
      }

      // Spawn collectibles
      G.collectTimer++;
      if (G.collectTimer >= 90) {
        spawnCollectible();
        G.collectTimer = 0;
      }

      // Move obstacles
      G.obstacles.forEach(o => { o.x -= G.speed; });
      G.obstacles = G.obstacles.filter(o => o.x + o.w > -20);

      // Move collectibles
      G.collectibles.forEach(c => { c.x -= G.speed; });
      G.collectibles = G.collectibles.filter(c => c.x + c.w > -20);

      // Move particles
      G.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      });
      G.particles = G.particles.filter(p => p.life > 0);

      // Trail particles
      if (G.frameCount % 3 === 0) {
        G.particles.push({
          x: G.player.x,
          y: G.player.y + G.player.h / 2 + (Math.random() - 0.5) * 8,
          vx: -1.5 - Math.random(),
          vy: (Math.random() - 0.5) * 0.8,
          life: 15 + Math.random() * 8,
          color: `hsla(${180 + Math.random() * 40}, 100%, 65%, ${0.4 + Math.random() * 0.3})`,
          size: Math.random() * 2.5 + 1
        });
      }

      // Collision with obstacles (AABB)
      const p = G.player;
      const margin = 4; // slight forgiveness
      for (const o of G.obstacles) {
        if (
          p.x + margin < o.x + o.w &&
          p.x + p.w - margin > o.x &&
          p.y + margin < o.y + o.h &&
          p.y + p.h - margin > o.y
        ) {
          G.gameOver = true;
          // Explosion
          for (let i = 0; i < 20; i++) {
            G.particles.push({
              x: p.x + p.w / 2,
              y: p.y + p.h / 2,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 30 + Math.random() * 20,
              color: `hsla(${Math.random() * 60}, 100%, 60%, 0.8)`,
              size: Math.random() * 4 + 1
            });
          }
          setGameOver(true);
          const final = G.score;
          setScore(final);
          setHighScore(prev => {
            const best = Math.max(prev, final);
            try { localStorage.setItem("cr_hs", best.toString()); } catch {}
            return best;
          });
          break;
        }
      }

      // Collect items
      G.collectibles = G.collectibles.filter(c => {
        if (
          p.x < c.x + c.w &&
          p.x + p.w > c.x &&
          p.y < c.y + c.h &&
          p.y + p.h > c.y
        ) {
          const pts = c.type === "key" ? 5 : c.type === "shield" ? 3 : 2;
          G.score += pts;
          setScore(G.score);
          // Collect burst
          for (let i = 0; i < 8; i++) {
            G.particles.push({
              x: c.x + c.w / 2,
              y: c.y + c.h / 2,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 20 + Math.random() * 10,
              color: c.type === "key" ? "#ffd740" : c.type === "shield" ? "#69f0ae" : "#40c4ff",
              size: Math.random() * 3 + 1
            });
          }
          return false;
        }
        return true;
      });

      // Score for passing obstacles
      G.obstacles.forEach(o => {
        if (!o.passed && o.x + o.w < p.x) {
          o.passed = true;
          G.score += 1;
          setScore(G.score);
        }
      });

      // ── Draw ──────────────────────
      // Particles (behind player)
      G.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.min(1, pt.life / 15);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Collectibles
      G.collectibles.forEach(drawCollectible);

      // Obstacles
      G.obstacles.forEach(drawObstacle);

      // Player
      if (!G.gameOver) {
        drawPlayer();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[600] bg-[#0a0e1a] flex flex-col">
      {/* HUD Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/50 border-b border-cyan-900/40 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="text-cyan-400 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
            <span className="text-lg">📨</span> CipherRun
          </div>
          <div className="text-xs text-cyan-300/60 hidden sm:block">
            Deliver the encrypted message
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-amber-400">
            SCORE <span className="text-white font-bold text-sm ml-1">{score}</span>
          </div>
          <div className="text-xs font-mono text-cyan-400/70">
            BEST <span className="text-cyan-300 font-bold text-sm ml-1">{highScore}</span>
          </div>
          <button
            onClick={onExit}
            className="text-[0.6rem] uppercase tracking-widest px-3 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-semibold"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Start Screen Overlay */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-5xl mb-4">📨</div>
            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-wider uppercase">
              CipherRun
            </h1>
            <p className="text-cyan-300/70 text-xs sm:text-sm mt-2 max-w-xs text-center px-4">
              You are an encrypted data packet. Dodge firewalls, spam, and viruses. Collect keys to score.
            </p>
            <div className="flex flex-col items-center gap-2 mt-6">
              <button
                onClick={startGame}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-2xl text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
              >
                Start Mission
              </button>
              <span className="text-cyan-500/50 text-[0.6rem] mt-2 uppercase tracking-widest">
                Space / Tap to Jump
              </span>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            <div className="text-4xl mb-3">💥</div>
            <h2 className="text-xl sm:text-2xl font-black text-red-400 uppercase tracking-wider">
              Intercepted!
            </h2>
            <p className="text-red-300/60 text-xs mt-1">Your packet was compromised</p>
            <div className="flex items-center gap-6 mt-5">
              <div className="text-center">
                <div className="text-xs text-cyan-400/60 uppercase tracking-wider">Score</div>
                <div className="text-2xl font-black text-white">{score}</div>
              </div>
              <div className="w-px h-10 bg-cyan-800/40" />
              <div className="text-center">
                <div className="text-xs text-amber-400/60 uppercase tracking-wider">Best</div>
                <div className="text-2xl font-black text-amber-400">{highScore}</div>
              </div>
            </div>
            <button
              onClick={startGame}
              className="mt-6 px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-2xl text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
            >
              Retry Mission
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="flex items-center justify-center py-1.5 bg-black/40 border-t border-cyan-900/30 shrink-0">
        <span className="text-[0.55rem] text-cyan-500/40 uppercase tracking-[0.2em]">
          🔑 = +5 &nbsp; 🛡️ = +3 &nbsp; 📨 = +2 &nbsp; | &nbsp; Dodge Firewalls, Spam & Viruses
        </span>
      </div>
    </div>
  );
}
