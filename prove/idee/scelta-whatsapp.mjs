/** ── PROVE: LA SCELTA «WHATSAPP» / «WHATSAPP DEL CRM» (30/10/2026) ─────────── */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSceltaWhatsapp(mod, { c, gruppo, radice }) {
  gruppo("SCELTA WHATSAPP: IL CONTATTO GIUSTO E LA FINESTRA DI 23 ORE");
  const S = mod["chatwa/scelta-whatsapp"];
  const adesso = new Date("2026-10-30T12:00:00Z");
  const id1 = "11111111-1111-4111-8111-111111111111";
  const id2 = "22222222-2222-4222-8222-222222222222";
  c("filtro sulle ultime 9 cifre", "%331234567", S.filtroNumero("+39 333 123 4567"));
  c("numero troppo corto: nessun filtro", "", S.filtroNumero("1234"));
  const righe = [
    { id: id1, phone_e164: "+393331234567", ultimo_in_entrata_il: "2026-10-28T10:00:00Z" },
    { id: id2, phone_e164: "393331234567", ultimo_in_entrata_il: "2026-10-30T09:00:00Z" },
    { id: "33333333-3333-4333-8333-333333333333", phone_e164: "+393339999999", ultimo_in_entrata_il: "2026-10-30T11:00:00Z" },
  ];
  c("con e senza «+»: vince l'entrata più recente dello stesso numero", id2, S.contattoDelNumero(righe, "3331234567")?.id);
  c("nessuna riga del numero: null", null, S.contattoDelNumero(righe, "+393400000000"));
  c("senza entrate: il contatto c'è lo stesso", id1, S.contattoDelNumero([{ id: id1, phone_e164: "+393331234567", ultimo_in_entrata_il: null }], "3331234567")?.id);

  c("scritto 3 ore fa: CRM acceso, sulla sua chat", { stato: "aperta", contattoId: id2 },
    S.sceltaCrm({ id: id2, ultimo_in_entrata_il: "2026-10-30T09:00:00Z" }, adesso));
  c("scritto 23 ore e 1 minuto fa: chiusa (regola delle 23 ore)", "chiusa",
    S.sceltaCrm({ id: id2, ultimo_in_entrata_il: "2026-10-29T12:59:00Z" }, adesso).stato);
  c("scritto 22 ore fa: aperta", "aperta",
    S.sceltaCrm({ id: id2, ultimo_in_entrata_il: "2026-10-29T14:00:00Z" }, adesso).stato);
  c("mai scritto: chiusa", "chiusa", S.sceltaCrm({ id: id1, ultimo_in_entrata_il: null }, adesso).stato);
  c("nessun contatto: chiusa, senza chat", { stato: "chiusa", contattoId: null }, S.sceltaCrm(null, adesso));

  c("link alla chat del CRM col contatto", `/CRM/whatsapp?chat=${id1}`, S.linkChatCrm(id1));
  c("id non valido: nessun link (la pagina vuole un uuid)", "", S.linkChatCrm("393331234567"));
  c("la frase della finestra chiusa", true, /Finestra di 24 ore chiusa/.test(S.FRASE_FINESTRA_CHIUSA) && /modello/.test(S.FRASE_FINESTRA_CHIUSA));

  c("il nativo: wa.me col testo", "https://wa.me/393331234567?text=Ciao", S.linkNativo("+39 333 1234567", "Ciao", ""));
  c("il nativo su Android: Business prima", true, S.linkNativo("+393331234567", "", "Linux; Android 14").startsWith("intent://"));
  c("il nativo con numero rotto: vuoto", "", S.linkNativo("123", "Ciao", ""));

  gruppo("SCELTA WHATSAPP: I PUNTI D'INGRESSO VERSO I LEAD USANO IL COMPONENTE");
  const comp = readFileSync(join(radice, "src/crm/chatwa/SceltaWhatsapp.tsx"), "utf8");
  c("il componente legge la finestra al tocco e spegne il CRM se chiusa", true,
    /ultimo_in_entrata_il/.test(comp) && /sceltaCrm\(/.test(comp) && /FRASE_FINESTRA_CHIUSA/.test(comp) && /aria-disabled/.test(comp));
  c("tocchi da 44 px", true, /min-h-11/.test(comp));
  const usano = [
    "src/crm/TastoMessaggio.tsx",
    "src/crm/LeadDialog.tsx",
    "src/crm/kpi/DaFareScheda.tsx",
    "src/crm/dafare/VoceDaFare.tsx",
    "src/crm/MeetGiornalieri.tsx",
    "src/crm/preventivi/Riga.tsx",
  ];
  for (const f of usano) {
    const s = readFileSync(join(radice, f), "utf8");
    c(`${f}: usa LinkWhatsapp`, true, /<LinkWhatsapp/.test(s));
  }
  //  Le pagine pubbliche per i clienti restano col link diretto.
  for (const f of ["src/routes/preventivo.tsx", "src/routes/webinar_.$code.tsx", "src/routes/prova-capelli.tsx", "src/routes/nuova.tsx"]) {
    let s = "";
    try { s = readFileSync(join(radice, f), "utf8"); } catch { continue; }
    c(`${f}: niente scelta (pagina pubblica)`, false, /LinkWhatsapp/.test(s));
  }
}
