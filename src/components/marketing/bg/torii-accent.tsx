export function ToriiAccent({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      fill="none"
    >
      <path d="M6 12 H42" stroke="var(--ja-shu)" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 18 H40" stroke="var(--ja-shu)" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 18 V40" stroke="var(--ja-shu)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 18 V40" stroke="var(--ja-shu)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 28 H30" stroke="var(--ja-shu)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
