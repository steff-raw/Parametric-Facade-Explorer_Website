import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-24 md:px-10">
      <p className="text-xs uppercase tracking-tag text-muted">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-base leading-body text-muted">
        That page does not exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-full border border-line bg-pill px-4 py-2 text-sm text-ink transition-colors hover:border-ink hover:text-accent"
      >
        Back to all patterns
      </Link>
    </div>
  );
}
