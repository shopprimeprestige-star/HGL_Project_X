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
2. Applica le migrazioni al tuo progetto Supabase **dal SQL Editor, una alla volta, nell'ordine qui sotto**.
   **Non usare `supabase db push`** in questo progetto: applicherebbe tutto in blocco e nell'ordine dei nomi dei file, che non è
   quello giusto. Il dettaglio è nella sezione «Migrazioni dello shop» più sotto.

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
| `SHEETS_INGRESSO_TOKEN` | *(chiave segreta dell'ingresso dei lead dal foglio Google: `openssl rand -hex 32`, la stessa nelle proprietà dello script del titolare; vedi `docs/google-sheets-setup.md`)* |
| `PONTE_WA_TOKEN` | *(chiave segreta del ponte WhatsApp sul Mac, **almeno 32 caratteri**: `openssl rand -hex 32 \| pbcopy`, poi `npx wrangler secret put PONTE_WA_TOKEN` e incolla; la stessa va sul Mac con `installa.sh chiave`; vedi `docs/ponte-whatsapp-setup.md`)* |
| `MEETLY_SFU_APP_ID` | *(Meetly via server Cloudflare: **ID** dell'app Cloudflare Realtime SFU dedicata a Meetly, **SEPARATA da quella del webinar**: si crea una app nuova in Cloudflare → Realtime. Poi `npx wrangler secret put MEETLY_SFU_APP_ID` e incolla. Senza questa e la prossima l'interruttore resta su «diretto» e il pannello delle Impostazioni lo dice)* |
| `MEETLY_SFU_APP_TOKEN` | *(il **token** (secret) della stessa app Meetly: `npx wrangler secret put MEETLY_SFU_APP_TOKEN` e incolla. Mai nel codice, mai in un file `.env` committato)* |
| `STRIPE_SECRET_KEY` | *(cassa dello shop: la chiave segreta di Stripe, **di prova** `sk_test_…` o chiave ristretta `rk_test_…` finché non si decide il passaggio ai pagamenti veri: `npx wrangler secret put STRIPE_SECRET_KEY` e incolla. Mai nel codice, mai in un file `.env` committato, mai in chat. Senza, la cassa nuova resta chiusa e il pannello «Cassa» del CRM dice «non collegato»)* |
| `STRIPE_WEBHOOK_SECRET` | *(il segreto di firma del webhook, `whsec_…`, lo dà Stripe quando si crea il webhook: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`. Senza, il webhook risponde 503 e nessun pagamento viene registrato)* |
| `SHOP_EMAIL_INDIRIZZO` | *(l'indirizzo da cui partono le email dello shop, sul dominio del titolare, per esempio `ordini@…`: `npx wrangler secret put SHOP_EMAIL_INDIRIZZO`. Il nome del mittente è fisso: «Hair Genius Labs». `RESEND_FROM` non si tocca e `RESEND_API_KEY` c'è già)* |

> ⚠️ **Meetly via server Cloudflare (SFU) — prima di accendere l'interruttore** (nota N5 del piano):
> 1. Lo si accende solo dopo una prova a mano con un **iPhone** (Safari) e con una **rete strozzata**
>    (circa 800 kbit/s): il comportamento con un abbonato lento non è mai stato misurato.
> 2. **Limite noto**: «Rimuovi» (`espelli`) toglie la riga e la chiave dell'espulso ma **non chiude
>    un abbonamento Cloudflare già negoziato**: in SFU un cliente espulso con un browser modificato
>    potrebbe ricevere ancora l'audio finché dura la sua sessione (un browser normale chiude il
>    collegamento e Cloudflare chiude la sessione). In diretto (mesh) non succede.
> 3. Il nome delle chiavi non compare nel pannello delle Impostazioni (dice solo «da chi gestisce il sito»):
>    i nomi stanno qui.

> ⚠️ Le `VITE_*` servono solo al build. Le altre vengono lette **runtime** dal
> Worker (es. `api.capi.ts`, `api.google-oauth-callback.ts`, `client.server.ts`).

## 4. Dopo il primo deploy

1. **Worker Secrets**: vai su **Workers → \[il tuo progetto\] → Settings → Variables and Secrets**
   e verifica che le runtime secrets siano presenti come **Secret** (non Plaintext).
   Se Cloudflare non le ha propagate dal build, aggiungile manualmente lì.
2. **Custom domain**: Workers → Settings → **Domains & Routes** → Add custom domain.
3. **Google OAuth redirect URI**: aggiungi `https://<tuo-dominio>/api/google-oauth-callback`
   nelle Authorized redirect URIs della Google Cloud Console.

## 4b. Shop: migrazioni, webhook di Stripe e prima prova

I passi «a mano» per il titolare, scritti in frasi brevi, stanno in `RILASCIO-2-PASSI-DEL-TITOLARE.md` (cartella della commessa).
Qui sotto c'è la parte tecnica.

**Vetrina V1 (pagine nuove di `/shop`): nessuna migrazione del database e nessuna variabile da impostare.** Per le sue pagine vedi `RILASCIO-V1-PASSI-DEL-TITOLARE.md`.
- `SHOP_CATALOGO_FORZA` (variabile del Worker, letta in `src/shop/cms/catalogo.functions.ts` e `modalita-certa.functions.ts`): «cms» o «codice» forza la modalità della vetrina e **vince sull'interruttore del CRM**. **Non impostarla in produzione**: serve solo per le prove.
- `SHOP_CASSA_FORZA`: vale solo in locale (`import.meta.env.DEV`); in produzione si ignora.

### Migrazioni dello shop (Supabase → SQL Editor, una alla volta, in quest'ordine)
**Non `supabase db push`.** Copia ogni file nel SQL Editor, premi «Run», controlla che non ci siano errori e passa al successivo.

| Passo | File in `supabase/migrations/` | Cosa fa |
|---|---|---|
| M1 | `20261117120000_ecommerce_ordini.sql` | la dashboard e-commerce del CRM (ordini) |
| R1 · S1 | `20261120120000_shop_catalogo.sql` | tabelle del catalogo |
| R1 · S2 *(facoltativa)* | `20261120130000_shop_catalogo_import.sql` | copia in bozza i prodotti del vecchio catalogo |
| R1 · D40 | `20261121120000_shop_invisible_derm.sql` | permette di pubblicare Invisible Derm senza prezzo |
| R1 · S3 | `20261120140000_tracciamento.sql` | consensi e tracciamento (poi l'`INSERT` del proprietario, vedi `RILASCIO-1-PASSI-DEL-TITOLARE.md`) |
| S4 | `20261122120000_shop_pagamenti.sql` | pagamenti e ordini della cassa nuova. Da sola non cambia niente per i clienti |
| S4b | `20261122123000_shop_orders_protezione.sql` | il blocco che impedisce di scrivere «pagato» dal browser. **Subito dopo: un ordine di prova dalla cassa vecchia** (nome «PROVA-ELIMINARE») per vedere che arriva ancora |
| S5 | `20261122130000_shop_spedizioni.sql` | tariffa di spedizione (seme: 4,90 €, provvisoria) |
| S6 | `20261122140000_shop_email.sql` | i cinque modelli email, tutti spenti |

**Dopo S3: `supabase functions deploy capi`.** La funzione `capi` è cambiata con il tracciamento: senza `tracciamento_proprietario` chiude gli eventi. Va ridistribuita subito dopo la migrazione S3 e l'`INSERT` del proprietario (come in `RILASCIO-1-PASSI-DEL-TITOLARE.md`).

Se S4 si ferma con un messaggio sulla colonna `pagato_il`, M1 non è stata applicata: si applica M1 e si rilancia S4.
Nessuna migrazione cancella o cambia dati esistenti. Per tornare indietro si spegne la cassa nuova dal CRM; le migrazioni restano (la cassa vecchia non le legge).

### Webhook di Stripe
1. Stripe → Sviluppatori → Webhook → «Aggiungi endpoint». Indirizzo: `https://hair-genius-hub.hair/api/public/stripe-webhook`.
2. Eventi (otto, né di più né di meno):
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`, `refund.updated`, `refund.failed`, `charge.dispute.created`.
3. Il segreto che Stripe mostra (`whsec_…`) va in `STRIPE_WEBHOOK_SECRET` con `npx wrangler secret put` (mai in chat né nel codice).
4. Come risponde la rotta (utile per leggere i log e il pannello Stripe):
   - firma sbagliata, vecchia (oltre 5 minuti) o assente: **400**; corpo oltre 1 MB: **413**; segreto non impostato: **503** (non si accetta mai senza firma);
   - evento non gestito: **200**; guasto del database: **500** (Stripe ritenta fino a tre giorni);
   - casi senza rimedio (per esempio email non configurata o rifiutata in modo definitivo da Resend): **200** con un avviso sull'ordine, che il CRM mostra in rosso.
   Il corpo si legge a pezzi con un tetto di 1 MB e si firma sui byte arrivati.
5. Cloudflare: se il piano lo prevede, una regola di limite per le rotte pubbliche nuove (`/api/public/shop-cassa*` e `/api/public/shop-collaudo`); **non** su `/api/public/stripe-webhook`, che deve ricevere tutto ciò che Stripe manda.

### Prima prova (con chiavi di prova)
Una vendita di prova col collaudo con chiave dal CRM (scheda «Cassa»): il link dura 2 ore e vale per chiunque lo abbia, quindi si cancella il messaggio che lo contiene dopo l'uso. Il pubblico continua a vedere la cassa vecchia.

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
