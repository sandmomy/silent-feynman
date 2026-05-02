# v7.2 Smoke Test Plan

Antes de hacer `eas submit` y publicar en Closed Testing, ejecutar este check-list. Marcar cada item con ✅ / ❌ / ⏭ (no aplica).

---

## Pre-flight (entorno)

- [ ] Migración D1 aplicada: `wrangler d1 execute bookvoice --remote --file=migrations/0003_v7_2_auth_hardening.sql`
- [ ] Migración D1 aplicada: `wrangler d1 execute bookvoice --remote --file=migrations/0004_v7_2_session_registry.sql`
- [ ] Secret `RESEND_API_KEY` configurado en Cloudflare: `wrangler secret put RESEND_API_KEY`
- [ ] Secret `RESEND_FROM` configurado: `wrangler secret put RESEND_FROM` (valor: `BookVoice <noreply@book.eugenemierak.com>`)
- [ ] Dominio verificado en Resend (DNS SPF/DKIM/DMARC)
- [ ] Worker desplegado: `wrangler deploy`
- [ ] R2 upload de `web/reset-password.html` y `web/forgot-password.html`
- [ ] R2 delete de `web/index.html`, `web/app.js`, `web/library-mock.html` (opcional, ya hay redirect)

## Auth — web (book.eugenemierak.com)

- [ ] Login admin con password correcto → entra
- [ ] Login admin con password incorrecto → error, NO filtra timing
- [ ] 6 intentos fallidos con mismo username → 429 Too many attempts
- [ ] 21 intentos desde misma IP en 1 min → 429 rate-limited
- [ ] `/forgot-password` carga y muestra form con favicon
- [ ] Enviar email válido → llega mail a la bandeja (Resend log)
- [ ] Click del link → `/reset-password?token=...` muestra form
- [ ] Password nuevo se guarda → login con el nuevo funciona
- [ ] Token usado 2x → error "expired or invalid"
- [ ] Link de hace 2h → error expired

## Auth — mobile app

- [ ] Deep link `book.eugenemierak.com/b/book_chapter_1` sin sesión → abre login con `?next=/book/book_chapter_1`
- [ ] Tras login → va a la página del libro (no al catálogo)
- [ ] Login con email → funciona
- [ ] Login con Google → funciona
- [ ] "Forgot password?" abre navegador con form
- [ ] Sign out → vuelve al login. Limpia player, no deja audio sonando
- [ ] Tras sign out, intentar volver al reader → redirect a login con `?next=/reader/...`

## Reader

- [ ] Abrir capítulo 1 Book → intro animada 3.5s → PDF carga → tutorial primera vez
- [ ] Abrir capítulo 2 Slides → **no crashea con OOM** (era el fix de v7.1)
- [ ] Rotar a landscape en Book → dos páginas tipo libro
- [ ] Rotar a landscape en Slides → una sola página fullscreen (sin barras negras)
- [ ] Portrait → tap/swipe entre páginas funciona
- [ ] Landscape Book: pinch en cualquier parte → zoom afecta toda la vista (no solo una página)
- [ ] Landscape: esconder chrome tras 1.5s → aparece badge verde pulsante de audio
- [ ] Audio: tap play → empieza sonar (verde #4ade80)
- [ ] Audio: skip ±15/30 funciona
- [ ] Error de red al abrir chapter → ErrorCard con mensaje amigable (no "step=download")
- [ ] Timeout 60s en red lenta → ErrorCard con "connection is slow"
- [ ] Retry tras error → borra cache anterior, vuelve a descargar
- [ ] Account → "Show reader tutorial again" → al siguiente open, tutorial aparece

## Login / register visual

- [ ] Login: título centrado vertical, inputs con iconos, botones claros
- [ ] Register: mismo tratamiento visual
- [ ] Sin botón "Browse without signing in" (eliminado)
- [ ] Paleta turquesa (#2dd4bf) — no dorado
- [ ] Play buttons en verde (#4ade80) — no turquesa

## Admin

- [ ] Login admin → dashboard carga
- [ ] Sección "Recent auth events" aparece
- [ ] Se pueblan eventos (login_success, login_fail, etc.)
- [ ] Click "Refresh" → recarga la lista
- [ ] Revoke-sessions en un user → el user en mobile es expulsado en siguiente request (puede tardar hasta que el TTL del mobile llegue al server)

## Play Console

- [ ] Warning "orientación ML Kit barcode" desaparece tras subir nuevo AAB
- [ ] Warnings de Android 15 edge-to-edge siguen (son de librerías third-party — documentado)

## Regresiones críticas

- [ ] Catálogo carga y muestra los capítulos
- [ ] Library muestra capítulos comprados
- [ ] Comprar un capítulo (Stripe checkout) → redirige, vuelve, capítulo aparece en library
- [ ] MiniPlayer aparece al reproducir audio desde reader y persiste en tabs
- [ ] App abierta 30 min con reader abierto no crashea (memory leak)

## Performance

- [ ] Dev APK no crashea con `pages_*` cache acumulado (probar 5 retries seguidos)
- [ ] Audio tarda <2s en empezar a sonar en red normal
- [ ] Intro no bloquea > 3.5s al abrir un libro

---

## Si algo falla

1. Capturar logcat del móvil + screenshot del error
2. Parar el submit a Closed Testing
3. Crear tarea urgente para el fix
4. Nueva build + reprobar item fallido + todos los ítems que lo incluían

## Si todo pasa

```bash
cd "/c/Users/Usuario/Desktop/bussines model/mobile"
eas build --platform android --profile production
# Esperar ~20 min
eas submit --platform android --profile production --latest
```
