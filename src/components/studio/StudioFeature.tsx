import Link from "next/link";
import StudioThumbnail from "./StudioThumbnail";

// Home-page entry to Facade Studio: a thumbnail card in the same language as the pattern cards.
export default function StudioFeature() {
  return (
    <section className="mb-14" aria-labelledby="tools-heading">
      <h2 id="tools-heading" className="mb-4 text-[11px] uppercase tracking-tag text-muted">
        Tools
      </h2>
      <Link
        href="/studio"
        className="group grid overflow-hidden rounded-sm border border-line transition-colors hover:border-muted md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <StudioThumbnail className="transition-opacity group-hover:opacity-90" />
        <div className="flex flex-col justify-between gap-6 p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-canvas">New</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Pro · free during beta</span>
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight text-ink group-hover:text-accent">Facade Studio</p>
            <p className="mt-2 text-sm text-muted">Perforated elevation, panel by panel.</p>
            <ul className="mt-4 flex flex-col gap-1.5 text-xs text-muted">
              <li>Real mm panels and joints</li>
              <li>Fabrication rules: web, edge margin, punch tools</li>
              <li>DXF + panel schedule export</li>
            </ul>
          </div>
          <span className="text-sm text-ink group-hover:text-accent">Open Studio →</span>
        </div>
      </Link>
    </section>
  );
}
