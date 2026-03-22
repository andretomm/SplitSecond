# Guida Deploy: Render + Cloudflare R2

Questa guida ti porterà dal codice al deploy live in ~20 minuti, con storage gratuito illimitato.

---

## STEP 1: Prepara il repository su GitHub

### 1.1 Se non hai ancora un repo

```powershell
# Nel terminale, stando in E:\SplitSecond
git init
git add .
git commit -m "Initial commit: SplitSecond app ready for deploy"
```

Poi su GitHub:
1. Vai a https://github.com/new
2. Crea un repo pubblico o privato (consiglio privato per app personale)
3. Segui le istruzioni per pushare il codice locale

```powershell
git remote add origin https://github.com/TUO_USERNAME/splitsecond.git
git branch -M main
git push -u origin main
```

### 1.2 Se già hai il repo

```powershell
git status  # Verifica che tutto sia committato
git push    # Push ultimi cambiamenti
```

---

## STEP 2: Setup Cloudflare R2 (Storage gratuito)

### 2.1 Crea account Cloudflare

1. Vai a https://dash.cloudflare.com/sign-up
2. Iscritti con email personale
3. Completa verifica email

### 2.2 Crea un bucket R2

1. Nel dashboard Cloudflare, vai a **R2** (colonna sx)
2. Clicca **Create bucket**
3. Nome bucket: `splitsecond-videos` (o quel che preferisci)
4. Impostazioni predefinite, crea

### 2.3 Genera API token

1. Resta su R2, clicca sull'ingranaggio ⚙️ (Settings, in basso a sx)
2. Vai a **API tokens**
3. Clicca **Create API token**
4. **Impostazioni token:**
   - **Type:** S3 API Token ✓
   - **Permissions:** Admin (per ora; in produzione usare permessi limitati)
   - **TTL:** Nessuno (non scade)
5. **Crea token**, copia i seguenti valori e **salvali da qualche parte (nunziati perché non li rivedrai):**

```
Access Key ID: [copia questo]
Secret Access Key: [copia questo]
```

### 2.4 Ottieni Account ID e Endpoint

Nel dashboard R2:
1. Clicca il bucket **splitsecond-videos**
2. In alto a destra, clicca **Settings**
3. Cerca **S3 API** → **Bucket details**
4. Copia:
   - **S3 API endpoint:** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - **Account ID:** Estrai da URL (è il numero/hash tra `https://` e `.r2`)

Esempio (finto):
```
Account ID: a1b2c3d4e5f6g7h8
S3 Endpoint: https://a1b2c3d4e5f6g7h8.r2.cloudflarestorage.com
```

### 2.5 (Opzionale) Configura dominio pubblico per i video

Se vuoi servire i video da un URL pulito (es. `https://cdn.splitsecond.it`):

1. Nel bucket R2, vai a **Settings** → **Custom domain**
2. Puoi collegare un dominio tuo (costa solo il dominio, non R2)
3. Oppure usa l'URL S3 diretto (meno bello ma funziona)

Per adesso, salta questo e usa l'URL S3 diretto.

---

## STEP 3: Setup Render (Deploy app)

### 3.1 Crea account Render

1. Vai a https://render.com
2. Clicca **Sign up**
3. Usa GitHub per login veloce (authorized Render)
4. Completa profilo

### 3.2 Crea nuovo Web Service

1. Nel dashboard Render, clicca **New +** → **Web Service**
2. **Connect a repository:**
   - Clicca **Connect account** se non autorizzato
   - Seleziona il tuo repo `splitsecond`
   - Clicca **Connect**

3. **Build & Deploy Settings:**
   - **Name:** `splitsecond` (o quel che vuoi)
   - **Region:** `Frankfurt` (Europa, più veloce per te)
   - **Branch:** `main` (default)
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free` ✓

4. Clicca **Create Web Service**

Render inizia il build (aspetta 2-3 minuti).

### 3.3 Aggiungi variabili ambiente in Render

1. Nel dashboard del tuo service su Render, vai a **Environment**
2. Clicca **Add Environment Variable** e aggiungi questi valori (metti i tuoi):

```
NODE_ENV=production
PORT=4000
CORS_ORIGIN=*
ADMIN_USERNAME=admin
ADMIN_PASSWORD=METTI_PASSWORD_FORTE_QUI
JWT_SECRET=METTI_SECRET_LUNGO_QUI_(almeno 32 char)

S3_BUCKET=splitsecond-videos
S3_REGION=auto
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=COPIA_DA_CLOUDFLARE
S3_SECRET_ACCESS_KEY=COPIA_DA_CLOUDFLARE
S3_PUBLIC_BASE_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com/splitsecond-videos
S3_FORCE_PATH_STYLE=true
```

**Dove sostituire:**
- `ACCOUNT_ID` → Quello di Cloudflare (es. `a1b2c3d4e5f6g7h8`)
- `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` → Da Cloudflare R2
- `ADMIN_PASSWORD` + `JWT_SECRET` → Valori forti a tua scelta

3. Clicca **Save** per ogni variabile (o tutte insieme se Render permette bulk)
4. Render riavvia il servizio automaticamente

### 3.4 Verifica il deploy

1. Vai a https://splitsecond.onrender.com (o il dominio che Render assegna, lo vedi nel dashboard)
2. Dovresti vedere la home di SplitSecond
3. Vai a tab **Admin**, fai login con le credenziali che hai impostato (ADMIN_USERNAME + ADMIN_PASSWORD)
4. Prova a caricare un video test

Se upload OK → tutto funziona! 🎉

---

## TROUBLESHOOTING

### "Video non si carica"
- Controlla che `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID` siano corretti in Render
- Guarda i **Logs** del service (Dashboard → Render → Logs) per errori S3

### "Login admin non funziona"
- Verifica `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET` in Render
- Controlla nei Logs se ci sono errori

### "Render dice "Build failed""
- Guarda i **Logs** di build
- Verifica che `npm install` e `npm run build` funzionano in locale

### "Dominio Render cambia/va offline dopo 15 min"
- È normale se nel piano Free: risvegliati al primo request (aspetta 10-15 sec alla visita)
- Se vuoi sempre "warm", upgrade al piano Starter ($7/mese)

---

## Costi Totali

- **Cloudflare R2:** Gratuito (10GB + upload/download illimitato)
- **Render Free:** Gratuito (750 ore/mese = copre 24/7 con un solo servizio)
- **Dominio personalizzato:** Opzionale ($10-15/anno)

**Total: Gratuito per uso privato illimitato**

---

## Prossimi passi (dopo verifica)

1. Carica qualche video motivazionale di prova
2. Salva qualcuno, verifica localStorage
3. Logout e login nuovi token (testare JWT refresh)
4. Se tutto OK, è pronto per uso personale!
