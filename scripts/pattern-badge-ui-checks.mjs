// Pattern Performance Badge, Stage 3 browser checks (P-0038): gallery cards, badge, fallback, console.
// Needs a running build and playwright-core (npm i --no-save playwright-core@1), Chromium at /opt/pw-browsers/chromium.
// Baseline (before the change): node scripts/pattern-badge-ui-checks.mjs <base-url> <out-dir> --baseline
// Check (after):                  node scripts/pattern-badge-ui-checks.mjs <base-url> <out-dir>
// Writes card-boxes-{before,after}.json and gallery/detail screenshots (1280 and 390 px) to <out-dir>.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [base = "http://localhost:3311", out = "./badge-ui-out", flag] = process.argv.slice(2);
const baseline = flag === "--baseline";
const tag = baseline ? "before" : "after";
mkdirSync(out, { recursive: true });
const VIEWPORTS = [{ name: "1280", width: 1280, height: 800 }, { name: "390", width: 390, height: 844 }];
const SCORED = ["louvre-cascade", "radial-pulse-panels", "hinged-flap-grid", "rotated-brick-screen", "solar-budget-skin", "adaptive-panel"];
const FLAT = ["perforated-screen", "radial-louvre", "deformed-grid", "facade-yield-map", "stack-effect-cavity"];
const DETAIL = "/patterns/louvre-cascade";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
// No WebGL anywhere (page and the thumbnail worker's OffscreenCanvas): a second browser with the 3D APIs off.
const noGLBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", // (--disable-webgl alone leaves OffscreenCanvas WebGL on; with these flags getContext("webgl2") is null everywhere.)
  args: ["--disable-3d-apis", "--disable-webgl", "--disable-webgl2", "--disable-gpu", "--disable-software-rasterizer"] });
const rows = [];
const check = (id, what, got, pass) => rows.push({ id, what, got: String(got).slice(0, 110), pass });

/** Open a page, collecting console errors and warnings. noWebGL: browser without WebGL (main thread and workers). */
async function open(path, vp, { noWebGL = false } = {}) {
  const page = await (noWebGL ? noGLBrowser : browser).newPage({ viewport: { width: vp.width, height: vp.height } });
  const logs = [];
  // Vercel Web Analytics script only exists on Vercel; its 404 under `next start` is not the page's.
  page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !(m.text() + m.location().url).includes("/_vercel/insights/")) logs.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(base + path, { waitUntil: "networkidle" });
  return { page, logs };
}

/** Scroll every card into view (thumbnails render near the viewport only), back to top, then wait for every 3D image. */
async function waitThumbs(page, want) {
  for (const a of await page.$$("div.grid > a")) { await a.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction((n) => document.querySelectorAll("[data-sun-badge]").length >= n &&
    document.querySelectorAll("img[data-thumb3d]").length >= n, want, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Bounding boxes of every card link in the grid (pattern cards and the Studio card), by href. */
const cardBoxes = (page) => page.$$eval("div.grid > a", (as) => Object.fromEntries(as.map((a) => {
  const r = a.getBoundingClientRect();
  const t = a.firstElementChild.getBoundingClientRect();
  const round = (v) => Math.round(v * 10) / 10;
  return [a.getAttribute("href"), { x: round(r.x), y: round(r.y + window.scrollY), w: round(r.width), h: round(r.height), thumbW: round(t.width), thumbH: round(t.height) }];
})));

/** Badge / pill per card: text, title and whether it sits fully inside the thumbnail. */
const cardBadges = (page) => page.$$eval("div.grid > a", (as) => as.map((a) => {
  const thumb = a.firstElementChild.getBoundingClientRect();
  const el = a.querySelector("[data-sun-badge],[data-sun-na]");
  const inside = (r) => r.left >= thumb.left - 0.5 && r.right <= thumb.right + 0.5 && r.top >= thumb.top - 0.5 && r.bottom <= thumb.bottom + 0.5;
  const kids = el ? [el, ...el.querySelectorAll("*")] : [];
  const img = a.querySelector("img[data-thumb3d]");
  const svg = a.querySelector(":scope > div > div[aria-hidden] > svg"); // the SVG preview, not the 3D icon
  const svgVisible = !!svg && (!img || getComputedStyle(img).display === "none");
  return {
    href: a.getAttribute("href"),
    kind: el ? (el.hasAttribute("data-sun-badge") ? "badge" : "na") : "none",
    text: el ? el.textContent.replace(/\s+/g, " ").trim() : "",
    title: el ? el.getAttribute("title") || "" : "",
    aria: el ? el.getAttribute("aria-label") || "" : "",
    role: el ? el.getAttribute("role") || "" : "",
    inside: kids.every((k) => inside(k.getBoundingClientRect())),
    clipped: kids.some((k) => k.scrollWidth > k.clientWidth + 1),
    // no wrapped lines: badge is two text lines (13 + 10 px) at most 44 px tall; pill one line
    oneLine: !!el && el.getBoundingClientRect().height <= 44,
    img: !!img,
    imgFill: img ? getComputedStyle(img).objectFit : "",
    svgVisible,
    // px between the badge / pill bottom and the top of the SVG preview box (artwork starts below the overlay when >= 0)
    headroom: el && svg ? Math.round(svg.getBoundingClientRect().top - el.getBoundingClientRect().bottom) : null,
  };
}));

const snap = {};
for (const vp of VIEWPORTS) {
  const { page, logs } = await open("/", vp);
  if (!baseline) await waitThumbs(page, SCORED.length);
  else await page.waitForTimeout(1500);
  snap[vp.name] = { cards: await cardBoxes(page) };
  await page.screenshot({ path: join(out, `gallery-${vp.name}-${tag}.png`), fullPage: true });
  if (!baseline) {
    const badges = await cardBadges(page);
    for (const s of SCORED) {
      const b = badges.find((x) => x.href === `/patterns/${s}`);
      const ok = b && b.kind === "badge" && /^Blocks (~\d+|>95|<5)% winter kept (~\d+|>95|<5)%$/.test(b.text) && b.inside && !b.clipped && b.oneLine && b.img && /south.*51\.5 N.*May-Aug.*default pose.*neighbour block ignored/i.test(b.title) &&
        /^Sun badge: blocks (about \d+|over 95|under 5)%, winter kept (about \d+|over 95|under 5)%\.$/.test(b.aria) && b.role === "img";
      check("1-2", `${vp.name} px ${s}: 3D image + badge 'Blocks ~X% / winter kept ~Y%' inside thumbnail, tooltip, aria-label`, b ? `${b.text} | img ${b.img} | inside ${b.inside} | ${b.aria}` : "missing", !!ok);
      const vals = b ? [...b.text.matchAll(/([~<>])(\d+)%/g)].map((m) => m[1] + m[2]) : [];
      check("R", `${vp.name} px ${s}: nearest 5 with '~', capped '>95%' / '<5%', never ~0% / ~100%`, vals.join(" / "),
        vals.length === 2 && vals.every((v) => (v[0] === "~" && +v.slice(1) % 5 === 0 && +v.slice(1) > 0 && +v.slice(1) < 100) || v === ">95" || v === "<5"));
    }
    for (const s of FLAT) {
      const b = badges.find((x) => x.href === `/patterns/${s}`);
      const ok = b && b.kind === "na" && b.text === "Sun: n/a" && b.title.length > 10 && b.inside && !b.clipped && b.oneLine && !b.img && b.svgVisible;
      check("1-2", `${vp.name} px ${s}: 'Sun: n/a' pill with reason on title, SVG kept`, b ? `${b.text} | ${b.title}` : "missing", !!ok);
      check("H", `${vp.name} px ${s}: SVG artwork starts below the pill (headroom >= 4 px)`, b ? `${b.headroom} px` : "missing", !!b && b.headroom >= 4);
    }
    const foot = await page.$eval("[data-sun-footnote]", (el) => ({ text: el.textContent.replace(/\s+/g, " ").trim(), title: el.getAttribute("title") || "" })).catch(() => null);
    const footOk = foot && /approximate, after EN ISO 52022-1/.test(foot.text) && /concept estimate, clear sky, not compliance/.test(foot.text) &&
      /central 60%/.test(foot.text) && /south.*51\.5 N.*May-Aug.*default pose.*neighbour block ignored/i.test(foot.title) &&
      !/clause|§|\b52022-1:\d|\d+\.\d+\.\d+/.test(foot.text + foot.title);
    check("4", `${vp.name} px footnote wording + tooltip, no clause number`, foot ? foot.text : "missing", !!footOk);
    check("5", `${vp.name} px gallery console: no errors or warnings (incl. WebGL context)`, logs.length ? logs.join(" | ") : "clean", logs.length === 0);
  }
  await page.close();

  // Detail page: related-pattern cards (same PatternCard)
  const d = await open(DETAIL, vp);
  if (!baseline) await d.page.waitForTimeout(4000); else await d.page.waitForTimeout(1500);
  snap[vp.name].related = await cardBoxes(d.page);
  await d.page.screenshot({ path: join(out, `detail-louvre-cascade-${vp.name}-${tag}.png`), fullPage: true });
  if (!baseline) {
    const rel = await cardBadges(d.page);
    // @react-three/fiber (detail-page canvas, unchanged) creates a THREE.Clock, which this three deprecates.
    d.logs = d.logs.filter((l) => !l.startsWith("warning: THREE.Clock: This module has been deprecated"));
    check("6", `${vp.name} px detail related cards render, badge/pill inside thumbnail, console clean`,
      `${rel.length} cards, ${rel.map((r) => r.kind).join(",")}${d.logs.length ? " | " + d.logs.join(" | ") : ""}`,
      rel.length > 0 && rel.every((r) => r.kind !== "none" && r.inside && r.oneLine) && d.logs.length === 0);
  }
  await d.page.close();
}

if (!baseline) {
  // (1) card boxes identical before and after, both widths (all 11 + Studio, and related cards on the detail page)
  const before = JSON.parse(readFileSync(join(out, "card-boxes-before.json"), "utf8"));
  for (const vp of VIEWPORTS) {
    for (const part of ["cards", "related"]) {
      const a = snap[vp.name][part], b = before[vp.name][part];
      const keys = Object.keys(b);
      const diff = keys.filter((k) => !a[k] || ["x", "y", "w", "h", "thumbW", "thumbH"].some((p) => Math.abs(a[k][p] - b[k][p]) > 0.5));
      check("1", `${vp.name} px ${part}: ${keys.length} card boxes (x, y, w, h, thumb) identical before/after`,
        diff.length ? `changed: ${diff.join(", ")}` : `${keys.length} identical`, diff.length === 0 && keys.length === Object.keys(a).length);
    }
  }
  // No WebGL: PatternCard keeps the SVG preview and still shows the badge
  const vp = VIEWPORTS[0];
  const { page, logs } = await open("/", vp, { noWebGL: true });
  await page.waitForFunction((n) => document.querySelectorAll("[data-sun-badge]").length >= n, SCORED.length, { timeout: 30000 }).catch(() => {});
  for (const a of await page.$$("div.grid > a")) { await a.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);
  const nb = await cardBadges(page);
  await page.screenshot({ path: join(out, "gallery-1280-no-webgl.png"), fullPage: true });
  for (const s of SCORED) {
    const b = nb.find((x) => x.href === `/patterns/${s}`);
    check("F", `no WebGL ${s}: SVG preview shown, no 3D image, badge kept`, b ? `svg ${b.svgVisible} img ${b.img} | ${b.text}` : "missing",
      !!b && b.svgVisible && !b.img && b.kind === "badge" && /^Blocks (~\d+|>95|<5)%/.test(b.text));
    check("H", `no WebGL ${s}: SVG fallback artwork starts below the badge (headroom >= 4 px)`, b ? `${b.headroom} px` : "missing", !!b && b.headroom >= 4);
  }
  // Badges are precomputed (badges.json), so they need no render path; the brick screen shows the end cap
  const brick = nb.find((x) => x.href === "/patterns/rotated-brick-screen");
  check("R", "no WebGL: rotated-brick-screen badge reads 'Blocks >95%' (end cap, never ~100%)", brick ? brick.text : "missing", !!brick && /^Blocks >95% /.test(brick.text));
  check("F", "no WebGL: no page errors", logs.filter((l) => l.startsWith("pageerror")).join(" | ") || "none", !logs.some((l) => l.startsWith("pageerror")));
  await page.close();
}

writeFileSync(join(out, `card-boxes-${tag}.json`), JSON.stringify(snap, null, 1));
await browser.close();
await noGLBrowser.close();

if (baseline) {
  console.log(`baseline written: ${Object.keys(snap["1280"].cards).length} cards at 1280, ${Object.keys(snap["390"].cards).length} at 390`);
} else {
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of rows) console.log(`${pad(r.id, 5)}${pad(r.what, 92)}${pad(r.got, 112)}${r.pass ? "PASS" : "FAIL"}`);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} pass`);
  process.exit(passed === rows.length ? 0 : 1);
}
