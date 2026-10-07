import type { Metadata } from "next";
import StudioApp from "@/components/studio/StudioApp";

export const metadata: Metadata = {
  title: "Facade Studio",
  description:
    "Map a perforation gradient across a whole elevation, panel it to real modules, check fabrication rules and export DXF and a panel schedule.",
};

export default function StudioPage() {
  return <StudioApp />;
}
