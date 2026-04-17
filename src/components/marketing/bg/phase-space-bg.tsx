export function PhaseSpaceBg({ className = "" }: { className?: string }) {
  const curves = Array.from({ length: 6 });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-[0.08] motion-orbit"
        viewBox="-200 -200 400 400"
      >
        {curves.map((_, i) => {
          const a = 3 + i;
          const b = 2 + ((i + 1) % 4);
          const points = Array.from({ length: 400 }, (_, k) => {
            const t = (k / 400) * Math.PI * 2;
            const x = 160 * Math.sin(a * t);
            const y = 160 * Math.sin(b * t + i * 0.4);
            return `${x},${y}`;
          }).join(" ");
          const colors = [
            "var(--ja-shu)",
            "var(--ja-asagi)",
            "var(--ja-kincha)",
            "var(--ja-matcha)",
            "var(--ja-fuji)",
            "var(--ja-shu-soft)",
          ];
          return (
            <polyline
              key={i}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="0.8"
              strokeOpacity="0.7"
              points={points}
            />
          );
        })}
      </svg>
    </div>
  );
}
