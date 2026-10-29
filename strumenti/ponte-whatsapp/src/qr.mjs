/** ── PONTE WHATSAPP · IL QR E LE NOTIFICHE SUL MAC ──────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T6 (PIANO §a3, D12).
 *  Il QR vale come la password dell'account finché non è inquadrato: NON
 *  lascia mai il Mac. Va in `qr.png` (permessi 600, scrittura atomica), si
 *  apre con `open` (Anteprima), una notifica macOS avvisa il titolare e, se
 *  il ponte gira in un terminale, si disegna anche lì. Al CRM va solo lo
 *  stato in parole (`attesa_qr`).
 *
 *  ⚠️ Le notifiche sono testi fissi (`NOTIFICHE`), passati a `osascript` come
 *   argomenti (mai dentro lo script): niente dati, niente iniezioni.
 *  ⚠️ `open` e la notifica partono solo al primo codice di un collegamento:
 *   WhatsApp rinnova il codice ogni ~20 s e Anteprima ricarica il file da sé.
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFile } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";

const TITOLO = "Ponte WhatsApp HGL";

/** Le frasi delle notifiche, per stato (parole di `STATI_PONTE`). */
export const NOTIFICHE = {
  attesa_qr: "Inquadra il codice con WhatsApp Business: Impostazioni, Dispositivi collegati, Collega un dispositivo.",
  sessione_scaduta: "WhatsApp ha scollegato il ponte: tra poco si apre un codice nuovo da inquadrare.",
  sostituita: "Il ponte è stato aperto da un'altra parte: riprovo da solo fra 10 minuti.",
  errore: "WhatsApp rifiuta il collegamento del ponte: riprovo da solo fra 30 minuti.",
  config: "Il ponte WhatsApp non parte: manca o è sbagliato config.env (rilancia installa.sh).",
  node: "Il ponte WhatsApp non parte: serve Node 22 o 24 (rilancia installa.sh).",
};

/** Il PNG del codice, 480 px (`qrcode` si carica solo quando serve). */
async function pngDiSerie(testo) {
  const { default: qrcode } = await import("qrcode");
  return qrcode.toBuffer(testo, { width: 480, margin: 2 });
}

/** Il codice disegnato a caratteri, per il terminale. */
async function terminaleDiSerie(testo) {
  const { default: qrcode } = await import("qrcode");
  return qrcode.toString(testo, { type: "terminal", small: true });
}

/** Un comando di sistema con un tempo massimo; non scrive niente a video. */
function eseguiDiSerie(comando, argomenti) {
  return new Promise((ok, ko) => {
    execFile(comando, argomenti, { timeout: 10_000, stdio: "ignore" }, (errore) => (errore ? ko(errore) : ok()));
  });
}

/** Il QR del ponte.
 *  `opzioni`: `percorso` di `qr.png`; `terminale(testo)` per scrivere a
 *  video, solo se il ponte gira in un terminale (altrimenti null); `registro`
 *  per i codici; `generaPng`, `disegnaTerminale`, `esegui` li sostituiscono
 *  le prove. Uscita: `{ mostra(codice), togli(), notifica(stato) }`. */
export function creaQr({ percorso, terminale = null, registro = () => {}, generaPng = pngDiSerie, disegnaTerminale = terminaleDiSerie, esegui = eseguiDiSerie }) {
  let aperto = false;

  async function notifica(stato) {
    const testo = NOTIFICHE[stato];
    if (!testo) return;
    try {
      await esegui("osascript", ["-e", "on run argv", "-e", "display notification (item 1 of argv) with title (item 2 of argv)", "-e", "end run", testo, TITOLO]);
    } catch {
      registro("notifica_fallita");
    }
  }

  async function mostra(codice) {
    try {
      const png = await generaPng(codice);
      const temporaneo = `${percorso}.tmp-${process.pid}`;
      writeFileSync(temporaneo, png, { mode: 0o600 });
      renameSync(temporaneo, percorso);
    } catch {
      registro("qr_non_scritto");
      return;
    }
    registro("qr_nuovo");
    if (terminale) {
      try {
        terminale(`\n${await disegnaTerminale(codice)}\n${NOTIFICHE.attesa_qr}\n`);
      } catch {
        registro("qr_terminale_fallito");
      }
    }
    if (aperto) return;
    aperto = true;
    try {
      await esegui("open", [percorso]);
    } catch {
      registro("qr_open_fallito");
    }
    await notifica("attesa_qr");
  }

  function togli() {
    aperto = false;
    rmSync(percorso, { force: true });
  }

  return { mostra, togli, notifica };
}
