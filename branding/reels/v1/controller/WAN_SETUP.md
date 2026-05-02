# Wan 2.1 i2v — working setup for FV reels

**Last validated:** Apr 30 2026 — RTX 5080 16GB + torch 2.10+cu130

## The pipeline that works

1. ComfyUI standalone (no flags): `cd /c/ComfyUI_windows_portable && ./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build`
2. Controller: `cd controller && python server.py` (port 8766)
3. Open http://localhost:8766 → click Generate Wan on each shot card.

Per-shot timing on RTX 5080:
- First shot (cold model load): ~6 min (5 min loading from E:\, then 6 min sampling)
- Subsequent shots (model warm in VRAM): ~6 min each (sampling dominates at length 201)
- 6 shots = ~36 min total

## Workflow `workflow_animate.json`

Key settings:
- Model: `wan2.1_i2v_480p_14B_fp8_scaled.safetensors` (NOT the plain `_fp8_e4m3fn.safetensors` — that hangs)
- weight_dtype: `default`
- LoRA: `Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64.safetensors` strength 1.0
- WanImageToVideo (plain, no Camera nodes): 480×832, length 201
- KSampler: 4 steps, cfg 1.0, euler/simple
- VHS_VideoCombine: fps 24, pingpong false, `images: ["10", 0]`

## Length sweep results

| length | sampling | clip duration |
|---|---|---|
| 49 | 70s | 2.0s |
| 81 | 78s | 3.4s |
| 121 | 138s | 5.0s |
| 161 | 213s | 6.7s |
| **201** | **372s** | **8.4s** ← chosen |

## Hang signals (when something is wrong)

If KSampler stops at "model_type FLOW" and nothing happens:
- The model file is the wrong (raw fp8) variant. Switch to `_scaled` version.
- Verify: parse safetensors header — must have `.scale_input` / `.scale_weight` tensors.

## Required files in E:\Modelos_ComfyUI\

- `diffusion_models\wan2.1_i2v_480p_14B_fp8_scaled.safetensors` (16 GB)
- `loras\Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64.safetensors`
- `text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors`
- `vae\wan_2.1_vae.safetensors`
