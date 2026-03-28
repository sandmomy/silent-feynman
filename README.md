# BookVoice Library

Base local para una biblioteca con tres superficies separadas:

1. `Web cliente`: catalogo, login y biblioteca personal del lector.
2. `Web admin`: Eugene publica books, escribe descripciones y activa accesos.
3. `Web maquina`: parte interna para subir material, guardar voces y generar audio.

## Que incluye esta version

- backend `FastAPI`
- biblioteca local de libros, voces, jobs y usuarios cliente
- web cliente independiente
- web admin independiente
- web maquina independiente
- paginas individuales por book en `/library/<slug>` y `/b/<slug>`
- descarga directa del MP3 generado
- cola de narracion
- revision de audio por capitulos antes de publicar
- motor real `OpenVoice + MeloTTS` en `WSL`
- `mock_preview` para probar el pipeline entero hoy mismo

## Requisitos

- Windows con Python 3.12 o similar
- `ffmpeg` y `ffprobe` en `PATH`
- WSL2 con Ubuntu para el motor de clonacion real
- autorizacion expresa de Eugene para usar y clonar su voz
- derechos claros sobre los textos que vayas a narrar

## Arranque rapido

1. Abre la carpeta `C:\Users\Usuario\Desktop\bussines model`.
2. Si aun no lo has hecho, prepara WSL con `scripts/setup_openvoice_wsl.sh`.
3. Crea `.env` a partir de `.env.example`.
4. Ejecuta `run_library_web.bat`.
5. Abre `http://127.0.0.1:8010`.
6. Usa la superficie que toque:
   - cliente: `http://127.0.0.1:8010/`
   - admin: `http://127.0.0.1:8010/admin`
   - maquina: `http://127.0.0.1:8010/machine`

## Flujo recomendado

1. En `maquina`, importa el PDF, sube la voz y genera una demo.
2. En `maquina`, aprueba demo, capitulos y audio final.
3. En `admin`, publica el book y rellena la ficha comercial.
4. En `admin`, crea o selecciona un lector y activa su acceso al book.
5. En `cliente`, el lector entra y abre solo los books activados.

## Motores

- `mock_preview`: crea un MP3 de prueba para validar la UX, la cola y el almacenamiento.
- `openvoice_wsl`: narracion real con voz local clonada.

## Estructura

- `bookvoice/`: backend, almacenamiento y motores
- `web/`: frontend web
- `scripts/openvoice_book_tts.py`: punto de integracion con OpenVoice
- `scripts/setup_openvoice_wsl.sh`: instalacion automatizada de WSL
- `library_data/`: libros, jobs, voces y audios generados
- `app.py`: MVP anterior con Streamlit y ElevenLabs

## Configuracion WSL recomendada

Usa este bloque en `.env`:

```env
BOOKVOICE_HOST=127.0.0.1
BOOKVOICE_PORT=8000
BOOKVOICE_LOGIN_ENABLED=true
BOOKVOICE_ADMIN_USERNAME=eugene
BOOKVOICE_ADMIN_PASSWORD=cambia_esta_password
BOOKVOICE_DEMO_CUSTOMER_USERNAME=lector
BOOKVOICE_DEMO_CUSTOMER_PASSWORD=000
BOOKVOICE_DEMO_CUSTOMER_DISPLAY_NAME=Lector Demo
BOOKVOICE_SESSION_HOURS=24
OPENVOICE_WSL_ENABLED=true
OPENVOICE_WSL_DISTRO=Ubuntu
OPENVOICE_WSL_PYTHON_BIN=./.wsl-openvoice-venv/bin/python
OPENVOICE_BASE_SPEAKER_ES=ES
OPENVOICE_BASE_SPEAKER_EN=EN-US
```

## Accesos

1. `Cliente`: usa usuarios tipo `lector`.
2. `Admin`: solo Eugene.
3. `Maquina`: solo Eugene.
4. Cambia `BOOKVOICE_ADMIN_PASSWORD` en `.env` cuando quieras rotar la clave local.

## Estado actual del motor local

1. `OpenVoice + MeloTTS` ya genera audio real desde WSL.
2. El backend convierte el WAV final a MP3 y lo deja listo para descarga y publicacion.
3. Solo falta usar una muestra real de Eugene en `voice profiles` para pasar de la demo a su voz definitiva.

## Referencias

- [OpenVoice](https://github.com/myshell-ai/OpenVoice)
- [MeloTTS](https://github.com/myshell-ai/MeloTTS)
- [Kokoro](https://github.com/hexgrad/kokoro)
