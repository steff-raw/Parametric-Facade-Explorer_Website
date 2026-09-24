import { Suspense } from "react";
import Gallery from "@/components/Gallery";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-12 text-muted md:px-10">
          Loading gallery…
        </div>
      }
    >
      <Gallery />
    </Suspense>
  );
}
