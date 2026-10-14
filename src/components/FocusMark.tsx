export function FocusMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="focus-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <circle
        cx="20"
        cy="20"
        r="10"
        stroke="#1b2018"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="11 4.7"
        transform="rotate(-45 20 20)"
      />
      <circle cx="20" cy="20" r="3" fill="#1b2018" />
    </svg>
  )
}
