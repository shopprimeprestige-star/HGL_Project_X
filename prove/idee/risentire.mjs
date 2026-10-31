/** ── PROVE: «RICONTATTI» CON ESITO + DATA, E LEAD NASCOSTI (31/10/2026) ─────────────────────────
 *  Regole in src/crm/chatwa/ricontatti.ts e filtri.ts; il disegno in RigheRisentire.tsx, RigaChat.tsx,
 *  ElencoChat.tsx e FinestraEsito.tsx. Prima versione: «Attesa acconto + non ha risposto»; con data icona
 *  calendario, senza data icona X. Seconda versione (titolare): niente filtro per Stato, solo Esito, in una
 *  barra che si chiude; Data minimale e non sticky; un'icona per nascondere un lead (gruppo «Nascosti»).
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
          ricontattoNascostoIl: o.nascostoIl,
          ricontattoNascostoPer: o.nascostoPer,
        },
      },
      daRispondere: { attesa: false },
    };
  };
  const nessuno = () => 0;
  const r = (o = {}) => ({ esito: "", data: "", ...o });
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

  gruppo("RISENTIRE: ESITO E DATA SI COMBINANO (E), NIENTE STATO");
  c("nessun filtro: tutti", tel(mondo), vedo(r()));
  c("solo esito: Sentiamoci più avanti", tel([b, d]), vedo(r({ esito: "piu_avanti" })));
  c("solo data: con data", tel([a, d, f]), vedo(r({ data: "con" })));
  c("solo data: senza data", tel([b, e, g]), vedo(r({ data: "senza" })));
  c("esito + data", tel([d]), vedo(r({ esito: "piu_avanti", data: "con" })));
  c("esito + senza data", tel([b]), vedo(r({ esito: "piu_avanti", data: "senza" })));
  c("una combinazione vuota dà zero", [], vedo(r({ esito: "non_ha_risposto", data: "senza" })));
  c("«Senza esito» prende chi non ne ha", tel([e]), vedo(r({ esito: "nessuno" })));
  c("il filtro non ha più il campo «stato»", false, "stato" in R.RISENTIRE_VUOTO);
  c("uno stato passato di nascosto non filtra", tel(mondo), tel(mondo.filter((ch) => R.passaRisentire(ch, { ...r(), stato: "per_ora_no" }))));
  c("la riga «Stato» non esiste più: niente statiRisentire", "undefined", typeof R.statiRisentire);

  gruppo("RISENTIRE: I NUMERI SULLE PASTIGLIE (cosa vedresti toccando)");
  const conta = (x, campo, v) => R.contaRisentire(mondo, x, campo, v);
  c("senza altro, «più avanti» = 2", 2, conta(r(), "esito", "piu_avanti"));
  c("con «con data» già scelto, «più avanti» = 1", 1, conta(r({ data: "con" }), "esito", "piu_avanti"));
  c("senza esito: conta chi non ne ha", 1, conta(r({ data: "senza" }), "esito", "nessuno"));
  c("con data / senza data / tutti", [3, 3, 6], [conta(r(), "data", "con"), conta(r(), "data", "senza"), conta(r(), "data", "")]);
  c("il numero della pastiglia scelta è quello che si vede", vedo(r({ esito: "piu_avanti" })).length, conta(r({ esito: "piu_avanti" }), "esito", "piu_avanti"));
  c("il numero di «Tutti» è quello senza il filtro data", 2, conta(r({ esito: "piu_avanti", data: "con" }), "data", "") );

  gruppo("RISENTIRE: TOCCARE UNA PASTIGLIA");
  c("la accende", "piu_avanti", R.commutaRisentire(r(), "esito", "piu_avanti").esito);
  c("toccarla di nuovo la spegne", "", R.commutaRisentire(r({ esito: "piu_avanti" }), "esito", "piu_avanti").esito);
  c("sceglierne un'altra della stessa riga sostituisce", "non_ha_risposto", R.commutaRisentire(r({ esito: "piu_avanti" }), "esito", "non_ha_risposto").esito);
  c("le due righe combinano", ["piu_avanti", "senza"], ((x) => [x.esito, x.data])(R.commutaRisentire(R.commutaRisentire(r(), "esito", "piu_avanti"), "data", "senza")));
  c("«acceso» dice se c'è qualcosa", [false, true], [R.risentireAcceso(r()), R.risentireAcceso(r({ data: "con" }))]);

  gruppo("RISENTIRE: DENTRO I FILTRI DELLA CHAT");
  const con = (o) => ({ ...F.FILTRI_VUOTI, ...o });
  const dentro = (o) => tel(mondo.filter((ch) => F.passaFiltri(ch, con({ ricontatti: true, io: "io", ...o }), nessuno)));
  c("Ricontatti da solo: tutti i miei", tel(mondo), dentro({}));
  c("Ricontatti + non ha risposto", tel([a]), dentro({ rEsito: "non_ha_risposto" }));
  c("Ricontatti + senza data", tel([b, e, g]), dentro({ rData: "senza" }));
  c("spento Ricontatti, i campi non filtrano", tel(mondo), tel(mondo.filter((ch) => F.passaFiltri(ch, con({ rData: "senza" }), nessuno))));
  c("i filtri interni non contano sul tasto «Filtri»", 1, F.contaAccesi(con({ ricontatti: true, rEsito: "piu_avanti", rData: "con" })));
  c("il numero di «Ricontatti» in riga resta quello di prima", mondo.length, F.contaVoce(mondo, con({ io: "io", rEsito: "piu_avanti" }), nessuno, "ricontatti", true));
  const acceso = con({ ricontatti: true, io: "io", rEsito: "nessuno", rData: "senza" });
  c("spegnere Ricontatti azzera anche i due", ["", ""], ((x) => [x.rEsito, x.rData])(F.commuta(acceso, "ricontatti", true)));
  c("accendere un'altra voce li azzera", ["", ""], ((x) => [x.rEsito, x.rData])(F.commuta(acceso, "coda", "da-rispondere")));
  c("la ✕ del riepilogo (togli) azzera anche i due", ["", ""], ((x) => [x.rEsito, x.rData])(F.togli(acceso, "ricontatti")));
  const etich = F.etichetteAccese(con({ ricontatti: true, rEsito: "non_ha_risposto", rData: "senza" }), (x) => x);
  c("ogni riga accesa ha la sua etichetta con la ✕, dopo «Ricontatti»", ["Ricontatti", "Non ha risposto", "Senza data"], etich.map((e) => e.etichetta));
  c("e la ✕ toglie solo quella riga", ["", "senza", true], ((x) => [x.rEsito, x.rData, x.ricontatti])(F.togli(con({ ricontatti: true, rEsito: "non_ha_risposto", rData: "senza" }), "rEsito")));
  c("«Senza esito» si legge così nel riepilogo", "Senza esito", F.etichetteAccese(con({ ricontatti: true, rEsito: "nessuno" }), (x) => x)[1].etichetta);
  c("«Tutte» (FILTRI_VUOTI) li ha vuoti, e non ha rStato", [["", ""], false], [[F.FILTRI_VUOTI.rEsito, F.FILTRI_VUOTI.rData], "rStato" in F.FILTRI_VUOTI]);

  gruppo("RISENTIRE: SALVATAGGIO NEL BROWSER");
  const salvato = F.leggiFiltri(F.scriviFiltriSessione(acceso), null);
  c("si ricordano", ["nessuno", "senza", true], [salvato.rEsito, salvato.rData, salvato.ricontatti]);
  c("un valore strano si ignora", ["", ""], ((x) => [x.rEsito, x.rData])(F.leggiFiltri(JSON.stringify({ ricontatti: true, rEsito: "boh", rData: "forse" }), null)));
  c("uno stato salvato da una versione vecchia si ignora, senza errori", ["", true], ((x) => [x.rEsito, x.ricontatti])(F.leggiFiltri(JSON.stringify({ ricontatti: true, rStato: "per_ora_no" }), null)));
  c("senza Ricontatti acceso non restano", ["", ""], ((x) => [x.rEsito, x.rData])(F.leggiFiltri(JSON.stringify({ coda: "da-chiamare", rData: "con" }), null)));
  c("soloUno li porta con Ricontatti", "nessuno", F.soloUno(acceso).rEsito);
  c("soloUno li toglie se vince un altro filtro", "", F.soloUno(con({ fase: "per-ora-no", ricontatti: true, rEsito: "piu_avanti" })).rEsito);

  gruppo("RISENTIRE: NASCONDERE UN LEAD (campo sulla scheda, nessuna migrazione)");
  const applica = (ch, patch) => ({ ...ch, lead: { data: { ...ch.lead.data, ...patch } } });
  const adesso = new Date("2026-10-31T10:00:00Z");
  const nascosto = (ch) => applica(ch, R.patchNascondi(ch, adesso));
  c("di partenza nessuno è nascosto", false, R.eNascosto(a));
  c("patchNascondi scrive i due campi del nascondi, e quando, più il «togli priorità»", ["2026-10-31T10:00:00.000Z", true], ((p) => [p.ricontattoNascostoIl, Object.keys(p).length === 3 && "ricontattoPrioritaIl" in p])(R.patchNascondi(a, adesso)));
  c("dopo patchNascondi è nascosto", true, R.eNascosto(nascosto(a)));
  c("anche senza data di ricontatto", true, R.eNascosto(nascosto(b)));
  c("patchMostra toglie entrambi i campi (undefined sparisce alla serializzazione)", true, ((p) => "ricontattoNascostoIl" in p && "ricontattoNascostoPer" in p && p.ricontattoNascostoIl === undefined && p.ricontattoNascostoPer === undefined)(R.patchMostra()));
  c("dopo patchMostra torna visibile", false, R.eNascosto(applica(nascosto(a), R.patchMostra())));
  c("se cambia la data di ricontatto, torna da solo nell'elenco", false, R.eNascosto(applica(nascosto(a), { dataRicontatto: "2026-11-20" })));
  c("se cambia solo l'ora, torna", false, R.eNascosto(applica(nascosto(a), { oraRicontatto: "15:30" })));
  c("se a un lead senza data se ne mette una, torna", false, R.eNascosto(applica(nascosto(b), { dataRicontatto: "2026-11-20" })));
  c("se la data resta uguale (anche scritta con l'ora in coda) resta nascosto", true, R.eNascosto(applica(nascosto(a), { dataRicontatto: "2026-11-05T09:00:00Z" })));
  c("cambiare l'esito non lo rimette fuori", true, R.eNascosto(applica(nascosto(a), R.patchEsito("piu_avanti", adesso))));
  c("cambiare lo stato (stessa data) non lo rimette fuori", true, R.eNascosto(applica(nascosto(a), { stato: "per_ora_no" })));
  c("un campo vuoto o rotto non nasconde", [false, false], [R.eNascosto(chat({ nascostoIl: "" })), R.eNascosto({ lead: null })]);
  const nasc = nascosto(e);
  const split = R.dividiNascosti([a, nasc, b, nascosto(g)]);
  c("dividiNascosti: visibili e nascosti, ognuno nel suo ordine", [tel([a, b]), tel([e, g])], [tel(split.visibili), tel(split.nascosti)]);
  c("dividiNascosti non muta l'ingresso", 4, ((l) => (R.dividiNascosti(l), l.length))([a, nasc, b, nascosto(g)]));
  const sopra = R.ordinaRicontatti(split.visibili);
  c("l'ordine resta sull'elenco principale (stesso arrivo: quello di ingresso)", tel([a, b]), tel(sopra));
  c("i nascosti restano dentro i filtri della chat (il gruppo «Nascosti» li rispetta)", true, F.passaFiltri(nasc, con({ ricontatti: true, io: "io" }), nessuno));
  c("i nascosti non pesano sui numeri delle pastiglie", [1, 1], ((vis) => [R.contaRisentire(vis, r(), "esito", "piu_avanti"), R.contaRisentire(vis, r(), "data", "senza")])(R.dividiNascosti([a, b, nascosto(d), nasc]).visibili));
  c("il nascondimento vale solo nella vista Ricontatti: passaFiltri di una voce qualunque non lo guarda", true, F.passaFiltri(nasc, con({ tipo: "con-scheda" }), nessuno));

  gruppo("RISENTIRE: IL DISEGNO");
  const righe = senzaCommenti(leggi("src/crm/chatwa/RigheRisentire.tsx"));
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const finestra = senzaCommenti(leggi("src/crm/chatwa/FinestraEsito.tsx"));
  const barra = righe.slice(righe.indexOf("export function BarraEsitoRicontatti"), righe.indexOf("const DATE"));
  const dataRiga = righe.slice(righe.indexOf("const DATE"));
  c("niente riga «Stato» nel pannello", false, /"Stato"|statiRisentire|LEAD_STATUS_LABEL/.test(righe));
  c("la barra dei filtri è chiusa all'ingresso (useState(false)) e si apre con un tasto che dice aria-expanded", true, /useState\(false\)/.test(barra) && /aria-expanded=\{/.test(barra) && /aria-controls=/.test(barra));
  c("da chiusa è una riga sottile con il nome «Filtri ricontatti»", true, /Filtri ricontatti/.test(barra) && /h-9/.test(barra));
  c("da chiusa dice quale esito è acceso", true, /nomeScelto|scelto/.test(barra));
  c("da aperta ha le pastiglie dell'esito (le quattro e «Senza esito») col numero", true, /ESITI_RICONTATTO/.test(righe) && /ESITO_NESSUNO/.test(righe) && /ESITI\.map/.test(barra) && /Contatore/.test(barra) && /contaRisentire\(/.test(barra));
  c("ogni pastiglia dice se è accesa (aria-pressed), non solo col colore", true, /aria-pressed=\{/.test(barra));
  c("la barra non ha una riga Data (sta fuori)", false, /"con"|Con data/.test(barra));
  c("Data: interruttore a segmenti Tutti / Con data / Senza data, col numero", true, /Tutti/.test(dataRiga) && /Con data/.test(dataRiga) && /Senza data/.test(dataRiga) && /aria-pressed=\{/.test(dataRiga) && /contaRisentire\(/.test(dataRiga));
  c("Data: NON è sticky", false, /sticky/.test(dataRiga));
  c("Data: la frase sull'ordine («dal lead arrivato più di recente») è nel title, non una riga di testo", true, /title=/.test(dataRiga) && /dal lead arrivato più di recente/.test(dataRiga));
  c("un solo «Azzera» in pagina (quello del riepilogo)", false, /Azzera/.test(righe));
  const sticky = elenco.slice(elenco.indexOf("sticky top-0"), elenco.indexOf("</div>", elenco.indexOf("sticky top-0")));
  c("in ElencoChat la barra sta nel blocco sticky in cima all'elenco, la Data fuori", true, /<BarraEsitoRicontatti/.test(sticky) && !/<RigaDataRicontatti/.test(sticky) && /<RigaDataRicontatti/.test(elenco));
  c("barra e Data compaiono solo in Ricontatti", true, /filtri\.ricontatti && \([\s\S]{0,80}<RigaDataRicontatti|filtri\.ricontatti &&[\s\S]{0,200}<RigaDataRicontatti/.test(elenco) && /filtri\.ricontatti &&[\s\S]{0,80}<BarraEsitoRicontatti/.test(elenco));
  c("la vecchia frase in riga è sparita", false, /I tuoi lead da risentire, dal(la data| lead arrivato) più (recente|di recente)\.\s*<\/p>/.test(elenco));
  c("la riga mostra «Senza data» con la X", true, /CalendarX/.test(riga) && /Senza data/.test(riga));
  c("e la data col calendario (richiamo) come prima", true, /CalendarClock/.test(riga));
  c("icona «nascondi» (occhio barrato) fuori dal bottone della riga, ferma la propagazione", true, /EyeOff/.test(riga) && /onNascondi/.test(riga) && /e\.stopPropagation\(\)/.test(riga.slice(riga.indexOf("onNascondi()") - 200, riga.indexOf("onNascondi()") + 50)));
  c("il tasto è da 44 px sul telefono", true, ((t) => /h-11/.test(t) && /w-11/.test(t) && /-my-2\.5/.test(t))(riga.slice(riga.indexOf("<EyeOff") - 900, riga.indexOf("<EyeOff") + 50)));
  c("nel gruppo dei nascosti lo stesso tasto è «Mostra» (occhio aperto) e dice a parole cosa fa", true, /Eye\b/.test(riga) && /Mostra/.test(riga) && /nascosto \?/.test(riga));
  c("il tasto c'è solo se la pagina lo chiede (props onNascondi), cioè solo in Ricontatti", true, /onNascondi=\{filtri\.ricontatti/.test(elenco));
  c("gruppo «Nascosti (N)» in fondo, richiudibile, parte chiuso", true, /Nascosti \(/.test(elenco) && /useState\(false\)/.test(elenco.slice(elenco.indexOf("apertoNascosti") - 40, elenco.indexOf("apertoNascosti") + 80)) && /aria-expanded=\{apertoNascosti\}/.test(elenco));
  c("nascondere e mostrare scrivono sulla scheda con updateLead, patch dal modulo puro", true, /updateLead\(/.test(elenco) && /patchNascondi\(/.test(elenco) && /patchMostra\(/.test(elenco));
  c("se non salva, lo si dice; se salva c'è «Annulla»", true, /toast\.error\(/.test(elenco) && /Annulla/.test(elenco));
  c("il titolo e il riepilogo contano i visibili, non i nascosti", true, /nTrovate/.test(elenco));
  const past = senzaCommenti(leggi("src/crm/chatwa/PastigliaEsito.tsx"));
  const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));
  const scheda = senzaCommenti(leggi("src/crm/LeadDialog.tsx"));
  c("l'esito è una pastiglia che si tocca, con 44 px sul telefono (un componente solo)", true, /FinestraEsito/.test(past) && /after:-inset-y-3/.test(past) && /aria-haspopup="dialog"/.test(past));
  c("l'esito si salva come gli altri campi della scheda (updateLead), in un posto solo", true, /updateLead\(/.test(past) && /patchEsito\(/.test(past));
  c("la riga, la chat aperta e la scheda usano la stessa pastiglia, senza una scrittura propria", true, [riga, conv, scheda].every((t) => /<PastigliaEsito/.test(t)) && !/esitoRicontatto/.test(riga) && !/esitoRicontatto:/.test(conv) && !/esitoRicontatto:/.test(scheda));
  c("se il salvataggio non riesce, lo si dice", true, /toast\.error\(/.test(past));
  c("chat aperta: la pastiglia c'è solo per i lead negli stati da risentire (come Ricontatti)", true, /eRicontatto\(attiva\)[\s\S]{0,80}<PastigliaEsito|eRicontatto\(attiva\)/.test(conv) && /<PastigliaEsito/.test(conv));
  c("scheda del cliente: solo negli stati da risentire e se la scheda è già salvata", true, /eRicontatto\(\{ lead: \{ data: form \} \}\)/.test(scheda) && /lead\?\.id[\s\S]{0,200}<PastigliaEsito|<PastigliaEsito[\s\S]{0,300}lead/.test(scheda));
  c("in chat aperta e in scheda il tocco è alto 44 px davvero", true, /min-h-11/.test(conv.slice(conv.indexOf("<PastigliaEsito"), conv.indexOf("<PastigliaEsito") + 400)) && /min-h-11/.test(scheda.slice(scheda.indexOf("<PastigliaEsito"), scheda.indexOf("<PastigliaEsito") + 400)));
  c("togliere l'esito lo toglie davvero", true, /esitoRicontatto: undefined/.test(senzaCommenti(leggi("src/crm/chatwa/ricontatti.ts"))));
  c("patchEsito: mette esito e quando", { esitoRicontatto: "piu_avanti", esitoRicontattoIl: "2026-10-31T10:00:00.000Z" }, R.patchEsito("piu_avanti", new Date("2026-10-31T10:00:00Z")));
  c("patchEsito: null toglie entrambi i campi", true, ((p) => "esitoRicontatto" in p && "esitoRicontattoIl" in p && p.esitoRicontatto === undefined && p.esitoRicontattoIl === undefined)(R.patchEsito(null)));
  c("le altre viste non cambiano: l'esito e «Senza data» solo in Ricontatti", true, /risentire/.test(riga) && /risentire=\{filtri\.ricontatti\}/.test(elenco));
  c("la finestra dell'esito: le quattro scelte, «Nessun esito» e Annulla, tasti da 44 px", true, /ESITI_RICONTATTO/.test(finestra) && /Nessun esito/.test(finestra) && /Annulla/.test(finestra) && /min-h-11/.test(finestra));
  c("niente emoji nei file nuovi", true, ![righe, finestra, past].some((t) => /\p{Extended_Pictographic}/u.test(t)));
  c("il campo nuovo è dichiarato sulla scheda", true, /esitoRicontatto\?: string/.test(senzaCommenti(leggi("src/crm/types.ts"))) && /ricontattoNascostoIl\?: string/.test(senzaCommenti(leggi("src/crm/types.ts"))) && /ricontattoNascostoPer\?: string/.test(senzaCommenti(leggi("src/crm/types.ts"))));
  c("il giro automatico non è toccato", true, !/esitoRicontatto|ricontattoNascosto/.test(leggi("src/crm/manychat/giro.ts")));
}
