export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs><linearGradient id="nl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#06b6d4" /></linearGradient></defs>
      <rect width="512" height="512" rx="112" fill="#0f172a" />
      <path d="M148 372V140h44l128 154V140h44v232h-44L192 218v154z" fill="url(#nl)" />
      <path d="M400 96l8 20 20 8-20 8-8 20-8-20-20-8 20-8z" fill="#fff" />
    </svg>
  );
}
