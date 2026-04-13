# Guía de Configuración de Dominio Personalizado (.com)

Para que tu sitio web (actualmente `sandmomy.github.io/silent-feynman`) se vea como `www.cliente.com`, necesitas seguir estos pasos.

## 1. Comprar el Dominio
Primero debes ser propietario del nombre.
*   **Proveedores recomendados:** Namecheap (económico, buen soporte), Google Domains (fácil), GoDaddy (común pero a veces intrusivo).
*   **Costo:** Aproximadamente $10 - $15 USD al año para un `.com`.

## 2. Configurar el DNS (En tu proveedor de dominio)
Una vez comprado, debes decirle al dominio que "apunte" a los servidores de GitHub.
Entra al panel de control de tu dominio, busca "DNS Records" o "Configuración DNS" y añade estos registros:

### A Records (Apuntar la raíz `@`)
Crea 4 registros tipo **A** con estos valores (GitHub IPs):
*   `185.199.108.153`
*   `185.199.109.153`
*   `185.199.110.153`
*   `185.199.111.153`

### CNAME Record (Apuntar el `www`)
Crea 1 registro tipo **CNAME**:
*   **Host:** `www`
*   **Value/Target:** `sandmomy.github.io` (tu usuario de GitHub + .github.io)

## 3. Configurar GitHub Pages
Ahora debes decirle a tu repositorio que acepte ese dominio.

1.  Ve a tu repositorio en GitHub: `https://github.com/sandmomy/silent-feynman`
2.  Clic en **Settings**.
3.  En la barra lateral izquierda, clic en **Pages**.
4.  Baja hasta **Custom domain**.
5.  Escribe tu dominio: `www.cliente.com` (o el que hayas comprado).
6.  Clic en **Save**.
7.  Marca la casilla **Enforce HTTPS** (puede tardar unos minutos en activarse).

## 4. Verificar el Archivo `CNAME`
Al hacer el paso 3, GitHub creará automáticamente un archivo llamado `CNAME` en la raíz de tu código.
*   **Importante:** Asegúrate de hacer un `git pull` en tu ordenador después de esto para bajarte ese archivo, o créalo tú manualmente con el nombre del dominio dentro.

---

## 5. Resultado Final
*   Cuando alguien escriba `www.cliente.com`, verá tu página `index.html`.
*   Tus otras páginas funcionarán como `www.cliente.com/projects.html`.
*   El certificado de seguridad (candado HTTPS) será automático y gratuito.
