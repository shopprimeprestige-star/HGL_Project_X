/** ── PONTE WHATSAPP · INVIO A MANO: LE REGOLE PURE ───────────────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale (PIANO.md §3.2). SCHELETRO del
 *  compito T0: le firme sono vere e congelate, i corpi li scrive T2.
 *  ───────────────────────────────────────────────────────────────────────── */
import type {
  CorpoEsito,
  CorpoPrendi,
  FattiInvio,
  MotivoInvio,
  MotivoRifiuto,
  RichiestaBrowser,
  RigaCoda,
  StatoCoda,
} from "./invio-tipi";

export function normalizzaNumero(_x: unknown): string | null {
  throw new Error("T2");
}

export function ponteCollegato(
  _ponte: { stato: string; aggiornato_il: string; invii_attivi?: boolean } | null,
  _adesso: Date,
): { ok: true } | { ok: false; motivo: "ponte_non_collegato" | "invii_spenti" } {
  throw new Error("T2");
}

export function controllaAccodamento(_i: {
  testo: string;
  numero: string;
  fatti: FattiInvio;
  adesso: Date;
}): { ok: true } | { ok: false; motivo: MotivoRifiuto } {
  throw new Error("T2");
}

export function fraseMotivo(_m: MotivoInvio | MotivoRifiuto | string | null | undefined): string {
  throw new Error("T2");
}

export function statoVisibile(
  _riga: RigaCoda,
  _adesso: Date,
): { fase: StatoCoda; motivo: string | null; frase: string; puoRiprovare: boolean; incerto: boolean } {
  throw new Error("T2");
}

export function puoRiprovare(
  _riga: RigaCoda,
): { ok: true; serveConferma: boolean } | { ok: false; motivo: "non_riprovabile" } {
  throw new Error("T2");
}

export function vistaCoda(
  _righe: RigaCoda[],
  _messaggi: { wa_message_id: string | null; direction: string; body: string | null; created_at: string; canale: string | null }[],
  _adesso: Date,
): RigaCoda[] {
  throw new Error("T2");
}

export function leggiRichiestaBrowser(
  _json: unknown,
): { ok: true; r: RichiestaBrowser } | { ok: false; motivo: MotivoRifiuto | "corpo_non_valido" } {
  throw new Error("T2");
}

export function leggiPrendi(_json: unknown): CorpoPrendi | null {
  throw new Error("T2");
}

export function leggiEsito(_json: unknown, _adesso: Date): CorpoEsito | null {
  throw new Error("T2");
}
