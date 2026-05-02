"""Once the Wan workflow is validated, animate all 6 shots of reel1_authority
sequentially. Reads spec.json, uploads each shot_N.png to ComfyUI, queues a
workflow per shot using the per-shot prompt + caption, and copies the result
into the reel folder as shot_N_motion.mp4."""
import json, os, time, sys, urllib.request, urllib.parse, glob, shutil

REEL_DIR = r"C:\Users\Usuario\Desktop\bussines model\branding\reels\v1\reel1_authority"
SPEC = os.path.join(REEL_DIR, "spec.json")
WF_TEMPLATE = r"C:\Users\Usuario\Desktop\bussines model\branding\reels\v1\controller\workflow_animate_test.json"
COMFY_OUT = r"C:\ComfyUI_windows_portable\ComfyUI\output"
COMFY = "http://127.0.0.1:8188"

with open(SPEC, "r", encoding="utf-8") as f:
    spec = json.load(f)
with open(WF_TEMPLATE, "r", encoding="utf-8") as f:
    base_wf = json.load(f)

def upload_image(path, target_name):
    import requests
    with open(path, "rb") as f:
        files = {"image": (target_name, f, "image/png")}
        r = requests.post(f"{COMFY}/upload/image",
                          files=files,
                          data={"type": "input", "overwrite": "true"})
    print(f"  upload {target_name}: HTTP {r.status_code}")
    return r.status_code == 200

def queue(workflow):
    data = json.dumps({"prompt": workflow, "client_id": "fv_batch"}).encode()
    req = urllib.request.Request(f"{COMFY}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def wait_for(prompt_id, prefix, timeout=1200):
    start = time.time()
    while time.time() - start < timeout:
        h = urllib.request.urlopen(f"{COMFY}/history/{prompt_id}", timeout=10).read()
        if h != b"{}" and h:
            mp4s = sorted(glob.glob(os.path.join(COMFY_OUT, f"{prefix}*.mp4")),
                          key=os.path.getmtime, reverse=True)
            if mp4s:
                return mp4s[0]
        time.sleep(5)
    return None

for shot in spec["shots"]:
    sid = shot["id"]
    if sid == 1:
        continue  # already validated separately
    img_path = os.path.join(REEL_DIR, shot["image_filename"])
    if not os.path.exists(img_path):
        print(f"shot_{sid}: image not found, skipping")
        continue
    print(f"shot_{sid}: queueing motion render")
    target = f"shot_{sid}_input.png"
    upload_image(img_path, target)
    wf = json.loads(json.dumps(base_wf))
    wf["1"]["inputs"]["image"] = target
    wf["6"]["inputs"]["text"] = shot.get("animation_prompt") or \
        "Subtle gentle motion, ethereal mist drifting softly, divine light pulsing, contemplative spiritual atmosphere, no abrupt motion, cinematic"
    wf["9"]["inputs"]["seed"] = 12345 + sid * 100
    wf["11"]["inputs"]["filename_prefix"] = f"fv_shot_{sid}"
    pid = queue(wf)["prompt_id"]
    print(f"  prompt {pid}")
    mp4 = wait_for(pid, f"fv_shot_{sid}")
    if mp4:
        dest = os.path.join(REEL_DIR, f"shot_{sid}_motion.mp4")
        shutil.copy2(mp4, dest)
        print(f"  -> {dest}")
    else:
        print(f"  shot_{sid} TIMEOUT — keeping Ken Burns fallback")

print("DONE")
