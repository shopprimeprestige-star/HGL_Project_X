/** ── PROVE: PERCHÉ È PARTITO UN MODELLO (30/10/2026) ─────────────────────── */
export function provePercheModello(mod, { c, gruppo }) {
  gruppo("CHAT WHATSAPP: SOTTO IL MODELLO, COM'ERA LA FINESTRA");
  const P = mod["chatwa/perche-modello"];
  //  Il caso del titolare: ultimo messaggio il 28/10 alle 17:18, modello il 30/10 alle 9:00.
  const msg = [
    { id: "a", direction: "inbound", created_at: "2026-10-28T16:18:00Z" },
    { id: "a2", direction: "inbound", created_at: "2026-10-28T16:18:05Z", canale: "baileys" },
    { id: "b", direction: "outbound", created_at: "2026-10-30T08:00:00Z" },
    { id: "c", direction: "inbound", created_at: "2026-10-30T08:52:00Z" },
    { id: "d", direction: "outbound", created_at: "2026-10-30T09:10:00Z" },
    { id: "z", direction: "outbound", created_at: "2026-10-27T09:00:00Z" },
  ];
  const e = P.entratePrima(msg);
  c("l'ultima entrata prima di ogni nostro messaggio (le righe del ponte no)", ["2026-10-28T16:18:00Z", "2026-10-30T08:52:00Z", null], [e.get("b"), e.get("d"), e.get("z")]);
  c("il modello delle 9: finestra chiusa, col giorno e l'ora dell'ultimo messaggio", { aperta: false, frase: "finestra chiusa: ultimo messaggio del cliente 28/10 alle 17:18" }, P.percheModello("2026-10-30T08:00:00Z", e.get("b")));
  c("un modello mandato a finestra aperta lo dice (poteva essere testo)", true, P.percheModello("2026-10-30T09:10:00Z", e.get("d")).aperta);
  c("mai scritto: finestra chiusa", "finestra chiusa: il cliente non aveva ancora scritto", P.percheModello("2026-10-27T09:00:00Z", null).frase);
  c("non si sa (messaggi non caricati): nessuna frase", null, P.percheModello("2026-10-30T08:00:00Z", undefined));
}
