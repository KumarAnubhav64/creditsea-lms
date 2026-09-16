export function CreditSeaLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`block mx-auto ${className}`}
      role="img"
      aria-label="CreditSea logo"
    >
      {/* Shield / lock shape — trust & security */}
      <path
        d="M24 2L6 10v12c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V10L24 2z"
        fill="#1A1F36"
        stroke="#1A1F36"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Wave lines inside — sea */}
      <path
        d="M12 22c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
        stroke="#2563EB"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M12 27c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
        stroke="#2563EB"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* C letterform overlay */}
      <path
        d="M30 16c-3.3-2-7.2-2.5-10.7-.7-3.5 1.8-5.8 5.3-6 9.2-.2 3.9 1.8 7.6 5.2 9.4 3.4 1.8 7.3 1.3 10.5-1"
        stroke="#F4F3EF"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
