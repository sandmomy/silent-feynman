# BookVoice — Play Console Cheat Sheet

Copy-paste answers for every question in App Content + Data Safety + Store Listing. Based on what BookVoice actually does. 5-minute completion.

---

## 1. Acceso a las aplicaciones

**¿Todas las funciones de tu app están disponibles sin restricciones?**
→ **No, algunas funciones están restringidas**

**Proporciona instrucciones para acceder a las áreas restringidas:**
```
Name: "Paid chapters"
Instructions:
1. Create a free account or sign in with Google
2. Browse the catalog
3. Purchase individual chapters via Stripe checkout at https://book.eugenemierak.com
4. Unlocked chapters become available in the mobile app library

Test credentials (for Google reviewers):
Username: reviewer@eugenemierak.com
Password: ReviewTest2026!
```

*(Te creo el usuario reviewer cuando quieras — comando: `wrangler d1 execute bookvoice --remote --command "INSERT INTO users ..."`)*

---

## 2. Anuncios

**¿Tu app muestra anuncios?**
→ **No, mi app no tiene anuncios** ✅

---

## 3. Clasificación de contenido (IARC questionnaire)

Play Console → Clasificación de contenido → Iniciar encuesta.

**Categoría de la app**: `Libro` (Book)

**Email de contacto**: tu email

### Preguntas típicas y respuestas para BookVoice:

| Pregunta | Respuesta |
|---|---|
| Violencia en el contexto general | No |
| Violencia cruel | No |
| Sangre o temas relacionados con el horror | No |
| Comportamiento sexual | No |
| Desnudez | No |
| Material sugerente o provocativo | No |
| Uso de lenguaje obsceno o insultos | No |
| Referencias a consumo de alcohol, tabaco o drogas | No |
| Juegos de azar con dinero real o simulado | No |
| Contenido que puede asustar a los niños | No |
| Integración con redes sociales | No |
| Acceso a sitios web de terceros | **Sí** (explicación: "Stripe checkout para comprar capítulos") |
| Comparte ubicación del usuario | No |
| Permite a los usuarios interactuar entre sí | No |
| Contenido generado por usuarios | No |

**Resultado esperado**: PEGI 3 / ESRB Everyone / USK 0. Audiolibro espiritual para audiencia general.

---

## 4. Audiencia objetivo

**Edades objetivo**: marca `18 y más` (solo adultos — contenido espiritual adulto)

**¿Tu app atrae a niños?** → No

**¿Incluyes contenido dirigido a niños?** → No

---

## 5. Aplicaciones gubernamentales

**¿Esta app es una aplicación gubernamental?** → **No** ✅

---

## 6. Funciones financieras

**¿Tu app proporciona alguna función financiera?**
→ **No** ✅

(Stripe checkout está fuera de la app — es un redirect al navegador web. Play Store no lo considera "funciones financieras dentro de la app".)

---

## 7. Salud

**¿Tu app tiene funciones relacionadas con la salud?**
→ **No** ✅

(BookVoice es audiolibro espiritual — no es medical/wellness tracking.)

---

## 8. Seguridad de los datos (si hay que re-verificar)

### ¿Recopila o comparte datos de usuarios?
→ **Sí, esta app recopila datos**

### Datos recopilados:

| Tipo | ¿Se recopila? | ¿Se comparte? | Opcional? | Propósito |
|---|---|---|---|---|
| **Nombre** | Sí | No | No | Cuenta de usuario, personalización |
| **Dirección de email** | Sí | No | No | Cuenta de usuario, comunicación |
| **ID de usuario** | Sí | No | No | Cuenta de usuario |
| **Historial de compras** | Sí | No (Stripe lo procesa fuera) | No | Desbloquear contenido adquirido |
| **Logs de fallos / diagnóstico** | Sí (solo si activas Sentry) | No | Sí | Solución de problemas |

### Seguridad:
- [x] **Los datos se cifran en tránsito** → Sí (HTTPS/TLS)
- [x] **Los usuarios pueden solicitar la eliminación de datos** → Sí
  - Enlace: `https://book.eugenemierak.com/delete-account` (si existe) o email `support@eugenemierak.com`

---

## 9. Categoría de la app

**Categoría**: `Libros y obras de consulta` (Books & Reference)

**Etiquetas / Tags** (hasta 5):
- Audiobook
- Audiolibro
- Spirituality
- Self-development
- Meditation

---

## 10. Ficha de Play Store (Store listing)

**Nombre de la app**: `BookVoice — Frequency Vibes`

**Nombre corto**: `BookVoice` (30 chars max)

**Descripción corta** (80 chars):
```
Read and listen to Frequency Vibes. Spiritual essays, chapter by chapter.
```

**Descripción larga** (4000 chars):
```
BookVoice is the official audiobook and reader app for Frequency Vibes, a collection of spiritual essays by Eugene Mierak.

Each chapter is a complete experience: elegant typography for reading, narration you can play on the go, and a clean, distraction-free interface designed for presence.

FEATURES
• Dark editorial reader — built for focus, easy on the eyes
• Chapter-by-chapter audio narration
• Background playback with lock-screen controls
• Pinch-to-zoom pages
• Sync across your devices (same account on web and mobile)
• Preview mode: browse the catalog without an account

WHAT'S INSIDE
Frequency Vibes is a set of meditative essays on consciousness, attention, and living deliberately. The book is sold chapter by chapter so you can sample before committing.

Each chapter is €10–12. Purchases happen securely via Stripe on the web — the app opens your browser to complete payment, then the chapter unlocks in your library.

ABOUT THE AUTHOR
Eugene Mierak writes at the intersection of spirituality and clarity. Frequency Vibes is his first published essay collection.

PRIVACY & DATA
We only collect what's needed for your account (email, username, purchase history). Session tokens are stored securely on-device. Read the full policy at book.eugenemierak.com/privacy.

OFFLINE & DEVICES
Once a chapter is purchased, you can download it in full and read/listen offline. Your library syncs when you next connect.

SUPPORT
Questions or problems: support@eugenemierak.com
Privacy policy: https://book.eugenemierak.com/privacy
Terms: https://book.eugenemierak.com/terms
```

---

## 11. Contacto y web

**Correo electrónico de contacto**: `support@eugenemierak.com` (o el que uses)

**Sitio web**: `https://book.eugenemierak.com`

**Teléfono**: (opcional — déjalo vacío)

**Política de privacidad**: `https://book.eugenemierak.com/privacy`

---

## ✅ Checklist rápido

Tras pegar todo:

- [ ] Clasificación de contenido: **encuesta enviada**
- [ ] Audiencia objetivo: **18+**
- [ ] Anuncios: **No**
- [ ] Acceso a la app: **restricciones con instrucciones**
- [ ] Funciones financieras: **No**
- [ ] Salud: **No**
- [ ] Apps gubernamentales: **No**
- [ ] Data safety: **actualizado con tabla de arriba**
- [ ] Categoría: **Libros y obras de consulta**
- [ ] Ficha Play Store: **descripción corta + larga + screenshots (ya subidos)**

Cuando todo esté verde → lo siguiente es **crear track Closed Testing** y subir v6.4 cuando termine el build.
