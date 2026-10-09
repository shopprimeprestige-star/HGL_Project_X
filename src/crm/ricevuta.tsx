/** ── IL RIEPILOGO DI CONSEGNA ──────────────────────────────────────────────
 *
 *  Il foglio che si consegna al cliente insieme all'impianto: cosa ha ricevuto,
 *  quanto ha versato, e — se lo si vuole — il certificato della copertura.
 *
 *  ── PERCHÉ SERVIVA ────────────────────────────────────────────────────────
 *  A posa finita il cliente ha pagato migliaia di euro e va via con l'impianto
 *  in testa e niente in mano. Il numero «ha saldato» esisteva solo dentro il
 *  CRM, cioè in un posto dove lui non entra: alla prima domanda — «ma quanto
 *  avevo versato?», «e se si rovina?» — la risposta era una telefonata a noi.
 *  Questo foglio la mette per iscritto una volta sola.
 *
 *  ── PERCHÉ UNA FINESTRA DI STAMPA E NON UNA LIBRERIA PDF ─────────────────
 *  Perché è già il modo di questa applicazione: la trascrizione della
 *  consulenza (shop/call, `exportTranscriptPDF`) e il percorso di produzione
 *  (/percorso) si esportano così — si apre una finestra, ci si scrive dentro un
 *  documento completo, e il browser offre «Salva come PDF». Zero dipendenze,
 *  zero font da incorporare, e il risultato è identico su Mac e su Windows.
 *
 *  ⚠️ IL DOCUMENTO NON EREDITA UNA RIGA DI CSS DALL'APPLICAZIONE, ed è voluto.
 *   Vive in una finestra sua con i suoi stili scritti dentro: nessuna classe di
 *   Tailwind, nessuna variabile di tema. Il giorno in cui il CRM cambia palette
 *   o passa a un altro foglio di stile, questo foglio esce identico a oggi —
 *   che è l'unica cosa che si può chiedere a un documento che il cliente si
 *   porta a casa e riguarda fra sei mesi.
 *
 *  ── LA COPERTURA È OPZIONALE, E L'IMPORTO SI DECIDE QUI ──────────────────
 *  La finestra chiede due cose sole prima di stampare: quanto costerà un
 *  intervento dentro la finestra di copertura, e se il certificato va incluso.
 *  Non tutte le consegne lo vogliono (una manutenzione, una sostituzione in
 *  garanzia), e stampare un certificato dove non serve lo svaluta.
 *  ⚠️ L'IMPORTO SI SALVA SULLA PRATICA (`installazione.coperturaImporto`) e non
 *   si rilegge dal listino a ogni stampa: il perché per esteso sta su quel
 *   campo in types.ts — due copie dello stesso foglio non possono portare due
 *   cifre diverse.
 *  ⚠️ I MESI, invece, si leggono SEMPRE da MAINTENANCE.everyMonths: è la stessa
 *   regola che il cliente ha già letto sul preventivo, e due documenti nostri
 *   che dicono due durate diverse valgono meno di nessun documento.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Percent, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/*  ── ⚠️ LA COPERTURA SI LEGGE DAL LISTINO, NON DALLA COSTANTE ─────────────
    Segnalazione del committente: «quando cambio il prezzo della garanzia 15
    mesi non si cambia».
    Qui la cifra di partenza e i mesi erano `MAINTENANCE`, cioè i 450 € e i 15
    mesi scritti nel codice: il consulente li cambiava dal pannello Listino, il
    preventivo del cliente usciva con la cifra nuova e QUESTO certificato —
    quello che il cliente si porta a casa — continuava a dire la vecchia. Due
    documenti della stessa pratica con due promesse diverse.
    `MAINTENANCE` resta come ripiego per il primo istante, prima che il listino
    sia arrivato. */
import { MAINTENANCE, manutenzioneDi, type PricingOverrides } from "@/shop/quote-menu";
import { useCRM } from "./CRMContext";
import {
  CLASSE_CAMPO,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  SezioneFinestra,
  VoceScelta,
} from "./ui/Finestra";
import { eur } from "./ui";
import {
  giaIncassato,
  giornoISO,
  incassoRegistrato,
  leggiEuro,
  nomeCompleto,
  posaCompletata,
  prezzoVendita,
  saldoAllaConsegna,
  scriviEuro,
} from "./InstallationScheduleDialog";
import { ALIQUOTA_IVA } from "./iva";
import type { InstallazioneInfo, Lead } from "./types";

/** ── UN CODICE PER UN IMPIANTO CHE NON HA UN PREVENTIVO ────────────────────
 *  Serve quando la pratica è nata senza passare dalla pagina del preventivo —
 *  succede: un cliente arrivato in negozio, una scheda importata da prima.
 *  L'impianto è stato consegnato lo stesso e la garanzia deve poterlo nominare.
 *
 *  ⚠️ L'ALFABETO NON HA `0 O 1 I L`. Questo codice si legge al telefono e si
 *   ricopia a mano da un foglio stampato: uno zero e una O si sbagliano, e a
 *   sbagliarli è chi ci sta chiedendo di onorare una garanzia — cioè il momento
 *   peggiore per far dire «questo codice non risulta».
 *
 *  ⚠️ IL PREFISSO NON È `ID`, che è quello dei preventivi. Due codici con la
 *   stessa faccia finiscono cercati nel posto sbagliato: un HGL- non si troverà
 *   mai in archivio preventivi, ed è giusto che si veda subito. */
const ALFABETO_ID = "23456789ACDEFGHJKLMNPQRSTUVWXYZ";
function nuovoIdImpianto(): string {
  //  `crypto` c'è in ogni browser che questa applicazione supporta; il ripiego
  //  esiste perché un codice mancante varrebbe un certificato senza numero.
  const n = 6;
  const bytes =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(n))
      : Array.from({ length: n }, () => Math.floor(Math.random() * 256));
  let out = "";
  for (let i = 0; i < n; i++) out += ALFABETO_ID[bytes[i] % ALFABETO_ID.length];
  return `HGL-${out}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. I DATI DEL FOGLIO — raccolti una volta, letti da un posto solo
   ═════════════════════════════════════════════════════════════════════════ */

export interface DatiRicevuta {
  cliente: string;
  prodotto: string;
  /** giorno della consegna, in chiaro */
  giorno: string;
  totale: number;
  versato: number;
  resta: number;
  /** ── COME L'IVA COMPARE SUL FOGLIO ────────────────────────────────────
   *  ⚠️ Prima era una STRINGA («22% inclusa nel totale») e finiva in una riga
   *   fra le altre. Non bastava più: il committente ha chiesto due
   *   presentazioni diverse, e la seconda cambia le cifre stampate.
   *    · "inclusa" → dell'IVA non si scrive NIENTE. Non una riga sbiadita, non
   *      una nota: il prezzo la comprende, e chi legge un foglio di consegna
   *      vuole sapere quanto ha pagato, non come è composto dentro.
   *    · "aggiunta" → il totale si scompone in tre righe (imponibile, IVA,
   *      totale con IVA) e la cifra da chiedere SALE.
   *    · "nessuna" → come "inclusa" a schermo, ma nasce da un'altra verità:
   *      l'IVA non c'è affatto. Si tengono separate perché la pratica le
   *      distingue già, e ricavarne una sola perderebbe il dato. */
  iva: "inclusa" | "aggiunta" | "nessuna";
  aliquota: number;
  /** logo del centro, se ce n'è uno caricato */
  logo: string;
  /** Il codice dell'impianto: è a QUESTO che la garanzia è attaccata.
   *  Vedi `idImpianto` in crm/types e `nuovoIdImpianto` qui sotto. */
  idImpianto: string;
  /** ── COSA ESCE DA QUESTO FOGLIO ────────────────────────────────────────
   *  Richiesta del committente: tre documenti diversi dalla stessa finestra.
   *   · "tutto"        → consegna e certificato, uno sotto l'altro (come prima)
   *   · "riepilogo"    → solo la consegna e il pagamento
   *   · "certificato"  → solo la copertura, e in formato 9:16
   *  ⚠️ IL SOLO CERTIFICATO CAMBIA ANCHE LA CARTA, non solo il contenuto: da
   *   solo non è un foglio d'ufficio, è una cosa che si manda su WhatsApp e si
   *   guarda dal telefono. Su A4 sarebbe un rettangolo di testo in cima a mezza
   *   pagina bianca. Il perché per esteso sta su `costruisciRiepilogo`. */
  emette: "tutto" | "riepilogo" | "certificato";
  coperturaImporto: number;
  coperturaMesi: number;
}

/** ── GLI EURO DEL FOGLIO HANNO I CENTESIMI ────────────────────────────────
 *  ⚠️ NON si usa `eur` del CRM, ed è una differenza voluta. Là i centesimi sono
 *   tolti apposta — «gli importi sono a tre/quattro cifre e i centesimi
 *   occupano spazio senza aggiungere nulla» — e per una riga di elenco che si
 *   scorre è giusto. Qui no: questo foglio dice a una persona quanto ha pagato,
 *   e «€ 650» accanto a un bonifico da 649,50 apre una discussione. Un
 *   documento di cassa scrive i centesimi anche quando sono zero, ed è anche
 *   quello che lo fa somigliare a quello che è.
 *  Resta `eur` per tutto ciò che si legge NELLA FINESTRA prima di stampare:
 *  quelle sono cifre di controllo, e lì il CRM parla la sua lingua. */
const euroFoglio = (n: number): string =>
  `€ ${(Number(n) || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dataLunga = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
};

/** Il giorno che il foglio dichiara come consegna: quello scritto sulla posa,
 *  con l'ordine di ripiego che scende dal dato più preciso al più generico.
 *  ⚠️ Mai `oggi` in silenzio: un foglio ristampato a marzo direbbe che la posa
 *   è di marzo, e quella data la legge un cliente che sa benissimo quando è
 *   venuto. Se non si sa, si tace (vedi come la usa `costruisciRiepilogo`). */
function giornoConsegna(l: Lead): string {
  const i = l.data.installazione;
  return String(i?.completataIl || i?.dataInstallazione || "");
}

/** ── COM'È L'IVA SU QUESTA PRATICA, SECONDO L'ARCHIVIO ────────────────────
 *  È la proposta con cui la finestra si apre, non l'ultima parola: chi stampa
 *  può cambiarla (vedi `TastoRicevuta`).
 *  ⚠️ Senza una dichiarazione esplicita si risponde «nessuna» e non «inclusa»:
 *   scrivere «IVA compresa» su una pratica che non l'ha mai detto è mettere per
 *   iscritto, sotto il nostro marchio, una cosa che non sappiamo. */
function ivaDellaPratica(l: Lead): "inclusa" | "aggiunta" | "nessuna" {
  const inc = incassoRegistrato(l);
  if (inc) {
    if (inc.modoIva === "aggiunta") return "aggiunta";
    return inc.conIva ? "inclusa" : "nessuna";
  }
  return l.data.payment?.costi?.ivaInclusa ? "inclusa" : "nessuna";
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL DOCUMENTO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── LA CHIUSURA DEL TAG, SPEZZATA IN DUE ─────────────────────────────────
 *  Il documento porta dentro tre righe di script (l'apertura della stampa), e
 *  la sua chiusura non si può scrivere per intero dentro questo file: un
 *  `</script>` letterale chiude il PRIMO tag script che lo incontra, e se
 *  questo pezzo di codice finisce mai incorporato in una pagina — un bundle
 *  inline, un'anteprima — taglierebbe la pagina a metà da lì in giù.
 *  Spezzarla è la difesa di sempre, e in due pezzi non è più una sequenza che
 *  un parser HTML possa riconoscere. */
const CHIUDI_SCRIPT = "<" + "/script>";

/** Testo dentro HTML: qui entrano nomi di persone e descrizioni scritte a mano
 *  nel CRM, e un `<` battuto per sbaglio in una nota non deve poter rompere —
 *  o riscrivere — il foglio che il cliente si porta a casa. */
const esc = (v: unknown): string =>
  String(v ?? "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );

/** ── IL FOGLIO, PER INTERO ────────────────────────────────────────────────
 *  Una sola pagina, in verticale, con tre blocchi: chi e cosa, quanto, e — se
 *  richiesto — la copertura.
 *
 *  ⚠️ IL CERTIFICATO NON COPIA IL PREVENTIVO. Là la copertura è un argomento di
 *   vendita, dentro una pagina scura piena di verde e di numeri grandi: serve a
 *   togliere l'ultimo dubbio prima di pagare. Qui il cliente ha già pagato, e il
 *   foglio ha un altro mestiere — si infila in un cassetto e si ritira fuori il
 *   giorno in cui qualcosa non va. Quindi carta bianca, cornice sottile, un
 *   colore solo, e le condizioni scritte come si scrivono le condizioni: due
 *   righe per punto, senza superlativi. Un certificato che grida non si crede.
 *
 *  ⚠️ E IL COLORE È UNO SOLO, il verde del marchio, usato per il filetto in alto
 *   e per i titoli: le stampanti dell'ufficio sono in bianco e nero metà delle
 *   volte, e un documento che si regge su tre colori in bianco e nero diventa
 *   tre grigi indistinguibili. Questo resta leggibile anche così. */
/** ── LE RIGHE DEI SOLDI, NELLE DUE PRESENTAZIONI ──────────────────────────
 *  Richiesta del committente, e sono due documenti diversi che escono dalla
 *  stessa pratica:
 *
 *   IVA COMPRESA (o nessuna) — non si scrive una parola sull'IVA:
 *     Totale della pratica        € 650,00
 *     Versato                     € 650,00
 *     ✓ Saldato per intero
 *
 *   IVA DA AGGIUNGERE — il totale si scompone, e la cifra da chiedere sale:
 *     Imponibile                  € 650,00
 *     IVA 22%                     € 143,00
 *     Totale con IVA              € 793,00     ← è questa che si paga
 *     Versato                     € 650,00
 *     Ancora da versare           € 143,00
 *
 *  ⚠️ NEL SECONDO CASO «Versato» E «Resta» SI RICALCOLANO SUL TOTALE LORDO, e
 *   non è un dettaglio: lasciandoli sul netto il foglio avrebbe detto «saldato
 *   per intero» sotto una cifra da pagare più alta di quella versata. È
 *   esattamente il documento che una persona porta in tribunale, o più
 *   probabilmente al telefono con noi, e ha ragione lei.
 *  ⚠️ E IL BOLLO «SALDATO» SEGUE LO STESSO CONTO: compare solo quando non resta
 *   davvero niente. Un bollo verde è una quietanza, e una quietanza sbagliata
 *   non si ritira. */
function blocchoPagamento(d: DatiRicevuta): string {
  const riga = (etichetta: string, valore: string, forte = false) => `
    <div class="riga${forte ? " forte" : ""}">
      <span class="et">${esc(etichetta)}</span>
      <span class="va">${esc(valore)}</span>
    </div>`;

  const conIva = d.iva === "aggiunta";
  const imposta = conIva ? Math.round(d.totale * d.aliquota) / 100 : 0;
  const daPagare = Math.round((d.totale + imposta) * 100) / 100;
  const resta = Math.max(0, Math.round((daPagare - d.versato) * 100) / 100);

  return `
      ${
        conIva
          ? `${riga("Imponibile", euroFoglio(d.totale))}
      ${riga(`IVA ${d.aliquota}%`, euroFoglio(imposta))}
      ${riga("Totale con IVA", euroFoglio(daPagare), true)}`
          : riga("Totale della pratica", euroFoglio(d.totale))
      }
      ${riga("Versato", euroFoglio(d.versato))}
      ${resta > 0 ? riga("Ancora da versare", euroFoglio(resta), true) : ""}
      ${
        resta <= 0
          ? `<div class="saldato"><span class="bollo">&#10003;</span> Saldato per intero</div>`
          : ""
      }`;
}

/** ── IL CERTIFICATO DA SOLO: UN'ALTRA COSA, NON LO STESSO FOGLIO ──────────
 *  16:9, fondo scuro, il marchio in cima.
 *
 *  ⚠️ ERA 9:16 (verticale, da telefono) ED È STATO CAMBIATO SU RICHIESTA. Il
 *   formato non è un dettaglio di stile: in verticale il certificato si legge
 *   in un messaggio, in orizzontale si stampa e si incornicia ma su WhatsApp
 *   arriva piccolo. Con l'orizzontale la colonna unica non regge — resterebbe
 *   un nastro di testo largo e alto due dita — e per questo qui dentro il
 *   contenuto è su DUE colonne: a sinistra chi e cosa, a destra le condizioni.
 *
 *  ⚠️ IL FONDO SCURO NON È UNA SCELTA DI GUSTO: È L'UNICO MODO DI VEDERE IL
 *   LOGO. Quello caricato nelle impostazioni è la versione BIANCA del marchio
 *   (`Logo-PNG-WHITE`), e su carta bianca era semplicemente invisibile — il
 *   certificato usciva senza marchio e nessuno capiva perché. Su fondo scuro si
 *   legge, ed è anche la stessa lingua visiva del preventivo che il cliente ha
 *   già visto: blu notte, verde smeraldo, cornici sottili.
 *   ⚠️ Chi un domani caricasse un logo NERO deve saperlo: qui sparirebbe. Il
 *    ripiego col nome scritto resta, quindi non si romperebbe niente — ma il
 *    marchio non si vedrebbe, e il posto da cambiare è questo.
 *
 *  ⚠️ E RESTA UN DOCUMENTO A SÉ, con i suoi stili, invece di essere il foglio
 *   chiaro con dieci eccezioni sopra. Le eccezioni si accumulano e prima o poi
 *   una regola pensata per la carta arriva qui e rompe la cartolina, o
 *   viceversa. Due documenti, due mestieri: uno si stampa e si firma, questo si
 *   manda su WhatsApp.
 *
 *  Le icone sono SVG scritte a mano: in una finestra di stampa non c'è nessuna
 *  libreria, e un'icona che non carica lascia un buco in mezzo al certificato.
 *  ───────────────────────────────────────────────────────────────────────── */
function certificato916(d: DatiRicevuta): string {
  //  Scudo, chiave inglese e calendario: i tre concetti del certificato —
  //  siamo garanti, si ripara, entro un tempo. `currentColor` così ogni icona
  //  prende il colore di dove sta.
  const scudo =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  const chiave =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
  //  L'impronta: è il concetto giusto per un codice che identifica UN pezzo.
  const impronta =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>';
  const calendario =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>';

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Certificato di copertura — ${esc(d.cliente)}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:#0b1220;padding:24px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  /* ── ⚠️ IL FONDO È QUELLO DEL SITO, COPIATO RIGA PER RIGA ───────────────
     Non «un blu che gli assomiglia»: è la ricetta di .bg-blueprint in
     styles.css — navy #0a1a3a, griglia bianca al 5% ogni 72px, alone azzurro
     in alto e blu profondo in basso. È lo sfondo che il cliente ha già visto
     sul preventivo e in videochiamata, e un certificato con un altro blu si
     legge come stampato da qualcun altro.
     ⚠️ Scritto per esteso e non con la classe: questo foglio esce in una
      finestra sua e non eredita una riga di CSS dall'applicazione (è voluto —
      un documento deve uscire identico fra un anno). Se un giorno cambia il
      fondo del sito, cambia QUI e in fatture/documento.ts. */
  .card{
    position:relative;max-width:940px;margin:0 auto;aspect-ratio:16/9;overflow:hidden;
    display:flex;flex-direction:column;border-radius:22px;color:#eaf2ff;
    background-color:#0a1a3a;
    background-image:
      radial-gradient(ellipse 80% 60% at 50% 0%,rgba(56,110,220,.28),transparent 70%),
      radial-gradient(ellipse 60% 50% at 50% 100%,rgba(20,50,120,.35),transparent 70%),
      linear-gradient(180deg,#0c1f44 0%,#081634 50%,#0a1a3a 100%);
  }
  /* la griglia, sopra gli aloni: 72px come sul sito */
  .card::before{
    content:"";position:absolute;inset:0;pointer-events:none;
    background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
    background-size:72px 72px;
  }
  .dentro{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:26px 34px 24px}
  /* ── LE DUE COLONNE ────────────────────────────────────────────────────
     A sinistra CHI e COSA (nome, data, codice), a destra le CONDIZIONI
     (l'importo, la durata) e la nota per attivarla. Il filo verticale in
     mezzo separa le due letture senza aggiungere un riquadro. */
  .corpo{display:flex;gap:34px;flex:1;min-height:0;margin-top:18px}
  .col{display:flex;flex-direction:column;min-width:0}
  .col.sx{flex:1.15}
  .col.dx{flex:1;padding-left:34px;border-left:1px solid rgba(255,255,255,.1)}

  /* la riga in cima: marchio a sinistra, cos'è questo foglio a destra */
  .testa{display:flex;align-items:center;justify-content:space-between;gap:20px}
  .logo{height:26px;width:auto;object-fit:contain;display:block}
  .logo-testo{font-size:17px;font-weight:800;letter-spacing:.02em}

  .bollo{display:flex;align-items:center;gap:8px}
  .bollo svg{width:18px;height:18px;color:#77bcff}
  .bollo span{font-size:10.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#77bcff}

  .nome{margin:0;font-size:31px;font-weight:800;letter-spacing:-.7px;line-height:1.1}
  .data{margin-top:7px;font-size:12.5px;color:rgba(234,242,255,.55)}

  /* ── IL CODICE DELL'IMPIANTO ──────────────────────────────────────────
     Sta ALTO, sotto il nome e prima della promessa, e non in fondo insieme
     agli importi: è il primo dato che serve quando il cliente ritorna, e in
     fondo al foglio si perde fra le due tessere. Il codice è scritto in
     monospaziato e spaziato perché si legge al telefono e si ricopia a mano. */
  .impianto{margin-top:auto;padding:14px 16px;border-radius:14px;
    border:1px solid rgba(15,144,254,.42);background:rgba(15,144,254,.12)}
  .impianto .cima{display:flex;align-items:center;gap:8px}
  .impianto .cima svg{width:16px;height:16px;color:#77bcff}
  .impianto .cima span{font-size:10px;font-weight:800;letter-spacing:.18em;
    text-transform:uppercase;color:#77bcff}
  .impianto .codice{display:block;margin-top:6px;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:27px;font-weight:700;letter-spacing:.09em;color:#fff;word-break:break-all}
  .impianto .nota{display:block;margin-top:6px;font-size:11.5px;line-height:1.5;
    color:rgba(234,242,255,.6)}
  .promessa{margin:0;font-size:14px;line-height:1.6;color:rgba(234,242,255,.8)}
  .promessa b{color:#fff;font-weight:700}

  .tessere{display:flex;flex-direction:column;gap:10px;margin-top:auto}
  .tessera{
    display:flex;align-items:center;gap:13px;padding:15px 16px;border-radius:16px;
    border:1px solid rgba(15,144,254,.32);background:rgba(255,255,255,.05);
  }
  .tessera .ico{display:flex;align-items:center;justify-content:center;flex:none;
    width:40px;height:40px;border-radius:12px;background:rgba(15,144,254,.18);color:#77bcff}
  .tessera .ico svg{width:20px;height:20px}
  .tessera .et{display:block;font-size:10.5px;font-weight:800;letter-spacing:.14em;
    text-transform:uppercase;color:rgba(234,242,255,.5)}
  .tessera .va{display:block;margin-top:2px;font-size:23px;font-weight:800;letter-spacing:-.4px;color:#fff}
  .tessera .no{display:block;margin-top:1px;font-size:11.5px;color:rgba(234,242,255,.5)}

  .piede{margin:14px 0 0;font-size:11px;line-height:1.55;color:rgba(234,242,255,.45)}

  /* ── ⚠️ IL PDF DEVE USCIRE 16:9, E QUI SI DECIDE ────────────────────────
     Due errori, uno dentro l'altro, che facevano uscire un A4 VERTICALE con
     il certificato stirato in mezzo:

     1) la regola diceva "size: 192mm 108mm landscape". Non è CSS valido: si
        scrivono O due misure, O un nome di formato insieme all'orientamento,
        mai le due cose insieme. Una dichiarazione non valida viene buttata
        via INTERA e in silenzio — quindi non restava "landscape", restava il
        foglio predefinito del browser, cioè A4 verticale.
        Adesso ci sono due sole misure, la larga per prima: è quello che
        significa orizzontale, e non serve dirlo con una parola.

     2) e comunque "height:100vh" avrebbe rovinato le proporzioni anche col
        foglio giusto, perché stira la scheda su tutta l'altezza della pagina
        qualunque essa sia — che è esattamente il vuoto che si vedeva.

     ⚠️ LE MISURE SONO 256x144mm, NON UN A4 GIRATO. 256/144 fa 16:9 esatto, e
      256mm sono ~968px: un filo più della larghezza per cui il contenuto è
      disegnato (940px), così il testo non viene mai tagliato. Stringere il
      foglio sul contenuto invece che schiacciare il contenuto nel foglio è
      l'unico modo di avere le proporzioni giuste E niente tagliato.

     ⚠️ E qui dentro non si scrivono apici inversi: questo foglio di stile vive
      dentro un template literal, e una coppia di apici lo chiuderebbe. */
  @media print{
    body{padding:0;background:#070f22}
    .card{width:256mm;height:144mm;max-width:none;margin:0;aspect-ratio:auto;border-radius:0}
  }
  @page{size:256mm 144mm;margin:0}
</style></head><body>
  <div class="card">
    <div class="dentro">
      <div class="testa">
        ${
          d.logo
            ? `<img class="logo" src="${esc(d.logo)}" alt="Hair Genius Labs">`
            : `<div class="logo-testo">Hair Genius Labs</div>`
        }
        <div class="bollo">${scudo}<span>Certificato di copertura</span></div>
      </div>

      <div class="corpo">
        <div class="col sx">
          <h1 class="nome">${esc(d.cliente)}</h1>
          <div class="data">${d.giorno ? `Consegnato il ${esc(d.giorno)}` : "Consegna registrata"}</div>

          <div class="impianto">
            <div class="cima">${impronta}<span>ID impianto</span></div>
            <span class="codice">${esc(d.idImpianto)}</span>
            <span class="nota">Questa garanzia vale per l&rsquo;impianto contrassegnato da questo codice, e solo per quello.</span>
          </div>
        </div>

        <div class="col dx">
          <p class="promessa">
            Se l&rsquo;impianto <b>${esc(d.idImpianto)}</b> presenta un problema, ce ne occupiamo noi:
            lo <b>rigeneriamo</b> riportandolo alle condizioni del primo giorno &mdash; base, densità
            e colore &mdash; oppure, se non è recuperabile, lo <b>sostituiamo</b> con uno nuovo,
            ricostruito sul tuo caso.
          </p>

          <div class="tessere">
            <div class="tessera">
              <span class="ico">${chiave}</span>
              <span>
                <span class="et">Un intervento</span>
                <span class="va">${esc(euroFoglio(d.coperturaImporto))}</span>
                <span class="no">rigenerazione oppure sostituzione</span>
              </span>
            </div>
            <div class="tessera">
              <span class="ico">${calendario}</span>
              <span>
                <span class="et">Entro</span>
                <span class="va">${d.coperturaMesi} mesi</span>
                <span class="no">dalla data di consegna qui accanto</span>
              </span>
            </div>
          </div>

          <p class="piede">
            Per altri interventi nello stesso periodo si ripaga l&rsquo;importo.<br>
            Per attivare la garanzia chiama il centro e comunica l&rsquo;ID:
            è da quel codice che riconosciamo il tuo impianto.
          </p>
        </div>
      </div>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}${CHIUDI_SCRIPT}
</body></html>`;
}

export function costruisciRiepilogo(d: DatiRicevuta): string {
  //  ⚠️ Il certificato da solo è un ALTRO documento, non questo con delle
  //   eccezioni: vedi la nota su `certificato916`.
  if (d.emette === "certificato") return certificato916(d);

  const riga = (etichetta: string, valore: string, forte = false) => `
    <div class="riga${forte ? " forte" : ""}">
      <span class="et">${esc(etichetta)}</span>
      <span class="va">${esc(valore)}</span>
    </div>`;

  /** ── CONSEGNA E PAGAMENTO ─────────────────────────────────────────────
   *  ⚠️ SI COMPONE IN UNA VARIABILE, E NON DENTRO IL FOGLIO. Infilando questo
   *   pezzo dentro un segnaposto del documento serviva un secondo template
   *   annidato nel primo, e per farcelo stare avevo dovuto proteggere i suoi
   *   segnaposto — che è esattamente il modo di SPEGNERLI. Il foglio è uscito
   *   con scritto, alla lettera, «${riga("Impianto", d.prodotto)}» al posto del
   *   prodotto: un difetto che leggendo il codice non si vede e sul foglio
   *   consegnato al cliente si vede benissimo. */
  const consegnaEPagamento = `<div class="sezione">
      <h2>Cosa hai ricevuto</h2>
      ${riga("Impianto", d.prodotto)}
    </div>

    <div class="sezione">
      <h2>Il pagamento</h2>
      ${blocchoPagamento(d)}
    </div>`;

  const copertura =
    d.emette !== "riepilogo"
      ? `
  <section class="cert">
    <div class="cert-testa">
      <span class="cert-tag">Certificato di copertura</span>
      <span class="cert-durata">${d.coperturaMesi} mesi dalla consegna</span>
    </div>
    <div class="cert-id">
      <span class="cert-et">ID impianto</span>
      <span class="cert-cod">${esc(d.idImpianto)}</span>
      <span class="cert-no">la garanzia vale per questo impianto, e solo per quello</span>
    </div>
    <p class="cert-frase">
      Se l&rsquo;impianto <strong>${esc(d.idImpianto)}</strong> presenta un problema, ce ne occupiamo noi: lo
      <strong>rigeneriamo</strong> riportandolo alle condizioni del primo giorno &mdash; base,
      densità e colore &mdash; oppure, se non è recuperabile, lo
      <strong>sostituiamo</strong> con uno nuovo ricostruito sul tuo caso.
    </p>
    <div class="cert-griglia">
      <div>
        <span class="cert-et">Un intervento</span>
        <span class="cert-va">${esc(euroFoglio(d.coperturaImporto))}</span>
        <span class="cert-no">rigenerazione oppure sostituzione</span>
      </div>
      <div>
        <span class="cert-et">Entro</span>
        <span class="cert-va">${d.coperturaMesi} mesi</span>
        <span class="cert-no">dalla data di consegna qui sopra</span>
      </div>
    </div>
    <p class="cert-piede">
      Per altri interventi nello stesso periodo si ripaga l&rsquo;importo. Per attivare la garanzia
      chiama il centro e comunica l&rsquo;ID: è da quel codice che riconosciamo il tuo impianto.
    </p>
  </section>`
      : "";

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Riepilogo di consegna — ${esc(d.cliente)}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#111827;background:#f3f4f6;padding:28px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .foglio{max-width:760px;margin:0 auto;padding-bottom:10px;background:#fff;
    border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
  /* il filetto in alto: l'unico pieno di colore del foglio */
  .filetto{height:5px;background:#0f90fe}
  .testa{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:22px 26px 18px}
  .marchio img{height:34px;width:auto;object-fit:contain;display:block}
  /* Il nome per esteso al posto del logo: più grande e più spaziato di
     quanto sarebbe una didascalia, perché QUI fa la parte del marchio. */
  .marchio .nome{font-size:18px;font-weight:800;letter-spacing:.04em}
  .marchio .sotto{margin-top:3px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0b57a4;font-weight:700}
  .titolo{text-align:right}
  .titolo h1{margin:0;font-size:18px;font-weight:700;letter-spacing:-.2px}
  .titolo .data{margin-top:3px;font-size:12.5px;color:#6b7280}
  .sezione{border-top:1px solid #eef0f2;padding:16px 26px}
  .sezione h2{margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6b7280}
  .riga{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:5px 0;font-size:14px}
  .riga .et{color:#6b7280}
  .riga .va{font-weight:600;text-align:right}
  /* la riga che conta: piu' grande, e staccata da un filetto pieno.
     ⚠️ NON è verde, ed è l'unico punto in cui il colore del marchio va evitato:
     questa riga compare SOLO quando resta qualcosa da versare, e in questo
     foglio il verde vuol dire «saldato» — lo dice il bollo qui sotto. Una cifra
     ancora dovuta scritta con il colore del pagato si legge come un pagamento
     in più, che è il fraintendimento più caro possibile su una ricevuta. */
  .riga.forte{margin-top:8px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:16px}
  .riga.forte .et{color:#111827;font-weight:600}
  .riga.forte .va{font-size:20px;font-weight:800;color:#b45309}
  .saldato{display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:7px 12px;border:1px solid #a7e3c8;background:#eefaf4;border-radius:999px;font-size:13px;font-weight:700;color:#0b7a53}
  .saldato .bollo{width:15px;height:15px;border-radius:999px;background:#0f9d6b;color:#fff;font-size:10px;line-height:15px;text-align:center;font-weight:800}
  /* il certificato: cornice sottile, niente riempimenti, si legge anche stampato in grigio */
  /*  ⚠️ IL VERDE RESTA SOLO DOVE SIGNIFICA «PAGATO» (il bollo .saldato qui
      sopra). Filetto, soprascritta e certificato sono il MARCHIO, e il marchio
      di questa casa è l'azzurro del sito: un documento con due colori diversi
      da quelli che il cliente ha già visto sembra emesso da un altro. */
  .cert{margin:0 26px 22px;border:1.5px solid #0f90fe;border-radius:12px;padding:16px 18px}
  .cert-testa{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:1px solid #d7f0e4;padding-bottom:10px}
  .cert-tag{font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#0b57a4}
  .cert-durata{font-size:12.5px;color:#6b7280}
  /* il codice sta subito sotto l'intestazione: è il primo dato che serve
     quando il cliente ritorna, e in fondo alla sezione si perderebbe */
  .cert-id{margin-top:11px;padding:9px 12px;border-radius:9px;
    border:1px solid #cfe4ff;background:#f2f8ff}
  .cert-cod{display:block;margin-top:2px;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:19px;font-weight:700;letter-spacing:.07em;color:#0b3a63;word-break:break-all}
  .cert-frase{margin:12px 0 0;font-size:13.5px;line-height:1.6;color:#374151}
  .cert-griglia{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}
  .cert-griglia>div{flex:1 1 190px;border:1px solid #e5e7eb;border-radius:9px;padding:10px 12px}
  .cert-et{display:block;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}
  .cert-va{display:block;margin-top:3px;font-size:19px;font-weight:800;letter-spacing:-.3px}
  .cert-no{display:block;margin-top:2px;font-size:11.5px;color:#6b7280}
  .cert-piede{margin:12px 0 0;font-size:12px;line-height:1.55;color:#6b7280}
  @media print{
    body{background:#fff;padding:14mm}
    .foglio{border:0;border-radius:0;max-width:none}
    /* ── ⚠️ MARGINE ZERO, E LO SPAZIO SE LO PRENDE IL FOGLIO ────────────
       Con un margine di pagina diverso da zero Chrome ci scrive dentro la
       sua intestazione: in alto la data, in basso a sinistra «about:blank»
       e a destra «1/1». Su un documento che si manda al cliente è una
       scritta che non c'entra niente e che sembra un errore.
       Non è un'opzione da spegnere nel codice: si toglie soltanto
       lasciando i margini a zero, cioè togliendo lo spazio in cui verrebbe
       scritta. Il bianco attorno al foglio non si perde — se lo prende il
       corpo con il suo padding, che è la stessa distanza di prima.
       ⚠️ Resta una casella «Intestazioni e piè di pagina» sotto «Altre
        impostazioni» nella finestra di stampa: se qualcuno la accende a
        mano, Chrome le rimette. Da qui non si può impedire. */
    @page{margin:0}
  }

</style></head><body>
  <div class="foglio">
    <div class="filetto"></div>
    <div class="testa">
      <div class="marchio">
        <!-- ⚠️ QUI IL LOGO NON CI VA, per scelta del committente: sul
             riepilogo di consegna il marchio è scritto per esteso. Il
             certificato di copertura invece il logo ce l'ha, e va lasciato —
             sono due documenti con due usi diversi. Chi rimette l'immagine
             qui la toglie di nuovo alla segnalazione successiva. -->
        <div class="nome">HAIR GENIUS LABS</div>
        <div class="sotto">Riepilogo di consegna</div>
      </div>
      <div class="titolo">
        <h1>${esc(d.cliente)}</h1>
        <div class="data">${d.giorno ? `Consegnato il ${esc(d.giorno)}` : "Consegna registrata"}</div>
      </div>
    </div>

    ${consegnaEPagamento}

    ${copertura}
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}${CHIUDI_SCRIPT}
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL PULSANTE E LA SUA FINESTRA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL PULSANTE ──────────────────────────────────────────────────────────
 *  Compare SOLO su una posa completata, ed è la stessa regola di
 *  «Manutenzione» che gli sta accanto: prima della consegna non c'è niente da
 *  riepilogare, e un foglio che dice «consegnato» stampato il giorno prima è
 *  un foglio che smentisce sé stesso.
 *
 *  ⚠️ SI APRE UNA FINESTRA, non si stampa al primo tocco. Due cose vanno decise
 *   ogni volta — quanto costerà un intervento e se il certificato serve — e
 *   soprattutto quell'importo si SCRIVE sulla pratica: un tocco che salva un
 *   dato e apre una finestra di stampa senza chiedere niente è un tocco che si
 *   preme per sbaglio una volta al giorno. */
export function TastoRicevuta({
  lead,
  esteso,
  className,
}: {
  lead: Lead;
  /** true = il pulsante porta anche la parola. Lo accende chi ha spazio sulla
   *  riga; dove i comandi sono già quattro resta la sola icona. */
  esteso?: boolean;
  className?: string;
}) {
  const { updateLead } = useCRM();
  const [aperta, setAperta] = useState(false);
  const [testo, setTesto] = useState("");
  /** ── COSA SI STAMPA ────────────────────────────────────────────────────
   *  Richiesta del committente: tre documenti dalla stessa finestra.
   *  ⚠️ Era un interruttore «includi il certificato», cioè due possibilità su
   *   tre: mancava proprio quella che serve di più — il certificato DA SOLO, da
   *   mandare al cliente mesi dopo quando chiede «e se si rovina?». */
  const [emette, setEmette] = useState<"tutto" | "riepilogo" | "certificato">("tutto");
  /** ── COME L'IVA VA STAMPATA SU QUESTO FOGLIO ───────────────────────────
   *  Si apre su quello che dice la pratica e si può cambiare: il foglio lo
   *  stampa una persona che ha davanti il cliente e sa com'era stato pattuito,
   *  e a volte l'archivio quella cosa non ce l'ha (schede importate, pratiche
   *  vecchie). ⚠️ Cambiando qui NON si riscrive la pratica: questa è una scelta
   *  di come si presenta un documento, non una correzione di cassa — quella si
   *  fa dove i soldi si registrano, e lì c'è già la stessa domanda. */
  const [iva, setIva] = useState<"inclusa" | "aggiunta" | "nessuna">("inclusa");
  const [logo, setLogo] = useState("");
  const [inCorso, setInCorso] = useState(false);

  //  ⚠️ Tutti gli hook sopra l'uscita anticipata: questo componente sta su ogni
  //  riga di un elenco che si ridisegna in continuazione, e un hook sotto un
  //  `return null` cambierebbe il numero di hook fra due disegni della stessa
  //  riga — schermata bianca, non un errore leggibile.
  const salvato = Number(lead.data.installazione?.coperturaImporto) || 0;
  /*  Il listino di chi sta usando il CRM: da lì arrivano l'importo e i mesi
      della copertura, gli stessi che legge il preventivo. Si chiede
      all'apertura della finestra e non al caricamento della pagina: è una
      finestra che si apre poche volte al giorno. */
  const [listino, setListino] = useState<PricingOverrides>({});
  useEffect(() => {
    if (!aperta) return;
    let vivo = true;
    fetch("/api/presenter/pricing")
      .then((r) => r.json())
      .then((j) => { if (vivo) setListino(((j as { pricing?: PricingOverrides })?.pricing ?? {}) as PricingOverrides); })
      .catch(() => { /* vale il ripiego: mai una finestra senza cifra */ });
    return () => { vivo = false; };
  }, [aperta]);
  const copertura = useMemo(() => manutenzioneDi(listino), [listino]);
  /*  ⚠️ Chi ha scritto a mano non si sovrascrive. Il listino arriva DOPO
      l'apertura della finestra, e senza questa guardia una cifra digitata
      mentre la risposta era per strada veniva cancellata sotto le dita. */
  const toccato = useRef(false);
  /** ── DA DOVE VIENE IL CODICE DELL'IMPIANTO, IN QUEST'ORDINE ────────────
   *  1. quello già scritto sulla pratica — VINCE SEMPRE, anche sul preventivo:
   *     è quello stampato sul foglio che il cliente ha in mano;
   *  2. il ref del preventivo, se la pratica ne ha uno;
   *  3. un codice nuovo.
   *  ⚠️ L'ORDINE NON SI GIRA. Mettendo il preventivo davanti, una pratica il
   *   cui preventivo viene rifatto (e il ref cambia) stamperebbe la seconda
   *   copia del certificato con un codice diverso dalla prima. Due certificati
   *   con due numeri per lo stesso impianto è esattamente ciò che un
   *   certificato deve impedire.
   *  ⚠️ Si conia QUI e non dentro `stampa` perché il codice si vede anche nella
   *   finestra prima di stampare: calcolarlo due volte vorrebbe dire mostrarne
   *   uno e stamparne un altro. `useMemo` sulla pratica: finché è la stessa,
   *   è lo stesso codice. */
  const idImpianto = useMemo(
    () =>
      String(lead.data.installazione?.idImpianto ?? "").trim() ||
      String(lead.data.quoteRef ?? "").trim() ||
      nuovoIdImpianto(),
    [lead.data.installazione?.idImpianto, lead.data.quoteRef],
  );

  useEffect(() => {
    if (!aperta) return;
    //  Riaprendo si riparte da quello che è SCRITTO sulla pratica, e solo se non
    //  c'è niente dal listino di oggi: è la promessa fatta a quel cliente, non
    //  il prezzo di adesso.
    toccato.current = false;
    setTesto(scriviEuro(salvato > 0 ? salvato : MAINTENANCE.price));
    setEmette("tutto");
    setIva(ivaDellaPratica(lead));
    setInCorso(false);
  }, [aperta, salvato, lead]);

  useEffect(() => {
    //  Arrivato il listino: la cifra di partenza è la sua, non quella scritta
    //  nel codice. Solo se su questa pratica non c'è già una promessa fatta
    //  (`salvato`) e solo se non l'ha toccata nessuno.
    if (!aperta || toccato.current || salvato > 0) return;
    setTesto(scriviEuro(copertura.price));
  }, [aperta, salvato, copertura.price]);

  useEffect(() => {
    //  Il marchio si legge dalla stessa fonte del logo dell'app (shop/BrandLogo)
    //  e non da un file scritto qui: cambiando il logo dalle impostazioni cambia
    //  anche il foglio, senza che nessuno debba ricordarsi di passare di qui.
    //  Se non risponde, il foglio esce con il nome scritto: mai un'immagine rotta.
    if (!aperta || logo) return;
    fetch("/api/presenter/brand")
      .then((r) => r.json())
      .then((j) => setLogo(String(j?.logoUrl || "")))
      .catch(() => setLogo(""));
  }, [aperta, logo]);

  if (!posaCompletata(lead)) return null;

  const importo = Math.max(0, leggiEuro(testo));
  const totale = prezzoVendita(lead);
  //  Gli stessi due conti che farà il foglio (`blocchoPagamento`), qui per
  //  mostrarli PRIMA di stampare: è l'ultimo momento in cui una cifra sbagliata
  //  si corregge senza doverla spiegare a chi ha già il foglio in mano.
  const impostaFoglio = Math.round(totale * ALIQUOTA_IVA) / 100;
  const conIvaFoglio = Math.round((totale + impostaFoglio) * 100) / 100;
  const versato = giaIncassato(lead);
  const resta = saldoAllaConsegna(lead);

  const stampa = async () => {
    if (inCorso) return;
    setInCorso(true);
    //  ⚠️ LA FINESTRA SI APRE PRIMA DEL SALVATAGGIO. `window.open` chiamata dopo
    //   un `await` non è più figlia del clic, e ogni browser la blocca come
    //   finestra a comparsa: il tocco sembra non fare niente, e l'unico segno è
    //   un'iconcina nella barra dell'indirizzo che nessuno guarda.
    const w = window.open("", "_blank");
    if (!w) {
      setInCorso(false);
      toast.error("Il browser ha bloccato la finestra di stampa", {
        description: "Consenti le finestre a comparsa per questo sito e riprova.",
      });
      return;
    }

    //  L'importo si scrive sulla pratica solo se è cambiato: ristampare lo stesso
    //  foglio dieci volte non deve lasciare dieci salvataggi in archivio.
    //  ⚠️ E INSIEME A LUI IL CODICE DELL'IMPIANTO, alla prima stampa: da quel
    //   momento il certificato uscirà sempre con quel numero, anche se il
    //   preventivo verrà rifatto. Una scrittura sola per tutti e due — due
    //   salvataggi di fila sulla stessa pratica si sovrascrivono a vicenda.
    const daCongelare = String(lead.data.installazione?.idImpianto ?? "").trim() ? "" : idImpianto;
    if ((importo > 0 && importo !== salvato) || daCongelare) {
      const inst: InstallazioneInfo = {
        ...(lead.data.installazione ?? {}),
        ...(importo > 0 ? { coperturaImporto: importo } : {}),
        ...(daCongelare ? { idImpianto: daCongelare } : {}),
      };
      //  ⚠️ Se il salvataggio non riesce il foglio si stampa LO STESSO, con la
      //   cifra che si vede a schermo: chi ha il cliente davanti e la mano sulla
      //   stampante non deve restare senza documento per un problema di rete. La
      //   differenza la si dice, però — altrimenti la ristampa di domani uscirà
      //   con un'altra cifra e nessuno saprà perché.
      const ok = await updateLead(lead.id, { installazione: inst });
      if (!ok) {
        toast.error("L'importo della copertura NON è stato salvato", {
          description:
            "Il foglio esce con la cifra che vedi, ma ristampandolo tornerà quella di prima.",
        });
      }
    }

    const d: DatiRicevuta = {
      cliente: nomeCompleto(lead),
      //  ⚠️ NON `payment.prodotto`, che nei dati veri contiene gli appunti
      //   della consulenza — misure, età, mestiere, a volte uno stato di
      //   salute. Questo foglio si consegna stampato e si inoltra: è la riga
      //   che dice COSA ha ricevuto, non il taccuino di chi ha venduto.
      //   Stessa correzione fatta sulla fattura (crm/fatture/FinestraFattura) e
      //   sull'evento mandato a Meta (crm/CRMContext).
      prodotto: "Invisible Derm Protocol",
      giorno: dataLunga(giornoConsegna(lead) || giornoISO()),
      totale,
      versato,
      resta,
      iva,
      aliquota: ALIQUOTA_IVA,
      logo,
      idImpianto,
      emette,
      coperturaImporto: importo,
      coperturaMesi: copertura.everyMonths,
    };
    w.document.write(costruisciRiepilogo(d));
    w.document.close();
    setAperta(false);
    setInCorso(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAperta(true)}
        title="Riepilogo di consegna da stampare o salvare in PDF"
        aria-label={`Riepilogo di consegna per ${nomeCompleto(lead)}`}
        className={cn("h-7 shrink-0", esteso ? "px-2 text-[11.5px]" : "w-7 p-0", className)}
      >
        <FileText className={cn("h-3.5 w-3.5", esteso && "mr-1")} />
        {esteso && "Riepilogo"}
      </Button>

      <Finestra
        aperta={aperta}
        onCambio={setAperta}
        larghezza="sm"
        icona={FileText}
        titolo="Riepilogo di consegna"
        contesto={`${nomeCompleto(lead)} · ${resta > 0 ? `${eur(resta)} ancora da versare` : "saldato per intero"}`}
        classeCorpo="space-y-3"
      >
        {/*  I tre numeri che finiranno stampati, prima di stampare: è l'ultimo
            momento in cui un totale sbagliato si corregge senza doverlo
            spiegare a chi ha già il foglio in mano. */}
        <div className="grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Totale" valore={eur(totale)} />
          <KpiFinestra etichetta="Versato" valore={eur(versato)} forte />
          <KpiFinestra
            etichetta="Resta"
            valore={eur(resta)}
            nota={resta > 0 ? "in attesa" : "niente"}
          />
        </div>

        {/* ── COME VA L'IVA SU QUESTO FOGLIO ────────────────────────────
            Richiesta del committente, e la differenza fra le due non è di
            stile: la prima non nomina l'IVA affatto, la seconda alza la cifra
            che il cliente deve.
            ⚠️ SI VEDONO LE CIFRE, NON I NOMI DELLE OPZIONI. «IVA esclusa»
             costringerebbe a moltiplicare a mente 650 per 1,22 mentre il
             cliente aspetta, e a mente si sbaglia: ogni riquadro porta il
             totale che finirà stampato. */}
        <SezioneFinestra
          titolo="L'IVA su questo foglio"
          nota={
            iva === "aggiunta"
              ? "Il foglio la scompone e chiede il totale con IVA"
              : "Il foglio non la nomina: si legge solo il totale"
          }
          classeCorpo="p-3 space-y-2"
        >
          <VoceScelta
            icona={Wallet}
            titolo="Il prezzo comprende già l'IVA"
            nota={`Sul foglio si legge ${eur(totale)}, senza nessuna riga sull'IVA`}
            selezionata={iva !== "aggiunta"}
            //  ⚠️ Tornando indietro si rimette quello che dice la PRATICA, non
            //   un "inclusa" fisso: fra «inclusa» e «nessuna» il documento non
            //   cambia di una virgola, ma la pratica le distingue — e ripremere
            //   due volte non deve riscrivere in silenzio come era stata
            //   venduta.
            onClick={() =>
              setIva(ivaDellaPratica(lead) === "aggiunta" ? "inclusa" : ivaDellaPratica(lead))
            }
          />
          <VoceScelta
            icona={Percent}
            titolo={`IVA ${ALIQUOTA_IVA}% da aggiungere`}
            nota={`Imponibile ${eur(totale)} + ${eur(impostaFoglio)} · sul foglio si chiede ${eur(conIvaFoglio)}`}
            selezionata={iva === "aggiunta"}
            onClick={() => setIva("aggiunta")}
          />
          {iva === "aggiunta" && (
            //  L'unico avviso in ambra della finestra, e compare solo quando il
            //  foglio sta per chiedere più di quanto risulta in cassa: è la
            //  differenza che, non detta qui, si scopre al telefono col cliente.
            <p className="text-[11.5px] leading-snug text-amber-700">
              Il foglio chiederà <span className="font-semibold">{eur(conIvaFoglio)}</span>, cioè{" "}
              {eur(impostaFoglio)} in più del totale sulla pratica. Se non è così, l&apos;IVA si
              corregge dove si registrano i soldi.
            </p>
          )}
        </SezioneFinestra>

        {/* ── COSA SI STAMPA ────────────────────────────────────────────
            ⚠️ ERA UN INTERRUTTORE «includi il certificato», cioè due
             possibilità su tre: mancava proprio quella che serve di più — il
             certificato DA SOLO, da mandare al cliente mesi dopo la consegna
             quando chiede «e se si rovina?». Con l'interruttore, per averlo
             bisognava mandargli anche quanto aveva pagato. */}
        <SezioneFinestra
          titolo="Cosa stampi"
          nota={`Il certificato copre ${copertura.everyMonths} mesi: rigenerazione o sostituzione`}
          classeCorpo="p-3 space-y-2"
        >
          <VoceScelta
            icona={FileText}
            titolo="Riepilogo e certificato"
            nota="Un foglio solo: consegna, pagamento e la copertura in fondo"
            selezionata={emette === "tutto"}
            onClick={() => setEmette("tutto")}
          />
          <VoceScelta
            icona={Wallet}
            titolo="Solo il riepilogo"
            nota="Cosa ha ricevuto e quanto ha versato, senza la copertura"
            selezionata={emette === "riepilogo"}
            onClick={() => setEmette("riepilogo")}
          />
          <VoceScelta
            icona={ShieldCheck}
            titolo="Solo il certificato"
            //  ⚠️ Si dice la FORMA, non solo il contenuto: chi lo sceglie sta per
            //   ottenere un foglio verticale da telefono, non un A4, e se non se
            //   lo aspetta pensa che la stampa sia venuta storta.
            nota="In formato 9:16, da mandare al cliente. Senza gli importi pagati"
            selezionata={emette === "certificato"}
            onClick={() => setEmette("certificato")}
          />

          {emette !== "riepilogo" && (
            <label className="block space-y-1">
              <span className="block text-[12px] font-medium text-slate-900">
                Quanto costerà un intervento
              </span>
              <span className="flex items-center gap-2">
                <Percent className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="text-[15px] font-semibold text-slate-500">€</span>
                {/*  Campo di TESTO, non "number": in italiano si scrive 450,00 e
                    un campo numerico rifiuta la virgola. Legge `leggiEuro`, la
                    stessa di tutti gli importi del CRM. */}
                <Input
                  value={testo}
                  onChange={(e) => { toccato.current = true; setTesto(e.target.value); }}
                  inputMode="decimal"
                  aria-label="Importo della copertura in euro"
                  placeholder="0,00"
                  className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[15px] font-semibold tabular-nums")}
                />
              </span>
              <span className="block text-[11px] leading-snug text-slate-500">
                {salvato > 0
                  ? `Su questa pratica era già stato scritto ${eur(salvato)}: cambiandolo, le prossime copie usciranno con la cifra nuova.`
                  : `Proposto il prezzo di listino. Resta scritto su questa pratica, così una seconda copia non esce con un'altra cifra.`}
              </span>
            </label>
          )}
        </SezioneFinestra>

        <Button
          type="button"
          onClick={() => void stampa()}
          disabled={inCorso || (emette !== "riepilogo" && importo <= 0)}
          className="h-10 w-full text-[13.5px]"
        >
          <FileText className="mr-1.5 h-4 w-4" />
          {emette === "certificato" ? "Apri il certificato" : "Apri il foglio da stampare"}
        </Button>

        <NotaFinestra>
          Si apre in una finestra nuova, già pronta per la stampa: da lì si sceglie la stampante
          oppure <strong>«Salva come PDF»</strong> per mandarlo su WhatsApp.
          {emette === "certificato" && (
            <>
              {" "}
              ⚠️ Il certificato esce in <strong>9:16</strong>: se la stampante propone A4, nella
              finestra di stampa scegli «dimensioni originali» o salvalo in PDF.
            </>
          )}
        </NotaFinestra>
      </Finestra>
    </>
  );
}
