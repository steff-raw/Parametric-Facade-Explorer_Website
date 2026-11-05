// Wall strip: plasterboard, mineral wool, brick, with a temperature line and a marked condensing interface.
export default function WallCheckThumbnail({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`block h-full w-full ${className}`}
      role="img"
      aria-label="Wall check preview: wall layers with a temperature line and a marked condensing interface"
    >
      <rect x="20" y="40" width="14" height="120" fill="#2a2a2a" />
      <rect x="34" y="40" width="80" height="120" fill="#1c1c1c" stroke="#2a2a2a" />
      <rect x="114" y="40" width="66" height="120" fill="#333" />
      <polyline
        fill="none"
        stroke="#7fb4ff"
        strokeWidth="3"
        points="20,56 34,58 114,128 180,132"
      />
      <circle cx="114" cy="128" r="7" fill="#e5484d" />
      <circle cx="114" cy="128" r="12" fill="none" stroke="#e5484d" strokeWidth="1.5" />
    </svg>
  );
}
