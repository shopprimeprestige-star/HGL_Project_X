# Com'è fatto questo programma — per chi lo prende in mano adesso

Questo foglio serve a una persona (o a un assistente) che apre questo codice
senza averlo mai visto e deve poterci lavorare **subito**, senza passare una
settimana a capire dove sono le cose. Non è un manuale d'uso: è la mappa, più
le regole che se non si conoscono si rompono.

Per installarlo altrove c'è un foglio a parte: `COME-INSTALLARLO-ALTROVE.md`.

---

## 1. Che cos'è

Due programmi che vivono nello stesso codice e nello stesso database:

- **il CRM** — lead, agenda, preventivi, fatture, contabilità, campagne, KPI.
  È il gestionale di un centro che vende e installa protesi/infoltimenti.
- **Meetly** — la videoconsulenza: il consulente apre una stanza, manda un
  link, il cliente entra dal browser senza installare niente. Dentro si mostra
  il preventivo che si compone in diretta, si registra la consulenza, si prova
  il colore dei capelli.

Più il **sito pubblico** (landing, moduli, pagina del preventivo che il cliente
riceve su WhatsApp).

## 2. Di che cosa è fatto

| Cosa | Con che cosa |
|---|---|
| Pagine e rotte del server | TanStack Start (React 19) — `src/routes/` |
| Dove gira | Cloudflare Workers (`npm run pubblica`) |
| Database, file, tempo reale | Supabase (Postgres + Storage + Realtime) |
| Aspetto | Tailwind v4 + componenti in `src/components/ui` |
| Videochiamata | WebRTC a maglia, TURN di Cloudflare — `src/shop/call.tsx` |

## 3. Dove stanno le cose

```
src/routes/        le pagine. Tutto ciò che comincia per `api.` è SERVER.
src/crm/           il gestionale (lead, agenda, fatture, contabilità…)
src/shop/          Meetly e la pagina del preventivo. `call.tsx` è la chiamata.
src/webinar/       le sale webinar
src/prova/         la prova colore dei capelli
prove/prove.mjs    ottomila controlli sulle regole, senza database né browser
strumenti/         pubblicazione, esportazione della sorgente, utilità
supabase/migrations/  lo schema del database, in ordine di data
docs/              questo foglio e quello dell'installazione
```

**Le spiegazioni stanno dentro i file.** In cima a ogni modulo c'è un cartello
in italiano che dice che cosa fa, perché esiste e quali trappole ha. Non c'è un
manuale separato: quando una regola cambia, cambia il cartello accanto a lei.
Chi legge il codice trova la storia; chi legge solo questo foglio no.

## 4. Le cinque regole che non si saltano

1. **`vite build` NON controlla i tipi.** Prima di pubblicare, sempre:
   `npx tsc --noEmit`. Senza, il sito si costruisce e poi si apre bianco.
2. **`node prove/prove.mjs` prima di toccare qualunque cosa**, e di nuovo dopo.
   Sono regole provate senza database e senza browser: se una si rompe, si è
   rotta davvero.
3. **Si pubblica con `npm run pubblica`**, mai con `npx wrangler deploy` a
   secco: lo script rimette online anche i pezzi delle versioni precedenti, se
   no una consulenza in corso si spezza a metà (`strumenti/pubblica.mjs` lo
   spiega per esteso).
4. **Le regole vanno in moduli puri, non dentro i componenti.** Una regola che
   vive in un componente non si può provare e si duplica alla seconda
   schermata che le serve. Il modello: un file con il cartello in cima, una
   funzione pura, e le prove in `prove/prove.mjs`.
5. **Niente credenziali nel codice, mai.** Stanno in `.env` (non versionato) e
   nelle variabili del worker. Nelle migrazioni non ci vanno nemmeno gli
   indirizzi: c'è una prova che lo verifica su tutta la cartella.

## 5. Le trappole che costano un pomeriggio

- **Una pagina aperta prima di una pubblicazione** continua a far girare la
  versione vecchia: quando qualcosa «non c'è», la prima cosa da provare è
  ⌘⇧R. Vale anche per chi segnala il guasto.
- **I ganci di React prima delle uscite anticipate.** Un `useState` sotto un
  `return` fa morire il componente quando quel ramo scatta — ed è successo
  davanti a un cliente. C'è una prova che lo impedisce.
- **Cloudflare, piano gratuito**: 100.000 richieste al giorno e 20.000 file per
  versione. Si sono toccati tutti e due.
- **Supabase, quota di traffico**: superata, il database risponde `402` e tutti
  i pannelli vanno a zero insieme. Sembra un guasto del programma e non lo è.
- **La videochiamata senza TURN** si collega e poi muore: schermo nero fra reti
  diverse. Le credenziali si mettono da Impostazioni → Meetly.
- **I file di prova scritti sul database vero** vanno cancellati sempre, nello
  stesso giro (`IDPROVE…` è il segno usato per riconoscerli).

## 6. Come si lavora qui

- **Si misura prima di aggiustare.** Quasi tutti i commit di questo progetto
  nascono da una misura: un conteggio, due numeri a confronto, una riga di
  diario letta dal server. «Credo che sia X» non basta: si guarda.
- **Si scrive in italiano**, nel codice e nei messaggi dei commit, perché chi
  legge è chi usa il programma.
- **I nomi dicono la cosa, non il meccanismo**: `chiSeNeEAndato`,
  `spuntaSoloUno`, `quantoDuraImmagine`.
- **I messaggi all'utente dicono che cosa fare**, non che cosa è andato storto.
- **Un pulsante che non può fare niente resta spento e dice perché**, invece di
  non fare niente quando lo si preme.

## 7. Da dove cominciare a leggere

1. `src/shop/call.tsx` — il cuore di Meetly (è lungo: i cartelli in cima alle
   sezioni raccontano la storia dei guasti veri).
2. `src/crm/booking-utils.ts` + `src/crm/fascia-consulenza.ts` — come si decide
   se un'ora è libera: ci passano tutte le schermate dell'agenda.
3. `src/routes/api.crm.backup.ts` + `src/crm/copia-sezioni.ts` — che cosa entra
   in una copia dei dati e che cosa non ne esce mai.
4. `prove/prove.mjs` — se vuoi capire che cosa fa davvero il programma, le
   prove lo dicono meglio di qualunque documento: ogni controllo porta il
   motivo per cui esiste.
