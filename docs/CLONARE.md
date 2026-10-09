# Portarsi via tutto, e rimetterlo in piedi altrove

Questo foglio serve a una cosa sola: **prendere il programma e i dati e farli
ripartire da un'altra parte** — un altro database, un altro hosting, un altro
nome a dominio — senza dipendere da nessuno.

Non serve essere programmatori per seguirlo, ma serve una persona che sappia
aprire un terminale. Se la consegni a qualcun altro, questo foglio è tutto
quello che gli serve: dentro c'è l'elenco dei pezzi, l'ordine in cui si
montano e le trappole che fanno perdere un pomeriggio.

---

## 1. Di che cosa è fatto

Quattro pezzi, e vanno copiati tutti e quattro:

| Pezzo | Che cos'è | Dove si scarica |
|---|---|---|
| **Il programma** | la sorgente: CRM, Meetly, pagina del preventivo, sito pubblico. Un archivio `.zip` | Impostazioni → Dati → **Il programma** |
| **I dati** | lead, consulenti, preventivi, fatture, listino, disponibilità, impostazioni. Un file `.json` | Impostazioni → Dati → **Scarica una copia** |
| **I file** | registrazioni delle consulenze, foto e documenti dei clienti, anteprime dei link | Impostazioni → Dati → **I file caricati** (elenco con i collegamenti) |
| **Lo schema** | come sono fatte le tabelle del database | è dentro il programma, in `supabase/migrations/` |

Le **credenziali non escono mai** da nessuno di questi file: PIN dei
consulenti, token, chiavi e password restano nel database di partenza. È una
scelta, non una dimenticanza — un archivio che gira per email non deve
contenere le chiavi di casa. Sul sistema nuovo si rifanno (passo 6).

## 2. Che cosa serve avere

- **Node.js 20 o più recente** (`node -v`) e `npm`.
- Un account **Supabase** — è il database, lo spazio file e il canale in tempo
  reale della videochiamata. Va bene anche il piano gratuito per cominciare.
- Un account **Cloudflare** — è dove gira il sito (Workers). Anche qui il piano
  gratuito basta per partire; i limiti veri sono scritti al passo 9.
- Un **nome a dominio**, se vuoi un indirizzo tuo.

> Il programma è scritto per queste due case. Farlo girare altrove (un server
> normale con Node, Vercel, Netlify) è possibile — è un'applicazione
> TanStack Start — ma la videochiamata, le copie automatiche e le rotte del
> server danno per scontato Supabase: quello non si sostituisce in un
> pomeriggio.

## 3. Il database nuovo

1. Crea un progetto nuovo su [supabase.com](https://supabase.com). Segnati
   l'indirizzo del progetto (`https://xxxx.supabase.co`) e le tre chiavi:
   `anon` (pubblica), `service_role` (segreta) e il riferimento del progetto.
2. Apri l'archivio del programma e crea le tabelle eseguendo **in ordine di
   nome** i file di `supabase/migrations/`. Due strade:
   - con la riga di comando: `npx supabase link --project-ref <ref>` e poi
     `npx supabase db push`;
   - oppure a mano: SQL Editor di Supabase, apri i file in ordine e premi Run.
3. Crea i contenitori dei file (Storage → New bucket), tutti **privati**:
   `registrazioni`, `media`, `documenti`, `prova-capelli`, `copie`,
   `sorgente` — e `anteprime` **pubblico**, perché quelle immagini le deve
   leggere WhatsApp quando mandi un link.

> ⚠️ **Le regole di lettura (RLS) contano.** Le migrazioni le portano con sé.
> Se salti una migrazione, il sito risponde ma i pannelli restano a zero: non è
> un guasto del programma, sono i permessi del database.

> ⚠️ **I lavori periodici vogliono due righe, e senza non partono.** Le
> migrazioni non sanno a memoria dov'è il sito (prima sì, ed era il guasto: un
> sistema clonato chiamava il sito vecchio). Appena hai l'indirizzo
> definitivo, scrivi in `app_config`:
>
> ```sql
> insert into app_config (key, value) values
>   ('cron_sito',   'https://il-tuo-indirizzo'),
>   ('cron_chiave', '<la chiave anon del TUO progetto>')
> on conflict (key) do update set value = excluded.value;
>
> select public.programma_hook_cron('meta-lead-sync-5min', '*/5 * * * *', '/hooks/meta-lead-sync');
> select public.programma_hook_cron('touch-history-backfill-daily', '15 3 * * *', '/hooks/touch-history-backfill');
> ```
>
> La chiave è quella **pubblica** (`anon`), mai quella di servizio: il comando
> di un lavoro periodico resta scritto in chiaro dentro `cron.job`.
> Finché quelle righe non ci sono, i lavori semplicemente non si programmano —
> e lo dicono. Per vedere se girano:
> `select * from cron.job_run_details order by start_time desc limit 10;`
>
> ⚠️ Queste due righe **non arrivano con la copia dei dati**, apposta: se
> viaggiassero, il sistema nuovo programmerebbe i suoi lavori contro il sito
> vecchio.

## 4. Il programma

```bash
unzip sorgente-*.zip -d hair-genius
cd hair-genius
npm ci                   # installa esattamente le versioni provate
cp .env.example .env     # e riempi i valori del passo 3
npx tsc --noEmit         # i tipi: nessuna riga = pulito
npm run prove            # devono passare TUTTI i controlli
npm run build            # la costruzione completa, senza bisogno del .env
npm run dev              # si apre in locale
```

Questa sequenza è la **prova che l'archivio è completo**: se arriva in fondo,
dentro c'è tutto quello che serve a ricostruire il programma. Fatta sul
pacchetto di oggi: 544 pacchetti installati, tipi puliti, 8.097 controlli
passati, costruzione riuscita (worker + 401 pezzi del sito).

Il file `.env` è l'unico posto in cui stanno le chiavi, e **non** finisce mai
dentro gli archivi (non è versionato, apposta).

```
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<chiave anon>"
SUPABASE_SERVICE_ROLE_KEY="<chiave service_role>"
VITE_SUPABASE_PROJECT_ID="<ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<chiave anon>"
VITE_SUPABASE_URL="https://<ref>.supabase.co"
OPENROUTER_API_KEY=""     # facoltativa: i suggerimenti scritti dall'AI
RESEND_API_KEY=""         # facoltativa: le email
SUMUP_API_KEY=""          # facoltativa: i pagamenti con SumUp
SUMUP_MERCHANT_CODE=""
```

> ⚠️ `vite build` **non controlla i tipi**: prima di pubblicare, `npx tsc
> --noEmit`. Senza, il sito si costruisce lo stesso e poi si apre bianco.

## 5. I dati dentro

Dal gestionale nuovo: **Impostazioni → Dati → Carica una copia**, e scegli il
file `.json` scaricato.

- Fallo girare prima in **prova**: non scrive niente e dice riga per riga che
  cosa succederebbe.
- Poi **sostituisci** (su un database appena creato è la scelta giusta) oppure
  **aggiungi** (tiene quello che c'è).

I **file** (registrazioni, foto, documenti) non stanno nel `.json`: si
scaricano dall'elenco e si ricaricano nei contenitori con lo stesso percorso.
L'elenco che scarichi è un `.json` con, per ogni file, il percorso e un
collegamento che **scade in un'ora**: va usato subito. Con `jq` e `curl` sono
due righe:

```bash
jq -r '.contenitori[].file[] | [.percorso, .url] | @tsv' file.json \
  | while IFS=$'\t' read -r p u; do mkdir -p "$(dirname "$p")"; curl -sL "$u" -o "$p"; done
```

## 6. Gli accessi

Non arrivano con la copia (vedi il passo 1). Sul sistema nuovo:

1. il **titolare** entra con l'email dell'amministratore (`CRM_ADMIN_EMAIL`);
2. i **consulenti** si ricreano da Collaboratori: ognuno riceve un PIN nuovo;
3. le **chiavi dei servizi esterni** (Meta, TikTok, WhatsApp, SumUp,
   OpenRouter) si rimettono da Impostazioni, una linguetta per servizio.

## 7. La videochiamata (Meetly)

Funziona già fra due dispositivi sulla stessa rete. Fra reti diverse — che è
il caso vero, tu in studio e il cliente a casa — serve un **TURN**, se no la
chiamata si collega e poi muore con lo schermo nero.

1. Cloudflare → **Realtime** → TURN → crea una chiave;
2. nel gestionale: Impostazioni → Meetly → incolla identificativo e segreto.

Si salvano nel database (`app_config`, riga `turn_config`), non nel codice.

## 8. Pubblicare

```bash
npx wrangler login
npm run pubblica
```

`npm run pubblica` fa quattro cose: costruisce, rimette online i pezzi delle
versioni precedenti (così una consulenza in corso non si spezza), pubblica, e
**deposita questa stessa sorgente** nel contenitore `sorgente` — cioè tiene
vivo il pulsante da cui hai scaricato questo archivio.

Poi, su Cloudflare: Workers → il tuo worker → Settings → **Variables and
Secrets**, e rimetti le stesse variabili del `.env` (quelle del passo 4).
Il dominio si attacca da Workers → Domains & Routes.

> ⚠️ **Mai scrivere i domini dentro `wrangler.jsonc`.** Ogni pubblicazione
> staccherebbe tutti gli altri. Si attaccano dal pannello.

## 9. Le cose che si rompono per prime

- **Limite di richieste** (piano gratuito Cloudflare: 100.000 al giorno). Una
  consulenza con più schede aperte ne consuma a migliaia: se il sito risponde
  «Error 1027», è il tetto, non un guasto.
- **Limite di file per versione** (20.000). L'archivio dei pezzi vecchi si pota
  da solo, ma se lo alzi finisci lì contro.
- **Quota di traffico Supabase**: superata, il database risponde `402` e tutti
  i pannelli vanno a zero insieme. È successo, e per mezz'ora sembra un guasto
  del programma.
- **Le pagine aperte da prima di una pubblicazione** continuano a far girare la
  versione vecchia finché non si ricaricano. Quando qualcosa «non c'è», la
  prima cosa da provare è ⌘⇧R.

## 10. Com'è fatto dentro, in dieci righe

- `src/routes/` — le pagine e le rotte del server (tutto ciò che comincia per
  `api.` è server).
- `src/crm/` — il gestionale: lead, agenda, preventivi, fatture, contabilità.
- `src/shop/` — Meetly (`call.tsx` è la videochiamata) e la pagina del
  preventivo.
- `prove/prove.mjs` — ottomila controlli sulle regole, senza database e senza
  browser: `npm run prove` prima di toccare qualunque cosa.
- `strumenti/pubblica.mjs` — la pubblicazione, con l'archivio dei pezzi.
- `supabase/migrations/` — lo schema del database, in ordine di data.

Le regole importanti sono scritte **dentro** i file, in italiano, in cima a
ogni modulo: non c'è un manuale separato da tenere aggiornato, e quando una
regola cambia il cartello cambia con lei.
