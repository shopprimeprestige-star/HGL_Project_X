/** ── PROVE: «RICONTATTI» CON STATO + ESITO + DATA, FILTRI COMBINATI (31/10/2026) ─────────────────
 *  Regole in src/crm/chatwa/ricontatti.ts e filtri.ts; il disegno in RigheRisentire.tsx, RigaChat.tsx
 *  e FinestraEsito.tsx. Richiesta del titolare: «Attesa acconto + non ha risposto», un lead che era in
 *  Attesa acconto e poi ha detto «sentiamoci più avanti»; con data icona calendario, senza data icona X.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveRisentire(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/ricontatti"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333222${String(n).padStart(4, "0")}`,
      lead: {
        data: {
          stato: o.stato ?? "in_attesa_acconto",
          consulenteId: "io",
          dataRicontatto: o.data,
          oraRicontatto: o.ora,
          esitoRicontatto: o.esito,
        },
      },
      daRispondere: { attesa: false },
    };
  };
  const nessuno = () => 0;
  const r = (o = {}) => ({ stato: "", esito: "", data: "", ...o });
  const tel = (l) => l.map((x) => x.phone);

  // Il mondo: sei lead miei
  const a = chat({ stato: "in_attesa_acconto", esito: "non_ha_risposto", data: "2026-11-05" });
  const b = chat({ stato: "in_attesa_acconto", esito: "piu_avanti" });
  const d = chat({ stato: "per_ora_no", esito: "piu_avanti", data: "2026-12-01" });
  const e = chat({ stato: "per_ora_no" });
  const f = chat({ stato: "da_ricontattare", esito: "ci_sta_pensando", data: "2026-11-02" });
  const g = chat({ stato: "da_ricontattare", esito: "aspetta_i_soldi" });
  const mondo = [a, b, d, e, f, g];
  const vedo = (x) => tel(mondo.filter((ch) => R.passaRisentire(ch, x)));

  gruppo("RISENTIRE: GLI ESITI");
  c(
    "sono i quattro del titolare, in questo ordine",
    ["Non ha risposto", "Sentiamoci più avanti", "Ci sta pensando", "Aspetta i soldi"],
    R.ESITI_RICONTATTO.map((x) => x.nome),
  );
  c("i valori sono tutti diversi", 4, new Set(R.ESITI_RICONTATTO.map((x) => x.v)).size);
  c("esitoDi legge il valore messo sulla scheda", "piu_avanti", R.esitoDi(b));
  c("un valore sconosciuto vale «nessun esito»", null, R.esitoDi(chat({ esito: "boh" })));
  c("senza il campo, nessun esito", null, R.esitoDi(chat({})));
  c("un numero senza scheda non ha esito", null, R.esitoDi({ lead: null }));

  gruppo("RISENTIRE: LA DATA");
  c("giorno valido = con data", "2026-11-05", R.dataDi(a));
  c("niente = senza data", "", R.dataDi(b));
  c("una data rotta = senza data", "", R.dataDi(chat({ data: "2026-13-45" })));
  c("con l'ora in coda si legge il giorno", "2026-11-05", R.dataDi(chat({ data: "2026-11-05T10:00:00Z" })));
  c(
    "per la riga: la data si legge anche in «Da contattare», che nel CRM non la chiede",
    "Richiamo domani",
    ((x) => (x ? x.testo : null))(
      mod["chatwa/richiamo"].etichettaRichiamo(R.datiPerData(chat({ stato: "da_contattare", data: "2026-11-01" }).lead.data), "2026-10-31"),
    ),
  );

  gruppo("RISENTIRE: I FILTRI SI COMBINANO (E)");
  c("nessun filtro: tutti", tel(mondo), vedo(r()));
  c("solo stato: Attesa acconto", tel([a, b]), vedo(r({ stato: "in_attesa_acconto" })));
  c("solo esito: Sentiamoci più avanti", tel([b, d]), vedo(r({ esito: "piu_avanti" })));
  c("solo data: con data", tel([a, d, f]), vedo(r({ data: "con" })));
  c("solo data: senza data", tel([b, e, g]), vedo(r({ data: "senza" })));
  c("stato + esito (il caso del titolare)", tel([b]), vedo(r({ stato: "in_attesa_acconto", esito: "piu_avanti" })));
  c("Attesa acconto + non ha risposto", tel([a]), vedo(r({ stato: "in_attesa_acconto", esito: "non_ha_risposto" })));
  c("stato + senza data", tel([b]), vedo(r({ stato: "in_attesa_acconto", data: "senza" })));
  c("stato + esito + data", tel([d]), vedo(r({ stato: "per_ora_no", esito: "piu_avanti", data: "con" })));
  c("una combinazione vuota dà zero", [], vedo(r({ stato: "da_ricontattare", esito: "non_ha_risposto" })));
  c("«Senza esito» prende chi non ne ha", tel([e]), vedo(r({ esito: "nessuno" })));
  c("Per ora no + senza esito", tel([e]), vedo(r({ stato: "per_ora_no", esito: "nessuno" })));
  c("l'esito resta quando lo stato cambia: era Attesa acconto, ora Per ora no, con «più avanti»", tel([d]), vedo(r({ stato: "per_ora_no", esito: "piu_avanti" })));

  gruppo("RISENTIRE: I NUMERI SULLE PASTIGLIE (cosa vedresti toccando)");
  const conta = (x, campo, v) => R.contaRisentire(mondo, x, campo, v);
  c("senza altro, Attesa acconto = 2", 2, conta(r(), "stato", "in_attesa_acconto"));
  c("con l'esito «più avanti» già scelto, Attesa acconto = 1", 1, conta(r({ esito: "piu_avanti" }), "stato", "in_attesa_acconto"));
  c("e Per ora no = 1", 1, conta(r({ esito: "piu_avanti" }), "stato", "per_ora_no"));
  c("la riga dell'esito conta con lo stato scelto, non con l'esito scelto", 1, conta(r({ stato: "in_attesa_acconto", esito: "piu_avanti" }), "esito", "non_ha_risposto"));
  c("senza esito: conta chi non ne ha", 1, conta(r({ stato: "per_ora_no" }), "esito", "nessuno"));
  c("con data / senza data", [3, 3], [conta(r(), "data", "con"), conta(r(), "data", "senza")]);
  c("il numero della pastiglia scelta è quello che si vede", vedo(r({ stato: "per_ora_no" })).length, conta(r({ stato: "per_ora_no" }), "stato", "per_ora_no"));

  gruppo("RISENTIRE: GLI STATI NELLA RIGA");
  c("solo quelli che hanno chat, nell'ordine del CRM", ["da_ricontattare", "in_attesa_acconto", "per_ora_no"].sort(), R.statiRisentire(mondo, r()).sort());
  c("lo stato scelto resta anche se intanto non ha più chat", true, R.statiRisentire([a], r({ stato: "per_ora_no" })).includes("per_ora_no"));
  c("ogni stato ha un'etichetta diversa (niente doppioni nella riga)", true, ((et) => new Set(et).size === et.length)([...R.STATI_RICONTATTI].map((s) => mod["types"].LEAD_STATUS_LABEL[s])));

  gruppo("RISENTIRE: TOCCARE UNA PASTIGLIA");
  c("la accende", "per_ora_no", R.commutaRisentire(r(), "stato", "per_ora_no").stato);
  c("toccarla di nuovo la spegne", "", R.commutaRisentire(r({ stato: "per_ora_no" }), "stato", "per_ora_no").stato);
  c("sceglierne un'altra della stessa riga sostituisce", "da_ricontattare", R.commutaRisentire(r({ stato: "per_ora_no" }), "stato", "da_ricontattare").stato);
  c("le altre righe restano (combinano)", ["per_ora_no", "piu_avanti", "senza"], ((x) => [x.stato, x.esito, x.data])(R.commutaRisentire(R.commutaRisentire(R.commutaRisentire(r(), "stato", "per_ora_no"), "esito", "piu_avanti"), "data", "senza")));
  c("«acceso» dice se c'è qualcosa", [false, true], [R.risentireAcceso(r()), R.risentireAcceso(r({ data: "con" }))]);

  gruppo("RISENTIRE: DENTRO I FILTRI DELLA CHAT");
  const con = (o) => ({ ...F.FILTRI_VUOTI, ...o });
  const dentro = (o) => tel(mondo.filter((ch) => F.passaFiltri(ch, con({ ricontatti: true, io: "io", ...o }), nessuno)));
  c("Ricontatti da solo: tutti i miei", tel(mondo), dentro({}));
  c("Ricontatti + Attesa acconto + non ha risposto", tel([a]), dentro({ rStato: "in_attesa_acconto", rEsito: "non_ha_risposto" }));
  c("Ricontatti + senza data", tel([b, e, g]), dentro({ rData: "senza" }));
  c("spento Ricontatti, i campi non filtrano", tel(mondo), tel(mondo.filter((ch) => F.passaFiltri(ch, con({ rData: "senza" }), nessuno))));
  c("i filtri nuovi non contano sul tasto «Filtri»", 1, F.contaAccesi(con({ ricontatti: true, rStato: "per_ora_no", rEsito: "piu_avanti", rData: "con" })));
  c("il numero di «Ricontatti» in riga resta quello di prima", mondo.length, F.contaVoce(mondo, con({ io: "io", rStato: "per_ora_no" }), nessuno, "ricontatti", true));
  const acceso = con({ ricontatti: true, io: "io", rStato: "per_ora_no", rEsito: "nessuno", rData: "senza" });
  c("spegnere Ricontatti azzera anche i tre", ["", "", ""], ((x) => [x.rStato, x.rEsito, x.rData])(F.commuta(acceso, "ricontatti", true)));
  c("accendere un'altra voce li azzera", ["", "", ""], ((x) => [x.rStato, x.rEsito, x.rData])(F.commuta(acceso, "coda", "da-rispondere")));
  c("la ✕ del riepilogo (togli) azzera anche i tre", ["", "", ""], ((x) => [x.rStato, x.rEsito, x.rData])(F.togli(acceso, "ricontatti")));
  const etich = F.etichetteAccese(con({ ricontatti: true, rStato: "in_attesa_acconto", rEsito: "non_ha_risposto", rData: "senza" }), (x) => x);
  c("ogni riga accesa ha la sua etichetta con la ✕, dopo «Ricontatti»", ["Ricontatti", "Attesa acconto", "Non ha risposto", "Senza data"], etich.map((e) => e.etichetta));
  c("e la ✕ toglie solo quella riga", ["", "non_ha_risposto", "senza", true], ((x) => [x.rStato, x.rEsito, x.rData, x.ricontatti])(F.togli(con({ ricontatti: true, rStato: "in_attesa_acconto", rEsito: "non_ha_risposto", rData: "senza" }), "rStato")));
  c("«Senza esito» si legge così nel riepilogo", "Senza esito", F.etichetteAccese(con({ ricontatti: true, rEsito: "nessuno" }), (x) => x)[1].etichetta);
  c("«Tutte» (FILTRI_VUOTI) li ha vuoti", ["", "", ""], [F.FILTRI_VUOTI.rStato, F.FILTRI_VUOTI.rEsito, F.FILTRI_VUOTI.rData]);

  gruppo("RISENTIRE: SALVATAGGIO NEL BROWSER");
  const salvato = F.leggiFiltri(F.scriviFiltriSessione(acceso), null);
  c("si ricordano", ["per_ora_no", "nessuno", "senza", true], [salvato.rStato, salvato.rEsito, salvato.rData, salvato.ricontatti]);
  c("un valore strano si ignora", ["", "", ""], ((x) => [x.rStato, x.rEsito, x.rData])(F.leggiFiltri(JSON.stringify({ ricontatti: true, rStato: "inventato", rEsito: "boh", rData: "forse" }), null)));
  c("senza Ricontatti acceso non restano", ["", "", ""], ((x) => [x.rStato, x.rEsito, x.rData])(F.leggiFiltri(JSON.stringify({ coda: "da-chiamare", rStato: "per_ora_no", rData: "con" }), null)));
  c("soloUno li porta con Ricontatti", "per_ora_no", F.soloUno(acceso).rStato);
  c("soloUno li toglie se vince un altro filtro", "", F.soloUno(con({ fase: "per-ora-no", ricontatti: true, rStato: "per_ora_no" })).rStato);

  gruppo("RISENTIRE: IL DISEGNO");
  const righe = senzaCommenti(leggi("src/crm/chatwa/RigheRisentire.tsx"));
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const finestra = senzaCommenti(leggi("src/crm/chatwa/FinestraEsito.tsx"));
  c("tre righe: Stato, Esito, Data", true, ["Stato", "Esito", "Data"].every((t) => new RegExp(`riga\\("${t}"`).test(righe)));
  c("pastiglie da 44 px sul telefono", true, /h-11/.test(righe) && /lg:pointer-fine:h-8/.test(righe));
  c("ogni pastiglia dice se è accesa (aria-pressed), non solo col colore", true, /aria-pressed=\{/.test(righe));
  c("ogni riga scorre di lato e ha un nome per chi usa lo screen reader", true, /RIGA_SCORREVOLE/.test(righe) && /role="group"/.test(righe) && /aria-label=\{`/.test(righe));
  c("il numero sulla pastiglia c'è", true, /Contatore/.test(righe) && /contaRisentire\(/.test(righe));
  c("«Con data» ha il calendario e «Senza data» l'icona X (lucide, outline)", true, /CalendarClock/.test(righe) && /CalendarX/.test(righe));
  c("un solo «Azzera» in pagina (quello del riepilogo): le righe non ne hanno un secondo", false, /Azzera/.test(righe));
  c("compaiono solo in Ricontatti", true, /filtri\.ricontatti[\s\S]{0,200}RigheRisentire|RigheRisentire[\s\S]{0,80}/.test(elenco) && /<RigheRisentire/.test(elenco));
  c("la riga mostra «Senza data» con la X", true, /CalendarX/.test(riga) && /Senza data/.test(riga));
  c("e la data col calendario (richiamo) come prima", true, /CalendarClock/.test(riga));
  c("l'esito è una pastiglia che si tocca, con 44 px sul telefono", true, /FinestraEsito/.test(riga) && /after:-inset-y-3/.test(riga) && /aria-haspopup="dialog"/.test(riga));
  c("l'esito si salva come gli altri campi della scheda (updateLead)", true, /updateLead\(/.test(riga) && /esitoRicontatto/.test(riga) && /esitoRicontattoIl/.test(riga));
  c("togliere l'esito lo toglie davvero", true, /esitoRicontatto: undefined/.test(riga));
  c("se il salvataggio non riesce, lo si dice", true, /toast\.error\(/.test(riga));
  c("le altre viste non cambiano: l'esito e «Senza data» solo in Ricontatti", true, /risentire/.test(riga) && /risentire=\{filtri\.ricontatti\}/.test(elenco));
  c("la finestra dell'esito: le quattro scelte, «Nessun esito» e Annulla, tasti da 44 px", true, /ESITI_RICONTATTO/.test(finestra) && /Nessun esito/.test(finestra) && /Annulla/.test(finestra) && /min-h-11/.test(finestra));
  c("niente emoji nei file nuovi", true, ![righe, finestra].some((t) => /\p{Extended_Pictographic}/u.test(t)));
  c("il campo nuovo è dichiarato sulla scheda", true, /esitoRicontatto\?: string/.test(senzaCommenti(leggi("src/crm/types.ts"))));
  c("il giro automatico non è toccato", true, !/esitoRicontatto/.test(leggi("src/crm/manychat/giro.ts")));
}
