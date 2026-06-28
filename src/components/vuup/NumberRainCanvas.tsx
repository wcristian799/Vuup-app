import * as React from "react";

/**
 * NumberRainCanvas — cascading matrix-style digit rain.
 * Decorative only; paused when prefers-reduced-motion.
 * Spec: MatrixSliderSpec — electric at 15% opacity, 800–1600ms per cycle.
 */
export function NumberRainCanvas({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  React.useEffect(() => {
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const FONT_SIZE = 14;
    const ELECTRIC = "oklch(0.72 0.22 246)";

    // Column state: each column tracks y position and speed
    const cols: { y: number; speed: number }[] = [];
    const initCols = () => {
      const count = Math.floor(canvas.width / FONT_SIZE);
      cols.length = 0;
      for (let i = 0; i < count; i++) {
        cols.push({
          y: Math.random() * canvas.height,
          speed: FONT_SIZE * (0.5 + Math.random() * 1.5), // px/frame ~30fps → 800–1600ms per screen
        });
      }
    };
    initCols();

    let raf: number;
    let lastTime = 0;

    const draw = (now: number) => {
      const dt = Math.min(now - lastTime, 50) / 1000; // seconds, cap at 50ms
      lastTime = now;

      // Fade trail
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const digit = Math.floor(Math.random() * 10).toString();
        const x = i * FONT_SIZE;

        // Leading character is brighter
        ctx.fillStyle = ELECTRIC;
        ctx.globalAlpha = 0.15;
        ctx.fillText(digit, x, col.y);
        ctx.globalAlpha = 1;

        col.y += col.speed * dt * 60; // normalize to ~60fps
        if (col.y > canvas.height) {
          col.y = 0;
          col.speed = FONT_SIZE * (0.5 + Math.random() * 1.5);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame((t) => {
      lastTime = t;
      draw(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [prefersReduced]);

  if (prefersReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
