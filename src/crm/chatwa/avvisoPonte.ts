/** ── L'AVVISO «IL PONTE È FERMO»: LA REGOLA, SENZA SCHERMO ──────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T8 (SPEC 8).
 *  Trasforma la riga di `ponte_wa_stato` e l'ora di adesso in «mostra o no, con
 *  quale gravità, con quale frase». Pura: nessun database, nessun orologio
 *  (l'ora arriva da fuori, così la prova la controlla).
 *
 *  REGOLE
 *   · Riga assente (`null`) → niente: il CRM di chi non ha il ponte resta quello
 *     di oggi. Anche una riga illeggibile (data non valida) non mostra niente:
 *     un avviso sbagliato è peggio di nessun avviso.
 *   · Battito più vecchio di 3 minuti → «non risponde», qualunque cosa dica
 *     `stato` (l'ultimo stato scritto può essere vecchio: Mac spento). Lo
 *     decide la lettura, non il server (PIANO §b3).
 *   · Orologio indietro (il battito sembra del futuro, per colpa dell'ora del
 *     Mac o del telefono): si considera fresco, non fermo.
 *   · `collegato` con battito fresco → niente, salvo lo storico ancora in
 *     arrivo (informativa discreta).
 *   · Le frasi sono per il titolare: mai QR, Baileys, token, JID, sessione,
 *     battito (le blocca la prova).
 *  Nessun dato dei clienti: la riga non ne contiene. */
import { STATI_PONTE, type StatoPonteWa } from "../ponte/tipi";

/** Oltre questo silenzio il ponte si considera fermo. */
export const SOGLIA_BATTITO_MS = 3 * 60_000;

/** Le colonne che la lettura chiede (un sottoinsieme di `ponte_wa_stato`). */
export interface RigaStatoPonte {
  stato: string;
  /** ISO 8601 dell'ultimo battito */
  aggiornato_il: string;
  /** numeri ripuliti dal server: `fatto` 0/1 e `avanzamento` 0-100 */
  storico?: Record<string, number> | null;
}

export type GravitaPonte = "nessuna" | "info" | "attenzione" | "grave";

export interface AvvisoPonte {
  mostra: boolean;
  gravita: GravitaPonte;
  frase: string;
}

const NIENTE: AvvisoPonte = { mostra: false, gravita: "nessuna", frase: "" };

/** «12 minuti», «2 ore», «3 giorni»: come lo direbbe una persona. */
export function durata(ms: number): string {
  const minuti = Math.max(1, Math.floor(ms / 60_000));
  if (minuti < 60) return `${minuti} ${minuti === 1 ? "minuto" : "minuti"}`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? "ora" : "ore"}`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? "giorno" : "giorni"}`;
}

const eStatoNoto = (s: string): s is StatoPonteWa => (STATI_PONTE as readonly string[]).includes(s);

/** Cosa mostrare, data la riga letta (o `null`) e l'ora di adesso. */
export function avvisoPonte(riga: RigaStatoPonte | null, adesso: Date): AvvisoPonte {
  if (!riga) return NIENTE;
  const battito = Date.parse(riga.aggiornato_il);
  const ora = adesso.getTime();
  if (!Number.isFinite(battito) || !Number.isFinite(ora)) return NIENTE;

  const silenzio = ora - battito;
  if (silenzio > SOGLIA_BATTITO_MS) {
    return {
      mostra: true,
      gravita: "grave",
      frase: `Il ponte con WhatsApp non risponde da ${durata(silenzio)}: i messaggi scritti dal telefono non arrivano qui. Controlla che il Mac sia acceso.`,
    };
  }

  //  Uno stato fuori lista (non dovrebbe: il server lo riduce a `errore`) si legge come errore.
  const stato: StatoPonteWa = eStatoNoto(riga.stato) ? riga.stato : "errore";
  switch (stato) {
    case "collegato": {
      const s = riga.storico;
      const avanzamento = s && Number.isFinite(s.avanzamento) ? Math.floor(s.avanzamento) : null;
      //  Solo se il server ha scritto `fatto: 0` e un avanzamento sotto il 100.
      if (s && s.fatto === 0 && avanzamento !== null && avanzamento < 100) {
        const percento = Math.max(0, avanzamento);
        return {
          mostra: true,
          gravita: "info",
          frase: `Il ponte è collegato ma lo storico è ancora in arrivo (${percento}%).`,
        };
      }
      return NIENTE;
    }
    case "attesa_qr":
    case "sessione_scaduta":
      return {
        mostra: true,
        gravita: "grave",
        frase:
          "WhatsApp ha scollegato il ponte: sul Mac c'è un codice da inquadrare. Sul telefono apri WhatsApp Business, vai in Dispositivi collegati, scegli Collega un dispositivo e inquadra il codice.",
      };
    case "in_collegamento":
      return {
        mostra: true,
        gravita: "attenzione",
        frase:
          "Il ponte si sta collegando a WhatsApp. Se dura più di qualche minuto, controlla il Mac.",
      };
    case "sostituita":
      return {
        mostra: true,
        gravita: "attenzione",
        frase:
          "WhatsApp è stato collegato altrove e il ponte aspetta prima di riprovare. Se non riparte da solo, controlla i Dispositivi collegati sul telefono.",
      };
    case "rete_assente":
      return {
        mostra: true,
        gravita: "attenzione",
        frase: "Il Mac non ha internet: il ponte riparte da solo appena torna la connessione.",
      };
    case "coda_piena":
      return {
        mostra: true,
        gravita: "info",
        frase:
          "Il ponte ha molto lavoro arretrato: i messaggi nuovi arrivano, lo storico va più piano.",
      };
    case "fermo":
      return {
        mostra: true,
        gravita: "grave",
        frase:
          "Il ponte è fermo: i messaggi scritti dal telefono non arrivano qui. Riaprilo dal Mac.",
      };
    case "errore":
      return {
        mostra: true,
        gravita: "grave",
        frase:
          "Il ponte ha un problema: i messaggi scritti dal telefono potrebbero non arrivare qui. Riaprilo dal Mac.",
      };
  }
}
