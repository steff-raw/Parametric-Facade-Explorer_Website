import Link from "next/link";

interface TagPillProps {
  label: string;
  count?: number;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function TagPill({
  label,
  count,
  href,
  active = false,
  onClick,
}: TagPillProps) {
  const className = [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
    "text-[11px] font-medium uppercase tracking-tag transition-colors",
    active
      ? "border-ink bg-pill text-ink"
      : "border-line bg-pill text-muted hover:border-ink hover:text-accent",
  ].join(" ");

  const content = (
    <>
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="text-muted tabular-nums">{count}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
