"use client";

import React, { useEffect, useRef } from "react";

interface AtmosphericParticlesProps {
  season: "halloween" | "advent";
  enabled: boolean;
}

export default function AtmosphericParticles({
  season,
  enabled,
}: AtmosphericParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const isHalloween = season === "halloween";
    const particleCount = isHalloween ? 35 : 55;

    // Particules : braises dorées/flammèches pour Halloween, flocons doux pour l'Avent
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: isHalloween ? Math.random() * 2.8 + 1.2 : Math.random() * 3 + 1.5,
      speedX: isHalloween ? (Math.random() - 0.5) * 0.6 : (Math.random() - 0.5) * 0.8,
      speedY: isHalloween ? -(Math.random() * 0.8 + 0.3) : Math.random() * 0.9 + 0.4,
      opacity: Math.random() * 0.6 + 0.25,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.03 + 0.015,
      color: isHalloween
        ? Math.random() > 0.4
          ? "rgba(249, 115, 22," // orange vif
          : "rgba(251, 191, 36," // or ambré
        : "rgba(255, 255, 255,", // neige
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        const currentOpacity =
          p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));

        // Réapparition cyclique
        if (isHalloween) {
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
        } else {
          if (p.y > height + 10) {
            p.y = -10;
            p.x = Math.random() * width;
          }
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${Math.max(0, Math.min(1, currentOpacity))})`;

        if (isHalloween) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(249, 115, 22, 0.6)";
        } else {
          ctx.shadowBlur = 4;
          ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [season, enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-15 select-none"
      style={{ zIndex: 15 }}
    />
  );
}
