/** Overlapping squares — Windows-style restore (not Minimize2). */
export function RestoreIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="4.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="4.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}
