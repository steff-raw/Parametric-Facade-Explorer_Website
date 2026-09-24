"use client";

import DebugReporter from "./DebugReporter";

/** Client island so the reporter only mounts in the browser. */
export default function DevDebugMount() {
  if (process.env.NODE_ENV !== "development") return null;
  return <DebugReporter />;
}
