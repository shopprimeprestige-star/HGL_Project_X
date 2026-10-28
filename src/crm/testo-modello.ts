/** ── IL MODELLO COME LO LEGGE IL CLIENTE ────────────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): «i template che mando li leggo e non mi
 *  serve il nome del template ma il contenuto, come lo vede il cliente».
 *  Nella pagina WhatsApp un modello inviato compariva come
 *  «[template:consulenza_conferma_presenza]»: chi apriva la chat non sapeva
 *  cosa avesse letto la persona, e quindi cosa rispondere.
 *
 *  Il testo approvato è lo stesso di `wa-meta-templates.ts` (META_TEMPLATES e
 *  MODELLI_MANYCHAT): qui si mettono le variabili al loro posto.
 *  ⚠️ IN ARCHIVIO RESTA «[template:x]», ED È VOLUTO: la riga di
 *   `whatsapp_messages` di un modello non porta nome né link del cliente
 *   (commessa 2026-10-23, provato in prove/manychat/porta.mjs). Il testo si
 *   compone SOLO a schermo, dalla scheda del lead: è una ricostruzione, e la
 *   pagina lo dice — se la data del meet è cambiata dopo, il cliente aveva
 *   letto quella vecchia.
 *  ⚠️ I nomi «_v2», «_v3» (modelli rifatti in ManyChat) hanno lo stesso testo
 *   del nome base: si cerca prima il nome esatto, poi senza il suffisso.
 *  ⚠️ Un modello che qui non c'è resta «[template:x]»: meglio il nome che un
 *   testo inventato.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "./types";
import { findMetaTemplate, type MetaTemplate } from "./wa-meta-templates";
import { giornoParlato, nomePerModello, oraNormale } from "./promemoria/formati";
import { linkPerCliente } from "./manychat/testi";

const SEGNAPOSTO = /^\[template:([^\]]+)\]$/;

/** Il modello, anche col suffisso «_v2». */
export function modelloDi(nome?: string | null): MetaTemplate | undefined {
  const n = String(nome ?? "").trim();
  if (!n) return undefined;
  return findMetaTemplate(n) ?? findMetaTemplate(n.replace(/_v\d+$/, ""));
}

/** Il testo con i parametri al loro posto. `null` se il modello non si conosce.
 *  Un parametro mancante resta «…»: un buco visibile, non un `{{2}}`. */
export function testoDelModello(nome?: string | null, parametri?: string[] | null): string | null {
  const m = modelloDi(nome);
  if (!m) return null;
  return m.body.replace(/\{\{(\d+)\}\}/g, (_, i) => {
    const v = String(parametri?.[Number(i) - 1] ?? "").trim();
    return v || "…";
  });
}

/** Il nome del modello dentro «[template:x]», o niente se il corpo è un testo. */
export function nomeDalSegnaposto(corpo?: string | null): string | null {
  return SEGNAPOSTO.exec(String(corpo ?? "").trim())?.[1] ?? null;
}

const dataBreve = (iso?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** I parametri ricostruiti dalla scheda, nell'ordine del modello. */
function parametriDallaScheda(
  m: MetaTemplate,
  d: Partial<LeadData> | null | undefined,
  consulente?: string | null,
  leadId?: string | null,
): string[] {
  const valore: Record<string, string> = {
    lead_name: nomePerModello(d?.nome) ?? "",
    consultant_name: nomePerModello(consulente) ?? "",
    appointment_day: giornoParlato(String(d?.dataMeeting ?? "").slice(0, 10)) ?? "",
    appointment_date: dataBreve(d?.dataMeeting),
    appointment_time: oraNormale(d?.oraMeeting) ?? "",
    visit_date: dataBreve(d?.dataVieneInSede),
    visit_time: oraNormale(d?.oraVieneInSede) ?? "",
    recontact_date: dataBreve(d?.dataRicontatto),
    recontact_time: oraNormale(d?.oraRicontatto) ?? "",
    //  Lo stesso link che parte col modello (per persona, se si sa la scheda).
    meet_link: (d ? linkPerCliente(d, leadId) : "") || "[link della consulenza]",
    address: "",
  };
  return m.params.map((p) => valore[p.key] ?? "");
}

export interface CorpoLeggibile {
  testo: string;
  /** Il nome del modello, se il messaggio era un modello. */
  modello?: string;
  /** Vero se il testo è ricostruito dalla scheda (messaggi salvati col nome). */
  ricostruito?: boolean;
}

/** Il corpo di un messaggio come si mostra nella chat. */
export function corpoLeggibile(
  corpo: string | null | undefined,
  d?: Partial<LeadData> | null,
  consulente?: string | null,
  leadId?: string | null,
): CorpoLeggibile {
  const nome = nomeDalSegnaposto(corpo);
  if (!nome) return { testo: String(corpo ?? "") };
  const m = modelloDi(nome);
  if (!m) return { testo: String(corpo ?? ""), modello: nome };
  return {
    testo: testoDelModello(nome, parametriDallaScheda(m, d, consulente, leadId)) ?? String(corpo),
    modello: nome,
    ricostruito: true,
  };
}
