// Plan view: tilted facade, reflected rays, spots on a street strip.
export default function GlareThumbnail({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`block h-full w-full ${className}`}
      role="img"
      aria-label="Glare map preview: a facade throwing reflected sun onto a street as spots"
    >
      <rect x="10" y="120" width="180" height="26" fill="#1c1c1c" />
      <rect x="40" y="30" width="120" height="14" fill="#333" stroke="#e8e8e8" strokeWidth="1.5" />
      <g stroke="#f5a524" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 3">
        <line x1="100" y1="44" x2="60" y2="133" />
        <line x1="100" y1="44" x2="100" y2="133" />
        <line x1="100" y1="44" x2="145" y2="130" />
      </g>
      <ellipse cx="60" cy="133" rx="12" ry="7" fill="#7fb4ff" fillOpacity="0.55" />
      <ellipse cx="100" cy="133" rx="14" ry="8" fill="#7fb4ff" fillOpacity="0.6" />
      <ellipse cx="145" cy="130" rx="11" ry="6" fill="#7fb4ff" fillOpacity="0.5" />
      <rect x="20" y="165" width="50" height="22" fill="#2a2a2a" />
      <rect x="125" y="165" width="55" height="22" fill="#2a2a2a" />
    </svg>
  );
}
