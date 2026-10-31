/** ── IL CLIENT DEL PANNELLO «MESSAGGI AUTOMATICI» (browser) ─────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T2. Parla con la rotta
 *  `/api/crm/messaggi-automatici` (contratto in `tipi.ts`) con la sessione del CRM
 *  (`fetchCRM`). Ogni funzione ritorna `{ ok, dati }` oppure `{ ok: false, stato, errore }`
 *  con una frase pronta da mostrare; mai un'eccezione. Il POST porta SOLO `chiave`,
 *  `acceso` e `prima`: il nome di chi clicca lo mette il server.
 *  ───────────────────────────────────────────────────────────────────────── */
import { fetchCRM } from "@/crm/AuthContext";
import type { RispostaCrm } from "../manychat/client-crm";
import { FRASE_RETE, fraseErrore } from "../manychat/vista-pannello";
import type { ComandoImposta, RispostaMessaggi } from "./tipi";

export const ROTTA_MESSAGGI_AUTOMATICI = "/api/crm/messaggi-automatici";

async function chiama(corpo?: ComandoImposta): Promise<RispostaCrm<RispostaMessaggi>> {
  try {
    const res = await fetchCRM(
      ROTTA_MESSAGGI_AUTOMATICI,
      corpo === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chiave: corpo.chiave,
              acceso: corpo.acceso,
              prima: corpo.prima,
            }),
          },
    );
    const json = (await res.json().catch(() => null)) as
      | (RispostaMessaggi & { error?: unknown })
      | null;
    if (res.ok && json) return { ok: true, dati: json };
    const e = json && typeof json.error === "string" ? json.error : undefined;
    return { ok: false, stato: res.status, errore: fraseErrore(res.status, e) };
  } catch {
    return { ok: false, stato: 0, errore: FRASE_RETE };
  }
}

/** Lo stato dei 25 messaggi, la fascia e le ultime modifiche. */
export const leggiMessaggiAutomatici = () => chiama();

/** Accende o spegne un messaggio. `prima` è quello che chi clicca ha visto: se nel frattempo
 *  è cambiato, la risposta è un 409 (`stato: 409`) e va riletto. */
export const impostaMessaggio = (comando: ComandoImposta) => chiama(comando);
