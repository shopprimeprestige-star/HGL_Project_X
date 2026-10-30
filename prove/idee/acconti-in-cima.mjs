/** ── PROVE: ACCONTI IN CIMA, ANTICIPA CONDIVISO, GESTIONE DALLA CHAT (30/10/2026) ─────────
 *  Regole in src/crm/chatwa/accontiInCima.ts. Chi ha lasciato l'acconto e non ha ancora fatto la
 *  posa sta in cima, dall'acconto più vecchio; «Anticipa» (priorità della scheda) sale per primo.
 *  Il disegno (blocco richiudibile, tasto «Installazione», 44 px, niente emoji, finestre già
 *  esistenti) si prova sul sorgente. Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveAccontiInCima(mod, { c, gruppo, radice }) {
  const A = mod["chatwa/accontiInCima"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  let n = 0;
  /** Una scheda: `o.acconto` = euro versati, `o.dal` = giorno dell'acconto (nel registro incassi). */
  const lead = (o = {}) => {
    n++;
    const data = {
      nome: o.nome ?? `Nome${n}`,
      cognome: o.cognome ?? "Prova",
      stato: o.stato ?? "posa_in_sede",
      payment: {},
    };
    if (o.acconto !== undefined) data.payment.accontoPagato = o.acconto;
    if (o.dal) data.payment.incassi = [{ id: `i${n}`, data: o.dal, importo: o.acconto ?? 0 }];
    if (o.dataPagamento) data.payment.dataPagamento = o.dataPagamento;
    if (o.convertedAt) data.convertedAt = o.convertedAt;
    if (o.posa || o.priorita || o.fatta || o.desiderata) {
      data.installazione = {};
      if (o.posa) data.installazione.dataInstallazione = o.posa;
      if (o.priorita) data.installazione.priorita = true;
      if (o.desiderata) data.installazione.dataDesiderata = o.desiderata;
      if (o.fatta) data.installazione.completataIl = "2026-10-20";
    }
    return { id: `L${n}`, data };
  };
  const chat = (l) => ({ phone: `+39333000${String(n).padStart(4, "0")}${Math.random()}`, lead: l });
  const nomi = (righe) => righe.map((r) => r.lead?.data.nome);

  gruppo("ACCONTI IN CIMA: CHI È «DA INSTALLARE»");
  c("acconto incassato, posa non fatta: sì", true, A.daInstallare(lead({ acconto: 200 })));
  c("senza un euro incassato e senza priorità: no", false, A.daInstallare(lead({ acconto: 0 })));
  c("scheda senza pagamento: no", false, A.daInstallare(lead({})));
  c("nessuna scheda: no", false, A.daInstallare(null));
  c("posa già fatta (completataIl): no", false, A.daInstallare(lead({ acconto: 200, fatta: true })));
  c("stato «venduto» = posa fatta: no", false, A.daInstallare(lead({ acconto: 200, stato: "venduto" })));
  c("pratica persa («annullato»): no", false, A.daInstallare(lead({ acconto: 200, stato: "annullato" })));
  c("«concluso»: no", false, A.daInstallare(lead({ acconto: 200, stato: "concluso" })));
  c(
    "acconto e posa già fissata, ma non fatta: sì (l'installazione non è ancora avvenuta)",
    true,
    A.daInstallare(lead({ acconto: 200, posa: "2026-11-10" })),
  );
  c(
    "senza acconto ma con Anticipa acceso: sì (la priorità conta)",
    true,
    A.daInstallare(lead({ acconto: 0, stato: "posa_in_sede", priorita: true })),
  );
  c(
    "Anticipa acceso su posa fatta: no (come il resto del CRM, a posa fatta il segno si spegne)",
    false,
    A.daInstallare(lead({ priorita: true, fatta: true })),
  );

  gruppo("ACCONTI IN CIMA: LA DATA DELL'ACCONTO");
  c(
    "la più vecchia fra le righe del registro incassi",
    "2026-09-02",
    A.dataAcconto(
      (() => {
        const l = lead({ acconto: 300, dal: "2026-09-10" });
        l.data.payment.incassi.push({ id: "x", data: "2026-09-02", importo: 100 });
        return l;
      })(),
    ),
  );
  c(
    "senza registro: la data del pagamento",
    "2026-08-15",
    A.dataAcconto(lead({ acconto: 100, dataPagamento: "2026-08-15T10:00:00Z" })),
  );
  c(
    "senza niente: il giorno in cui è diventata vendita (la stessa regola dell'attesa)",
    "2026-07-01",
    A.dataAcconto(lead({ acconto: 100, convertedAt: "2026-07-01T09:00:00Z" })),
  );

  gruppo("ACCONTI IN CIMA: L'ORDINE DEL BLOCCO");
  const vecchio = chat(lead({ nome: "Vecchio", acconto: 100, dal: "2026-08-01" }));
  const medio = chat(lead({ nome: "Medio", acconto: 100, dal: "2026-09-01" }));
  const nuovo = chat(lead({ nome: "Nuovo", acconto: 100, dal: "2026-10-01" }));
  const estraneo = chat(lead({ nome: "Estraneo", acconto: 0 }));
  const senzaScheda = { phone: "+390000", lead: null };
  c(
    "dal più vecchio al più giovane, chi non c'entra non c'è",
    ["Vecchio", "Medio", "Nuovo"],
    nomi(A.chatDaInstallare([nuovo, estraneo, vecchio, senzaScheda, medio])),
  );
  const anticipato = chat(lead({ nome: "Anticipato", acconto: 100, dal: "2026-10-20", priorita: true }));
  c(
    "chi ha Anticipa acceso sta in cima al blocco, anche se l'acconto è recente",
    ["Anticipato", "Vecchio", "Medio", "Nuovo"],
    nomi(A.chatDaInstallare([vecchio, medio, nuovo, anticipato])),
  );
  const a1 = chat(lead({ nome: "ConData", acconto: 1, dal: "2026-10-25", priorita: true, desiderata: "2026-11-05" }));
  const a2 = chat(lead({ nome: "ConDataPrima", acconto: 1, dal: "2026-10-26", priorita: true, desiderata: "2026-11-01" }));
  c(
    "fra gli anticipati vale l'ordine di Anticipa (prima il giorno chiesto più vicino)",
    ["ConDataPrima", "ConData"],
    nomi(A.chatDaInstallare([a1, a2])),
  );
  const pari1 = chat(lead({ nome: "Bianchi", acconto: 1, dal: "2026-09-01" }));
  const pari2 = chat(lead({ nome: "Alberti", acconto: 1, dal: "2026-09-01" }));
  c(
    "a parità di giorno decide il nome: l'elenco non si rimescola a ogni aggiornamento",
    ["Alberti", "Bianchi"],
    nomi(A.chatDaInstallare([pari1, pari2])),
  );
  const ingresso = [nuovo, vecchio];
  A.chatDaInstallare(ingresso);
  c("non muta l'elenco di partenza", ["Nuovo", "Vecchio"], nomi(ingresso));

  gruppo("ACCONTI IN CIMA: NELLE CODE (DA RISPONDERE, ALTRE) SALGONO DENTRO LA SEZIONE");
  const x = chat(lead({ nome: "X", acconto: 0 }));
  const y = chat(lead({ nome: "Y", acconto: 0 }));
  c(
    "gli acconti vanno prima, gli altri restano nel loro ordine",
    ["Vecchio", "Nuovo", "X", "Y"],
    nomi(A.saliAcconti([x, nuovo, y, vecchio])),
  );
  c("senza acconti restituisce lo stesso elenco", true, (() => { const l = [x, y]; return A.saliAcconti(l) === l; })());

  gruppo("ACCONTI IN CIMA: CHI PUÒ ESSERE ANTICIPATO");
  c("acconto e posa da fare: sì", true, A.puoAnticipare(lead({ acconto: 50 })));
  c("lead ancora in trattativa, senza soldi: no", false, A.puoAnticipare(lead({ stato: "sta_valutando" })));
  c("chiusura vinta senza acconto («paga alla consegna»): sì", true, A.puoAnticipare(lead({ stato: "posa_in_sede" })));
  c("posa fatta: no", false, A.puoAnticipare(lead({ acconto: 50, fatta: true })));
  c("pratica persa: no", false, A.puoAnticipare(lead({ acconto: 50, stato: "annullato" })));
  c("nessuna scheda: no", false, A.puoAnticipare(null));

  gruppo("ACCONTI IN CIMA: QUANDO C'È IL TASTO «INSTALLAZIONE»");
  c("posa da fare con acconto: sì", true, A.haUnaPosa(lead({ acconto: 50 })));
  c("trattativa aperta: no", false, A.haUnaPosa(lead({ stato: "sta_valutando" })));
  c(
    "posa eseguita ma con il saldo ancora da incassare: sì",
    true,
    A.haUnaPosa(
      (() => {
        const l = lead({ acconto: 100, fatta: true });
        l.data.payment.prezzoFinaleVendita = 500;
        return l;
      })(),
    ),
  );
  c("posa eseguita e saldata: no", false, A.haUnaPosa(lead({ acconto: 100, fatta: true })));
  c("nessuna scheda: no", false, A.haUnaPosa(null));

  gruppo("ACCONTI IN CIMA: IL DISEGNO");
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  const modulo = senzaCommenti(leggi("src/crm/chatwa/accontiInCima.ts"));
  const conv = senzaCommenti(leggi("src/crm/chatwa/Conversazione.tsx"));
  const riga = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  const gest = senzaCommenti(leggi("src/crm/chatwa/GestioneInstallazione.tsx"));
  c("ElencoChat usa chatDaInstallare", true, /chatDaInstallare\(/.test(elenco));
  c("il blocco è solo in «Tutte»", true, /const daInstallareTutte = tutte \?/.test(elenco));
  c(
    "le chat del blocco escono dall'elenco sotto (una riga una volta sola)",
    true,
    /inBloccoTel/.test(elenco) && /!inBloccoTel\.has\(c\.phone\)/.test(elenco),
  );
  c(
    "il blocco sta sotto la barra del prossimo meet",
    true,
    elenco.indexOf("<BarraProssimoMeet") < elenco.indexOf("titolo-da-installare"),
  );
  c("il blocco è richiudibile (aria-expanded)", true, /aria-expanded=\{apertoAcconti\}/.test(elenco));
  c(
    "il tasto del blocco è alto 44 px col dito",
    true,
    /aria-expanded=\{apertoAcconti\}[\s\S]{0,400}min-h-11/.test(elenco),
  );
  c("nelle code gli acconti salgono dentro la sezione (non con «Con stelle»)", true, /saliAcconti\(/.test(elenco));
  c("la riga mostra Anticipa solo a chi può averlo", true, /puoAnticipare\(/.test(riga) && /<TastoPriorita/.test(riga));
  c("la priorità sulla riga è la STESSA della scheda: TastoPriorita, non un campo nuovo", true, /TastoPriorita/.test(riga) && !/anticipaWa|prioritaWa/.test(riga + elenco + conv + gest));
  c("le stelle restano com'erano (osservazione)", true, /onStelle/.test(riga) && /useStelle/.test(elenco));
  c("l'intestazione ha UN tasto «Installazione»", true, /<GestioneInstallazione/.test(conv));
  c("il tasto è alto 44 px col dito", true, /h-11/.test(gest));
  c("apre le finestre che esistono già: programma", true, /InstallationScheduleDialog/.test(gest));
  c("apre le finestre che esistono già: incasso del saldo", true, /FinestraIncasso/.test(gest));
  c("apre le finestre che esistono già: il resto delle azioni", true, /FinestraAzioniPosa/.test(gest));
  c("Anticipa dal menu scrive sulla scheda (useAzioniPriorita)", true, /useAzioniPriorita\(\)/.test(gest));
  c("niente emoji nel disegno", false, /\p{Extended_Pictographic}/u.test(elenco + modulo + conv + riga + gest));
  c("il modulo non ha React né Supabase", false, /from "react"|supabase/.test(modulo));
}
