# Reels Controller — uso

Panel HTML auto-contenido que orquesta el pipeline de los 3 reels piloto:

```
Buku 2 GCNI PDF
    ↓ (manual, Zak escribe scripts en spec.json)
spec.json por reel
    ↓ Generate voice (Higgs @ 127.0.0.1:5757)
voice.wav
    ↓ Generate image por shot (ComfyUI @ 127.0.0.1:8188)
shot_1.png … shot_N.png
    ↓ Storyboard preview en HTML
    ↓ Aprobación Zak → Eugene
DaVinci edit (manual) → render.mp4 → IG/YT
```

## Requisitos previos

1. **Higgs server activo** en `127.0.0.1:5757`. Lanzar:
   ```bat
   cd "C:\Users\Usuario\Desktop\bussines model\voicebox_lab\experiments\higgs_audio_quantized"
   run_higgs_server.bat
   ```
2. **ComfyUI portable activo** en `127.0.0.1:8188`. Lanzar:
   ```bat
   cd C:\ComfyUI_windows_portable
   run_nvidia_gpu_blackwell_FINAL.bat
   ```
   (Modelos en `E:\Modelos_ComfyUI\` ya están mapeados vía `extra_model_paths.yaml`.)
3. **`workflow.json` está pre-configurado para FLUX.1 dev nvfp4** (vertical 9:16, 768×1344). Usa:
   - UNET: `flux1-dev-nvfp4.safetensors` (Blackwell-optimized FP4, 9GB)
   - DualCLIP: `clip_l.safetensors` + `t5xxl_fp8_e4m3fn_scaled.safetensors`
   - VAE: `ae.safetensors`
   - 20 steps euler/simple, FluxGuidance 3.5 (recomendado FLUX)
   - Negative prompt anti "low quality / cartoon / illustration / watermark"
   Si quieres cambiar a `flux1-dev-fp8.safetensors` (17GB, calidad ligeramente mejor pero más lento), edita `unet_name` en el nodo "4" del workflow.json o usa el botón "use" del tab System.

## Lanzar

Doble clic en `start.bat`. Abre auto el navegador en http://localhost:8766/index.html

Si los pills de health en la esquina superior derecha quedan rojos, los servicios no están arriba — relánzalos.

## Flujo de uso

1. **Click la pestaña del reel** (3 disponibles: Authority, Unity, Essay).
2. **Verifica el script** mirando los `voice_line` de cada shot (la voz se construye concatenando todos en orden).
3. **Generate voice** → Higgs lo procesa (~30-90s), aparece reproductor inline. Si la duración total supera el target (≤30s), se pinta en rojo.
4. **Por cada shot**, edita el `image_prompt` si quieres + click "Generate image". ComfyUI corre el workflow (~10-60s según GPU/checkpoint), thumb aparece.
5. **Repite** hasta tener todas las imágenes. La sección "Storyboard" da una vista de tira de frames.
6. **Aprobación**: revisa storyboard + audio. Si todo bien, exporta el contenido a DaVinci (los assets están en cada reel folder).

## Tabs en la HTML

- **⚙ System** — primer tab. Muestra:
  - Estado Higgs + perfil Eugene cargado (cuántos samples de referencia hay)
  - Estado ComfyUI + lista de **checkpoints** instalados (FLUX se resalta en púrpura si lo tienes)
  - Lista de **UNET models** (formato FLUX-style) si los tienes
  - **Workflow.json activo**: qué checkpoint usa, sampler, scheduler, dimensiones, validación de placeholders
  - **Pipeline overview**: los 3 reels en una vista con su estado actual (Script ✓ → Voice → Images N/N → Zak → Eugene)
  - Botón **"use"** al lado de cada checkpoint para hacer swap instantáneo en `workflow.json` (mismo workflow, sólo cambia el `ckpt_name`)
- **Reel 1 / 2 / 3** — un tab por reel con:
  - Pipeline status visible arriba
  - Generador de voz
  - Lista de shots con prompts editables y botón Generate image por shot
  - Storyboard preview

## Endpoints expuestos por server.py

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/health` | estado Higgs + ComfyUI |
| GET | `/api/system` | estado + inventario ComfyUI + perfil Higgs + workflow actual |
| GET | `/api/comfy/inventory` | sólo el inventario ComfyUI (checkpoints, samplers, etc.) |
| GET | `/api/workflow` | contenido + parsing del `workflow.json` |
| POST | `/api/workflow/checkpoint` | swap rápido del checkpoint (`{"ckpt_name": "..."}`) |
| GET | `/api/specs` | lista de specs de los 3 reels |
| GET | `/api/spec/{reel_id}` | spec individual |
| POST | `/api/spec/{reel_id}` | guardar edits |
| POST | `/api/voice/{reel_id}` | generar voz Higgs y guardar `voice.wav` |
| GET | `/api/voice/{reel_id}` | descargar `voice.wav` |
| POST | `/api/image/{reel_id}/{shot_id}` | generar imagen ComfyUI y guardar `shot_N.png` |
| GET | `/api/image/{reel_id}/{shot_id}` | descargar `shot_N.png` |

## Cambiar de modelo de imagen

Sólo reemplaza `workflow.json`:
1. En ComfyUI, monta el workflow que quieras (FLUX dev, SDXL turbo, custom Lora, etc.).
2. Test que produce una imagen vertical 9:16 (768×1344 o similar).
3. Click **Save (API Format)** → te baja un JSON.
4. Edita el JSON: busca el `text` del prompt positivo y reemplázalo por `"PROMPT_PLACEHOLDER"`. Busca el `seed` del KSampler y reemplázalo por `"SEED_PLACEHOLDER"`.
5. Guarda como `workflow.json` en esta carpeta. Reinicia start.bat.

## Cambiar duración / cantidad de shots

Edita el `spec.json` directo del reel (`Desktop\bussines model\branding\reels\v1\reelN_*/spec.json`). El controller recarga automáticamente.

## Limitaciones conocidas v1

- No hay regeneración con seed manual desde la UI (cada gen usa una seed nueva basada en time). Si quieres regenerar igual: vacía `shot_N.png` y vuelve a clickar.
- La construcción del texto Higgs concatena `voice_line` con un espacio. No respeta marcas de pausa explícita más allá del `.` natural.
- No exporta `edit-spec.json` aún — el `spec.json` ya tiene toda la info; DaVinci lo puede consumir manual.
- No hay autoguardado de prompts. Hay que click "Save text" por shot, o "Generate image" (que guarda antes de generar).
