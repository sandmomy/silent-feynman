# Auditoría de Preparación para Despliegue - Silent Feynman
**Fecha:** 9 de Febrero de 2026
**Objetivo:** Despliegue en producción (Semana del 16 de Febrero)
**Estado Actual:** 🔴 NO LISTO (Requiere correcciones críticas)

---

## 1. Resumen de Situación
El proyecto tiene una base visual sólida y contenido premium, pero técnicamente no está listo para un despliegue profesional debido principalmente al **tamaño del repositorio** (1.9 GB) y **funcionalidad rota** en páginas clave. 

Si se despliega hoy en GitHub Pages u otro hosting estático gratuito, fallará o tendrá un rendimiento inaceptable.

## 2. Hallazgos Críticos (Bloqueantes)

### 🚨 1. Tamaño del Repositorio (1.9 GB)
*   **Problema:** GitHub Pages tiene un límite estricto de 1 GB. El despliegue fallará.
*   **Causa:** Carpetas con archivos no utilizados y "basura" de desarrollo.
*   **Archivos detectados:**
    *   `assets/eko-vitaris/`: Contiene ~50 imágenes (renders de PDF, páginas completas) que no parecen estar usándose en la web final.
    *   `awwwards-examples/`: Probablemente contiene referencias pesadas que no deben ir a producción.
    *   `node_modules/`: Nunca debe subirse al repo.
*   **Acción Requerida:** Limpieza masiva de assets y uso de `.gitignore`.

### 🚨 2. Funcionalidad Rota en `vegaqura.html`
*   **Problema:** El menú desplegable "PARTNERS" (arriba a la derecha) **no funciona**. Al hacer clic, no ocurre nada.
*   **Causa:** Falta el JavaScript que controla el evento `click` en esta página específica.
*   **Acción Requerida:** Insertar el script de control del menú en `vegaqura.html`.

### 🚨 3. Sitemap Incompleto
*   **Problema:** Google y otros buscadores solo verán `index.html` y `projects.html`.
*   **Causa:** El archivo `sitemap.xml` solo lista 2 URLs. Faltan `sdbi-center`, `vegaqura`, `eko-vitaris`, `wiseuse`, `about`.
*   **Acción Requerida:** Regenerar `sitemap.xml` con todas las páginas públicas.

---

## 3. Optimización y Calidad (Prioridad Alta)

### ⚡ CSS Desactualizado
*   `styles.min.css` no coincide con la última versión de `styles.css`. Los cambios recientes no se verán en producción si el HTML apunta al `.min.css`.
*   **Acción:** Ejecutar `npm run build` o `npm run minify:css` antes del deploy.

### 🧹 Código "Sucio"
*   Se encontraron `console.log` en `js/projects.js`. Esto se ve poco profesional en la consola del navegador del cliente.
*   Bloques masivos de CSS inline en las páginas de partners dificultan el mantenimiento.

### 🖼️ Optimización de Imágenes
*   Muchas imágenes en `assets/eko-vitaris` son PNGs pesados (>1MB). Deben convertirse a WebP o JPG optimizado si se van a usar.

---

## 4. Plan de Acción (1 Semana)

Este es el plan paso a paso para tener el proyecto listo para el lunes:

### Día 1: Limpieza (URGENTE)
1.  [ ] **Backup:** Crear una copia de seguridad local de todo el proyecto.
2.  [ ] **Limpieza de Assets:** Eliminar los 48 archivos no usados en `assets/eko-vitaris`.
3.  [ ] **Gitignore:** Asegurar que `node_modules` y archivos temporales estén ignorados.
4.  [ ] **Fix Vegaqura:** Copiar el script del menú a `vegaqura.html`.

### Día 2: Optimización Técnica
1.  [ ] **Minificación:** Ejecutar scripts de build para generar nuevos `.min.css` y `.min.js`.
2.  [ ] **Sitemap:** Actualizar `sitemap.xml`.
3.  [ ] **Favicons:** Verificar que todas las páginas tengan el favicon correcto.

### Día 3: Pruebas Finales
1.  [ ] **Deploy de Prueba:** Intentar subir a un entorno de staging (o una rama separada de GH Pages).
2.  [ ] **Lighthouse:** Correr auditoría de Chrome para verificar performance > 80.

---

## 5. Conclusión
El proyecto es visualmente impresionante pero necesita esta "semana de ingeniería" para ser viable. **Recomiendo empezar hoy mismo con la limpieza de la carpeta `assets` y el arreglo del menú en Vegaqura.**
