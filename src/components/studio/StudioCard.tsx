import Link from "next/link";
import StudioThumbnail from "./StudioThumbnail";

// Gradient Perforation in the pattern grid: same size, aspect, slot and caption as PatternCard.
export default function StudioCard() {
  return (
    <Link href="/studio" className="group block">
      <div className="relative aspect-square w-full overflow-hidden bg-canvas transition-opacity group-hover:opacity-90">
        <div className="absolute inset-x-3 bottom-3 top-14">
          <StudioThumbnail />
        </div>
        <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full border border-line bg-pill px-3 text-[11px] text-muted">
          Sun: n/a
        </span>
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink group-hover:text-accent">Gradient Perforation</p>
      </div>
    </Link>
  );
}
