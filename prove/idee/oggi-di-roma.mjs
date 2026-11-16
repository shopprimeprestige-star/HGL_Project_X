/** ── PROVE: UN SOLO «OGGI» NELLA CHAT, QUELLO DI ROMA (16/11/2026, D6 dell'analisi) ──────────────
 *  La fila dei giorni usava già Roma (`giornoDiRoma`, giorno.ts); la barra del prossimo meet, la barra
 *  «Da richiamare alle…» (ElencoChat.tsx) e il pannello «Oggi» (PannelloOggi.tsx) usavano l'orologio
 *  del dispositivo (`oggiIso`/`iso`). Ora guardano tutti lo stesso giorno di Roma. `oggiIso`
 *  (crm/ui.tsx) e `iso` (crm/MeetGiornalieri.tsx) non si toccano: li usa tutto il resto del CRM.
 *  ⚠️ Fuori da questa commessa: la pastiglia del richiamo in RigaChat.tsx ha un suo `oggiIso` separato
 *  (non elencato nell'ANALISI §1.5 fra gli usi di `ElencoChat.tsx:324`, e PIANO.md non lo mette fra i
 *  file del Compito 5): stesso tipo di guasto, lasciato com'era, segnalato all'architetto.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveOggiDiRoma(mod, { c, gruppo, radice }) {
  const G = mod["chatwa/giorno"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  //  La stessa formula di `oggiIso`/`iso` (orologio del dispositivo), scritta qui per non caricare
  //  crm/ui.tsx o crm/MeetGiornalieri.tsx.
  const delDispositivo = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  gruppo("UN SOLO OGGI: IL GIORNO DI ROMA NON DIPENDE DAL FUSO DI CHI ESEGUE");
  const prima = process.env.TZ;
  const istanti = ["2026-11-16T06:30:00Z", "2026-11-15T23:30:00Z", "2026-07-15T22:30:00Z", "2026-12-31T23:30:00Z"];
  const attesi = ["2026-11-16", "2026-11-16", "2026-07-16", "2027-01-01"];
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Rome"]) {
      process.env.TZ = tz;
      c(`fuso ${tz}: giornoDiRoma dà sempre il giorno di Roma`, attesi, istanti.map((x) => G.giornoDiRoma(new Date(x))));
    }
    process.env.TZ = "America/Los_Angeles";
    c("con l'orologio del dispositivo (Los Angeles) le 07:30 di Roma sarebbero ancora «ieri»: è il guasto evitato", "2026-11-15", delDispositivo(new Date("2026-11-16T06:30:00Z")));
  } finally {
    if (prima === undefined) delete process.env.TZ;
    else process.env.TZ = prima;
  }

  gruppo("UN SOLO OGGI: L'ELENCO DELLA CHAT E IL PANNELLO «OGGI» USANO giornoDiRoma");
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const pannello = senzaCommenti(leggi("src/crm/chatwa/PannelloOggi.tsx"));
  c("ElencoChat: «oggi» per prossimo meet e prossimo ricontatto = giornoDiRoma(new Date(adesso))", true, /const oggi = giornoDiRoma\(new Date\(adesso\)\)/.test(elenco));
  c("ElencoChat: niente più oggiIso", false, /oggiIso/.test(elenco));
  c("PannelloOggi: «oggi» delle consulenze del giorno = giornoDiRoma(ora)", true, /const oggi = giornoDiRoma\(ora\)/.test(pannello));
  c("PannelloOggi: niente più iso(ora) di MeetGiornalieri", true, !/\biso\(ora\)/.test(pannello) && !/, iso,|, iso }/.test(pannello));
  //  16/11/2026 (coordinatore): anche la pastiglia del richiamo nell'intestazione della chat.
  const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));
  c("Conversazione: la pastiglia del richiamo usa giornoDiRoma(adesso), niente più oggiIso", [true, false],
    [/etichettaRichiamo\(attiva\.lead\.data, giornoDiRoma\(adesso\)\)/.test(conv), /oggiIso/.test(conv)]);
  c("crm/ui.tsx: oggiIso resta com'era (lo usa tutto il resto del CRM)", true, /export const oggiIso/.test(leggi("src/crm/ui.tsx")));
  c("crm/MeetGiornalieri.tsx: iso resta com'era (lo usa tutto il resto del CRM)", true, /export const iso =/.test(leggi("src/crm/MeetGiornalieri.tsx")));
}
