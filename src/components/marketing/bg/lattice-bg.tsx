export function LatticeBg({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      <div
        className="absolute inset-0 opacity-[0.05] motion-drift"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] motion-drift-rev"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: "16px 16px",
        }}
      />
    </div>
  );
}
