"""
Frequency Vibes — image folder watcher.
Polls a folder for new ChatGPT-generated images and auto-produces 3 versions
(WhatsApp 1280, HQ 2160, IG 1080×1350 cream-padded).

Usage: python watch.py
       (or use start-watcher.bat which installs deps + launches)
"""
import os
import sys
import time
import glob
from datetime import datetime
from PIL import Image, ImageEnhance, ImageFilter

# Force UTF-8 console output so we can use arrows etc. without crashing
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

SOURCE_DIR = r"C:\Users\Usuario\Pictures\imagnes try"
OUTPUT_DIR = os.path.join(SOURCE_DIR, "_processed")
SEEN_FILE = os.path.join(OUTPUT_DIR, ".seen.txt")
PATTERNS = ["ChatGPT Image*.png", "ChatGPT Image*.jpg", "ChatGPT Image*.jpeg"]
POLL_INTERVAL = 2  # seconds

# Optional toast notification (best-effort)
try:
    from winotify import Notification, audio
    HAS_TOAST = True
except ImportError:
    HAS_TOAST = False


def log(msg, color=None):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def notify(title, body, paths=None):
    if HAS_TOAST:
        try:
            n = Notification(app_id="Frequency Vibes", title=title, msg=body, duration="short")
            n.set_audio(audio.Default, loop=False)
            if paths:
                # Open the output folder when clicking the toast
                n.add_actions(label="Open folder", launch=OUTPUT_DIR)
            n.show()
            return
        except Exception as e:
            log(f"toast failed: {e}")
    log(f"[notify] {title} — {body}")


def load_seen():
    if not os.path.exists(SEEN_FILE):
        return set()
    with open(SEEN_FILE, encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def mark_seen(name):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(SEEN_FILE, "a", encoding="utf-8") as f:
        f.write(name + "\n")


def is_file_stable(path, checks=4, delay=0.4):
    """Wait until the file size has stopped changing (write finished)."""
    last = -1
    for _ in range(20):
        try:
            size = os.path.getsize(path)
        except OSError:
            return False
        if size > 0 and size == last:
            checks -= 1
            if checks <= 0:
                return True
        last = size
        time.sleep(delay)
    return False


def slug(name):
    """Make a clean stem from the original filename."""
    stem = os.path.splitext(name)[0]
    # ChatGPT Image 27 abr 2026, 09_03_05  ->  chatgpt_2026-04-27_09-03-05
    stem = stem.replace("ChatGPT Image ", "chatgpt_")
    stem = stem.replace(",", "").replace(" ", "_")
    # rough date parse: chatgpt_27_abr_2026_09_03_05
    months = {"ene":"01","feb":"02","mar":"03","abr":"04","may":"05","jun":"06",
              "jul":"07","ago":"08","sep":"09","oct":"10","nov":"11","dic":"12",
              "jan":"01","apr":"04","aug":"08","dec":"12"}
    parts = stem.split("_")
    for i, p in enumerate(parts):
        low = p.lower()
        if low in months:
            parts[i] = months[low]
    stem = "_".join(parts)
    return stem


def enhance(im):
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))
    im = ImageEnhance.Contrast(im).enhance(1.04)
    im = ImageEnhance.Color(im).enhance(1.05)
    return im


def process_image(src_path):
    log(f"PROCESSING  {os.path.basename(src_path)}")
    im = Image.open(src_path).convert("RGB")
    sw, sh = im.size
    ratio = sw / sh
    is_square = abs(ratio - 1.0) < 0.05
    is_portrait = ratio < 0.95
    is_landscape = ratio > 1.05

    stem = slug(os.path.basename(src_path))
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    outputs = []

    # === WhatsApp version (preserve aspect, max long side 1280) ===
    if max(sw, sh) > 1280:
        scale = 1280 / max(sw, sh)
        size = (int(sw * scale), int(sh * scale))
    else:
        size = (sw, sh)
    v1 = im.resize(size, Image.LANCZOS)
    v1 = enhance(v1)
    out1 = os.path.join(OUTPUT_DIR, f"{stem}_whatsapp.jpg")
    v1.save(out1, "JPEG", quality=94, optimize=True, progressive=True)
    outputs.append(out1)
    log(f"  → whatsapp ({size[0]}×{size[1]})  {os.path.getsize(out1)//1024} KB")

    # === HQ version (preserve aspect, max long side 2160) ===
    if max(sw, sh) > 2160:
        size_hq = (sw, sh)  # already big, use native
    else:
        scale = 2160 / max(sw, sh)
        size_hq = (int(sw * scale), int(sh * scale))
    v2 = im.resize(size_hq, Image.LANCZOS)
    v2 = v2.filter(ImageFilter.UnsharpMask(radius=1.6, percent=140, threshold=2))
    v2 = ImageEnhance.Contrast(v2).enhance(1.05)
    v2 = ImageEnhance.Color(v2).enhance(1.05)
    out2 = os.path.join(OUTPUT_DIR, f"{stem}_HQ.jpg")
    v2.save(out2, "JPEG", quality=95, optimize=True, progressive=True)
    outputs.append(out2)
    log(f"  → HQ       ({size_hq[0]}×{size_hq[1]})  {os.path.getsize(out2)//1024} KB")

    # === IG version (1080×1080 square, 1080×1350 portrait, or 1080×1920 story) ===
    if is_square:
        target = (1080, 1080)
        suffix = "ig_square"
    elif is_portrait:
        # If much taller than 4:5, pad with cream; else fit to 4:5
        target = (1080, 1350)
        suffix = "ig_portrait"
    else:
        target = (1350, 1080)
        suffix = "ig_landscape"

    # Fit into target with cream pad (no cropping)
    target_ratio = target[0] / target[1]
    if ratio > target_ratio:
        # wider — fit width
        fit_w = target[0]
        fit_h = int(target[0] / ratio)
    else:
        # taller — fit height
        fit_h = target[1]
        fit_w = int(target[1] * ratio)
    fitted = im.resize((fit_w, fit_h), Image.LANCZOS)
    fitted = enhance(fitted)
    canvas = Image.new("RGB", target, "#efe7d3")  # cream pad
    canvas.paste(fitted, ((target[0] - fit_w) // 2, (target[1] - fit_h) // 2))
    out3 = os.path.join(OUTPUT_DIR, f"{stem}_{suffix}.jpg")
    canvas.save(out3, "JPEG", quality=94, optimize=True, progressive=True)
    outputs.append(out3)
    log(f"  → {suffix:14s} ({target[0]}×{target[1]})  {os.path.getsize(out3)//1024} KB")

    return outputs


def scan_once():
    found = 0
    for pattern in PATTERNS:
        for path in glob.glob(os.path.join(SOURCE_DIR, pattern)):
            name = os.path.basename(path)
            if name in load_seen():
                continue
            if not is_file_stable(path):
                log(f"skipping {name} (still being written)")
                continue
            try:
                outs = process_image(path)
                mark_seen(name)
                notify(
                    title="3 versions ready",
                    body=f"{name} → whatsapp.jpg · HQ.jpg · ig.jpg",
                    paths=outs,
                )
                found += 1
            except Exception as e:
                log(f"ERROR processing {name}: {e}")
    return found


def main():
    if not os.path.exists(SOURCE_DIR):
        log(f"FATAL: source folder not found: {SOURCE_DIR}")
        sys.exit(1)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    log(f"Frequency Vibes watcher — Pillow {Image.__version__}")
    log(f"Watching: {SOURCE_DIR}")
    log(f"Output:   {OUTPUT_DIR}")
    log(f"Toast:    {'on (winotify)' if HAS_TOAST else 'off (winotify not installed — using console only)'}")
    log("Ctrl+C to stop.")
    log("-" * 60)
    initial = scan_once()
    if initial:
        log(f"Initial scan processed {initial} new image(s).")
    else:
        log("No new images. Waiting for ChatGPT drops...")
    try:
        while True:
            time.sleep(POLL_INTERVAL)
            scan_once()
    except KeyboardInterrupt:
        log("Stopped.")


if __name__ == "__main__":
    main()
