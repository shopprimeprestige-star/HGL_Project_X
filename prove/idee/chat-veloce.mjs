/** ── PROVE: LA CHAT VELOCE (p1-chat-veloce, 30/10/2026) ─────────────────────────
 *  Parti pure: `indiceSchede` fa quello che fa `schedaUnica` (stesso esito per ogni numero), l'elenco
 *  si disegna a pezzi (`tagliaSezioni`), `costruisciChat` tiene l'ordine e le regole di prima.
 *  Dati inventati (seme fisso): nessun cliente vero. */
export function proveChatVeloce(mod, { c, gruppo }) {
  const S = mod["chatwa/stato"];
  const F = mod["chatwa/finestraLista"];
  const K = mod["chatwa/costruisciChat"];

  let seme = 12345;
  const r = () => ((seme = (Math.imul(seme, 1664525) + 1013904223) >>> 0) / 4294967296);

  gruppo("INDICE DELLE SCHEDE = schedaUnica");
  //  Numeri scritti in modi diversi, con doppioni, corti, vuoti, con prefissi diversi.
  const base = Array.from({ length: 60 }, () => String(3000000000 + Math.floor(r() * 9000000)));
  const scrivi = (n, i) =>
    [n, `+39${n}`, `0039 ${n}`, `${n.slice(0, 3)} ${n.slice(3)}`, `+44${n}`, n.slice(-8), n.slice(-6), "", null][i % 9];
  const leads = Array.from({ length: 200 }, (_, i) => ({
    id: `l${i}`,
    data: { telefono: scrivi(base[Math.floor(r() * base.length)], Math.floor(r() * 9)) },
  }));
  leads.push({ id: "conphone", phone: "+39 333 000 1111", data: { telefono: "999" } });
  leads.push({ id: "phonevuoto", phone: "", data: { telefono: "3330001111" } });
  const trova = S.indiceSchede(leads);
  const numeri = [
    ...base.flatMap((n) => [n, `+39${n}`, `${n.slice(0, 3)} ${n.slice(3)}`, `+44${n}`]),
    "+393330001111", "3330001111", "", "123", "1234567", "12345678", "+39 123 456 78",
  ];
  let uguali = 0;
  let diversi = [];
  for (const n of numeri) {
    const a = JSON.stringify(S.schedaUnica(leads, n));
    const b = JSON.stringify(trova(n));
    if (a === b) uguali++;
    else diversi.push(n);
  }
  c(`stesso esito di schedaUnica su ${numeri.length} numeri`, [numeri.length, []], [uguali, diversi]);
  c("nessuna scheda → nessuna", { tipo: "nessuna" }, S.indiceSchede([])("+393331112222"));
  c("numero troppo corto → nessuna", { tipo: "nessuna" }, trova("12345"));

  gruppo("L'ELENCO SI DISEGNA A PEZZI");
  const A = [1, 2, 3], B = [4, 5], C2 = [6, 7, 8, 9];
  c("n sopra il totale: tutto com'è (stesse liste)", true, (() => { const [a, b, d] = F.tagliaSezioni(99, A, B, C2); return a === A && b === B && d === C2; })());
  c("la prima sezione ha la precedenza", [[1, 2], [], []], F.tagliaSezioni(2, A, B, C2));
  c("il taglio passa alla sezione dopo", [A, [4], []], F.tagliaSezioni(4, A, B, C2));
  c("zero e negativo: niente righe", [[], [], []], F.tagliaSezioni(-3, A, B, C2));
  c("non muta l'ingresso", [1, 2, 3], A);
  c("prime righe e passo sensati", true, F.RIGHE_INIZIALI >= 20 && F.PASSO_RIGHE >= 20);

  gruppo("costruisciChat: ordine e regole");
  const t = (min) => new Date(Date.UTC(2026, 9, 30, 12, 0) - min * 60_000).toISOString();
  const adesso = Date.UTC(2026, 9, 30, 12, 0);
  const contatto = (id, tel, min, extra = {}) => ({
    id, user_id: "u", phone_e164: tel, lead_id: null, display_name: null, last_message_at: t(min),
    unread_count: 0, created_at: t(min + 5), updated_at: t(min),
    ultimo_in_entrata_il: t(min), ultimo_in_entrata_anteprima: "ciao", risposto_il: null,
    ultimo_messaggio_il: t(min), ultimo_messaggio_anteprima: "ciao", ultimo_messaggio_direzione: "inbound", ...extra,
  });
  const lead = (id, tel, stato = "da_contattare") => ({ id, user_id: "u", created_at: t(999), updated_at: t(999), data: { nome: "N", cognome: id, telefono: tel, stato } });
  const out = K.costruisciChat({
    tutti: [], adesso, ottimistici: {},
    contacts: [contatto("c1", "+393331110001", 30), contatto("c2", "+393331110002", 10), contatto("c3", "+393331110003", 20, { risposto_il: t(5), ultimo_messaggio_direzione: "outbound" })],
    leads: [lead("L2", "333 111 0002"), lead("L3a", "3331110003"), lead("L3b", "+39 333 111 0003")],
  });
  c("dall'ultimo movimento", ["+393331110002", "+393331110003", "+393331110001"], out.map((x) => x.phone));
  c("una scheda sola per numero la collega", "L2", out[0].lead?.id);
  c("due schede sul numero: ambigua, nessuna scelta", [null, true], [out[1].lead, out[1].schedaAmbigua]);
  c("senza scheda lo dice", true, out[2].senzaScheda);
  c("chi ha scritto per ultimo aspetta, chi ha avuto risposta no", [true, false, true], out.map((x) => x.daRispondere.attesa));
  c("la finestra di 24 ore si calcola", [true, true, true], out.map((x) => x.finestra.aperta));
  const scelta = K.costruisciChat({ tutti: [], adesso, ottimistici: {}, contacts: [contatto("c9", "+393331110009", 5, { lead_id: "L9" })], leads: [lead("L9", "999"), lead("L10", "3331110009")] });
  c("la scheda scelta sul contatto vince sul numero", "L9", scelta[0].lead?.id);
}
