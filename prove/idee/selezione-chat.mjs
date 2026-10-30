/** ── PROVE: SELEZIONE DELLE CHAT E AZIONI IN BLOCCO (30/10/2026) ─────────────
 *  Richiesta del titolare: tenere premuto su una chat, come su WhatsApp, e poi
 *  «seleziona tutto» e un'azione per tutte (da leggere, letto, …).
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSelezioneChat(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/selezione"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const chat = (phone, extra = {}) => ({
    phone,
    unread: 0,
    haContatto: true,
    inAttesa: false,
    stelle: 0,
    ...extra,
  });

  gruppo("SELEZIONE: TOCCA, TOGLI, SELEZIONA TUTTO");
  const uno = S.commuta(new Set(), "+391");
  c("un tocco aggiunge la chat", ["+391"], [...uno]);
  c("un secondo tocco la toglie", [], [...S.commuta(uno, "+391")]);
  c("il tocco non cambia l'insieme di prima", ["+391"], [...uno]);
  const visibili = [chat("+391"), chat("+392"), chat("+393")];
  c("seleziona tutto: le visibili", ["+391", "+392", "+393"], [...S.selezionaTutte(visibili)]);
  c("tutte selezionate: sì", true, S.sonoTutte(new Set(["+391", "+392", "+393"]), visibili));
  c("una manca: no", false, S.sonoTutte(new Set(["+391", "+392"]), visibili));
  c("elenco vuoto: non è «tutte»", false, S.sonoTutte(new Set(), []));
  c(
    "cambia il filtro: restano scelte solo le chat che si vedono",
    ["+392"],
    S.soloVisibili(new Set(["+391", "+392"]), [chat("+392"), chat("+393")]).map((x) => x.phone),
  );
  c(
    "le chat scelte e nascoste non entrano mai nell'azione",
    [],
    S.soloVisibili(new Set(["+399"]), visibili).map((x) => x.phone),
  );
  c(
    "il telefono doppio (due riquadri) conta una volta",
    ["+391"],
    S.senzaDoppioni([chat("+391"), chat("+391")]).map((x) => x.phone),
  );

  gruppo("SELEZIONE: LA PRESSIONE LUNGA");
  c("tempo come su WhatsApp, circa mezzo secondo", true, S.PRESSIONE_LUNGA_MS >= 400 && S.PRESSIONE_LUNGA_MS <= 500);
  c("un dito che scorre non è una pressione lunga", true, S.eSpostamento(0, 14));
  c("un dito fermo (tremolio) sì", false, S.eSpostamento(3, 4));
  c("lo spostamento in orizzontale conta", true, S.eSpostamento(-12, 0));

  gruppo("SELEZIONE: «SEGNA COME LETTO» TOCCA SOLO CHI HA DA LEGGERE");
  const mix = [chat("+391", { unread: 3 }), chat("+392"), chat("+393", { unread: 1 })];
  const letto = S.pianoAzione("letto", mix, null);
  c("letto: scrive solo sulle chat con non letti", ["+391", "+393"], letto.fare);
  c("letto: l'altra era già a posto", ["+392"], letto.gia);
  c("letto: niente saltate", [], letto.saltate);

  gruppo("SELEZIONE: «SEGNA COME DA LEGGERE»");
  const dl = S.pianoAzione("da-leggere", [...mix, chat("+394", { haContatto: false })], "+392");
  c("da leggere: solo dove non c'era il badge e non è la chat aperta", [], dl.fare);
  const dl2 = S.pianoAzione("da-leggere", [...mix, chat("+394", { haContatto: false }), chat("+395")], "+392");
  c("da leggere: la 395 sì", ["+395"], dl2.fare);
  c("da leggere: chi ha già il badge è a posto", ["+391", "+393"], dl2.gia);
  c(
    "da leggere: la chat aperta e quella senza contatto sono saltate, con il motivo",
    [
      { phone: "+392", motivo: "aperta" },
      { phone: "+394", motivo: "senza-contatto" },
    ],
    dl2.saltate,
  );

  gruppo("SELEZIONE: «FATTO» E «IN OSSERVAZIONE»");
  const fa = S.pianoAzione(
    "fatto",
    [chat("+391", { inAttesa: true }), chat("+392"), chat("+393", { inAttesa: true, haContatto: false })],
    null,
  );
  c("fatto: solo chi è in «Da rispondere»", ["+391"], fa.fare);
  c("fatto: le altre non c'entravano", ["+392"], fa.gia);
  c("fatto: in attesa ma senza contatto = saltata", [{ phone: "+393", motivo: "senza-contatto" }], fa.saltate);
  const os = S.pianoAzione("osservazione", [chat("+391", { stelle: 2 }), chat("+392")], null);
  c("osservazione: una stella a chi non ne ha, le stelle già messe non si toccano", ["+392"], os.fare);
  c("osservazione: chi ne ha già resta com'è", ["+391"], os.gia);

  gruppo("SELEZIONE: SCRITTURE A BLOCCHI E FRASI DELL'ESITO");
  c("a blocchi da 2", [["a", "b"], ["c", "d"], ["e"]], S.aBlocchi(["a", "b", "c", "d", "e"], 2));
  c("nessun elemento, nessun blocco", [], S.aBlocchi([], 50));
  c("blocchi mai vuoti con N non valido", [["a", "b"]], S.aBlocchi(["a", "b"], 0));
  c("tutto riuscito: «Fatto su 3 chat»", { tipo: "ok", testo: "Fatto su 3 chat" }, S.fraseEsito("letto", { fatte: 3, gia: 0, saltate: 0, fallite: 0 }));
  c("una sola chat al singolare", "Fatto su 1 chat", S.fraseEsito("letto", { fatte: 1, gia: 0, saltate: 0, fallite: 0 }).testo);
  c(
    "con chat già a posto lo dice",
    { tipo: "ok", testo: "Fatto su 2 chat · 1 era già a posto" },
    S.fraseEsito("letto", { fatte: 2, gia: 1, saltate: 0, fallite: 0 }),
  );
  c(
    "errore parziale: dice quante sono riuscite e quante no",
    { tipo: "parziale", testo: "Riuscito su 2 chat, non su 1: riprova" },
    S.fraseEsito("letto", { fatte: 2, gia: 0, saltate: 0, fallite: 1 }),
  );
  c(
    "tutto fallito: errore, non un successo",
    { tipo: "errore", testo: "Non è riuscito su nessuna delle 2 chat: riprova" },
    S.fraseEsito("letto", { fatte: 0, gia: 0, saltate: 0, fallite: 2 }),
  );
  c(
    "niente da fare perché già tutto a posto",
    { tipo: "niente", testo: "Era già tutto a posto" },
    S.fraseEsito("letto", { fatte: 0, gia: 3, saltate: 0, fallite: 0 }),
  );
  c(
    "saltate: si dice perché",
    { tipo: "parziale", testo: "Fatto su 1 chat · 1 saltata: la chat aperta resta letta (chiudila e riprova)" },
    S.fraseEsito("da-leggere", { fatte: 1, gia: 0, saltate: 1, fallite: 0, motivoSaltate: "aperta" }),
  );
  c(
    "saltate senza contatto: si dice perché",
    "Fatto su 1 chat · 2 saltate: non hanno ancora un contatto",
    S.fraseEsito("fatto", { fatte: 1, gia: 0, saltate: 2, fallite: 0, motivoSaltate: "senza-contatto" }).testo,
  );

  gruppo("SELEZIONE: COME È CABLATA (letto nei file veri)");
  const riga = leggi("src/crm/chatwa/RigaChat.tsx");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const barra = leggi("src/crm/chatwa/BarraSelezione.tsx");
  const hook = leggi("src/crm/chatwa/useChatWa.ts");
  c("la riga ascolta la pressione lunga e blocca il menu del telefono", true,
    /onPointerDown/.test(riga) && /PRESSIONE_LUNGA_MS/.test(riga) && /onContextMenu/.test(riga));
  c("la pressione lunga non apre la chat al rilascio", true, /lungo\.current/.test(riga));
  c("in selezione la riga non porta fuori (tasti interni inerti)", true, /inert/.test(riga));
  c("la riga dice a chi legge se è selezionata", true, /aria-pressed/.test(riga));
  c("l'elenco esce con Esc", true, /Escape/.test(elenco));
  c("l'elenco seleziona le chat VISIBILI, non tutte", true, /soloVisibili\(/.test(elenco) && /selezionaTutte\(/.test(elenco));
  c("la barra: seleziona tutto, annulla, le quattro azioni", true,
    /Seleziona tutto/.test(barra) && /Annulla/.test(barra) && /Segna come letto/.test(barra) &&
      /Segna come da leggere/.test(barra) && /Fatto/.test(barra) && /In osservazione/.test(barra));
  c("i tasti della barra sono da 44 px sul telefono", true, /h-11/.test(barra));
  c("la barra dà l'esito a chi usa il lettore di schermo", true, /aria-live|role="status"/.test(barra) || /toast\./.test(elenco));
  c("«letto» in blocco scrive come l'apertura: unread_count a 0, con l'utente, a blocchi", true,
    /segnaLetto: \(telefoni\) => scriviNonLetti\(telefoni, 0\)/.test(hook) && /\.in\("phone_e164"/.test(hook) && /aBlocchi\(/.test(hook));
  c("mai su chat di altri: ogni scrittura in blocco filtra per user_id", true,
    /in\("phone_e164"[\s\S]{0,200}eq\("user_id"|eq\("user_id"[\s\S]{0,200}in\("phone_e164"/.test(hook));
  c("«Fatto» in blocco usa la stessa funzione del database di «Fatto»", true,
    (hook.match(/whatsapp_segna_fatto/g) ?? []).length >= 2);
}
