/** ── PROVE: CHAT WHATSAPP · STILE, VOCALI E «SVUOTA» ─────────────────────────────
 *
 *  Commessa 2026-10-28-chat-stile-whatsapp. Le regole pure di
 *  `src/crm/chatwa/stile.ts`: il tempo del lettore dei vocali, la velocità
 *  1× → 1,5× → 2×, la forma d'onda finta (sempre la stessa per lo stesso
 *  vocale), le bolle attaccate alla precedente e l'«Annulla» della X.
 *  Più i controlli sul sorgente dei punti che non hanno uno schermo nelle prove.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatStile(mod, { c, gruppo, radice }) {
  const S = mod["chatwa/stile"];

  gruppo("CHAT · VOCALI · IL TEMPO E LA VELOCITÀ");
  c("velocità salvata: valori ammessi", [1, 1.5, 2], ["1", "1.5", "2"].map(S.velocitaValida));
  c("velocità salvata: strana o mancante → 1×", [1, 1, 1, 1], [null, "3", "abc", undefined].map(S.velocitaValida));
  c("velocità senza archivio del browser → 1×", 1, S.velocitaSalvata());
  c("salvare senza archivio non rompe", undefined, S.salvaVelocita(2));
  c("zero", "0:00", S.tempoVocale(0));
  c("sette secondi", "0:07", S.tempoVocale(7.4));
  c("un minuto e cinque", "1:05", S.tempoVocale(65));
  c("oltre l'ora resta in minuti", "61:01", S.tempoVocale(3661));
  c("durata sconosciuta (NaN, Infinity, negativa): 0:00", ["0:00", "0:00", "0:00"], [NaN, Infinity, -3].map(S.tempoVocale));
  c("velocità: 1 → 1,5 → 2 → 1", [1.5, 2, 1], [1, 1.5, 2].map(S.velocitaDopo));
  c("velocità strana: si riparte da 1", 1, S.velocitaDopo(3));
  c("etichetta della velocità", ["1×", "1,5×", "2×"], [1, 1.5, 2].map(S.etichettaVelocita));

  gruppo("CHAT · VOCALI · LA FORMA D'ONDA FINTA");
  const a = S.barreFinte("https://x/a.ogg", 28);
  c("quante barre chieste", 28, a.length);
  c("stesso vocale: stesse barre (niente salti a ogni disegno)", a, S.barreFinte("https://x/a.ogg", 28));
  c("vocale diverso: barre diverse", false, JSON.stringify(a) === JSON.stringify(S.barreFinte("https://x/b.ogg", 28)));
  c("altezze fra 0,2 e 1", true, a.every((h) => h >= 0.2 && h <= 1));
  c("zero barre: niente", [], S.barreFinte("x", 0));
  c("avanzamento: dove si tocca (metà, fuori a sinistra, fuori a destra)", [0.5, 0, 1], [
    S.quotaDaPunto(150, 100, 100),
    S.quotaDaPunto(50, 100, 100),
    S.quotaDaPunto(400, 100, 100),
  ]);
  c("avanzamento: barra larga zero non divide per zero", 0, S.quotaDaPunto(10, 0, 0));

  gruppo("CHAT · BOLLE · ATTACCATE ALLA PRECEDENTE");
  const m = (direction, created_at) => ({ direction, created_at });
  c("prima bolla: staccata", false, S.attaccataAllaPrecedente(m("inbound", "2026-10-28T10:00:00Z"), null));
  c("stesso lato, stesso giorno: attaccata", true,
    S.attaccataAllaPrecedente(m("inbound", "2026-10-28T10:05:00Z"), m("inbound", "2026-10-28T10:00:00Z")));
  c("lato diverso: staccata", false,
    S.attaccataAllaPrecedente(m("outbound", "2026-10-28T10:05:00Z"), m("inbound", "2026-10-28T10:00:00Z")));
  c("stesso lato ma giorno diverso (Roma): staccata", false,
    S.attaccataAllaPrecedente(m("inbound", "2026-10-28T23:30:00Z"), m("inbound", "2026-10-28T22:30:00Z")));
  c("data illeggibile: staccata", false,
    S.attaccataAllaPrecedente(m("inbound", "boh"), m("inbound", "2026-10-28T10:00:00Z")));

  gruppo("CHAT · CASELLA · LA X E «ANNULLA»");
  c("casella ancora vuota: torna il testo cancellato", "Buongiorno Mario", S.bozzaDopoAnnulla("Buongiorno Mario", ""));
  c("solo spazi: come vuota", "Buongiorno Mario", S.bozzaDopoAnnulla("Buongiorno Mario", "  \n"));
  c("nel frattempo ha scritto altro: niente si perde, il cancellato va sopra",
    "Buongiorno Mario\n\nA che ora?", S.bozzaDopoAnnulla("Buongiorno Mario", "A che ora?"));
  c("niente da ripristinare: resta com'è", "ciao", S.bozzaDopoAnnulla("", "ciao"));

  gruppo("CHAT · STILE WHATSAPP · NEL SORGENTE");
  const leggi = (f) => readFileSync(join(radice, "src/crm/chatwa", f), "utf8");
  const bolla = leggi("BollaMessaggio.tsx");
  const casella = leggi("Casella.tsx");
  const conv = leggi("Conversazione.tsx");
  c("il vocale non usa più i comandi nativi del browser", false, /<audio[^>]*\bcontrols\b/.test(bolla));
  c("un solo vocale alla volta (il precedente si ferma)", true, /vocaleInCorso/.test(bolla) && /\.pause\(\)/.test(bolla));
  c("i tasti del lettore non tolgono il fuoco alla casella", true, /onPointerDown=\{[^}]*preventDefault/.test(bolla));
  c("bolle in uscita verde WhatsApp, sfondo della chat tenue", true, /#d9fdd3/.test(bolla) && /#efeae2/.test(conv));
  c("la X c'è solo con del testo e si può annullare", true,
    /aria-label="Svuota il messaggio"/.test(casella) && /bozzaDopoAnnulla\(/.test(casella) && /Annulla/.test(casella));
  c("toccare la casella non riporta la pagina in cima (niente scrollTo nel fuoco)", false, /onFocus=\{[^}]*scrollTo/.test(casella));
}
