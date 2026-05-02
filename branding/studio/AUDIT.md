# Studio v3 — Audit checklist
*Pásalo en orden. Marca ✅ funciona · ❌ no · ⚠️ funciona pero hay un detalle.*

Abre `branding/studio/index.html` en Chrome (Ctrl+F5 si ya lo tenías abierto).

---

## 1. Auto-save / Restore session
- [ ] Edita algo (mueve un elemento, cambia un texto)
- [ ] Espera ~2s → cierra la pestaña sin guardar
- [ ] Reabre el index.html → debería preguntar *"Restore previous session (Xmin ago)?"*
- [ ] Click OK → tu trabajo vuelve

## 2. Multi-select + Align
- [ ] Click un elemento → selecciona (azul)
- [ ] **Shift+click** otro → ambos seleccionados (segundo con borde dashed gold)
- [ ] Aparece la **align bar** abajo del canvas (9 botones)
- [ ] Click `⫷` → ambos van al mismo borde izquierdo
- [ ] Click `⊟` (centro horizontal) → centrados horizontalmente
- [ ] Selecciona 3 elementos → los botones `↔` y `↕` (distribute) los reparten

## 3. Carousel mode (slides)
- [ ] Arriba del canvas: barra **SLIDES** con `01` activo y `+ ADD SLIDE`
- [ ] Click `+ ADD SLIDE` → aparece tab `02`, canvas en blanco con template Quote
- [ ] Edita slide 2, vuelve a `01` → mantiene tu slide 1 intacto
- [ ] Botón **↓ Export carousel** aparece arriba a la derecha cuando hay 2+ slides
- [ ] Click → exporta TODOS los slides como `frequency-vibes_carousel_01.png`, `02.png`...
- [ ] Click la `×` de un slide → borra (con confirm)

## 4. Decorative shapes library
- [ ] Sidebar izquierda: nueva sección **Decorative shapes** con 12 formas
- [ ] Drag una wave / dots / line / frame al canvas
- [ ] Aparece como elemento libre — podés moverlo, redimensionarlo, rotarlo
- [ ] Cambia el color en el panel derecho (Color del texto se aplica al SVG via `currentColor`)

## 5. Knockout text (texto-ventana sobre foto)
- [ ] Carga template **Photo + Quote** (ya tiene foto bg)
- [ ] Click un texto sobre la foto → panel derecho FX TEXT
- [ ] Click el botón **"apply knockout"**
- [ ] El texto se vuelve transparente y muestra la foto detrás (efecto "ventana")
- [ ] Click otra vez → toggle off

## 6. EyeDropper (color desde la foto)
- [ ] Selecciona un texto · panel FX TEXT
- [ ] Click **"⊙ eyedropper from canvas"**
- [ ] Cursor cambia a lupa de Chrome → click sobre cualquier color en pantalla
- [ ] El texto adopta ese color exacto
- [ ] (Si falla: solo Chrome 95+ soporta EyeDropper API)

## 7. Copy PNG to clipboard
- [ ] Topbar arriba → **📋 Copy** (al lado de Export PNG)
- [ ] Click → toast "PNG copied to clipboard"
- [ ] Vas a WhatsApp Web / IG / Telegram / Photoshop → `Ctrl+V` → la imagen aparece pegada
- [ ] (Si dice "clipboard write failed": file:// puede bloquear en algunos browsers — entonces usa Export PNG normal)

## 8. My templates
- [ ] Compón algo (ej: Quote con tu foto y texto custom)
- [ ] Click **★ Save as tpl** arriba → escribe nombre → OK
- [ ] Sidebar derecha (después de Layers): nueva sección **My templates** con tu plantilla
- [ ] Click la card → carga esa composición exacta
- [ ] Hover → aparece `×` para borrarla

---

## Otros que ya funcionaban (re-verifico que no se rompieron en v3)
- [ ] Drop foto del cliente → bg swap o free element según template
- [ ] Drop logo partner → swap o free
- [ ] Click texto, escribir → edita
- [ ] Click frase de la library → reemplaza texto seleccionado
- [ ] Templates 1-6 cargan
- [ ] Format toggle 1:1 / 4:5 / 9:16
- [ ] Layers panel (visibility / lock / reorder)
- [ ] Undo / Redo (Ctrl+Z / Ctrl+Y)
- [ ] Snap guides al mover (líneas doradas)
- [ ] Grain overlay toggle
- [ ] FX TEXT (shadow, gradient, stroke, highlight, vertical, weight, case, line height)
- [ ] FX IMAGE (presets, sliders, blend, shape mask, drop shadow)
- [ ] FX LOGO (tints)
- [ ] Save / Load JSON
- [ ] Export PNG individual

---

## Decisión a tomar después de auditar

- **Si todo va bien** → **producir el primer post juntos**: cargo Post 1 (Quote opener) y vamos componiendo.
- **Si hay 1-2 detalles** → me los dices y los fix sobre la marcha (5-15 min).
- **Si te quedas corto en alguna feature crítica** → migración a **Polotno Studio**: clonar el repo open-source, portar templates Frequency Vibes, deploy local. Tarda ~1h y requiere registrarse para API key gratuita. No lo hago sin tu green-light.

## Caveats que ya conozco
- **Copy to clipboard** puede fallar en `file://` en algunos browsers (Chrome lo permite normalmente, Firefox a veces no). Workaround: Export PNG normal funciona siempre.
- **EyeDropper API** solo Chrome/Edge 95+. Firefox/Safari aún no.
- **Auto-save** guarda en `localStorage` por origen — si abres en otro browser/perfil no aparece.
- **My templates** también localStorage — exportar JSON con 💾 Save si quieres backup off-machine.
