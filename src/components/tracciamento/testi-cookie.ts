/*  ── TUTTI I TESTI DEL BANNER DEI COOKIE, IN UN FILE SOLO ─────────────────────────
    Shop R1 · T27. ⚠️ IN ATTESA DELL'APPROVAZIONE DEL TITOLARE.
    Il titolo, il testo, i tre bottoni e la riga dopo la scelta sono del Copywriter
    (documento 2026-11-20-shop-completo, §3.2). Le due parole sul nome del link («Gestisci cookie») e tutto
    ciò che il documento non scrive (descrizioni delle categorie, avviso se il browser non salva) li ho
    scritti io, corti, e vanno letti da lui. */

export const TESTI = {
  titolo: "Cookie, in breve",
  corpo:
    "Usiamo cookie tecnici perché lo shop funzioni. Con il tuo permesso usiamo anche quelli di Meta, TikTok e Google per capire cosa funziona e mostrarti i nostri annunci. Puoi rifiutarli: lo shop funziona uguale.",
  linkPolicy: "Cookie policy",
  accetta: "Accetta",
  rifiuta: "Rifiuta",
  scegli: "Scegli",
  salva: "Salva la scelta",
  /** Il nome del link nel piè di pagina (lo stesso che la conferma qui sotto indica). */
  gestisci: "Gestisci cookie",
  /** Dopo la scelta. Il documento dice «Cookie»: qui il nome è quello vero del link nel piè di pagina. */
  salvata: "Scelta salvata. La cambi quando vuoi da “Gestisci cookie” in fondo alla pagina.",
  // — non nel documento: da approvare —
  errore: "Il browser non ci lascia salvare la scelta. Per ora non usiamo cookie di statistica né di marketing.",
  categorie: "Categorie di cookie",
  necessari: { nome: "Necessari", descrizione: "Fanno funzionare il sito (carrello, sicurezza, la tua scelta). Sono sempre attivi." },
  statistiche: { nome: "Statistiche", descrizione: "Ci dicono, in forma aggregata, quali pagine si visitano. Usiamo Google." },
  marketing: { nome: "Marketing (Meta, TikTok e Google)", descrizione: "Misurano gli annunci e ci permettono di mostrarti i nostri annunci su Meta, TikTok e Google." },
  ariaDialogo: "Preferenze cookie",
} as const;
