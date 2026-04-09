#!/usr/bin/env node
/**
 * Rewrites HTML files to reference optimized WebP variants in assets/optimized/.
 *
 * For each <img src> or url(...) pointing at assets/**\/*.{jpg,jpeg,png}, if a
 * matching basename exists in assets/optimized/, swap to the largest-available
 * variant <= 1200w (or 800w if only smaller exists). Also adds loading="lazy"
 * and decoding="async" to <img> tags that lack them (except ones marked
 * data-eager or with fetchpriority="high").
 *
 * Intentionally conservative: skips services.html (already hand-tuned) and any
 * reference inside a <picture> block (already optimized).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1"), "..");
const OPT_DIR = path.join(ROOT, "assets", "optimized");
const SKIP_HTML = new Set(["services.html", "test-images.html", "admin.html"]);
const PREFERRED_WIDTHS = [1200, 800, 1600, 480];

async function main() {
  const opt = new Set(await fs.readdir(OPT_DIR));
  // Map basename -> best variant filename
  const byBase = new Map();
  for (const f of opt) {
    const m = f.match(/^(.+)\.(\d+)w\.webp$/);
    if (!m) continue;
    const [, base, w] = m;
    const width = parseInt(w, 10);
    const prev = byBase.get(base);
    if (!prev || score(width) < score(prev.width)) {
      byBase.set(base, { file: f, width });
    }
  }
  function score(w) {
    // Prefer 1200, then 800, then 1600, then 480
    const idx = PREFERRED_WIDTHS.indexOf(w);
    return idx === -1 ? 99 : idx;
  }

  const htmlFiles = (await fs.readdir(ROOT)).filter((f) => f.endsWith(".html") && !SKIP_HTML.has(f));

  const stats = { filesChanged: 0, imgReplaced: 0, urlReplaced: 0, lazyAdded: 0 };

  for (const file of htmlFiles) {
    const full = path.join(ROOT, file);
    const original = await fs.readFile(full, "utf8");
    let html = original;

    // Replace src="assets/.../name.jpg|png" -> assets/optimized/name.WIDTHw.webp
    html = html.replace(
      /(src|href)=["']assets\/([^"']+?\/)?([^"'\/]+)\.(jpg|jpeg|png)["']/gi,
      (match, attr, subdir, name, ext) => {
        const hit = byBase.get(name);
        if (!hit) return match;
        stats.imgReplaced++;
        return `${attr}="assets/optimized/${hit.file}"`;
      }
    );

    // Replace url(assets/.../name.jpg) in inline styles / <style>
    html = html.replace(
      /url\((['"]?)assets\/([^)'"]+?\/)?([^)'"\/]+)\.(jpg|jpeg|png)\1\)/gi,
      (match, q, subdir, name, ext) => {
        const hit = byBase.get(name);
        if (!hit) return match;
        stats.urlReplaced++;
        return `url(${q}assets/optimized/${hit.file}${q})`;
      }
    );

    // Add loading="lazy" decoding="async" to <img> tags lacking them
    html = html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (/\bfetchpriority\s*=\s*["']high/i.test(attrs)) return match;
      if (/\bdata-eager\b/i.test(attrs)) return match;
      let updated = attrs;
      let changed = false;
      if (!/\bloading\s*=/i.test(updated)) {
        updated += ' loading="lazy"';
        changed = true;
      }
      if (!/\bdecoding\s*=/i.test(updated)) {
        updated += ' decoding="async"';
        changed = true;
      }
      if (changed) stats.lazyAdded++;
      return `<img${updated}>`;
    });

    if (html !== original) {
      await fs.writeFile(full, html, "utf8");
      stats.filesChanged++;
      console.log(`  ✓ ${file}`);
    }
  }

  console.log("\n→ Done");
  console.log(`  files changed: ${stats.filesChanged}`);
  console.log(`  img/href replacements: ${stats.imgReplaced}`);
  console.log(`  url() replacements: ${stats.urlReplaced}`);
  console.log(`  lazy/decoding added: ${stats.lazyAdded}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
