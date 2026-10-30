/** ── IL CONTROLLO DELLA NOTTE DEL GIRO WHATSAPP: LE REGOLE ──────────────────
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p8, punti (20) e (9).
 *  Ogni mattina (pg_cron, migrazione `p8_controllo_notte`) la rotta
 *  /hooks/controllo-notte legge come è andato il giro WhatsApp e lascia al
 *  titolare UNA notifica nel CRM; se c'è qualcosa da guardare anche una push.
 *  Il lunedì lo stesso giro guarda la settimana intera (il controllo
 *  settimanale). Senza numero di prova: si legge solo quello che è successo.
 *
 *  Qui le regole, pure (l'ora arriva da fuori, così la prova la controlla).
 *  ⚠️ Nessun dato dei clienti: solo conteggi e codici. Le frasi sono per il
 *   titolare: niente parole tecniche (le blocca la prova).
 *  Prove in `prove/manychat/controllo-notte.mjs`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { aRoma } from "../promemoria/formati";
import { anteprimaSenzaTesto } from "../chatwa/entrata-vera";
import { avvisoPonte, type RigaStatoPonte } from "../chatwa/avvisoPonte";
import type { AvvisoPush } from "../push/avviso";

const ORA_MS = 3_600_000;
const GIORNO_MS = 24 * ORA_MS;

export type Periodo = "notte" | "settimana";
export interface Giro {
  /** il giorno di Roma, `YYYY-MM-DD` */
  giorno: string;
  periodo: Periodo;
}

/** Che giro è: il lunedì (a Roma) guarda la settimana, gli altri giorni la notte. */
export function giroDi(adesso: Date): Giro {
  const { giorno } = aRoma(adesso);
  const lunedi = new Date(`${giorno}T12:00:00Z`).getUTCDay() === 1;
  return { giorno, periodo: lunedi ? "settimana" : "notte" };
}

/** Da quando si contano invii falliti e finestre chiuse. */
export const inizioPeriodo = (adesso: Date, periodo: Periodo) =>
  new Date(adesso.getTime() - (periodo === "settimana" ? 7 : 1) * GIORNO_MS);

/** Da quando la pulizia cerca eco e doppioni: il periodo più un giorno di
 *  margine (un messaggio arrivato mentre girava il controllo di ieri). MAI lo
 *  storico intero: quello lo pulisce il titolare a mano, dopo aver letto
 *  l'elenco (ECO-MANYCHAT-pulizia-PROPOSTA.sql). */
export const inizioPulizia = (adesso: Date, periodo: Periodo) =>
  new Date(inizioPeriodo(adesso, periodo).getTime() - GIORNO_MS);

/** Una notifica per giorno e per giro: se il cron parte due volte, la seconda
 *  trova la chiave già presa e non manda un'altra push. */
export const chiaveNotifica = (g: Giro) => `controllo-whatsapp:${g.periodo}:${g.giorno}`;

// ── Gli invii automatici (manychat_invii) ────────────────────────────────────

export interface ContoInvii {
  falliti: number;
  incerti: number;
  /** solo i falliti, per motivo (codice) */
  perMotivo: Record<string, number>;
}

/** Il motivo è un codice del giro (`modello_rifiutato`…): quello che non lo
 *  sembra diventa «altro», così un testo con dentro un dato non esce mai. */
const codice = (m: unknown) =>
  typeof m === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(m) ? m : "altro";

export function contaInvii(righe: { stato: string; motivo: string | null }[]): ContoInvii {
  const conto: ContoInvii = { falliti: 0, incerti: 0, perMotivo: {} };
  for (const r of righe) {
    if (r.stato === "incerto") conto.incerti++;
    if (r.stato !== "fallito") continue;
    conto.falliti++;
    const m = codice(r.motivo);
    conto.perMotivo[m] = (conto.perMotivo[m] ?? 0) + 1;
  }
  return conto;
}

// ── La finestra di 24 ore (whatsapp_contacts) ────────────────────────────────

export interface ContattoFinestra {
  ultimo_in_entrata_il: string | null;
  risposto_il: string | null;
  non_scrivere_dal: string | null;
  /** Se l'ultima entrata era una reazione (senza testo) non apre la finestra. */
  ultimo_in_entrata_anteprima?: string | null;
}

/** I contatti si leggono da un giorno prima del periodo: una finestra chiusa
 *  nel periodo si era aperta fino a 24 ore prima. */
export const inizioLetturaContatti = (dal: Date) => new Date(dal.getTime() - GIORNO_MS);

/** `aperte`: il cliente ha scritto nelle ultime 24 ore e nessuno ha risposto
 *  (né premuto «Fatto»). `scadute`: la sua finestra si è chiusa nel periodo
 *  senza risposta, e adesso serve un modello approvato. Lo STOP non conta. */
export function finestra24h(
  contatti: ContattoFinestra[],
  adesso: Date,
  dal: Date,
): { aperte: number; scadute: number } {
  let aperte = 0;
  let scadute = 0;
  const ora = adesso.getTime();
  for (const k of contatti) {
    if (k.non_scrivere_dal) continue;
    //  Una reazione non apre la finestra (30/10/2026). shortcut: non si cerca l'ultimo messaggio
    //  vero sotto la reazione: è un conteggio del rapporto, non decide invii; cambiarla se serve esatto.
    if (anteprimaSenzaTesto(k.ultimo_in_entrata_anteprima)) continue;
    const entrata = Date.parse(k.ultimo_in_entrata_il ?? "");
    if (!Number.isFinite(entrata)) continue;
    const risposto = Date.parse(k.risposto_il ?? "");
    if (Number.isFinite(risposto) && risposto >= entrata) continue;
    const chiude = entrata + GIORNO_MS;
    if (chiude > ora) aperte++;
    else if (chiude > dal.getTime()) scadute++;
  }
  return { aperte, scadute };
}

// ── Il rapporto ──────────────────────────────────────────────────────────────

export interface EsitoPulizia {
  eco: number;
  doppione: number;
  /** eco o doppioni rimasti visibili: nessuna riga libera a cui legarli */
  senza_bersaglio: number;
  /** segni persi per una scrittura del ponte nello stesso momento */
  persi: number;
}

/** Le letture che possono non riuscire, col nome che legge il titolare. */
export const LETTURE = {
  invii: "i messaggi automatici",
  messaggi: "i messaggi della chat",
  pulizia: "la pulizia dei doppioni",
  ponte: "il collegamento col telefono",
  manychat: "lo stato di ManyChat",
  finestra: "le chat in attesa di risposta",
} as const;
export type Lettura = keyof typeof LETTURE;

export interface DatiControllo {
  giro: Giro;
  adesso: Date;
  /** le letture non riuscite */
  nonLetti: Lettura[];
  invii: ContoInvii;
  /** messaggi in uscita della chat con stato `failed` nel periodo */
  messaggiFalliti: number;
  /** `null` = la pulizia non è girata */
  pulizia: EsitoPulizia | null;
  /** la riga di `ponte_wa_stato`; `null` = niente ponte */
  ponte: RigaStatoPonte | null;
  /** `null` = ManyChat non configurato */
  manychat: { acceso: boolean; fermatoDalGiro: boolean; fallitiDiFila: number } | null;
  finestra: { aperte: number; scadute: number };
}

export type GravitaVoce = "grave" | "attenzione" | "info";
export interface Voce {
  gravita: GravitaVoce;
  frase: string;
}

export interface RapportoControllo {
  voci: Voce[];
  severity: "critical" | "warning" | "info";
  titolo: string;
  corpo: string;
  /** c'è almeno una cosa da guardare: si manda anche la push */
  push: boolean;
  /** quante cose da guardare (grave + attenzione) */
  daGuardare: number;
}

const n1 = (n: number, uno: string, tanti: string) => `${n} ${n === 1 ? uno : tanti}`;
const ORDINE: Record<GravitaVoce, number> = { grave: 0, attenzione: 1, info: 2 };

export function rapportoControllo(d: DatiControllo): RapportoControllo {
  const voci: Voce[] = [];
  const metti = (gravita: GravitaVoce, frase: string) => voci.push({ gravita, frase });

  //  Il ponte: la stessa regola della fascia nella chat.
  const ponte = avvisoPonte(d.ponte, d.adesso);
  if (ponte.mostra && ponte.gravita !== "info")
    metti(ponte.gravita === "grave" ? "grave" : "attenzione", ponte.frase);

  if (d.manychat?.fermatoDalGiro && !d.manychat.acceso)
    metti(
      "grave",
      "ManyChat si è fermato da solo dopo troppi errori: i messaggi automatici non partono. Riaccendilo dal pannello ManyChat dopo aver letto il motivo.",
    );
  else if (d.manychat?.acceso && d.manychat.fallitiDiFila > 0)
    metti(
      "attenzione",
      `Gli ultimi ${n1(d.manychat.fallitiDiFila, "invio", "invii")} di ManyChat sono andati male di fila: se continua, il giro si ferma da solo.`,
    );

  const { falliti, incerti, perMotivo } = d.invii;
  if (falliti > 0) {
    const motivi = Object.entries(perMotivo)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${m} ${n}`)
      .join(", ");
    metti(
      "attenzione",
      `${n1(falliti, "messaggio automatico non è partito", "messaggi automatici non sono partiti")} (${motivi}).`,
    );
  }
  if (incerti > 0)
    metti(
      "attenzione",
      `${n1(incerti, "messaggio automatico non si sa se è partito", "messaggi automatici non si sa se sono partiti")}: controllali nel pannello ManyChat.`,
    );
  if (d.messaggiFalliti > 0)
    metti(
      "attenzione",
      `${n1(d.messaggiFalliti, "messaggio della chat non è stato consegnato", "messaggi della chat non sono stati consegnati")}.`,
    );

  const { aperte, scadute } = d.finestra;
  if (aperte > 0)
    metti(
      "attenzione",
      `${n1(aperte, "cliente aspetta una risposta", "clienti aspettano una risposta")}: la finestra di 24 ore per scrivere liberamente si chiude nelle prossime ore.`,
    );
  if (scadute > 0)
    metti(
      "attenzione",
      `${n1(scadute, "cliente ha scritto e la finestra di 24 ore si è chiusa", "clienti hanno scritto e la finestra di 24 ore si è chiusa")} senza risposta: adesso serve un modello approvato.`,
    );

  if (d.pulizia) {
    const { eco, doppione, senza_bersaglio } = d.pulizia;
    //  Le eco dal 29/10 le scarta l'ingresso: se ne arrivano ancora, qualcosa è cambiato.
    if (eco > 0)
      metti(
        "attenzione",
        `${n1(eco, "eco di ManyChat (un vecchio messaggio del cliente ripetuto) è arrivata", "eco di ManyChat (vecchi messaggi del cliente ripetuti) sono arrivate")} lo stesso: le ho nascoste, non cancellate.`,
      );
    if (doppione > 0)
      metti(
        "info",
        `${n1(doppione, "doppione nascosto", "doppioni nascosti")} nella chat (non cancellati).`,
      );
    if (senza_bersaglio > 0)
      metti(
        "info",
        `${n1(senza_bersaglio, "messaggio ripetuto è rimasto", "messaggi ripetuti sono rimasti")} visibili: non c'era un originale libero a cui legarli.`,
      );
  }

  if (d.nonLetti.length)
    metti(
      "attenzione",
      `Non sono riuscito a controllare ${d.nonLetti.map((l) => LETTURE[l]).join(", ")}.`,
    );

  voci.sort((a, b) => ORDINE[a.gravita] - ORDINE[b.gravita]);
  const daGuardare = voci.filter((v) => v.gravita !== "info").length;
  if (voci.length === 0) metti("info", "Niente da segnalare: il giro WhatsApp è andato bene.");

  const quando = d.giro.periodo === "settimana" ? "della settimana" : "della notte";
  return {
    voci,
    severity: voci.some((v) => v.gravita === "grave")
      ? "critical"
      : daGuardare > 0
        ? "warning"
        : "info",
    titolo: `Controllo WhatsApp ${quando}: ${
      daGuardare > 0 ? n1(daGuardare, "cosa da guardare", "cose da guardare") : "tutto in ordine"
    }`,
    corpo: voci.map((v) => v.frase).join(" "),
    push: daGuardare > 0,
    daGuardare,
  };
}

/** La push: sullo schermo bloccato solo il conto (come per i messaggi, mai i
 *  dettagli). Una chiave sola: quella di domani sostituisce quella di oggi. */
export function avvisoPushControllo(r: RapportoControllo): AvvisoPush {
  return {
    titolo: "Controllo WhatsApp",
    corpo: `${n1(r.daGuardare, "cosa da guardare", "cose da guardare")}: apri le notifiche del CRM.`,
    chiave: "controllo-whatsapp",
    destinazione: "/CRM/notifiche",
  };
}
