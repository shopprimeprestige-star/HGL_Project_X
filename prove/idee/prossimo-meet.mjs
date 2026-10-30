/** ── PROVE: IL PROSSIMO MEET IN CIMA ALL'ELENCO DELLE CHAT (30/10/2026) ───────
 *  Regole in src/crm/chatwa/prossimo-meet.ts: fra le chat con scheda, il meet (consulenza online) di
 *  OGGI con l'ora più vicina e ancora da fare; uno solo; l'etichetta «Meet alle 15:00 · Mirko».
 *  Il disegno (barra incollata in cima, bordo viola, tasti da 44 px, niente emoji) si prova sul
 *  sorgente, come le altre prove di disegno. Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveProssimoMeet(mod, { c, gruppo, radice }) {
  const P = mod["chatwa/prossimo-meet"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  /** il sorgente senza commenti: le prove sui nomi guardano quello che si vede, non la storia */
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const OGGI = "2026-10-30";
  //  Il 30 ottobre 2026 è ora legale finita (CET, UTC+1): le 12:00 a Roma sono le 11:00 UTC.
  const alle = (hhmm) => Date.parse(`${OGGI}T${hhmm}:00+01:00`);
  const consulenti = [
    { id: "m", data: { nome: "Mirko Rossi" } },
    { id: "f", data: { nome: "  Filippo " } },
    { id: "s", data: { nome: "" } },
  ];
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333111${String(n).padStart(4, "0")}`,
      lead: o.senzaScheda
        ? null
        : {
            id: `l${n}`,
            data: {
              stato: o.stato ?? "appuntamento_fissato",
              dataMeeting: o.giorno ?? OGGI,
              oraMeeting: o.ora === undefined ? "15:00" : o.ora,
              consulenteId: o.consulente === undefined ? "m" : o.consulente,
            },
          },
    };
  };
  const tel = (r) => r?.chat.phone ?? null;

  gruppo("PROSSIMO MEET · QUALE CHAT");
  c("nessuna chat: niente", null, P.prossimoMeet([], OGGI, alle("10:00"), consulenti));
  const a15 = chat({ ora: "15:00" });
  c("una sola di oggi: è lei", a15.phone, tel(P.prossimoMeet([a15], OGGI, alle("10:00"), consulenti)));
  const a17 = chat({ ora: "17:00" });
  const a09 = chat({ ora: "09:30" });
  c(
    "la più vicina per orario, qualunque sia l'ordine dell'elenco",
    a09.phone,
    tel(P.prossimoMeet([a17, a15, a09], OGGI, alle("08:00"), consulenti)),
  );
  c(
    "l'orario si legge come ora: 9:30 viene prima di 15:00 anche scritto «9:30»",
    "9:30",
    P.prossimoMeet([a15, chat({ ora: "9:30" })], OGGI, alle("08:00"), consulenti)?.chat.lead.data.oraMeeting,
  );
  const prima = chat({ ora: "15:00" });
  const seconda = chat({ ora: "15:00" });
  c("a pari orario vince la prima dell'elenco", prima.phone, tel(P.prossimoMeet([prima, seconda], OGGI, alle("10:00"), consulenti)));
  c("…e l'ordine dell'elenco è quello che conta, non il numero", seconda.phone, tel(P.prossimoMeet([seconda, prima], OGGI, alle("10:00"), consulenti)));
  c(
    "anche «rifissato» è un meet da fare",
    true,
    tel(P.prossimoMeet([chat({ stato: "appuntamento_rifissato", ora: "11:00" })], OGGI, alle("08:00"), consulenti)) !== null,
  );
  //  Gli altri stati con una data del meeting NON sono un meet da fare.
  for (const stato of ["da_spostare", "fatto", "no_show", "non_fatto", "concluso", "annullato", "venduto", "da_contattare", "viene_in_sede"]) {
    c(`stato «${stato}»: non è un meet da fare`, null, P.prossimoMeet([chat({ stato })], OGGI, alle("08:00"), consulenti));
  }
  c("domani non è oggi", null, P.prossimoMeet([chat({ giorno: "2026-10-31" })], OGGI, alle("08:00"), consulenti));
  c("ieri non è oggi (anche se lo stato non è cambiato)", null, P.prossimoMeet([chat({ giorno: "2026-10-29" })], OGGI, alle("08:00"), consulenti));
  c("la data con l'ora in coda (ISO) vale come giorno", true, tel(P.prossimoMeet([chat({ giorno: `${OGGI}T00:00:00` })], OGGI, alle("08:00"), consulenti)) !== null);
  c("chat senza scheda: ignorata", null, P.prossimoMeet([chat({ senzaScheda: true })], OGGI, alle("08:00"), consulenti));
  c("senza ora (o illeggibile) non c'è un orario da dire: ignorata", null, P.prossimoMeet([chat({ ora: "" }), chat({ ora: "boh" }), chat({ ora: "25:00" })], OGGI, alle("08:00"), consulenti));

  gruppo("PROSSIMO MEET · CAMBIA STATO, PASSA L'ORA");
  const m11 = chat({ ora: "11:00" });
  const m15 = chat({ ora: "15:00" });
  const elenco = [m15, m11];
  c("prima delle 11: il meet delle 11", m11.phone, tel(P.prossimoMeet(elenco, OGGI, alle("10:00"), consulenti)));
  c("alle 11 in punto: ancora lui", m11.phone, tel(P.prossimoMeet(elenco, OGGI, alle("11:00"), consulenti)));
  c("alle 12:30, un'ora e mezza dopo: ancora lui (il titolare deve chiuderlo)", m11.phone, tel(P.prossimoMeet(elenco, OGGI, alle("12:30"), consulenti)));
  c("a 2 ore esatte: ancora lui", m11.phone, tel(P.prossimoMeet(elenco, OGGI, alle("13:00"), consulenti)));
  c("passate le 2 ore: passa al successivo", m15.phone, tel(P.prossimoMeet(elenco, OGGI, alle("13:01"), consulenti)));
  c("passate le 2 ore e senza successivo: niente (non resta in cima per sempre)", null, P.prossimoMeet([m11], OGGI, alle("13:30"), consulenti));
  //  Lo stato cambia: la chat esce da sola, l'elenco è lo stesso ma con lo stato nuovo.
  const concluso = { ...m11, lead: { ...m11.lead, data: { ...m11.lead.data, stato: "fatto" } } };
  c("dopo il cambio di stato passa il successivo", m15.phone, tel(P.prossimoMeet([m15, concluso], OGGI, alle("11:20"), consulenti)));
  c("…e se non c'è altro, niente", null, P.prossimoMeet([concluso], OGGI, alle("11:20"), consulenti));
  c("non muta l'elenco che riceve", [m15.phone, m11.phone], (P.prossimoMeet(elenco, OGGI, alle("10:00"), consulenti), elenco.map((x) => x.phone)));

  gruppo("PROSSIMO MEET · L'ETICHETTA (SOLO IL NOME DEL CONSULENTE)");
  const eti = (o) => P.prossimoMeet([chat(o)], OGGI, alle("08:00"), consulenti)?.etichetta;
  c("con il consulente: solo il nome", "Meet alle 15:00 · Mirko", eti({ ora: "15:00", consulente: "m" }));
  c("il nome senza spazi attorno", "Meet alle 15:00 · Filippo", eti({ consulente: "f" }));
  c("senza consulente: solo il meet", "Meet alle 15:00", eti({ consulente: null }));
  c("consulente cancellato dal CRM: solo il meet", "Meet alle 15:00", eti({ consulente: "x" }));
  c("consulente senza nome: solo il meet", "Meet alle 15:00", eti({ consulente: "s" }));
  c("l'ora si scrive sempre con due cifre", "Meet alle 09:05 · Mirko", eti({ ora: "9:05" }));
  c("ora e nome anche a parte, per chi li disegna", ["15:00", "Mirko"], (() => { const r = P.prossimoMeet([chat()], OGGI, alle("08:00"), consulenti); return [r.ora, r.consulente]; })());
  c("senza elenco di consulenti non si rompe", "Meet alle 15:00", P.prossimoMeet([chat()], OGGI, alle("08:00"), undefined)?.etichetta);

  gruppo("PROSSIMO MEET · DISEGNO (SORGENTE)");
  const elencoSrc = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const barraSrc = senzaCommenti(leggi("src/crm/chatwa/BarraProssimoMeet.tsx"));
  const rigaSrc = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  c("l'elenco lo calcola dalle chat che passano filtri e ricerca (in «Da chiamare» da quelle mostrate)", true,
    /prossimoMeet\(\s*filtri\.coda === "da-chiamare" \? elencoDaChiamare : trovate,\s*oggi,\s*adesso,\s*consultants/.test(elencoSrc));
  c("la barra sta dentro l'area che scorre, prima di tutte le sezioni", true, elencoSrc.indexOf("<BarraProssimoMeet") > elencoSrc.indexOf("overflow-y-auto") && elencoSrc.indexOf("<BarraProssimoMeet") < elencoSrc.indexOf('aria-labelledby="titolo-in-scadenza"'));
  c("la barra tocca la chat e la apre", true, /onApri=\{\(\) => apri\(/.test(elencoSrc.slice(elencoSrc.indexOf("<BarraProssimoMeet"))));
  c("la barra è incollata in alto, sopra le righe", true, /sticky top-0 z-10/.test(barraSrc));
  c("bordo e sfondo viola, a tinta con il meet", true, /border-violet-/.test(barraSrc) && /bg-violet-50/.test(barraSrc));
  c("icona Video di lucide, outline", true, /import \{[^}]*\bVideo\b[^}]*\} from "lucide-react"/.test(barraSrc) && /<Video\b[^>]*aria-hidden/.test(barraSrc));
  c("tasto da 44 px sul telefono, più basso dal computer col mouse", true, /min-h-11/.test(barraSrc) && /lg:pointer-fine:min-h-/.test(barraSrc));
  c("l'etichetta si taglia con i puntini, non fa salire la barra", true, /truncate/.test(barraSrc));
  c("la barra è una regione col suo nome per chi usa lo screen reader", true, /aria-label="Prossimo meet"/.test(barraSrc));
  c("nessuna emoji nella barra", false, /\p{Extended_Pictographic}/u.test(barraSrc));
  c("la riga della stessa chat nelle sezioni ha sfondo e bordo viola", true, /prossimoMeet\??:\s*boolean/.test(rigaSrc) && /bg-violet-50\/70 ring-1 ring-inset ring-violet-300/.test(rigaSrc));
  c("niente righetta colorata a lato (segno da avviso)", false, /border-l-|inset-y-0 left-0 w-1\b/.test(barraSrc + rigaSrc));
  c("la chat resta anche nella sua sezione (i conti di «Da rispondere» non cambiano)", true, !/prossimoMeet[^;]*\.filter\(\(c\) => c\.phone !==/.test(elencoSrc) && !/tel\.has\(prossimo/i.test(elencoSrc));
}
