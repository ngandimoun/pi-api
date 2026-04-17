export function FourierBg({ className = "" }: { className?: string }) {
  const harmonics = [
    { amp: 60, freq: 1, opacity: 0.08, color: "var(--ja-shu)" },
    { amp: 40, freq: 2, opacity: 0.07, color: "var(--ja-asagi)" },
    { amp: 28, freq: 3, opacity: 0.06, color: "var(--ja-kincha)" },
    { amp: 20, freq: 5, opacity: 0.05, color: "var(--ja-fuji)" },
    { amp: 14, freq: 7, opacity: 0.04, color: "var(--ja-matcha)" },
  ];
  const W = 1200;
  const H = 600;
  const mid = H / 2;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {harmonics.map((h, i) => {
        const points = Array.from({ length: 120 }, (_, x) => {
          const t = (x / 120) * Math.PI * 2 * h.freq;
          const y = mid + Math.sin(t) * h.amp;
          return `${(x / 120) * W},${y}`;
        }).join(" ");
        return (
          <svg
            key={i}
            className={`absolute inset-x-0 top-0 h-full w-full ${
              i % 2 === 0 ? "motion-drift" : "motion-drift-rev"
            }`}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ top: `${8 + i * 8}%` }}
          >
            <polyline
              fill="none"
              stroke={h.color}
              strokeOpacity={h.opacity}
              strokeWidth="2"
              points={points}
            />
          </svg>
        );
      })}
    </div>
  );
}
