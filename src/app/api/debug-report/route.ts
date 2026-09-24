import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only: persist a debug report to disk for the agent to read.
 * Returns 404 in production.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body" }, { status: 400 });
  }

  const root = process.cwd();
  const debugDir = path.join(root, "debug");
  const reportsDir = path.join(debugDir, "reports");
  const latestPath = path.join(debugDir, "latest-report.json");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivedPath = path.join(reportsDir, `report-${stamp}.json`);
  const json = JSON.stringify(body, null, 2);

  try {
    await mkdir(reportsDir, { recursive: true });
    await writeFile(latestPath, json, "utf8");
    await writeFile(archivedPath, json, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    path: "debug/latest-report.json",
    archive: path.relative(root, archivedPath),
  });
}
