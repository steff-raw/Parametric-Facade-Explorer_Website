import Link from "next/link";
import StudioThumbnail from "./StudioThumbnail";

// Facade Studio in the gallery grid: same size, aspect and caption as PatternCard.
export default function StudioCard() {
  return (
    <Link href="/studio" className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-canvas transition-opacity group-hover:opacity-90">
        <div className="absolute inset-[11%]">
          <StudioThumbnail />
        </div>
        <span className="absolute bottom-3 left-3 inline-flex h-7 items-center rounded-full border border-line bg-pill px-3 text-[11px] uppercase tracking-tag text-ink">
          New · Studio
        </span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink group-hover:text-accent">Facade Studio</p>
      </div>
    </Link>
  );
}
