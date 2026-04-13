#!/usr/bin/env node
/**
 * Image optimizer for silent-feynman.
 *
 * Reads everything in assets/images and a few hand-picked heavy files
 * elsewhere, then writes multi-width WebP versions to assets/optimized.
 *
 * Skips files that already have an up-to-date optimized output (mtime check)
 * so re-running is cheap.
 *
 * Usage:
 *   node scripts/optimize-images.mjs           # incremental
 *   node scripts/optimize-images.mjs --force   # rebuild everything
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1"), "..");
const OUT_DIR = path.join(ROOT, "assets", "optimized");
const FORCE = process.argv.includes("--force");

// Widths to generate (only smaller-than-source widths are emitted)
const WIDTHS = [480, 800, 1200, 1600];

// Inputs: scan entire assets/ recursively (excluding optimized output dir)
const SCAN_DIRS = [path.join(ROOT, "assets")];
const EXCLUDE_DIRS = new Set([path.join(ROOT, "assets", "optimized")]);
const EXTRA_FILES = [
  path.join(ROOT, "assets", "karangasem-water-temple-palace-bali.jpg"),
  path.join(ROOT, "assets", "hero-pose.jpg"),
  path.join(ROOT, "assets", "contact-bg.jpg"),
  path.join(ROOT, "assets", "meditation-bg.png"),
  path.join(ROOT, "assets", "ibiza-background.png"),
  path.join(ROOT, "assets", "earth-day.jpg"),
  path.join(ROOT, "assets", "frequency-vibes-poster.jpg"),
  path.join(ROOT, "assets", "event-video-poster.jpg"),
  path.join(ROOT, "assets", "eugene-meditation.jpg"),
  path.join(ROOT, "assets", "meditation-about.jpg"),
  path.join(ROOT, "assets", "frequency-vibes-diagram-original.jpg"),
  path.join(ROOT, "assets", "retreat-custom-01.jpg"),
  path.join(ROOT, "assets", "retreat-custom-02.jpg"),
  path.join(ROOT, "assets", "retreat-class-01.jpg"),
  path.join(ROOT, "assets", "retreat-class-02.jpg"),
  path.join(ROOT, "assets", "retreat-class-03.jpg"),
  path.join(ROOT, "assets", "biozar-thumb.jpg"),
  path.join(ROOT, "assets", "ahmad-jaafar-toQTkWFvWyo-unsplash.jpg"),
  path.join(ROOT, "assets", "muhammed-a-mustapha-aaIsU06zWrg-unsplash.jpg"),
  path.join(ROOT, "assets", "pexels-maxravier-2253818.jpg"),
];

const VALID_EXT = new Set([".jpg", ".jpeg", ".png"]);

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(full)) continue;
      out.push(...(await walk(full)));
    } else if (VALID_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function needsRebuild(srcPath, outPath) {
  if (FORCE) return true;
  if (!(await fileExists(outPath))) return true;
  const [src, out] = await Promise.all([fs.stat(srcPath), fs.stat(outPath)]);
  return src.mtimeMs > out.mtimeMs;
}

function formatBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

async function processOne(srcPath, stats) {
  const base = path.basename(srcPath, path.extname(srcPath));
  await fs.mkdir(OUT_DIR, { recursive: true });

  const meta = await sharp(srcPath).metadata();
  const srcWidth = meta.width || 1600;

  let totalIn = 0;
  let totalOut = 0;
  const results = [];

  // For tiny sources smaller than smallest WIDTH, still emit a native-size variant
  const effectiveWidths = WIDTHS.filter((w) => w <= srcWidth);
  if (effectiveWidths.length === 0) effectiveWidths.push(srcWidth);

  for (const width of effectiveWidths) {
    const outName = `${base}.${width}w.webp`;
    const outPath = path.join(OUT_DIR, outName);

    if (!(await needsRebuild(srcPath, outPath))) {
      stats.skipped++;
      continue;
    }

    await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toFile(outPath);

    const outStat = await fs.stat(outPath);
    totalOut += outStat.size;
    results.push({ width, size: outStat.size });
    stats.generated++;
  }

  // Also generate a full-quality fallback at the source's native size (for cases
  // where the source itself is overkill but we still want a webp at the largest
  // width we use). Only if we didn't already cover it via WIDTHS.
  if (srcWidth > Math.max(...WIDTHS)) {
    const outName = `${base}.${Math.max(...WIDTHS)}w.webp`;
    // already handled in the loop above; nothing more to do.
  }

  if (results.length) {
    const srcStat = await fs.stat(srcPath);
    totalIn = srcStat.size;
    const savings = ((1 - totalOut / totalIn) * 100).toFixed(0);
    console.log(
      `  ✓ ${path.relative(ROOT, srcPath)} → ${results.length} variants ` +
        `(src ${formatBytes(totalIn)} → out ${formatBytes(totalOut)}, ${savings}% saved)`
    );
  }
}

async function main() {
  console.log("→ Scanning sources…");
  const fromDirs = (await Promise.all(SCAN_DIRS.map(walk))).flat();
  const fromExtras = [];
  for (const f of EXTRA_FILES) {
    if (await fileExists(f)) fromExtras.push(f);
  }
  const all = [...new Set([...fromDirs, ...fromExtras])];
  console.log(`  found ${all.length} candidate images`);

  const stats = { generated: 0, skipped: 0, failed: 0 };
  for (const src of all) {
    try {
      await processOne(src, stats);
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ ${path.relative(ROOT, src)}: ${err.message}`);
    }
  }

  console.log("\n→ Done");
  console.log(`  generated: ${stats.generated}`);
  console.log(`  skipped (up-to-date): ${stats.skipped}`);
  console.log(`  failed: ${stats.failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
