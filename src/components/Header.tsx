import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 max-sm:flex-wrap max-sm:gap-y-1 md:px-10">
        <Link
          href="/"
          className="max-sm:inline-flex max-sm:min-h-8 max-sm:items-center whitespace-nowrap text-sm font-semibold tracking-tight text-ink hover:text-accent"
        >
          Parametric Facade Explorer
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/glare-map"
            className="max-sm:inline-flex max-sm:min-h-8 max-sm:items-center text-sm text-muted transition-colors hover:text-accent"
          >
            Glare map
          </Link>
          <Link
            href="/collected"
            className="max-sm:inline-flex max-sm:min-h-8 max-sm:items-center text-sm text-muted transition-colors hover:text-accent"
          >
            Collected
          </Link>
        </nav>
      </div>
      <div className="h-px w-full bg-line" />
    </header>
  );
}
