# Deploy su Cloudflare Workers via GitHub

Questo progetto è una app **TanStack Start** con SSR + route API, configurata per girare su **Cloudflare Workers** (vedi `wrangler.jsonc`).

## ⚠️ Si pubblica con `npm run pubblica`, non con `wrangler deploy`

Segnalazione dal campo: durante una consulenza il cliente si è fermato su
«Pezzo dell'app non disponibile (versione aggiornata)».

L'applicazione arriva al browser **a pezzi**, e ogni pezzo porta nel nome
l'impronta del suo contenuto (`AuthContext-D94CWX6q.js`). Una pagina aperta
PRIMA della pubblicazione conosce i nomi vecchi e li chiede quando servono —
cambiando schermata, entrando in videochiamata. Cloudflare però tiene online
solo i file dell'ULTIMA pubblicazione: i nomi vecchi rispondono «non trovato»,
e la pagina del cliente si spezza a metà consulenza. Succede **a ogni**
pubblicazione fatta mentre qualcuno ha la pagina aperta.

`npm run pubblica` (vedi `strumenti/pubblica.mjs`) costruisce, rimette online
anche i pezzi delle versioni precedenti tenuti in `.storico-assets/`, e poi
pubblica. I nomi portano l'impronta del contenuto, quindi vecchio e nuovo non
possono darsi fastidio. L'archivio si pota da solo dopo tre settimane.

⚠️ Se la pubblicazione parte da Cloudflare a ogni push (Deploy command
`npx wrangler deploy`), quella NON ha l'archivio e rimette il difetto:
l'archivio vive sul computer di chi pubblica. Pubblicare a mano con
`npm run pubblica` resta la via buona.

## 1. Prerequisiti

1. Assicurati che il repo sia su GitHub e pushato sul branch `main`
2. Applica le migrazioni `supabase/migrations/*` al tuo progetto Supabase (`supabase db push`)

## 2. Cloudflare — Create application

Nella dashboard Cloudflare: **Compute → Workers & Pages → Create → Import a repository**.
Seleziona il repo GitHub, poi compila così:

| Campo | Valore |
|---|---|
| **Project name** | `hairgenius-crm` (a piacere) |
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm install && npm run build` |
| **Deploy command** | `npx wrangler deploy` |
| **Root directory** | *(lascia vuoto)* |

> Il **Deploy command** è essenziale: `wrangler deploy` legge `wrangler.jsonc` e
> pubblica la app come Worker (con SSR + route `/api/*`).

## 3. Variables and Secrets

Espandi la sezione **Variables and Secrets** e aggiungi:

### Build-time (Plaintext) — usate da Vite durante il build
| Nome | Valore |
|---|---|
| `VITE_SUPABASE_URL` | `https://<tuo-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(anon key dal `.env`)* |
| `VITE_SUPABASE_PROJECT_ID` | `<tuo-ref>` |

### Runtime (Secret / Encrypted) — usate dal Worker via `process.env.*`
| Nome | Valore |
|---|---|
| `SUPABASE_URL` | `https://<tuo-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | *(anon key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(service role key dal tuo progetto Supabase → Settings → API)* |
| `OPENROUTER_API_KEY` | *(API key da https://openrouter.ai/keys — per le AI Insights)* |
| `GOOGLE_CLIENT_ID` | *(Google Cloud Console — OAuth Client ID)* |
| `GOOGLE_CLIENT_SECRET` | *(Google Cloud Console — OAuth Client Secret)* |

> ⚠️ Le `VITE_*` servono solo al build. Le altre vengono lette **runtime** dal
> Worker (es. `api.capi.ts`, `api.google-oauth-callback.ts`, `client.server.ts`).

## 4. Dopo il primo deploy

1. **Worker Secrets**: vai su **Workers → \[il tuo progetto\] → Settings → Variables and Secrets**
   e verifica che le runtime secrets siano presenti come **Secret** (non Plaintext).
   Se Cloudflare non le ha propagate dal build, aggiungile manualmente lì.
2. **Custom domain**: Workers → Settings → **Domains & Routes** → Add custom domain.
3. **Google OAuth redirect URI**: aggiungi `https://<tuo-dominio>/api/google-oauth-callback`
   nelle Authorized redirect URIs della Google Cloud Console.

## 5. Note

- Le **edge functions Supabase** (es. `capi`) si deployano sul tuo progetto Supabase con `supabase functions deploy`, non su Cloudflare.
- **Realtime, pg_cron, Auth, Storage** continuano a funzionare: vivono nel database Supabase.
- Il progetto usa il flag `nodejs_compat` (già in `wrangler.jsonc`) — necessario per `crypto`, `Buffer`, ecc.
- Per redeploy basta pushare su `main`: Cloudflare ribuilda e ridistribuisce automaticamente.

## 6. Troubleshooting

- **401 da Supabase nelle route `/api/*`** → manca `SUPABASE_SERVICE_ROLE_KEY` come Worker Secret.
- **Build fallisce su Vite** → manca una `VITE_*` nelle build-time variables.
- **Pagina bianca in production ma OK in dev** → controlla i log del Worker (Workers → Logs).
- **OAuth Google non torna indietro** → la redirect URI in Google Console non corrisponde al dominio Cloudflare.
