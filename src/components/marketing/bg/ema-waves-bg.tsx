export function EmaWavesBg({ className = "" }: { className?: string }) {
  const waves = [
    { y: 120, color: "var(--ja-shu)", op: 0.06 },
    { y: 280, color: "var(--ja-asagi)", op: 0.06 },
    { y: 440, color: "var(--ja-matcha)", op: 0.05 },
    { y: 600, color: "var(--ja-fuji)", op: 0.05 },
  ];
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {waves.map((w, i) => {
        const path = `M 0 ${w.y} ` +
          Array.from({ length: 20 })
            .map((_, k) => {
              const x1 = k * 80 + 20;
              const y1 = w.y + (k % 2 === 0 ? -18 : 18);
              const x2 = k * 80 + 60;
              const y2 = w.y + (k % 2 === 0 ? 18 : -18);
              const x3 = k * 80 + 80;
              const y3 = w.y;
              return `C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
            })
            .join(" ");
        return (
          <svg
            key={i}
            className={`absolute inset-x-0 h-[800px] w-full ${
              i % 2 === 0 ? "motion-wave" : ""
            }`}
            viewBox="0 0 1600 800"
            preserveAspectRatio="none"
          >
            <path
              d={path}
              fill="none"
              stroke={w.color}
              strokeWidth="2"
              strokeOpacity={w.op}
            />
          </svg>
        );
      })}
    </div>
  );
}
