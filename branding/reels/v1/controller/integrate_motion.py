"""When a fv_test_gguf*.mp4 lands in the ComfyUI output dir, copy it to
reel1_authority/shot_1_motion.mp4 so compose_video.py picks it up instead
of Ken Burns on shot 1."""
import glob, os, shutil, sys

OUT_DIR = r"C:\ComfyUI_windows_portable\ComfyUI\output"
DEST = r"C:\Users\Usuario\Desktop\bussines model\branding\reels\v1\reel1_authority\shot_1_motion.mp4"

candidates = sorted(
    glob.glob(os.path.join(OUT_DIR, "fv_test_gguf*.mp4")),
    key=os.path.getmtime,
    reverse=True,
)
if not candidates:
    print("NO_MP4_FOUND")
    sys.exit(1)

src = candidates[0]
size = os.path.getsize(src)
print(f"SRC: {src} ({size} bytes)")

shutil.copy2(src, DEST)
print(f"COPIED -> {DEST}")
print(f"DEST_SIZE: {os.path.getsize(DEST)} bytes")
