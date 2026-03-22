# SplitSecond

App stile TikTok per video motivazionali curati: niente like e niente commenti, solo salvataggio video e upload riservato all'admin.

## Cosa include ora

- Feed verticale fullscreen con scroll snap.
- Autoplay intelligente: parte solo il video visibile, gli altri vanno in pausa.
- Solo pulsante `Salva` (`localStorage`), senza like e senza commenti.
- Login admin con JWT (`/api/admin/login`) e upload protetto con Bearer token.
- Storage locale (`uploads/`) oppure cloud S3 compatibile.

## Setup locale

1. Installa dipendenze:

```bash
npm install
```

2. Crea il file `.env`:

```bash
copy .env.example .env
```

3. Imposta credenziali admin e secret JWT in `.env`.

4. Avvia frontend + backend:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API backend: `http://localhost:4000`

## Flusso admin

- Apri tab `Admin`.
- Fai login con `ADMIN_USERNAME` e `ADMIN_PASSWORD`.
- Carica file video (`mp4`, `mov`, `webm`).

## Variabili ambiente principali

```env
PORT=4000
CORS_ORIGIN=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=metti-password-admin-forte
JWT_SECRET=metti-jwt-secret-lungo-e-casuale
```

## Storage cloud (S3/R2/MinIO)

Se `S3_BUCKET` e' valorizzato, gli upload vanno su cloud invece che in locale.

```env
S3_BUCKET=nome-bucket
S3_REGION=eu-west-1
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=https://cdn.tuodominio.it
S3_FORCE_PATH_STYLE=false
```

Note:
- Per provider S3-compatibili (es. Cloudflare R2 o MinIO), usa `S3_ENDPOINT`.
- Imposta `S3_PUBLIC_BASE_URL` per servire i video da CDN o dominio pubblico.

## Deploy (Render)

Nel repository trovi `render.yaml` per deploy rapido.

1. Push su GitHub.
2. Crea un nuovo servizio Web su Render collegando il repo.
3. Importa/usa le variabili da `.env.example` (in produzione metti valori forti).
4. Render esegue:

```bash
npm install
npm run build
npm start
```

Il server Express serve automaticamente il frontend buildato da `dist/`.

## Deploy con Docker

Build immagine:

```bash
docker build -t splitsecond .
```

Run container:

```bash
docker run -p 4000:4000 --env-file .env splitsecond
```

## Build frontend

```bash
npm run build
```
