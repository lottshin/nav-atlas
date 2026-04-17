"use client";

import { useEffect, useRef } from "react";

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canvas || reduceMotion) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrame = 0;
    let mouse = { x: 0, y: 0, active: false };
    let particles: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.max(24, Math.floor((canvas.width * canvas.height) / 15000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.random() - 0.5,
        vy: Math.random() - 0.5,
        size: Math.random() * 2 + 1
      }));
    };

    const color = () => {
      const theme = document.documentElement.dataset.theme;
      return theme === "dark"
        ? { dot: "rgba(255,255,255,0.2)", line: "rgba(255,255,255,0.08)" }
        : { dot: "rgba(10,10,10,0.12)", line: "rgba(10,10,10,0.06)" };
    };

    const render = () => {
      const palette = color();
      context.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > canvas.width) {
          particle.vx *= -1;
        }

        if (particle.y < 0 || particle.y > canvas.height) {
          particle.vy *= -1;
        }

        context.fillStyle = palette.dot;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();

        for (let inner = index + 1; inner < particles.length; inner += 1) {
          const target = particles[inner];
          const dx = particle.x - target.x;
          const dy = particle.y - target.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            context.strokeStyle = palette.line;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(target.x, target.y);
            context.stroke();
          }
        }

        if (mouse.active) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150) {
            const angle = Math.atan2(dy, dx);
            particle.x += Math.cos(angle) * 0.5;
            particle.y += Math.sin(angle) * 0.5;
            context.strokeStyle = palette.line;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(mouse.x, mouse.y);
            context.stroke();
          }
        }
      });

      animationFrame = window.requestAnimationFrame(render);
    };

    const handleMove = (event: MouseEvent) => {
      mouse = {
        x: event.clientX,
        y: event.clientY,
        active: true
      };
    };

    const handleLeave = () => {
      mouse.active = false;
    };

    updateCanvasSize();
    render();

    window.addEventListener("resize", updateCanvasSize);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseout", handleLeave);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateCanvasSize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseout", handleLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
