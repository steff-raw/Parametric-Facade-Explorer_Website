import type { Metadata } from "next";
import WallCheckApp from "@/components/wallcheck/WallCheckApp";

export const metadata: Metadata = {
  title: "Wall check",
  description:
    "Screen a wall build-up for interstitial condensation: approximate, after EN ISO 13788. Concept screening, not compliance.",
};

export default function WallCheckPage() {
  return <WallCheckApp />;
}
