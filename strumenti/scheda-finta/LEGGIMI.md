# Scheda finta: la pagina «Prodotti» del CRM sopra un database finto

Serve a **vedere e provare con un browser vero** l'elenco prodotti, la scheda, la scheda nuova e l'import da CSV
(commessa «editor prodotti», PIANO §6 livello 3), senza login e **senza toccare il database vero**.
Non è in produzione, non è in `npm test`, non è compilato da `tsc` (sta fuori da `src/`). Nessun pacchetto nuovo.

## Come si avvia

Dalla cartella del worktree (che deve essere **senza `.env`**):

```
node strumenti/scheda-finta/avvia.mjs            # porta 5188
node strumenti/scheda-finta/avvia.mjs --porta N  # un'altra porta
```

Stampa l'indirizzo (`http://127.0.0.1:5188`) e il numero del processo. Per chiudere: `Ctrl-C`, oppure `kill <PID>`.
Il primo caricamento della pagina è lento (vite prepara le dipendenze in una cartella temporanea, che sparisce alla chiusura).

- `http://127.0.0.1:5188/`: l'elenco con 33 bozze. «Aggiungi prodotto» e «Importa» sono lì.
- `http://127.0.0.1:5188/#<id del prodotto>`: la scheda di quel prodotto (gli id sono `00000000-0000-4000-8000-0000000010NN`, con NN da 01 a 21 in esadecimale: `…001001` è la bozza 01, `…001010` la 16).
- `http://127.0.0.1:5188/__scheda-finta/stato`: quanti prodotti ci sono, quante scritture ha fatto il finto, quante chiamate ha ricevuto (utile per il collaudo).

## Cosa c'è dentro

- **Pagina** (`index.html` + `pagina.tsx`): `ElencoProdotti` (con `SchedaNuova` e la finestra «Importa») e `SchedaProdotto`, dentro `.crm-theme`, con gli stili veri del CRM.
- **Accesso**: `@/crm/AuthContext` è **sostituito** da `auth-finto.ts` (`fetchCRM` è una `fetch` semplice): nessun login, nessun client del database.
- **Server**: `/api/crm/negozio` risponde con il server vero (`smista.server`, caricato con `vite ssrLoadModule`), con la guardia sempre «sì», sopra `prove/negozio/_finto-db.mjs`.
- **Dati** (`dati.mjs`): 33 bozze inventate, tutte con «PROVA» nel nome, 4 su 5 senza opzioni e le altre con 2 o 3 colori (e 2 misure), una categoria. Tutto in memoria: chiuso il processo, ogni scrittura è persa.
- **Non c'è**: lo Storage delle foto (caricare una foto non funziona: la rotta `negozio-media` non è collegata), il sito pubblico, i pagamenti.

## Salvaguardie (provate da `prove/negozio/editor-invarianti.mjs`)

1. **Rifiuta di partire** se trova un `.env*` o un `.dev.vars*` nella cartella dell'app o in questa (la funzione è quella della vetrina finta, `strumenti/vetrina-finta/avvia.mjs`).
2. `envDir` di vite su una cartella vuota; `envPrefix` che non espone nessuna variabile della shell alla pagina.
3. Il processo butta via tutte le variabili d'ambiente che non sono dell'elenco chiuso (`PATH`, `HOME`, `TMPDIR`, `NODE_*`…).
4. Ascolta solo su `127.0.0.1`. La `.vite` condivisa non si tocca: la cache di vite è in una cartella temporanea.
5. Nessun file di questa cartella nomina chiavi, e nessun file di `src/` la importa.

## Collaudo con Playwright (regola D92)

Si lancia da una cartella `mktemp -d` **fuori dal repository**, con `npx`, contro questo indirizzo. Misure: 390 e 1440 px, clic e Tab (focus visibile),
nessuno scorrimento orizzontale a 390 px, campi alti 44 px, creazione di un prodotto semplice, aggiunta di opzioni, import del modello e di un file con errori,
scarico del file da correggere. Per ripartire dai 33 dati di partenza basta chiudere e riavviare.
