# Frequency Vibes — Reels Pilot v1

3 reels piloto de ≤30s cada uno, basados en Buku 2 GCNI (UN GCNI 2025 Impact Stories). Voz: Higgs clonada de Eugene (perfil `09b98354-e421-4724-a665-f76c9708e186`). Visuales: AI image gen (pipeline a definir) + motion graphics donde aplique.

## Estado

- ✅ Carpetas y scripts creados (`reel1_authority/`, `reel2_unity/`, `reel3_essay/`)
- ✅ `script.txt` redactado para los 3, todos ≤30s con margen (estimación detallada en `HIGGS_NOTES.md`)
- ✅ `shotlist.md` con tiempos, voice line, image prompt draft, caption por shot
- ✅ `generate_reel_voice.py` — generador parametrizado (lee script.txt → escribe voice.wav)
- ✅ `HIGGS_NOTES.md` — auditoría Higgs-friendliness por reel
- ⏳ **Higgs server**: setup ya hecho del audiobook. Crash al lanzarlo desde sesión Claude probablemente fue contención de VRAM. Lanzar manual cuando quieras (ver abajo).
- ⏳ Pipeline image gen — pendiente decidir herramienta (ver "Decisiones pendientes")
- ⏳ Voice WAVs pendientes
- ⏳ Edición DaVinci pendiente
- ⏳ Aprobación Eugene pendiente

## Cómo levantar Higgs (recordatorio rápido)

Cmd nueva (no Claude terminal):

```bat
cd "C:\Users\Usuario\Desktop\bussines model\voicebox_lab\experiments\higgs_audio_quantized"
run_higgs_server.bat
```

Espera ~3 min hasta `Running on http://127.0.0.1:5757`. Si segfaultea, cerrar Antigravity / Chrome / juegos, retry.

## Cómo generar las 3 voces

```powershell
python "branding\reels\v1\generate_reel_voice.py" reel3_essay      # primero — el más corto
python "branding\reels\v1\generate_reel_voice.py" reel1_authority
python "branding\reels\v1\generate_reel_voice.py" reel2_unity
```

Empezar por **Reel 3** (~22s, contemplativo) — valida calidad voz Higgs antes de comprometernos. Si suena bien, generar los otros 2.

## Resumen de los 3 reels

| Reel | Ángulo | Duración est. | Hook visual | Hook copy |
|------|--------|---------------|-------------|-----------|
| 1 — authority | SBDI en publicación oficial UN | ~20s | Page 40 zoom | "The same foundation I direct." |
| 2 — unity | Cassava → MOCAF → 5 nations Africa | ~22-28s | "100 / 2 weeks / 1" punch cuts | "Sustainable food security starts with shared knowledge and local action." |
| 3 — essay | Filosofía de marca, atmosférico | ~22-25s | Sunset + slow tempo | "When those frequencies align — that's when something real gets created." |

## Decisiones pendientes (pingear a Zak)

1. **Image gen pipeline**: ¿qué herramienta? Opciones a discutir:
   - ComfyUI local (.lnk encontrada en Desktop) — gratis, control total, lento
   - FLUX vía API (Black Forest Labs) — cuesta, calidad cinematográfica top
   - Midjourney — costoso, mejor estética pero sin API oficial
   - Stable Diffusion Forge / A1111 local — alternativa a ComfyUI
   - Photos del cliente (`Desktop\video imagen istaram\`) — fallback si no hay tiempo
2. **HTML controller**: ¿construimos un panel tipo n8n para orquestar el pipeline? Recomendación: SÍ, versión simple (~1-2h de build), no canvas completo. Detalles abajo.

## Propuesta HTML controller (opcional)

Un fichero `branding/reels-controller.html` autocontenido (sin instalación, fetch a Higgs y al servicio de imagen) con:

- Tarjeta por reel mostrando el `script.txt` editable
- Botón "Generate voice" → POST a `127.0.0.1:5757/generate` → preview WAV inline
- Tabla por shot: voice line + image prompt + thumb generada
- Botón "Generate image" por fila → llama al endpoint que decidamos (ComfyUI tiene HTTP API, FLUX también)
- Vista storyboard final (script + WAV + imágenes en sucesión)
- Botón "Export edit-spec.json" con el plan completo para que DaVinci o un script de render lo consuma

Encaja con el ecosistema existente:
- `branding/studio/` — image editor self-contained ✓
- `branding/video-workbench/` — video trim/crop self-contained ✓
- `branding/reels-controller.html` — orquestador del pipeline reels (nuevo)

Costes: 1-2h diseño + scaffold inicial. Beneficio: cero comandos manuales, Eugene puede ver el storyboard navegando un HTML, escalable a 30+ reels.

## Ficheros

```
v1/
├── README.md                ← este fichero
├── HIGGS_NOTES.md           ← auditoría Higgs por reel + tiempos
├── generate_reel_voice.py   ← generador parametrizado de voz
├── metrics.md               ← tracking template
├── reel1_authority/
│   ├── script.txt           ← guion EN (~48 palabras, ~20s)
│   ├── shotlist.md          ← plan de tiempos / B-roll / captions
│   ├── voice.wav            (pendiente Higgs)
│   ├── edit.drp             (pendiente DaVinci)
│   └── render.mp4           (pendiente)
├── reel2_unity/
│   ├── script.txt           ← guion EN recortado (~50 palabras, ~22-28s)
│   └── (idem)
└── reel3_essay/
    ├── script.txt           ← guion EN (~33 palabras, ~22-25s)
    └── (idem)
```

## Plan completo

`C:\Users\Usuario\.claude\plans\c-users-usuario-pictures-imagnes-try-ig-recursive-ripple.md`
