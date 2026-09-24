import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPattern, patterns } from "@/lib/patterns";
import PatternDetail from "@/components/PatternDetail";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return patterns.map((p) => ({ slug: p.meta.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const pattern = getPattern(params.slug);
  if (!pattern) return { title: "Pattern" };
  return {
    title: pattern.meta.name,
    description: pattern.meta.description,
  };
}

export default function PatternPage({ params }: PageProps) {
  const pattern = getPattern(params.slug);
  if (!pattern) notFound();
  return <PatternDetail slug={params.slug} />;
}
