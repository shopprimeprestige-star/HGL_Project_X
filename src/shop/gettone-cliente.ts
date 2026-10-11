/** ── CHI SONO, IN QUESTA STANZA ────────────────────────────────────────────
 *  Il «gettone» è il nome che il cliente si prende toccando il proprio nome
 *  alla porta: da lì in poi il suo preventivo è suo (vedi
 *  shop/preventivi-di-gruppo). Qui c'è solo il POSTO dove si ricorda — la
 *  memoria della scheda — e il modo di rileggerlo.
 *
 *  ⚠️ STA IN UN FILE SUO, e non nel motore della consulenza, per una ragione
 *   misurata: `shop/live` ha bisogno di questa riga per dire al server chi sta
 *   chiedendo la pagina, e `shop/live` lo importa il CRM (per fare il link di
 *   un preventivo). Finché questa funzione stava dentro il motore, aprire il
 *   CRM voleva dire scaricare e interpretare 254 kB di videochiamata per
 *   leggere una riga di `sessionStorage`. Vedi shop/link-ospite.
 *  ⚠️ `sessionStorage` e non `localStorage`: un gettone che resta sul
 *   dispositivo dopo aver chiuso la scheda è l'identità di un cliente lasciata
 *   in un browser che può essere di famiglia.
 *  ───────────────────────────────────────────────────────────────────────── */
const PERSONA_KEY = "hg_mia_persona";

/** Il gettone scelto in questa scheda, finché la scheda vive. */
let miaPersona = "";

export const gettoneInMemoria = (): string => miaPersona;
export function tieniInMemoria(g: string) { miaPersona = g || ""; }

export function ricordaPersona(code: string | null | undefined, gettone: string) {
  if (!gettone) return;
  try { sessionStorage.setItem(PERSONA_KEY, JSON.stringify({ code: String(code || ""), gettone })); } catch { /* */ }
}

/** Chi sono, in questa stanza: "" se non l'ho mai dichiarato. */
export function miaPersonaDi(code: string | null | undefined): string {
  if (miaPersona) return miaPersona;
  try {
    const j = JSON.parse(sessionStorage.getItem(PERSONA_KEY) || "null") as { code?: string; gettone?: string } | null;
    if (!j?.gettone) return "";
    //  Il gettone vale in UNA stanza: portarselo in un'altra vorrebbe dire
    //  entrare nel preventivo di un altro appuntamento.
    return !j.code || !code || j.code === code ? String(j.gettone) : "";
  } catch { return ""; }
}
