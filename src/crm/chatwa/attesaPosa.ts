/** ── IL BADGE «DA QUANTO NON GLI SCRIVIAMO», PER CHI ASPETTA LA POSA (31/10/2026) ──
 *
 *  Richiesta del titolare: nelle righe dei lead che hanno lasciato l'acconto e aspettano
 *  l'installazione, un badge corto («10 g», «3 h») che dica da quanto tempo NON gli scriviamo noi.
 *  Chi aspetta è `daInstallare` (accontiInCima.ts): stessa regola del blocco «Acconto, da installare».
 *
 *  DA DOVE SI CONTA (nessuna lettura nuova al database)
 *   · l'ultimo messaggio in USCITA, cioè nostro e partito: il più recente fra quelli già letti in
 *     pagina (`ultimoNostroIl` di stato.ts, calcolato da `costruisciChat` sui messaggi che ha già in
 *     mano) e l'ultimo della chat se è nostro (`ultimoDellaChat`: messaggio letto o `ultimo_messaggio_*`
 *     del contatto, che vale anche per le chat vecchie fuori dai messaggi letti);
 *   · se non c'è nessuna uscita nota, l'ultimo messaggio della chat (qualunque direzione).
 *  ⚠️ LIMITE: i messaggi letti sono gli ultimi 500 di tutte le chat. Se l'ultimo messaggio è del
 *   cliente e la nostra risposta è più vecchia di quella finestra, l'uscita non si vede e il
 *   badge conta dal messaggio del cliente: il tempo mostrato è più corto del vero, mai più lungo.
 *   `risposto_il` non si usa: lo scrive anche «Fatto», che non manda niente.
 *
 *  SOGLIE DEL COLORE (giorni interi): sotto 3 g neutro; da 3 a 7 g ambra; da 8 g in su rosso.
 *  Pura: niente React, niente Supabase. Provata in prove/idee/riga-attesa-wame.mjs. */
import { daInstallare } from "./accontiInCima";
import { inBreve } from "./anteprima-riga";
import { attesaInChiaro, ultimoDellaChat } from "./stato";
import type { ChatItem } from "./tipi";

const GIORNO = 86_400_000;
/** Da quanti giorni interi il badge diventa ambra. */
export const GIORNI_AMBRA = 3;
/** Fino a quanti giorni interi resta ambra: oltre diventa rosso. */
export const GIORNI_ROSSO_OLTRE = 7;

export type LivelloAttesa = "neutro" | "ambra" | "rosso";

export interface BadgeAttesaPosa {
  /** Il testo corto: «10 g», «3 h», «25 min», «<1 min». */
  testo: string;
  /** La frase per il tooltip e per chi legge con lo schermo. */
  titolo: string;
  livello: LivelloAttesa;
}

const ms = (x: string | null | undefined): number | null => {
  if (!x) return null;
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : null;
};

/** Il badge della riga, o `null` se la chat non è di chi aspetta la posa o non c'è da dove contare. */
export function badgeAttesaPosa(
  c: Pick<ChatItem, "lead" | "lastMessage" | "contact" | "ultimoNostroIl">,
  adesso: number,
): BadgeAttesaPosa | null {
  if (!daInstallare(c.lead)) return null;
  const ultimo = ultimoDellaChat(c.lastMessage, c.contact);
  const nostroUltimo =
    ultimo && ultimo.direction === "outbound" && ultimo.status !== "failed"
      ? ultimo.created_at
      : null;
  const nostro = [c.ultimoNostroIl, nostroUltimo]
    .filter((x): x is string => ms(x) !== null)
    .sort((a, b) => (ms(b) as number) - (ms(a) as number))[0];
  const dal = nostro ?? (ms(ultimo?.created_at) !== null ? (ultimo?.created_at ?? null) : null);
  if (!dal) return null;
  const durata = attesaInChiaro(dal, adesso);
  const breve = inBreve(durata);
  const giorni = Math.floor(Math.max(0, adesso - (ms(dal) as number)) / GIORNO);
  return {
    testo: breve === "da poco" ? "<1 min" : breve.replace(/^da /, ""),
    titolo: nostro
      ? `Non gli scrivi ${durata}`
      : `Nessun messaggio nostro: l'ultimo della chat è ${durata}`,
    livello: giorni > GIORNI_ROSSO_OLTRE ? "rosso" : giorni >= GIORNI_AMBRA ? "ambra" : "neutro",
  };
}
