/** ── PROVE: «RICONTATTI» E IL PANNELLO FILTRI PIÙ SEMPLICE (31/10/2026) ───────
 *  Regole in src/crm/chatwa/ricontatti.ts e filtri.ts; il disegno in PannelloFiltri.tsx.
 *  Richiesta del titolare: una scorciatoia «Ricontatti» fra «Sconosciuti» e «Clienti» con tutti i
 *  lead a data (attesa acconto, da contattare, sta valutando…), dalla data più recente in giù,
 *  SOLO i propri anche per l'admin; e un pannello Filtri in cui non ci si perde.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveRicontatti(mod, { c, gruppo, radice }) {
  const R = mod["chatwa/ricontatti"];
  const F = mod["chatwa/filtri"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  // ── Un piccolo mondo di chat finte ────────────────────────────────────────────────────────────
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333111${String(n).padStart(4, "0")}`,
      lead: o.senzaScheda
        ? null
        : {
            data: {
              stato: o.stato ?? "sta_valutando",
              consulenteId: o.consulente === undefined ? "io" : o.consulente,
              dataRicontatto: o.data,
              oraRicontatto: o.ora,
              createdAt: o.arrivo,
              ricontattoPrioritaIl: o.priorita,
              ricontattoNascostoIl: o.nascostoIl,
              ricontattoNascostoPer: o.nascostoPer,
            },
            created_at: o.creata,
          },
      finestra: null,
      daRispondere: { attesa: false },
    };
  };
  const nessuno = () => 0;
  const con = (o) => ({ ...F.FILTRI_VUOTI, ...o });
  const tel = (l) => l.map((x) => x.phone);

  gruppo("RICONTATTI: CHI ENTRA");
  const STATI_DENTRO = [
    "da_ricontattare", // Ricontatto fissato
    "sta_valutando",
    "in_attesa_acconto",
    "gestire_in_chat",
    "da_contattare",
    "fissa_meet_dopo",
    "da_spostare",
    "richiamo",
    "ci_ricontatta_lui",
    "per_ora_no",
    "sede_disdetta",
  ];
  c(
    "ogni stato a data entra",
    STATI_DENTRO.map(() => true),
    STATI_DENTRO.map((s) => R.eRicontatto(chat({ stato: s }))),
  );
  const STATI_FUORI = [
    "attesa_whatsapp",
    "appuntamento_fissato",
    "appuntamento_rifissato",
    "viene_in_sede",
    "non_risponde",
    "segreteria",
    "venduto",
    "posa_in_sede",
    "no_show",
    "annullato",
  ];
  c(
    "gli altri stati no",
    STATI_FUORI.map(() => false),
    STATI_FUORI.map((s) => R.eRicontatto(chat({ stato: s }))),
  );
  c("un numero senza scheda non è un ricontatto", false, R.eRicontatto(chat({ senzaScheda: true })));
  c(
    "l'elenco segue la tabella del CRM: ogni stato che chiede dataRicontatto c'è",
    true,
    /QUANDO_PER_STATO/.test(senzaCommenti(leggi("src/crm/chatwa/ricontatti.ts"))) &&
      /chiaveData === "dataRicontatto"/.test(senzaCommenti(leggi("src/crm/chatwa/ricontatti.ts"))),
  );

  gruppo("RICONTATTI: ORDINE (il lead arrivato più di recente in alto)");
  //  Dal 31/10/2026 (richiesta del titolare) NON si ordina più per data di ricontatto: conta quando è
  //  arrivato il lead (`data.createdAt`, la «data di acquisizione»; in mancanza `created_at` della riga).
  const nuovoArr = chat({ arrivo: "2026-10-30T10:00:00.000Z", data: "2026-11-01" });
  const medioArr = chat({ arrivo: "2026-10-20T10:00:00.000Z", data: "2026-12-30" });
  const vecchioArr = chat({ arrivo: "2026-09-01T10:00:00.000Z", data: "2026-11-20" });
  const senzaArr = chat({ data: "2026-12-31" });
  const senzaArrBis = chat({});
  c(
    "dal più giovane al più vecchio, anche se la data di ricontatto dice il contrario",
    tel([nuovoArr, medioArr, vecchioArr, senzaArr, senzaArrBis]),
    tel(R.ordinaRicontatti([senzaArr, vecchioArr, senzaArrBis, nuovoArr, medioArr])),
  );
  const daRiga = chat({ creata: "2026-10-25T10:00:00.000Z" });
  c(
    "senza `createdAt` vale `created_at` della riga",
    tel([nuovoArr, daRiga, medioArr]),
    tel(R.ordinaRicontatti([medioArr, daRiga, nuovoArr])),
  );
  const ordineIngresso = [vecchioArr, nuovoArr];
  R.ordinaRicontatti(ordineIngresso);
  c("non muta l'ingresso", tel([vecchioArr, nuovoArr]), tel(ordineIngresso));
  c("senza arrivo sta in fondo, anche con la data di ricontatto più lontana", tel([nuovoArr, senzaArr]), tel(R.ordinaRicontatti([senzaArr, nuovoArr])));
  const rotto = chat({ arrivo: "ieri" });
  c("un arrivo illeggibile vale «senza data»: in fondo", tel([nuovoArr, rotto]), tel(R.ordinaRicontatti([rotto, nuovoArr])));
  c("a parità resta l'ordine di arrivo in elenco", tel([senzaArr, senzaArrBis]), tel(R.ordinaRicontatti([senzaArr, senzaArrBis])));

  gruppo("RICONTATTI: PRIORITÀ (restano fissi in alto, quanti ne vuole)");
  //  Campo SEPARATO da quello delle installazioni (`priorita.ts`, acconti): `ricontattoPrioritaIl`, ISO.
  const adessoP = new Date("2026-10-31T09:00:00Z");
  const prioVecchio = chat({ arrivo: "2026-08-01T10:00:00.000Z", priorita: "2026-10-31T08:00:00.000Z" });
  const prioNuovo = chat({ arrivo: "2026-10-10T10:00:00.000Z", priorita: "2026-10-29T08:00:00.000Z" });
  const prioSenzaArrivo = chat({ priorita: "2026-10-30T08:00:00.000Z" });
  c(
    "i lead in priorità stanno sopra tutti, anche sopra il più recente",
    tel([prioNuovo, prioVecchio, prioSenzaArrivo, nuovoArr, medioArr]).slice(0, 2),
    tel(R.ordinaRicontatti([nuovoArr, medioArr, prioVecchio, prioNuovo, prioSenzaArrivo])).slice(0, 2),
  );
  c(
    "fra loro seguono la regola di tutti: il più recente per arrivo, senza arrivo in fondo al gruppo",
    tel([prioNuovo, prioVecchio, prioSenzaArrivo, nuovoArr, medioArr]),
    tel(R.ordinaRicontatti([nuovoArr, medioArr, prioVecchio, prioNuovo, prioSenzaArrivo])),
  );
  c(
    "non conta quando sono stati messi in priorità: toccare la puntina non li fa saltare",
    tel([prioNuovo, prioVecchio]),
    tel(R.ordinaRicontatti([prioVecchio, prioNuovo])),
  );
  c("ePrioritario legge il segno sulla scheda", [true, false, false], [R.ePrioritario(prioNuovo), R.ePrioritario(nuovoArr), R.ePrioritario({ lead: null })]);
  c("un segno vuoto o rotto non è priorità", [false, false], [R.ePrioritario(chat({ priorita: "" })), R.ePrioritario(chat({ priorita: null }))]);
  const applicaP = (ch, patch) => ({ ...ch, lead: { ...ch.lead, data: { ...ch.lead.data, ...patch } } });
  const messo = applicaP(medioArr, R.patchPriorita(true, adessoP));
  c("patchPriorita(true) scrive solo il segno, con l'ora", [{ ricontattoPrioritaIl: "2026-10-31T09:00:00.000Z" }], [R.patchPriorita(true, adessoP)]);
  c("dopo averla messa il lead sale in cima", tel([medioArr, nuovoArr]), tel(R.ordinaRicontatti([nuovoArr, messo])));
  const tolto = applicaP(messo, R.patchPriorita(false));
  c(
    "patchPriorita(false) toglie la chiave (undefined sparisce alla serializzazione)",
    true,
    "ricontattoPrioritaIl" in R.patchPriorita(false) && R.patchPriorita(false).ricontattoPrioritaIl === undefined && Object.keys(R.patchPriorita(false)).length === 1,
  );
  c("e il lead torna al suo posto per arrivo", tel([nuovoArr, medioArr]), tel(R.ordinaRicontatti([tolto, nuovoArr])));
  c("la priorità non tocca gli altri campi della scheda", [medioArr.lead.data.stato, medioArr.lead.data.dataRicontatto], [messo.lead.data.stato, messo.lead.data.dataRicontatto]);
  c("quanti ne vuole: tre in priorità, tutti sopra gli altri", 3, R.ordinaRicontatti([nuovoArr, prioVecchio, medioArr, prioNuovo, prioSenzaArrivo]).slice(0, 3).filter(R.ePrioritario).length);

  gruppo("RICONTATTI: PRIORITÀ E NASCONDI (nascondere toglie la priorità)");
  c("nascondere scrive anche il «togli priorità»", true, ((p) => "ricontattoPrioritaIl" in p && p.ricontattoPrioritaIl === undefined)(R.patchNascondi(prioNuovo, adessoP)));
  const nascP = applicaP(prioNuovo, R.patchNascondi(prioNuovo, adessoP));
  c("dopo nascosto non è più in priorità", [true, false], [R.eNascosto(nascP), R.ePrioritario(nascP)]);
  const nascPrioStale = chat({ arrivo: "2026-01-01T10:00:00.000Z", priorita: "2026-10-30T08:00:00.000Z", nascostoIl: "2026-10-30T09:00:00.000Z", nascostoPer: "" });
  c("se per un salvataggio vecchio restano tutti e due, il nascosto NON sale in cima", [false, tel([nuovoArr, nascPrioStale])], [R.ePrioritario(nascPrioStale), tel(R.ordinaRicontatti([nascPrioStale, nuovoArr]))]);
  c("e finisce comunque nel gruppo dei nascosti", [tel([nuovoArr]), tel([nascPrioStale])], ((d) => [tel(d.visibili), tel(d.nascosti)])(R.dividiNascosti(R.ordinaRicontatti([nascPrioStale, nuovoArr]))));
  c("«Annulla» del nascondi rimette la priorità di prima", "2026-10-29T08:00:00.000Z", R.patchMostra("2026-10-29T08:00:00.000Z").ricontattoPrioritaIl);
  c("mostra senza priorità di prima non scrive la chiave (non cancella quella messa nel frattempo)", false, "ricontattoPrioritaIl" in R.patchMostra());
  const rimessa = applicaP(nascP, R.patchMostra("2026-10-29T08:00:00.000Z"));
  c("rimessa da «Annulla», la riga è di nuovo visibile, in priorità e in cima", [false, true, tel([prioNuovo, nuovoArr])], [R.eNascosto(rimessa), R.ePrioritario(rimessa), tel(R.ordinaRicontatti([nuovoArr, rimessa]))]);

  gruppo("RICONTATTI: PRIORITÀ E LA SCHEDA (LeadDialog salva il modulo intero)");
  //  Il modulo parte da `{...nuovo(), ...lead.data}` e salva `form` intero con `updateLead`, che fonde su
  //  `{...riga.data, ...patch}`. Il segno deve attraversare il giro senza sparire, e la scheda non deve
  //  nominarlo (nessuna riscrittura propria).
  const schedaDati = prioNuovo.lead.data;
  const formAperto = { nome: "", cognome: "", ...schedaDati };
  const inArchivio = { ...schedaDati, nome: "Anna" };
  const salvato = { ...inArchivio, ...formAperto, nome: "Anna Rossi" };
  c("aprire e salvare il modulo non cancella la priorità", schedaDati.ricontattoPrioritaIl, salvato.ricontattoPrioritaIl);
  //  Modulo aperto su un lead SENZA priorità, poi la priorità arriva dalla lista: il salvataggio non la cancella,
  //  perché `nuovo()` non conosce il campo e il modulo non ha la chiave.
  const formSenza = { nome: "", cognome: "", ...medioArr.lead.data };
  const archivioDopo = { ...medioArr.lead.data, ...R.patchPriorita(true, adessoP) };
  c("modulo aperto prima della priorità: salvare non cancella quella messa dopo", "2026-10-31T09:00:00.000Z", { ...archivioDopo, ...formSenza, nome: "Anna" }.ricontattoPrioritaIl);
  c("e nemmeno il nascosto né l'esito (stessa regola)", true, ((x) => x.ricontattoNascostoIl === undefined)(salvato));
  const dialogo = senzaCommenti(leggi("src/crm/LeadDialog.tsx"));
  c("LeadDialog non scrive né azzera il campo: lo porta com'è col resto della scheda", false, /ricontattoPrioritaIl/.test(dialogo));
  c("il campo è dichiarato sulla scheda, separato da quello delle installazioni", true, /ricontattoPrioritaIl\?: string/.test(senzaCommenti(leggi("src/crm/types.ts"))) && !/ricontattoPrioritaIl/.test(senzaCommenti(leggi("src/crm/priorita.ts"))));
  c("il giro automatico dei messaggi non lo tocca", false, /ricontattoPrioritaIl/.test(leggi("src/crm/manychat/giro.ts")));

  gruppo("RICONTATTI: SOLO I PROPRI, ANCHE L'ADMIN");
  const mio = chat({ stato: "in_attesa_acconto", data: "2026-11-03", consulente: "io" });
  const suo = chat({ stato: "in_attesa_acconto", data: "2026-11-04", consulente: "anna" });
  const orfano = chat({ stato: "sta_valutando", data: "2026-11-04", consulente: null });
  const fuoriStato = chat({ stato: "appuntamento_fissato", consulente: "io" });
  const sconosciuto = chat({ senzaScheda: true });
  const mondo = [mio, suo, orfano, fuoriStato, sconosciuto];
  const dentro = (f) => tel(mondo.filter((x) => F.passaFiltri(x, f, nessuno)));
  c("con Ricontatti acceso passano solo i miei ricontatti", tel([mio]), dentro(con({ ricontatti: true, io: "io" })));
  c("quelli di un altro consulente no", false, F.passaFiltri(suo, con({ ricontatti: true, io: "io" }), nessuno));
  c("senza consulente nemmeno", false, F.passaFiltri(orfano, con({ ricontatti: true, io: "io" }), nessuno));
  c("un altro stato del mio no", false, F.passaFiltri(fuoriStato, con({ ricontatti: true, io: "io" }), nessuno));
  c("chi non è legato a nessun consulente (io vuoto): lista vuota", [], dentro(con({ ricontatti: true, io: "" })));
  c(
    "il menu consulente non aggira la regola: scegliere Anna non mostra i suoi",
    [],
    dentro(con({ ricontatti: true, io: "io", consulente: "anna" })).filter((t) => t === suo.phone),
  );
  c("e scegliere me stesso non cambia niente", tel([mio]), dentro(con({ ricontatti: true, io: "io", consulente: "io" })));
  c(
    "spento, Ricontatti non filtra niente (anche con io valorizzato)",
    tel(mondo),
    dentro(con({ io: "io" })),
  );
  c(
    "«io» da solo non è un filtro acceso (non conta sul tasto Filtri)",
    [0, 1],
    [F.contaAccesi(con({ io: "io" })), F.contaAccesi(con({ io: "io", ricontatti: true }))],
  );
  const lunga = [mio, suo, orfano];
  c(
    "il numero della pastiglia è «cosa vedresti»: solo i miei",
    1,
    F.contaVoce(lunga, con({ io: "io" }), nessuno, "ricontatti", true),
  );
  c("e con io vuoto è zero, onesto", 0, F.contaVoce(lunga, con({ io: "" }), nessuno, "ricontatti", true));
  c(
    "il conteggio degli altri filtri non è toccato da io",
    F.contaVoce(lunga, con({}), nessuno, "tipo", "con-scheda"),
    F.contaVoce(lunga, con({ io: "io" }), nessuno, "tipo", "con-scheda"),
  );

  gruppo("RICONTATTI: COME TUTTI GLI ALTRI FILTRI (esclusivo, salvataggio)");
  const acceso = F.commuta(con({ io: "io", consulente: "anna" }), "ricontatti", true);
  c("toccarlo lo accende", true, F.eAcceso(acceso, "ricontatti", true));
  c("il consulente scelto resta ricordato, io non si perde", ["anna", "io"], [acceso.consulente, acceso.io]);
  c("toccarlo di nuovo lo spegne", false, F.commuta(acceso, "ricontatti", true).ricontatti);
  c("toccare un'altra voce lo spegne", false, F.commuta(acceso, "coda", "da-rispondere").ricontatti);
  c("e viceversa: accendere Ricontatti spegne le stelle", false, F.commuta(con({ stelle: true }), "ricontatti", true).stelle);
  c("compare fra le etichette accese", "Ricontatti", F.etichetteAccese(acceso, (x) => x)[0].etichetta);
  const giro = F.leggiFiltri(F.scriviFiltriSessione(acceso), "anna");
  c("si ricorda nella scheda del browser", true, giro.ricontatti);
  c("ma «io» non si salva mai: lo rimette la pagina ad ogni apertura", [false, ""], [JSON.stringify(JSON.parse(F.scriviFiltriSessione(acceso))).includes('"io"'), giro.io]);
  c("un valore salvato strano non lo accende", false, F.leggiFiltri(JSON.stringify({ ricontatti: "sì" }), null).ricontatti);
  c("se ne trova più d'uno ne tiene uno solo", 1, F.contaAccesi(F.leggiFiltri(JSON.stringify({ ricontatti: true, coda: "da-chiamare", stelle: true }), null)));
  c("filtriValidi mette «io» senza toccare il resto", ["io", "anna", true], ((f) => [f.io, f.consulente, f.ricontatti])(F.filtriValidi(acceso, new Set(["anna"]), "io")));
  c("filtriValidi senza io lo lascia vuoto", "", F.filtriValidi(con({}), new Set(), undefined).io);
  c(
    "in Ricontatti il consulente scelto prima non conta e non ha la sua etichetta",
    [1, ["Ricontatti"]],
    [F.contaAccesi(acceso), F.etichetteAccese(acceso, (x) => x).map((e) => e.etichetta)],
  );
  c("Azzera spegne anche Ricontatti", 0, F.contaAccesi(F.FILTRI_VUOTI));

  gruppo("RICONTATTI: LA PASTIGLIA NELLA RIGA");
  const nomiRiga = F.VOCI_RIGA.map((v) => v.nome);
  c(
    "sta subito dopo «Sconosciuti», prima di «Clienti» (in mezzo può esserci «Da recuperare»)",
    true,
    nomiRiga.indexOf("Sconosciuti") + 1 === nomiRiga.indexOf("Ricontatti") &&
      nomiRiga.indexOf("Ricontatti") < nomiRiga.indexOf("Clienti"),
  );
  c("la voce è acceso/spento sul campo ricontatti", true, F.VOCI_RIGA.some((v) => v.nome === "Ricontatti" && v.campo === "ricontatti" && v.valore === true));
  c("ogni voce della riga (tranne le pastiglie per stato) ha una voce nei gruppi (le prove esclusive le percorrono tutte)", true, F.VOCI_RIGA.filter((v) => !String(v.valore).startsWith("stato:")).every((v) => F.GRUPPI_FILTRI.some((g) => g.voci.some((x) => x.campo === v.campo && x.valore === v.valore))));

  gruppo("PANNELLO FILTRI PIÙ SEMPLICE: STRUTTURA");
  const pannello = leggi("src/crm/chatwa/PannelloFiltri.tsx");
  const vivo = senzaCommenti(pannello);
  const titoli = F.GRUPPI_FILTRI.map((g) => g.titolo);
  c("titoli brevi, al massimo due parole", true, titoli.every((t) => t.split(" ").length <= 3));
  c("il pannello ha «Consulente» e «Altri filtri» (Stato e Finestra 24h vengono dai gruppi)", true, /titolo="Consulente"/.test(vivo) && /Altri filtri/.test(vivo));
  c("«Stato» e «Finestra 24h» sono gruppi di dati", true, ["Stato", "Finestra 24h"].every((t) => titoli.includes(t)));
  const fuoriRiga = F.GRUPPI_FILTRI.flatMap((g) => g.voci).filter((v) => !F.VOCI_RIGA.some((r) => r.campo === v.campo && r.valore === v.valore));
  c(
    "nel pannello restano solo le voci che la riga non ha",
    ["Attesa WhatsApp", "Per ora no", "Acconto versato", "Si può scrivere", "Finestra chiusa", "Con scheda"],
    fuoriRiga.map((v) => v.nome),
  );
  c("il pannello non conosce un secondo elenco: deriva dalla riga (voceInRiga)", true, /voceInRiga\(/.test(vivo));
  c("un solo «Azzera» nel pannello", 1, (vivo.match(/>\s*Azzera\s*</g) ?? []).length);
  c("niente più paragrafo di spiegazione fisso in cima", false, /Un filtro alla volta: scegliendone un altro, il primo si spegne/.test(vivo));
  c("«Altri filtri» è chiuso di partenza e si apre da solo con un filtro dentro", true, /useState\(false\)/.test(vivo) && /aria-expanded=\{apertoAltri\}/.test(vivo));
  c("il piede chiude: «Mostra N chat»", true, /Mostra 1 chat/.test(vivo) && /Mostra \$\{mostra\} chat/.test(vivo));
  c("tocchi da 44 px su ogni voce", true, /ALTEZZA_TASTO/.test(vivo) && /min-h-11/.test(vivo));
  c("le frasi di spiegazione sono corte (max 60 caratteri)", true, fuoriRiga.every((v) => v.spiega.length > 20 && v.spiega.length <= 60));
  c("il consulente non c'è quando Ricontatti è acceso: vale solo il tuo", true, /filtri\.ricontatti/.test(vivo));
  c("il tasto «Filtri» ha il contatore", true, /<Contatore n=\{accesi\} acceso \/>/.test(vivo));
  c("le voci già nella riga non tornano fra gli altri stati", true, /altriStati[\s\S]{0,200}VOCI_RIGA|VOCI_RIGA[\s\S]{0,300}altriStati|fuoriRiga/.test(vivo));

  gruppo("RICONTATTI: COLLEGAMENTO NELL'ELENCO");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const elVivo = senzaCommenti(elenco);
  c("l'elenco ordina con ordinaRicontatti", true, /ordinaRicontatti\(/.test(elVivo));
  c("«io» è chi ha digitato il PIN (useConsulenteCollegato), senza eccezione per l'admin", true, /useConsulenteCollegato\(\)/.test(elVivo) && /filtriValidi\(\s*filtriSalvati,\s*consulentiNoti,\s*io/.test(elVivo));
  c("niente blocco «Acconto, da installare» dentro Ricontatti (compare solo col filtro Acconto, esclusivo)", true, /tutte && filtri\.acconto/.test(elVivo));
  c("frase sincera quando non sei legato a nessun consulente", true, /fraseRicontattiVuoti\(/.test(elVivo));
  c("passaFiltri resta l'unica porta dei filtri (nessuna regola riscritta nell'elenco)", true, /passaFiltri\(c, filtri, stelleDi\)/.test(elVivo) && !/eMioRicontatto|eRicontatto\(/.test(elVivo));

  gruppo("RICONTATTI: PRIORITÀ, IL TASTO E IL COLLEGAMENTO");
  const rigaV = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  const tastoP = rigaV.slice(rigaV.indexOf("onPriorita && ("), rigaV.indexOf("onNascondi && ("));
  c("la riga ha un tasto «priorità» (puntina), solo se la pagina lo chiede", true, /onPriorita\?: \(\) => void/.test(rigaV) && /<Pin\b/.test(tastoP));
  c("ferma la propagazione, così non apre la chat", true, /e\.stopPropagation\(\)/.test(tastoP));
  c("tocco da 44 px sul telefono (h-11 w-11, margini negativi: la riga non cresce)", true, /h-11/.test(tastoP) && /w-11/.test(tastoP) && /-my-2\.5/.test(tastoP));
  c("dice a parole cosa fa e se è accesa (aria-pressed, «Togli priorità»)", true, /aria-pressed=\{/.test(tastoP) && /Togli priorità/.test(tastoP) && /Metti in priorità/.test(tastoP));
  c("da accesa l'icona è piena e colorata, non solo diversa di forma", true, /fill-current/.test(tastoP) && /text-primary/.test(tastoP));
  const elencoV = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  c("l'elenco passa il tasto solo in Ricontatti, per un lead con scheda e non nascosto", true, /onPriorita=\{\s*filtri\.ricontatti && c\.lead && !nascosto/.test(elencoV));
  c("scrive con updateLead e patchPriorita (modulo puro), dice l'errore e offre «Annulla»", true, /patchPriorita\(/.test(elencoV) && /Priorità NON/.test(elencoV) && /updateLead\(lead\.id, patchPriorita\(/.test(elencoV) && /Priorità tolta|In priorità/.test(elencoV));
  c("«Annulla» del nascondi rimette la priorità di prima", true, /patchMostra\(/.test(elencoV) && /patchMostra\(prima/.test(elencoV));
  c("l'elenco ordina ancora con ordinaRicontatti e non con un secondo ordinamento", true, /ordinaRicontatti\(/.test(elencoV) && !/\.sort\(/.test(elencoV.slice(elencoV.indexOf("ricPrincipali"), elencoV.indexOf("ricPrincipali") + 400)));
  c("le frasi dicono la nuova regola (non più «dalla data più recente»)", false, /dalla data più recente/.test(elencoV) || /dalla data più recente/.test(senzaCommenti(leggi("src/crm/chatwa/RigheRisentire.tsx"))));
}
