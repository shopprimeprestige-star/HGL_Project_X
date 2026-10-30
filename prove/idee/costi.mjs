/** ── PROVE: IDEA 9 · QUANTO SI È RISPARMIATO (30/10/2026) ─────────────────────
 *
 *  Commessa 2026-10-30-idee-chat. I messaggi del giro (promemoria, conferme…) partiti
 *  come TESTO nella finestra aperta (nel registro: nessun flusso) non sono modelli
 *  pagati: il pannello «Costi WhatsApp» mostra quanto si sarebbe speso con i modelli.
 *  Dati inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveIdeeCosti(mod, { c, gruppo, radice }) {
  const C = mod["chatwa/calcolo-costi"];
  const K = mod["chatwa/costi-whatsapp"];
  const ADESSO = new Date("2026-10-30T14:00:00Z");
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const testo = (tipo, quando = "2026-10-30T09:00:00Z") => ({ tipo, modello: null, conFlusso: false, inviatoIl: quando });
  const modello = (tipo, nome, quando = "2026-10-30T09:00:00Z") => ({ tipo, modello: nome, conFlusso: true, inviatoIl: quando });

  gruppo("IDEE · COSTI · IL RISPARMIO DEI TESTI AUTOMATICI");
  c("un testo dentro la finestra costa zero (l'ipotesi del pannello: gratis per Meta)", 0, K.COSTO_TESTO_IN_FINESTRA);
  {
    //  promemoria → hgl promemoria_meet (utility), conferma → utility, ritorno → marketing
    //  (le 10:00 di Roma del 30/10/2026 sono prima di UTILITY_DAL, le 12:00: il ritorno passa a Utility solo da lì).
    const r = C.calcolaCosti(
      [testo("promemoria"), testo("conferma"), testo("ritorno"), testo("meet_oggi")],
      "oggi",
      ADESSO,
    );
    c("quattro testi del giro: quattro messaggi risparmiati", 4, r.risparmio.messaggi);
    c("…il risparmio è la somma dei prezzi dei modelli (3 utility + 1 marketing)", r6(3 * 0.0248 + 0.0658), r.risparmio.euro);
    c("…non sono testi a mano", 0, r.testiLiberi);
    c("…e non entrano nel totale né nei messaggi pagati", [0, 0], [r.totale, r.messaggi]);
  }
  {
    const r = C.calcolaCosti(
      [
        testo("chat"), // scritto a mano
        testo("chat"),
        testo("prova"), // tipo senza modello tipico
        testo("tipo_mai_visto"),
        testo("promemoria"),
        modello("promemoria", "hgl_promemoria_meet"), // modello vero: si paga, non si risparmia
        modello("chat", "hgl_ritorno"),
      ],
      "oggi",
      ADESSO,
    );
    c("i testi a mano e quelli di tipo senza modello restano «testi liberi»", 4, r.testiLiberi);
    c("solo il testo del giro è un risparmio", [1, 0.0248], [r.risparmio.messaggi, r.risparmio.euro]);
    c("i modelli veri si pagano come prima", [2, r6(0.0248 + 0.0658)], [r.messaggi, r.totale]);
  }
  {
    const r = C.calcolaCosti(
      [
        testo("promemoria", "2026-10-30T10:00:00Z"),
        testo("promemoria", "2026-10-29T10:00:00Z"), // ieri
        testo("promemoria", "2026-10-28T10:00:00Z"), // due giorni fa
        testo("promemoria", "2026-10-30T16:00:00Z"), // nel futuro: non conta
        testo("promemoria", "boh"),
      ],
      "oggi",
      ADESSO,
    );
    c("il risparmio segue il periodo (Oggi: uno solo, mai il futuro né le date rotte)", 1, r.risparmio.messaggi);
    c("…3 giorni: tre", 3, C.calcolaCosti([testo("promemoria", "2026-10-30T10:00:00Z"), testo("promemoria", "2026-10-29T10:00:00Z"), testo("promemoria", "2026-10-28T10:00:00Z")], "3", ADESSO).risparmio.messaggi);
  }
  {
    const v = C.calcolaCosti([], "oggi", ADESSO);
    c("senza invii il risparmio è zero, mai un NaN", { messaggi: 0, euro: 0 }, v.risparmio);
    const molti = C.calcolaCosti(Array.from({ length: 1000 }, () => testo("promemoria")), "oggi", ADESSO);
    c("mille testi: l'arrotondamento non deriva (1000 × 0,0248)", 24.8, molti.risparmio.euro);
  }
  c(
    "ogni tipo del giro ha un modello tipico con prezzo",
    [],
    Object.entries(C.MODELLO_DEL_TIPO).filter(([, m]) => !(K.prezzoModello(m) > 0)),
  );

  gruppo("IDEE · COSTI · IL PANNELLO (sorgente)");
  {
    const pan = readFileSync(join(radice, "src/crm/chatwa/PannelloCosti.tsx"), "utf8");
    c("la riga: «Risparmiati circa X € · N messaggi … come testo invece che come modello»", true,
      /Risparmiati circa/.test(pan) && /come testo invece che come/.test(pan) && /costi\.risparmio\.euro/.test(pan));
    c("si mostra solo se c'è qualcosa risparmiato", true, /costi\.risparmio\.messaggi > 0 &&/.test(pan));
    c("dice che è una stima", true, /È una stima/.test(pan));
    c("senza larghezze fisse: il testo va a capo sul telefono", false, /risparmio[\s\S]{0,900}(w-\[\d|whitespace-nowrap)/.test(pan.slice(pan.indexOf("costi-risparmio"), pan.indexOf("costi-categorie"))));
  }
}
