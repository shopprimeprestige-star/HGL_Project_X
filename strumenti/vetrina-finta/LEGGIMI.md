# Vetrina finta: un finto Supabase locale e un lanciatore sicuro

Serve a vedere, fotografare e misurare le pagine dello shop **senza toccare il database vero**
(PIANO-V1, D91, compito T75). Tutti i dati sono inventati: ogni nome dice «PROVA», le foto sono
quadrati con la scritta «PROVA», nessuna foto vera.

## Come si usa

1. Crea un worktree **nuovo e senza `.env`** (il `.env` del progetto punta al database vero):
   `git worktree add ../hub-shop-prova <ramo>`. Non copiare e non collegare mai un `.env` o un `.dev.vars`.
2. Dalla cartella del worktree: `node strumenti/vetrina-finta/avvia.mjs <scenario>`.
   Stampa l'indirizzo del finto, quello dell'app (`http://127.0.0.1:5199`, cambia con `--porta-app N`)
   e il numero del processo: per chiudere tutto, `kill <PID del lanciatore>` (chiude anche app e finto).
   Aspetta la riga «App riscaldata»: con `vite dev` appena avviato, finché nessuno chiede l'entrata del client nella forma
   `__x00__`, le pagine non si idratano (succede anche su main). Il lanciatore fa questa richiesta da solo.
3. Apri `http://127.0.0.1:5199/shop`. Il lanciatore forza `SHOP_CATALOGO_FORZA=cms` e `SHOP_CASSA_FORZA=vecchia`
   **solo per quel processo**: in produzione quelle variabili non si impostano mai.
4. Lighthouse: si lancia contro `vite dev` (come sopra). `--wrangler` avvia `wrangler dev --local` con lo stesso ambiente chiuso
   (le variabili finte passano con `--var`), ma **provato il 23/11: da solo non parte**, wrangler dice che il punto d'ingresso
   `@tanstack/react-start/server-entry` non c'è (serve prima una build, e la build deve girare con lo stesso ambiente chiuso:
   non fatto). Finché non c'è, per le misure vale `vite dev`; wrangler è un lavoro a parte.
5. Playwright, `axe` e Lighthouse si lanciano con `npx` da una cartella `mktemp -d` **fuori** dal repository (D92).

`GET http://127.0.0.1:<porta del finto>/__vetrina/stato` mostra lo scenario, quante scritture ha scartato
e l'elenco delle richieste ricevute (utile per la scheda di rete).

## Scenari

| Scenario | Cosa c'è |
|---|---|
| `completo` | 9 prodotti (5 patch con 1-3 opzioni, 2 cura, 1 kit, Invisible Derm senza prezzo), un nome lunghissimo, un prodotto senza foto, uno esaurito, 2 categorie, tariffa confermata, landing con un testo di prova |
| `vuoto` | catalogo vuoto, nessuna tariffa, nessuna riga di landing |
| `pochi` | 2 prodotti, uno senza foto, tariffa ancora provvisoria |
| `guasto` | ogni richiesta al database risponde 503 (le foto si servono) |
| `vecchio` | migrazione S1 non applicata: le tabelle `shop_*` non esistono (PGRST205); `landing_content` sì |
| `stress` | 50 prodotti, il primo con 50 varianti (5 colori per 10 lunghezze) |

## Cosa fa il finto (`server.mjs`)

- `GET /rest/v1/<tabella>`: `select`, `eq`, `neq`, `is`, `in`, `gt`/`gte`/`lt`/`lte`, `not.`, `order`, `limit`, `offset`, `maybeSingle`/`single`.
  Tabelle: le quattro viste `shop_v_*`, `shop_impostazioni`, `shop_spedizioni_tariffe`, `landing_content`, `funnel_settings`, `public_leads`.
- `POST /rest/v1/<tabella>` (insert, upsert): **accetta e scarta**, risponde 201. Non scrive niente: `lp_events` e `public_leads` non riempiono la prova di rete di errori.
- `GET /storage/v1/object/public/{shop-media,landing-media}/…`: la foto di prova (SVG).
- Tutto il resto lo rifiuta con un errore chiaro (400, 404, 405): mai una risposta inventata. Non esistono `rpc`, `PATCH`, `DELETE`, `or`, relazioni nella `select`.

## Le salvaguardie (stanno nel lanciatore, non solo nel finto)

Il lanciatore non può far parlare l'app con altro che il finto:

1. **Si ferma** se trova un `.env*` o un `.dev.vars*` nella cartella dell'app o in quella dello strumento (`.env.example` no: è nel repository e ha solo i nomi). Il messaggio dice il nome del file, mai il contenuto.
2. **Ambiente a elenco chiuso**: all'app arrivano `PATH`, `HOME`, `NODE_*` dalla shell e le sole variabili che il codice legge, tutte finte:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SHOP_CATALOGO_FORZA=cms`, `SHOP_CASSA_FORZA=vecchia`.
   Le chiavi vere della shell (Supabase, Stripe, OpenRouter, Cloudflare…) **non passano**.
3. **Verifica prima di partire**: nessuna variabile fuori elenco; ogni indirizzo è `http://127.0.0.1` o `http://localhost` sulla porta del finto, senza utente e password; ogni chiave è quella finta; nessun valore somiglia a un indirizzo (`supabase.co`) o a una chiave (JWT, `sb_secret_`) di Supabase. Se qualcosa non torna, l'app non parte.
4. Il finto ascolta **solo su 127.0.0.1**, vuole la chiave finta a ogni richiesta (una chiave vera avrebbe risposto 401) e concede CORS solo alle pagine su 127.0.0.1 o localhost.

La prova `prove/negozio/vetrina-finta.mjs` tenta di violarle una per una (finto `.env` e `.dev.vars`, URL remoti e travestiti, chiave «vera», variabili ereditate dalla shell, un costruttore d'ambiente che perde) e diventa rossa se se ne toglie una.

## Quattro rotte da NON visitare

Hanno un indirizzo Supabase **vero scritto nel codice** (solo immagini pubbliche, fuori dallo shop); il finto non le può governare e il lanciatore non le può chiudere:

- `/api/og/anteprima` (`src/routes/api.og.anteprima.ts`)
- `/media/<codice>` (`src/routes/media.$codice.tsx`)
- `/prova-anteprima-a` (`src/routes/prova-anteprima-a.tsx`) e `/prova-anteprima/<caso>` (`src/routes/prova-anteprima.$caso.tsx`)

Il collaudo non le visita: se uno strumento che scorre i collegamenti le incontra, va escluso.

## Limiti dichiarati

- Le foto di prova pesano meno di quelle vere: Lighthouse e LCP si rifanno sul sito vero con le foto vere (D92, §7.2 del piano).
- Il finto non controlla niente di ciò che il database vero controlla (permessi, trigger, vincoli): serve a vedere le pagine, non a provare la cassa.
- Le funzioni lato server dell'app girano nel processo di `vite dev`, che parla col finto come parlerebbe con Supabase; il carrello e la cassa restano quelli «vecchi» (`SHOP_CASSA_FORZA=vecchia`).
