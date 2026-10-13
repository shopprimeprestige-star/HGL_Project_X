/** ── L'ANTEPRIMA DEL LINK «SOLO PREVENTIVO» È DI CHI LO RICEVE ─────────────
 *
 *  Segnalazione del committente (13/10/2026): «quando termino un preventivo,
 *  passo al prossimo e clicco "condividi link preventivo", l'anteprima mostra
 *  il cliente precedente».
 *
 *  Il link senza preventivo creato era `/preventivo?client=1&sess=CODICE`: il
 *  codice è quello della CONSULENZA, che resta lo stesso mentre si passa da un
 *  cliente all'altro. Stesso indirizzo per tutti, quindi:
 *   · l'immagine si depositava sotto la consulenza, e il cliente successivo
 *     ereditava quella del precedente;
 *   · WhatsApp, che tiene le anteprime per indirizzo, mostrava comunque la
 *     vecchia anche quando l'immagine nuova c'era.
 *
 *  Adesso il link porta anche la persona (`&persona=<gettone>`, lo stesso
 *  parametro che il server usa già per scrivere nome e cognome nel testo del
 *  riquadro) e l'immagine sta sotto `CODICE_<gettone>` — la stessa forma dei
 *  biglietti d'invito personali (shop/chi-dal-link). Un cliente, un indirizzo,
 *  una sua anteprima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { codiceAnteprimaDi } from "./chi-dal-link";
import { gettoneDi } from "@/crm/fascia-consulenza";

/** Il codice sotto cui sta l'immagine di questo link. Col preventivo creato
 *  vale il suo numero; senza, la consulenza più la persona (se si sa). */
export function chiaveAnteprimaPreventivo(p: { id?: unknown; sess?: unknown; persona?: unknown }): string {
  const id = String(p.id ?? "").trim();
  if (id) return id;
  return codiceAnteprimaDi(String(p.sess ?? "").trim(), String(p.persona ?? "").trim());
}

/** Per chi è il preventivo che si sta componendo: la persona scelta con
 *  «Nuovo preventivo per…» se c'è, altrimenti il cliente con cui è stata
 *  avviata la consulenza. "" = non si sa (il link resta quello di prima). */
export function personaDelPreventivo(p: {
  scelta?: string | null;
  leadCorrente?: { id?: string | null; nome?: string | null } | null;
}): string {
  const scelta = String(p.scelta ?? "").trim().toLowerCase();
  if (/^p[a-z0-9]{1,8}$/.test(scelta)) return scelta;
  const id = String(p.leadCorrente?.id ?? "").trim();
  return id ? gettoneDi({ leadId: id, nome: String(p.leadCorrente?.nome ?? "") }) : "";
}
