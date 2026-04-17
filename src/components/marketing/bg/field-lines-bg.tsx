export function FieldLinesBg({ className = "" }: { className?: string }) {
  const lines = Array.from({ length: 14 });
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07] motion-drift"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="charge-pos" cx="0.25" cy="0.5" r="0.4">
            <stop offset="0%" stopColor="var(--ja-shu)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--ja-shu)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="charge-neg" cx="0.75" cy="0.5" r="0.4">
            <stop offset="0%" stopColor="var(--ja-asagi)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--ja-asagi)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="1200" height="800" fill="url(#charge-pos)" />
        <rect x="0" y="0" width="1200" height="800" fill="url(#charge-neg)" />
        {lines.map((_, i) => {
          const y = 80 + i * 50;
          const mid = 400 + (i % 3) * 50;
          return (
            <path
              key={i}
              d={`M 300 ${y} Q 600 ${mid} 900 ${y}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity={0.5}
            />
          );
        })}
        <circle cx="300" cy="400" r="8" fill="var(--ja-shu)" opacity="0.5" />
        <circle cx="900" cy="400" r="8" fill="var(--ja-asagi)" opacity="0.5" />
      </svg>
    </div>
  );
}
