import type { Metadata } from "next";
import CollectedGrid from "@/components/CollectedGrid";

export const metadata: Metadata = {
  title: "Collected",
  description: "Your saved facade pattern variations (stored locally).",
};

export default function CollectedPage() {
  return <CollectedGrid />;
}
