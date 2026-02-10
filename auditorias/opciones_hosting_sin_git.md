# Opciones de Hosting SIN usar Git

Si prefieres no usar Git ni la terminal, tienes dos caminos principales para conectar tu dominio `.com`.

## Opción 1: Netlify Drop (La más fácil y moderna)
Esta es la mejor opción si quieres algo rápido, gratuito y con certificado de seguridad (HTTPS) automático, pero subiendo los archivos manualmente.

### Pasos:
1.  **Prepara tu carpeta:** Asegúrate de que tu carpeta del proyecto (`silent-feynman`) tenga el archivo `index.html` en la raíz.
2.  **Entra a Netlify:** Ve a [app.netlify.com/drop](https://app.netlify.com/drop).
3.  **Arrastra y Suelta:** Coge tu carpeta desde tu escritorio y suéltala en el recuadro de la web.
    *   *Nota:* Netlify subirá tu sitio y te dará una URL temporal (ej: `silent-feynman-123.netlify.app`).
4.  **Conectar Dominio:**
    *   En el panel de tu sitio en Netlify, ve a **Domain Settings**.
    *   Clic en **Add custom domain**.
    *   Escribe `www.tudominio.com`.
    *   Netlify te dirá exactamente qué poner en tu proveedor de dominio.

### ¿Cómo quedarán mis URLs?
Sí, puedes tener `www.cliente.com`.
*   **Página Principal:** `index.html` se verá como `www.cliente.com`
*   **Otras Páginas:** Netlify tiene una función llamada **"Pretty URLs"** automática.
    *   `projects.html` se verá en el navegador como `www.cliente.com/projects` (sin el `.html`).
    *   Tus enlaces actuales funcionarán perfectamente.

---

## Opción 2: Hosting Tradicional (cPanel / FTP)
Esta es la opción clásica ("la de toda la vida"). Pagas a un proveedor de hosting (Hostinger, Bluehost, SiteGround, GoDaddy) y te dan un espacio en un servidor.

### Pasos:
1.  **Contratar Hosting:** Compras un plan de hosting web básico.
2.  **Acceder al Administrador de Archivos:**
    *   Entra al panel de control de tu hosting (cPanel o similar).
    *   Busca "File Manager" o "Administrador de Archivos".
3.  **Subir Archivos:**
    *   Navega a la carpeta `public_html`.
    *   Sube **todo el contenido** de tu carpeta `silent-feynman` ahí.
    *   El `index.html` debe quedar dentro de `public_html`.
4.  **Configurar Dominio:**
    *   Generalmente, si compras el dominio junto con el hosting, esto es automático.
    *   Si el dominio lo compraste en otro lado, debes cambiar los **Nameservers (DNS)** del dominio para que apunten a tu hosting (tu proveedor de hosting te dará estos datos, ej: `ns1.bluehost.com`, `ns2.bluehost.com`).

---

## Comparativa
| Característica | GitHub Pages / Netlify | Hosting Tradicional (FTP) |
| :--- | :--- | :--- |
| **Costo** | Gratis | $5 - $20 / mes |
| **Subida** | Git / Arrastrar carpeta | FTP / Panel Web |
| **Velocidad** | Muy rápida (CDN Global) | Depende del plan |
| **Mantenimiento** | Bajo | Medio (seguridad, PHP, etc.) |

**Recomendación:** Para un sitio estático como este (HTML/JS/CSS), **Netlify Drop** es superior porque es gratis, más rápido y no requiere mantenimiento de servidor.
