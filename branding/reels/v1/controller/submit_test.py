import json, urllib.request, sys, time, os, glob, shutil

WORKFLOW = r"C:\Users\Usuario\Desktop\bussines model\branding\reels\v1\controller\workflow_animate_test.json"
COMFY = "http://127.0.0.1:8188"
OUT_DIR = r"C:\Users\Usuario\AppData\Local\Programs\@comfyorgcomfyui-electron\resources\ComfyUI\output"

with open(WORKFLOW, "r", encoding="utf-8") as f:
    wf = json.load(f)

payload = {"prompt": wf, "client_id": "fv_test_client"}
data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=30)
    body = resp.read().decode("utf-8")
    print("QUEUED:", body)
    pid = json.loads(body).get("prompt_id")
    print("PROMPT_ID:", pid)
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode("utf-8"))
    sys.exit(1)
