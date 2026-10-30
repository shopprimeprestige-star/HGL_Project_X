/** ── PROVE: PASTIGLIA «ATTESA WHATSAPP» E RIQUADRO DEL RITORNO (30/10/2026) ── */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveAttesaERitorno(mod, { c, gruppo, radice }) {
  gruppo("CHAT WHATSAPP: PASTIGLIA «ATTESA WHATSAPP»");
  const { passaFiltro } = mod["chatwa/cercaChat"];
  const chat = (stato) => ({ lead: stato ? { data: { stato } } : null });
  c("in attesa WhatsApp: sì; altri stati e sconosciuti: no", [true, false, false], [passaFiltro(chat("attesa_whatsapp"), "attesa-whatsapp"), passaFiltro(chat("da_chiamare"), "attesa-whatsapp"), passaFiltro(chat(null), "attesa-whatsapp")]);
  const elenco = readFileSync(join(radice, "src/crm/chatwa/ElencoChat.tsx"), "utf8");
  c("la pastiglia c'è, col numero", true, /l: "Attesa WhatsApp"/.test(elenco) && /f\.v === "attesa-whatsapp"/.test(elenco));

  gruppo("CHAT WHATSAPP: IL RITORNO SI APRE CON LO STATO DI PRIMA E LE NOTE");
  const R = mod["chatwa/ritorno"];
  const d = {
    stato: "attesa_whatsapp",
    ricarico: { volte: 2, ultimo: "2026-10-29T10:00:00Z", lista: "Ads ottobre", statoAllora: "fatto" },
    dataMeeting: "2026-10-12", oraMeeting: "18:00",
    lostReason: "prezzo", lostReasonNote: "voleva pensarci",
    note: "Vuole sentire la moglie", notePostCall: "Preventivo inviato",
  };
  const v = R.vociRitorno(d, "Filippo");
  const valore = (e) => v.find((x) => x.etichetta === e)?.valore;
  c("lo stato di prima", "Consulenza svolta", valore("Stato di prima"));
  c("quante volte, quando e da che lista", "2 volte · l'ultima il 29/10/2026 · dalla lista «Ads ottobre»", valore("Ricomparso"));
  c("la consulenza avuta e il consulente", ["12/10/2026 alle 18:00", "Filippo"], [valore("Consulenza"), valore("Consulente")]);
  c("le note e le note dopo la consulenza", ["Vuole sentire la moglie", "Preventivo inviato"], [valore("Note"), valore("Note dopo la consulenza")]);
  c("niente stato di prima: lo dice, non inventa", "non si sa (scheda vecchia)", R.vociRitorno({ ricarico: { volte: 1, ultimo: "2026-10-29T10:00:00Z" } }).find((x) => x.etichetta === "Stato di prima").valore);
  c("campi vuoti: non compaiono", false, R.vociRitorno({ ricarico: { volte: 1, ultimo: "2026-10-29T10:00:00Z" }, note: "  " }).some((x) => x.etichetta === "Note"));
  c("non di ritorno: niente riquadro", [], R.vociRitorno({ stato: "fatto" }));
  const conv = readFileSync(join(radice, "src/crm/chatwa/Conversazione.tsx"), "utf8");
  c("nell'intestazione il ritorno apre il riquadro, con «Apri la scheda completa»", true, /<PopoverTrigger asChild>/.test(conv) && /vociRitorno\(/.test(conv) && /Apri la scheda completa/.test(conv));
}
