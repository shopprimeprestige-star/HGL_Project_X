/** ── PROVE: IL LINK «SOLO PREVENTIVO» NON PORTA IL PREVENTIVO DEL CLIENTE DI PRIMA (31/10/2026) ──
 *  Aprendo dal CRM la consulenza di un altro cliente, il numero del preventivo
 *  si azzera: l'anteprima del link è «lo costruiamo insieme». Controlli sul sorgente. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveAnteprimaPreventivoCliente({ c, gruppo, radice }) {
  gruppo("LINK SOLO PREVENTIVO: CAMBIANDO CLIENTE IL PREVENTIVO DI PRIMA SI AZZERA");
  const meet = readFileSync(join(radice, "src/crm/MeetGiornalieri.tsx"), "utf8");
  const azzera = meet.indexOf("if (leadCorrenteId() !== l.id) setQuoteRef(null);");
  const scrive = meet.indexOf('"hg_lead_corrente",\n      JSON.stringify');
  c("Avvia di un altro cliente azzera il numero del preventivo", true, azzera > 0);
  c("…prima di scrivere il cliente nuovo (si confronta con quello di prima)", true, azzera > 0 && scrive > azzera);
  const bar = readFileSync(join(radice, "src/shop/PresenterBar.tsx"), "utf8");
  c("senza numero il link porta solo la sessione e la persona", true, /linkPreventivo\(ref \|\| null, ref \? null : destinatarioDelLink\(\)\.persona\)/.test(bar));
}
