import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink hover:text-accent"
        >
          Parametric Facade Explorer
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/studio"
            className="text-sm text-muted transition-colors hover:text-accent"
          >
            Studio
          </Link>
          <Link
            href="/collected"
            className="text-sm text-muted transition-colors hover:text-accent"
          >
            Collected
          </Link>
          <span
            className="text-muted"
            title="Dark theme"
            aria-label="Theme"
            role="img"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </span>
        </nav>
      </div>
      <div className="h-px w-full bg-line" />
    </header>
  );
}
