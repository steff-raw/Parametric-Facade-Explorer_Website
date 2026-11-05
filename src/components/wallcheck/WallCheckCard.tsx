import Link from "next/link";
import WallCheckThumbnail from "./WallCheckThumbnail";

// Wall check in the gallery grid: same size, aspect and caption as StudioCard / PatternCard.
export default function WallCheckCard() {
  return (
    <Link href="/wall-check" className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-canvas transition-opacity group-hover:opacity-90">
        <div className="absolute inset-[11%]">
          <WallCheckThumbnail />
        </div>
        <span className="absolute bottom-3 left-3 inline-flex h-7 items-center rounded-full border border-line bg-pill px-3 text-[11px] uppercase tracking-tag text-ink">
          New · Wall check
        </span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink group-hover:text-accent">Wall check</p>
      </div>
    </Link>
  );
}
