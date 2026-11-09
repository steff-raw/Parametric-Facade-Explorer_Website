import Link from "next/link";
import GlareThumbnail from "./GlareThumbnail";

// Glare map in the Tools row: same size, aspect and caption as StudioCard / WallCheckCard.
export default function GlareCard() {
  return (
    <Link href="/glare-map" className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-canvas transition-opacity group-hover:opacity-90">
        <div className="absolute inset-x-3 bottom-3 top-14">
          <GlareThumbnail />
        </div>
        <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full border border-line bg-pill px-3 text-[11px] uppercase tracking-tag text-ink">
          New · Glare map
        </span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink group-hover:text-accent">Glare map</p>
      </div>
    </Link>
  );
}
