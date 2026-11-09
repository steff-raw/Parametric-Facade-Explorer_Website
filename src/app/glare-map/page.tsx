import type { Metadata } from "next";
import GlareApp from "@/components/glare/GlareApp";

export const metadata: Metadata = {
  title: "Glare map",
  description:
    "Where does a tilted or curved glass facade throw the reflected sun? Approximate concept screening, not a BRE or planning glare study.",
};

export default function GlareMapPage() {
  return <GlareApp />;
}
