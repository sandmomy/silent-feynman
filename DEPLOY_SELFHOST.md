# Self-host on your own domain

This path is for moving BookVoice off Railway and onto your own server while keeping the same app.

## What this setup gives you

- FastAPI app behind your own `.com`
- automatic HTTPS via Caddy
- persistent `library_data` outside the container image
- secure auth cookies for the live domain

## Files included

- `Dockerfile`
- `docker-compose.selfhost.yml`
- `.env.production.example`
- `deploy/Caddyfile`

## 1. Prepare the server

- Use an Ubuntu VPS or dedicated machine with Docker and Docker Compose installed.
- Point your domain A record to the server IP.
- Open ports `80` and `443`.

## 2. Copy the project

- Put the repo on the server.
- Copy `.env.production.example` to `.env.production`.
- Fill in the real domain, admin password, and session secret.
- Or generate it automatically from your local `.env`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap_selfhost_env.ps1 -Domain yourdomain.com
```

## 3. Move the real library data

- Create `deploy/data`.
- Copy your real `library_data/` into `deploy/data/`.
- Final result should look like:

```text
deploy/data/books
deploy/data/jobs
deploy/data/users
deploy/data/voices
```

This is the important part. The live PDFs, audio files, and reader access data must live in that persistent volume.

## 4. Start the stack

```bash
docker compose -f docker-compose.selfhost.yml up -d --build
```

## 5. Verify before opening the domain

- Open `/api/health`
- Sign in to `/admin`
- Check the new `Launch readiness` section
- Confirm every live chapter has the assets you expect
- Run the local preflight if you want a terminal summary first:

```bash
python scripts/selfhost_preflight.py --env-file .env.production --data-dir deploy/data
```

## Recommended env values

For a domain like `example.com`:

```env
BOOKVOICE_PUBLIC_BASE_URL=https://example.com
BOOKVOICE_ALLOWED_ORIGINS=https://example.com,https://www.example.com
BOOKVOICE_TRUSTED_HOSTS=example.com,www.example.com
BOOKVOICE_COOKIE_SECURE=true
BOOKVOICE_DATA_DIR=/srv/bookvoice/library_data
```

Leave `BOOKVOICE_COOKIE_DOMAIN` empty unless you intentionally need cross-subdomain cookies.

## Notes

- Missing MP3 files now show up in the admin readiness audit instead of failing silently.
- `slides.pdf` is optional for fallback reading because the reader can still use the original PDF.
- If you want to disable public signup before launch, set `BOOKVOICE_SELF_SIGNUP_ENABLED=false`.
