/** ── «WHATSAPP» O «WHATSAPP DEL CRM»: LE REGOLE DELLA SCELTA ─────────────────
 *  Richiesta del titolare (30/10/2026): in tutto il CRM, toccando un'azione
 *  WhatsApp verso un lead, si sceglie fra l'app del telefono (wa.me) e la
 *  chat del CRM di quel lead. Con la finestra di 24 ore CHIUSA (il cliente non
 *  scrive da più di 23 ore, la stessa regola della porta: `finestraPerTesto`)
 *  dal CRM si manda solo un modello, e l'opzione CRM è spenta.
 *  Qui la parte pura (provata in prove/idee/scelta-whatsapp.mjs); il disegno
 *  e la lettura al tocco stanno in SceltaWhatsapp.tsx.
 *  ───────────────────────────────────────────────────────────────────────── */
import { finestraPerTesto } from "@/crm/manychat/finestra";
import { ultimeNoveCifre } from "@/crm/manychat/regole";
import { entrataPerFinestra, type MessaggioEntrata } from "./entrata-vera";
import { linkApriWhatsapp } from "./apriWhatsapp";

/** La frase sopra le opzioni quando la finestra è chiusa (stesso tono di Casella). */
export const FRASE_FINESTRA_CHIUSA =
  "Finestra di 24 ore chiusa: dal CRM si può mandare solo un modello approvato";

/** Quanto serve di una riga di `whatsapp_contacts`. */
export interface ContattoPerScelta {
  id: string;
  phone_e164?: string | null;
  ultimo_in_entrata_il?: string | null;
  /** Per capire se l'ultima entrata era una reazione (senza testo): non riapre la finestra. */
  ultimo_in_entrata_anteprima?: string | null;
}

/** L'opzione «WhatsApp del CRM»: accesa sulla chat del contatto, o spenta. */
export type SceltaCrm =
  | { stato: "aperta"; contattoId: string }
  | { stato: "chiusa"; contattoId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Il filtro `like` sul numero: le ultime 9 cifre (la rubrica ha il numero con e senza «+»). */
export function filtroNumero(telefono?: string | null): string {
  const nove = ultimeNoveCifre(telefono);
  return nove ? `%${nove}` : "";
}

/** Il contatto di quel numero fra le righe lette: con più righe (con e senza «+»)
 *  vince quella con l'entrata più recente. `null` se il numero non c'è. */
export function contattoDelNumero(
  righe: ContattoPerScelta[],
  telefono?: string | null,
): ContattoPerScelta | null {
  const nove = ultimeNoveCifre(telefono);
  if (!nove) return null;
  let meglio: ContattoPerScelta | null = null;
  let quando = -Infinity;
  for (const r of righe) {
    if (ultimeNoveCifre(r.phone_e164) !== nove || !r.id) continue;
    const t = Date.parse(String(r.ultimo_in_entrata_il ?? ""));
    const v = Number.isFinite(t) ? t : -Infinity;
    if (!meglio || v > quando) {
      meglio = r;
      quando = v;
    }
  }
  return meglio;
}

/** Accesa solo con la finestra aperta (regola delle 23 ore) e un contatto vero.
 *  Una reazione non apre la finestra: `messaggi` (in entrata, recenti) servono solo se l'ultima
 *  entrata era senza testo, per trovare l'ultimo messaggio vero. Senza: finestra chiusa. */
export function sceltaCrm(
  contatto: ContattoPerScelta | null,
  adesso: Date,
  messaggi: MessaggioEntrata[] = [],
): SceltaCrm {
  if (contatto?.id && finestraPerTesto(entrataPerFinestra(contatto, messaggi), adesso))
    return { stato: "aperta", contattoId: contatto.id };
  return { stato: "chiusa", contattoId: contatto?.id ?? null };
}

/** La pagina WhatsApp del CRM con aperta la chat del contatto (`?chat=` vuole un uuid);
 *  con `testo` il messaggio arriva già nella casella (`&testo=`, vedi PaginaChat). */
export function linkChatCrm(contattoId?: string | null, testo?: string | null): string {
  const id = String(contattoId ?? "");
  if (!UUID.test(id)) return "";
  const t = String(testo ?? "").trim();
  return `/CRM/whatsapp?chat=${id.toLowerCase()}${t ? `&testo=${encodeURIComponent(t)}` : ""}`;
}

/** L'app del telefono: Business prima su Android, altrove wa.me; vuoto se il numero è rotto. */
export function linkNativo(
  telefono: string | null | undefined,
  testo: string | null | undefined,
  userAgent: string,
): string {
  return linkApriWhatsapp(telefono, userAgent, testo);
}
