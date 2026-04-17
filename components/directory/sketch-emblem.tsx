"use client";

import { useEffect, useRef } from "react";

export function SketchEmblem() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const wrappers = Array.from(svg.querySelectorAll<SVGGElement>(".eye-wrapper"));
    const pupils = wrappers
      .map((wrapper) => wrapper.querySelector<SVGGElement>(".pupil-group"))
      .filter((group): group is SVGGElement => Boolean(group));

    const resetPupils = () => {
      pupils.forEach((group) => group.setAttribute("transform", "translate(0 0)"));
    };

    const handleMove = (event: MouseEvent) => {
      wrappers.forEach((wrapper, index) => {
        const pupil = pupils[index];
        if (!pupil) return;

        const rect = wrapper.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;
        const angle = Math.atan2(event.clientY - eyeCenterY, event.clientX - eyeCenterX);
        const distance = Math.min(5, Math.hypot(event.clientX - eyeCenterX, event.clientY - eyeCenterY) / 10);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        pupil.setAttribute("transform", `translate(${x} ${y})`);
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("blur", resetPupils);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("blur", resetPupils);
      resetPupils();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className="sketch-emblem"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Hand-drawn portrait"
    >
      <g id="face-paths">
        <path
          className="sketch-path"
          d="M 60 160 C 50 140, 40 100, 70 60 C 90 30, 140 30, 160 70 C 180 110, 160 150, 140 170 M 70 60 Q 60 30, 90 40 T 130 30 T 160 70 M 95 120 L 115 115 M 50 180 Q 20 200, 10 200 M 150 180 Q 180 200, 190 200 M 160 50 L 170 40 M 40 60 L 30 50"
        />
      </g>
      <g id="eyes-group">
        <g className="eye-wrapper" transform="translate(85 95)">
          <circle className="eye-socket" cx="0" cy="0" r="10" />
          <g className="pupil-group">
            <circle className="eye-pupil" cx="0" cy="0" r="3.5" />
            <circle className="eye-glint" cx="1.5" cy="-1.5" r="1.5" />
          </g>
        </g>
        <g className="eye-wrapper" transform="translate(125 95)">
          <circle className="eye-socket" cx="0" cy="0" r="10" />
          <g className="pupil-group">
            <circle className="eye-pupil" cx="0" cy="0" r="3.5" />
            <circle className="eye-glint" cx="1.5" cy="-1.5" r="1.5" />
          </g>
        </g>
      </g>
    </svg>
  );
}
