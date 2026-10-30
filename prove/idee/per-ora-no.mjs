/** ── PROVE: STATO «PER ORA NO» (30/10/2026) ─────────────────────────────────
 *  Richiesta del titolare: chi dice «non ho soldi ora», «ci sentiamo più
 *  avanti». Famiglia rossa accanto a «Non interessato», nessun messaggio
 *  automatico, la data di ricontatto lo porta in «Da fare oggi».
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function provePerOraNo(mod, { c, gruppo, radice }) {
  const T = mod["types"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");

  gruppo("PER ORA NO: ETICHETTA, FASE E COLORE");
  c("l'etichetta è corta", "Per ora no", T.LEAD_STATUS_LABEL.per_ora_no);
  c("«più avanti» sta nella descrizione", true, /più avanti/.test(T.LEAD_STATUS_NOTA.per_ora_no));
  c(
    "è nella fase dei persi, come Non interessato",
    [T.fasePer("annullato"), "persa"],
    [T.fasePer("per_ora_no"), "persa"],
  );
  c("colore: famiglia rossa", true, /rose/.test(T.LEAD_STATUS_COLOR.per_ora_no));
  c(
    "colore: ma distinguibile da Non interessato",
    true,
    T.LEAD_STATUS_COLOR.per_ora_no !== T.LEAD_STATUS_COLOR.annullato,
  );
  c("gli altri stati non cambiano colore", T.LEAD_PHASE_COLOR.persa, T.LEAD_STATUS_COLOR.annullato);

  gruppo("PER ORA NO: NEL SELETTORE, VICINO A NON INTERESSATO");
  const vicino = (elenco) => elenco.indexOf("per_ora_no") - elenco.indexOf("annullato");
  c("lead importato: c'è, subito dopo Non interessato", 1, vicino(T.statiPer({ importato: true })));
  c("lead di sempre: c'è, subito dopo Non interessato", 1, vicino(T.statiPer({})));
  c("fra gli stati da scegliere", 1, vicino(T.SELECTABLE_LEAD_STATUSES));
  c("fra tutti gli stati (filtri, pipeline)", true, T.ALL_LEAD_STATUSES.includes("per_ora_no"));
  const selettore = leggi("src/crm/SelettoreStatoDialog.tsx");
  c(
    "nel selettore ha la sua icona e la sua barretta",
    true,
    /per_ora_no: CalendarClock/.test(selettore) && /PUNTO_PER_ORA_NO/.test(selettore),
  );
  const Q = mod["quando-per-stato"];
  c(
    "chiede «quando ricontattarlo» sui campi del ricontatto",
    ["dataRicontatto", "oraRicontatto", false],
    [
      Q.QUANDO_PER_STATO.per_ora_no.chiaveData,
      Q.QUANDO_PER_STATO.per_ora_no.chiaveOra,
      Q.QUANDO_PER_STATO.per_ora_no.oraObbligatoria,
    ],
  );
  c(
    "e la data è saltabile («Non adesso»)",
    true,
    /Non adesso/.test(leggi("src/crm/LeadDialog.tsx")) &&
      /Non adesso/.test(Q.QUANDO_PER_STATO.per_ora_no.nota),
  );
  c(
    "nella scheda c'è la pastiglia accanto a Non interessato",
    true,
    /Non interessato\s*<\/Pillola>[\s\S]{0,400}stato === "per_ora_no"/.test(
      leggi("src/crm/LeadDialog.tsx"),
    ),
  );

  gruppo("PER ORA NO: IL FILTRO DELLA CHAT");
  const { passaFiltro } = mod["chatwa/cercaChat"];
  const chat = (stato) => ({ lead: stato ? { data: { stato } } : null });
  c(
    "per ora no: sì; Non interessato, attesa e senza scheda: no",
    [true, false, false, false],
    [
      passaFiltro(chat("per_ora_no"), "per-ora-no"),
      passaFiltro(chat("annullato"), "per-ora-no"),
      passaFiltro(chat("attesa_whatsapp"), "per-ora-no"),
      passaFiltro(chat(null), "per-ora-no"),
    ],
  );
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  c(
    "la pastiglia c'è, col numero",
    true,
    /l: "Per ora no"/.test(elenco) && /f\.v === "per-ora-no"/.test(elenco),
  );

  gruppo("PER ORA NO: NESSUN MESSAGGIO AUTOMATICO, NESSUNO SPOSTAMENTO");
  c(
    "nessuna riga nella tabella ManyChat",
    undefined,
    mod["manychat/stati"].TABELLA_STATI.per_ora_no,
  );
  c(
    "non è un lead nuovo (niente primo contatto né richiamo a 24 ore)",
    false,
    mod["manychat/sequenze"].STATI_LEAD_NUOVO.includes("per_ora_no"),
  );
  c(
    "nessun suggerimento di modello in chat",
    [],
    mod["chatwa/modelli-casella"].candidatiPerStato({ stato: "per_ora_no" }, "2026-10-30", 600),
  );
  c(
    "nessun link di prenotazione",
    false,
    mod["manychat/prenota-scheda"].puoPrenotare(
      { stato: "per_ora_no" },
      new Date("2026-10-30T10:00:00Z"),
    ).ok,
  );
  c("non è una scheda da telefonare", false, T.eStatoDaChiamare("per_ora_no"));

  gruppo("PER ORA NO: ESCLUSO DAL RITORNO IN ATTESA WHATSAPP");
  const A = mod["importa/attesa-da-chiamare"];
  const adesso = new Date("2026-10-30T10:00:00Z");
  const entrata = { ultimoInEntrataIl: "2026-10-30T09:00:00Z" };
  const scheda = (stato) => ({ stato, statoDal: "2026-10-28T12:00:00Z", note: "x" });
  c(
    "controllo: Non risponde con la stessa scheda torna in attesa",
    "attesa_whatsapp",
    A.patchRitornoAttesa(scheda("non_risponde"), entrata, adesso)?.stato,
  );
  c(
    "Per ora no resta com'è anche se il cliente scrive",
    null,
    A.patchRitornoAttesa(scheda("per_ora_no"), entrata, adesso),
  );
  c("l'elenco chiuso non lo contiene", false, A.STATI_CHE_TORNANO_IN_ATTESA.includes("per_ora_no"));
  c(
    "e il passaggio a «Da chiamare» non lo tocca",
    null,
    A.patchDaChiamare(scheda("per_ora_no"), { ultimoInEntrataIl: "2026-10-25T09:00:00Z" }, adesso),
  );

  gruppo("PER ORA NO: LA DATA DI RICONTATTO LO PORTA IN «DA FARE OGGI»");
  const DF = mod["dafare/righe"];
  const ora = new Date("2026-10-30T10:00:00");
  const lead = (id, data) => ({
    id,
    data: { nome: "Mario", cognome: "Esempio", stato: "per_ora_no", ...data },
  });
  const righe = DF.costruisciRighe({
    ora,
    task: [],
    leads: [
      lead("oggi", { dataRicontatto: "2026-10-30", oraRicontatto: "16:00" }),
      lead("domani", { dataRicontatto: "2026-10-31" }),
      lead("senza", {}),
    ],
  });
  const di = (id) => righe.find((r) => r.id === `lead:${id}`);
  c(
    "con la data di oggi compare, come ricontatto, alla sua ora",
    ["ricontatto", "2026-10-30", "16:00"],
    [di("oggi")?.tipo, di("oggi")?.giorno, di("oggi")?.ora],
  );
  c(
    "…e la frase dice «per ora no»",
    true,
    /per ora no/.test(DF.verboRiga("ricontatto", "per_ora_no")),
  );
  c("con una data futura non compare oggi: aspetta il suo giorno", undefined, di("domani"));
  c("senza data non compare: nessuno lo disturba", undefined, di("senza"));
}
