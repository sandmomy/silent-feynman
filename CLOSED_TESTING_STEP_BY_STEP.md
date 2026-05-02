# BookVoice — Closed Testing Track setup (step-by-step)

Ejecuta después de que v6.4 termine de buildear. Tiempo total: ~10 minutos.

## Prerequisito

- [ ] v6.4 AAB descargado: `https://expo.dev/artifacts/eas/<v6.4-url>.aab` (te lo paso cuando termine el build)
- [ ] App Content completo (ver `PLAY_CONSOLE_CHEAT_SHEET.md`)
- [ ] Ficha Play Store verde (ya está, hecho ayer)

---

## Paso 1 — Crear el track Closed Testing (3 min)

1. **Play Console** → selecciona **BookVoice — Frequency Vibes**
2. Menú izquierdo → **Test and release / Prueba y lanzamiento**
3. Dentro del desplegable → **Closed testing / Prueba cerrada**
4. Botón azul **Create track / Crear canal**
5. **Nombre del canal**: `alpha` (o lo que quieras)
6. **Descripción** (opcional): "Pre-production closed test"
7. **Save / Guardar**

---

## Paso 2 — Crear la primera versión del track (3 min)

1. Dentro del track `alpha`, clic **Create new release / Crear versión nueva**
2. **App bundles** → **Upload / Subir**
3. Selecciona el archivo **AAB v6.4** (`.aab`) descargado de Expo
4. Espera la subida (~30s)
5. Google valida → aparece verde

6. **Nombre de la versión (interno)**: `1.0.0 (9)` (auto)

7. **Notas de la versión** → pega esto (de `mobile/RELEASE_NOTES_v6.md`):

```xml
<en-US>
v6 alpha: Sign in with Google, smoother reader, fixes for pinch-zoom freeze and audio cleanup on logout. Google OAuth redirect fixed in v6.4.
</en-US>
<es-ES>
v6 alpha: Inicia sesión con Google, lector mejorado, correcciones en zoom y audio al cerrar sesión. Fix del redirect OAuth en v6.4.
</es-ES>
```

8. **Save / Guardar** (NO todavía "Review & rollout")

---

## Paso 3 — Añadir testers (3 min)

1. Vuelve al track `alpha` → pestaña **Testers**

2. **Cómo añadir testers** — elige una de las 2 opciones:

### Opción A — Google Group (recomendada, escalable)

1. Ve a https://groups.google.com/ con tu cuenta
2. **Create group**:
   - Name: `BookVoice Alpha Testers`
   - Email: `bookvoice-alpha@googlegroups.com`
   - Group type: Email list
   - Who can join: "Invited users only"
3. Vuelve a Play Console → **Add Google Groups** → pega `bookvoice-alpha@googlegroups.com` → Save

### Opción B — Lista de emails

1. **Create email list** → nombre `BookVoice Alpha`
2. Pega un email por línea (el primero: `zakirsternik3c@gmail.com`, Eugene, etc.)
3. Save

---

## Paso 4 — Configurar Store presence (1 min)

En el mismo track → tab **Settings / Configuración**:

- **Countries / Regions**: mínimo Spain, Italy, Germany, UK (donde Eugene tiene audiencia)
- **Feedback URL / Email**: `support@eugenemierak.com`

---

## Paso 5 — Iniciar el rollout (1 min)

1. **Review release / Revisar versión**
2. Google hace comprobaciones automáticas → deberían pasar todas
3. **Start rollout to Closed testing / Iniciar lanzamiento a prueba cerrada**
4. Confirmar

**El track está LIVE** ✅

---

## Paso 6 — Copiar el opt-in link

Scroll arriba en el track `alpha` → verás un link tipo:

```
https://play.google.com/apps/testing/com.eugenemierak.bookvoice
```

**Cópialo**. Este es el link que darás a los testers.

---

## Paso 7 — Test tú mismo (5 min)

1. En tu móvil Android: abre el link de arriba en Chrome
2. Clic **Become a tester / Convertirme en tester**
3. Sale: "You're a tester now. It may take up to 15 minutes to show up in Play Store."
4. Espera 15 min
5. Abre Play Store → busca `BookVoice` → aparece como "Early access" o "Tester"
6. Instala → abre → **prueba Google Sign-In** → debe funcionar ahora en v6.4

**Si funciona** → marca Task #34 completado.

---

## Paso 8 — Empezar a reclutar (30 min de outreach)

Ve a `TESTER_RECRUITMENT_TEMPLATES.md`:

1. Postea template EN en **r/AndroidTesting**
2. Postea template EN en **r/TestMyApp**
3. Reenvía template ES en tu WhatsApp / grupo amigos
4. LinkedIn (desde tu cuenta o la de Eugene)
5. Discord Indie Android Devs

Objetivo: **14-15 inscritos en 24h** (para buffer).

---

## Timer: empieza el reloj de 14 días

En el momento que el **primer tester** se inscribe Y abre la app, empieza el contador de 14 días.

Play Console → Production → **Solicitar acceso a producción** te muestra el progreso:
- `X/12 testers accepted`
- `X/14 days running`

Cuando ambos ≥ requisitos → puedes pedir Production. Review: 3-7 días. Lanzamiento: ~día 22-25 desde hoy.
