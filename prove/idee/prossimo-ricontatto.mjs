/** ── PROVE: IL PROSSIMO RICONTATTO IN CIMA ALL'ELENCO DELLE CHAT (11/11/2026) ──
 *  Regole in src/crm/chatwa/prossimo-ricontatto.ts; disegno in BarraProssimoRicontatto.tsx e
 *  ElencoChat.tsx (provato sul sorgente). Pannello «Oggi» senza «Da fare». Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveProssimoRicontatto(mod, { c, gruppo, radice }) {
  const P = mod["chatwa/prossimo-ricontatto"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const OGGI = "2026-11-11";
  //  L'11 novembre 2026 Roma è a UTC+1.
  const alle = (hhmm) => Date.parse(`${OGGI}T${hhmm}:00+01:00`);
  const consulenti = [{ id: "m", data: { nome: "Mirko Rossi" } }, { id: "s", data: { nome: "Sara" } }];
  let n = 0;
  const chat = (o = {}) => {
    n++;
    return {
      phone: `+39333222${String(n).padStart(4, "0")}`,
      lead: {
        id: `l${n}`,
        data: {
          stato: o.stato ?? "da_ricontattare",
          dataRicontatto: o.giorno ?? OGGI,
          oraRicontatto: o.ora === undefined ? "15:00" : o.ora,
          consulenteId: o.consulente === undefined ? "s" : o.consulente,
        },
      },
    };
  };

  gruppo("PROSSIMO RICONTATTO · REGOLE");
  const a = chat({ ora: "15:00" });
  const r = P.prossimoRicontatto([a], OGGI, alle("09:00"), consulenti);
  c("ricontatto fissato oggi alle 15: c'è la barra", a, r?.chat);
  c("etichetta con ora e consulente", "Da richiamare alle 15:00 · Sara", r?.etichetta);
  c("prima delle 15 non è passato", false, r?.passato);
  c("senza ora: niente barra", null, P.prossimoRicontatto([chat({ ora: "" })], OGGI, alle("09:00"), consulenti));
  c("domani: niente barra", null, P.prossimoRicontatto([chat({ giorno: "2026-11-12" })], OGGI, alle("09:00"), consulenti));
  c("ieri: niente barra", null, P.prossimoRicontatto([chat({ giorno: "2026-11-10" })], OGGI, alle("09:00"), consulenti));
  c("stato senza richiamo (venduto): niente barra", null, P.prossimoRicontatto([chat({ stato: "venduto" })], OGGI, alle("09:00"), consulenti));
  c("vale anche per «Richiamo concordato»", true, !!P.prossimoRicontatto([chat({ stato: "richiamo" })], OGGI, alle("09:00"), consulenti));
  const presto = chat({ ora: "11:30" });
  const tardi = chat({ ora: "17:00" });
  c("fra più ricontatti vince l'ora più vicina", presto, P.prossimoRicontatto([tardi, a, presto], OGGI, alle("09:00"), consulenti)?.chat);
  const passato = P.prossimoRicontatto([a], OGGI, alle("16:00"), consulenti);
  c("ora passata da un'ora: resta, segnato passato", [a, true], [passato?.chat, passato?.passato]);
  c("ora passata da più di 2 ore: passa al successivo", tardi, P.prossimoRicontatto([a, tardi], OGGI, alle("17:30"), consulenti)?.chat);
  c("solo i propri col consulente dentro", null, P.prossimoRicontatto([a], OGGI, alle("09:00"), consulenti, "m"));
  c("i propri sì", a, P.prossimoRicontatto([a], OGGI, alle("09:00"), consulenti, "s")?.chat);
  c("senza consulente: etichetta senza nome", "Da richiamare alle 15:00", P.prossimoRicontatto([chat({ consulente: null })], OGGI, alle("09:00"), consulenti)?.etichetta);
  c("l'ora «9:05» si legge come 09:05", "09:05", P.prossimoRicontatto([chat({ ora: "9:05" })], OGGI, alle("08:00"), consulenti)?.ora);

  gruppo("PROSSIMO RICONTATTO · DISEGNO (SORGENTE)");
  const barra = senzaCommenti(leggi("src/crm/chatwa/BarraProssimoRicontatto.tsx"));
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  c("l'elenco monta la barra del ricontatto", true, /<BarraProssimoRicontatto\b/.test(elenco));
  c("la barra si calcola su tutte le chat (non nascoste), col consulente dentro", true, /prossimoRicontatto\(\s*api\.chats\.filter\(\(c\) => !eNascosto\(c\)\),[\s\S]*?consultants,\s*soloDi/.test(elenco));
  c("la barra sta nel blocco incollato in cima", true, /\(filtri\.ricontatti \|\| meet \|\| ricontatto\)/.test(elenco));
  c("tasto alto almeno 44 px sul telefono", true, /min-h-11/.test(barra));
  c("il tocco apre la chat", true, /onClick=\{onApri\}/.test(barra));
  c("niente emoji nella barra", false, /\p{Extended_Pictographic}/u.test(barra));

  gruppo("PANNELLO OGGI · SENZA PROMEMORIA (11/11/2026)");
  const pan = senzaCommenti(leggi("src/crm/chatwa/PannelloOggi.tsx"));
  c("niente più scheda «Da fare» nel pannello Oggi", false, /Da fare\s*<\/Segmento>/.test(pan) || /"dafare"/.test(pan));
  c("niente righe da fare né cose scritte a mano", false, /<VoceDaFare\b|caricaTask|costruisciRighe/.test(pan));
  c("restano le consulenze nei tre gruppi e «Lead»", true, /\["fatte", "Già fatte"/.test(pan) && /\["prossime", "Da fare"/.test(pan) && /<WhatsAppLeadsPanel\b/.test(pan));
}
