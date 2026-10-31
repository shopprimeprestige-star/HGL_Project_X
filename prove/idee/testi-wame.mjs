/** ── PROVE: I TESTI PRECOMPILATI NEI LINK wa.me, FORMATTATI (31/10/2026) ──────
 *  Richiesta del titolare: il testo arrivava in WhatsApp come un blocco unico, col link in
 *  mezzo alla frase. Regola (src/crm/chatwa/testoWa.ts): saluto · riga vuota · informazione ·
 *  riga vuota · «Per collegarti:» e il link DA SOLO · riga vuota · chiusura. Qui, per ogni testo
 *  toccato: gli a capo, il link su una riga sua, la codifica `%0A` nel link wa.me.
 *  Dati inventati: nessun cliente vero. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function proveTestiWame(mod, { c, gruppo, radice }) {
  const T = mod["chatwa/testoWa"];
  const W = mod["chatwa/apriWhatsapp"];
  const I = mod["chatwa/invito-meet"];
  const LINK = "https://meet.example.test/stanza-prova?chi=abc123";

  /** I controlli di forma che valgono per OGNI testo con un link. */
  const forma = (nome, testo, link = LINK) => {
    const righe = testo.split("\n");
    const i = righe.indexOf(link);
    c(`${nome}: il link sta DA SOLO su una riga`, true, i > 0);
    c(`${nome}: la riga prima del link finisce con «:»`, true, i > 0 && /:$/.test(righe[i - 1]));
    c(`${nome}: mai tre a capo di fila né spazi a fine riga`, false, /\n{3,}|[ \t]+\n|[ \t]$/.test(testo));
    c(`${nome}: più blocchi separati da una riga vuota (non un blocco unico)`, true, testo.split("\n\n").length >= 3);
    const wa = W.linkWaMe("+393331110000", testo);
    c(`${nome}: nel link wa.me gli a capo sono %0A`, true, wa.includes("%0A%0A") && !wa.includes("%20%0A") && !/%20https/.test(wa));
    c(`${nome}: nel link wa.me il link segue direttamente un %0A`, true, wa.includes("%0A" + encodeURIComponent(link)));
    c(`${nome}: decodificato torna identico`, testo, decodeURIComponent(wa.split("?text=")[1]));
  };

  gruppo("TESTI wa.me · L'AIUTO COMUNE");
  c("saluto col nome", "Ciao Giulia!", T.salutoWa("Giulia"));
  c("saluto senza nome: mai «Ciao !»", "Ciao!", T.salutoWa("  "));
  c("blocco del link: introduzione, a capo, link", "Per collegarti:\nhttps://x.it", T.bloccoLinkWa("Per collegarti:", "https://x.it"));
  c("i blocchi vuoti si saltano", "a\n\nb", T.testoWa(["a", "", null, false, undefined, "b"]));

  gruppo("TESTI wa.me · L'INVITO AL MEET");
  const chat = (nome = "Giulia Verdi") => ({
    phone: "+393331110000",
    leadId: "l1",
    lead: { id: "l1", data: { nome, linkMeeting: LINK } },
  });
  const col = I.preparaInvito(chat(), "10:30", "Mirko").invito;
  c(
    "col link: saluto, informazione, «Per collegarti:», link, chiusura",
    `Ciao Giulia!\n\nLa tua consulenza con Hair Genius Labs è alle 10:30: Mirko ti aspetta.\n\nPer collegarti:\n${LINK}\n\nA presto!`,
    col.testo,
  );
  forma("invito col link", col.testo);
  c("il link dell'invito è quello personale, intero", LINK, col.link);
  c("il segno per «già inviato oggi» è sempre il link", LINK, col.segno);
  c("senza consulente: «ti aspettiamo»", true, I.preparaInvito(chat(), "10:30", null).invito.testo.includes("alle 10:30: ti aspettiamo."));
  c("senza nome: «Ciao!» e niente virgola sospesa", true, I.preparaInvito(chat(""), "10:30", "Mirko").invito.testo.startsWith("Ciao!\n\nLa tua"));
  const senza = I.preparaInvito(chat(), "10:30", "Mirko", "senza").invito;
  c(
    "senza link: la promessa del link su una riga sua, e la chiusura",
    "Ciao Giulia!\n\nLa tua consulenza con Hair Genius Labs è alle 10:30: Mirko ti aspetta.\n\nTra poco ti mando qui il link per entrare.\n\nA presto!",
    senza.testo,
  );
  c("senza link: la frase che lo riconosce nella chat c'è ancora", true, senza.testo.includes(I.SEGNO_SENZA_LINK));
  c("senza link: più blocchi e %0A nel link wa.me", true, senza.testo.split("\n\n").length === 4 && W.linkWaMe("+393331110000", senza.testo).includes("%0A%0A"));
  c("senza link: nessun link nel testo", false, /https?:/.test(senza.testo));

  gruppo("TESTI wa.me · IL PROMEMORIA CON IL LINK (modello «promemoria»)");
  const WA = mod["whatsapp"];
  const modello = WA.MODELLI_ORIGINALI.promemoria;
  const pm = WA.componiMessaggio(modello, { nome: "Giulia", consulente: "Mirko", quando: "oggi alle 10:30", link: LINK });
  forma("promemoria", pm);
  c("promemoria: «Per collegarti:» poi il link", true, pm.includes(`Per collegarti:\n${LINK}\n\n`));
  const pmSenza = WA.componiMessaggio(modello, { nome: "Giulia", consulente: "Mirko", quando: "oggi alle 10:30" });
  c("promemoria senza link: una riga sola, senza l'introduzione appesa", true, pmSenza.includes("appuntamento di oggi alle 10:30.\n\nIl link per collegarti te lo mando poco prima.\n\n") && !pmSenza.includes("Per collegarti:"));
  c("promemoria senza link: il senso resta (lo manda poco prima), niente buchi", true, !/\n{3,}/.test(pmSenza));

  gruppo("TESTI wa.me · LINK POCO PRIMA (promemoria precompilato nella chat)");
  const R = mod["chatwa/risposte-rapide"];
  const fra = R.riempi(R.RISPOSTE_PREDEFINITE.find((r) => r.id === "link_fra_poco").testo, { nome: "Giulia", consulente: "Mirko", ora: "10:30", link: LINK });
  forma("link poco prima", fra);
  c("link poco prima: ora e consulente restano", true, fra.includes("alle 10:30") && fra.includes("Mirko la aspetta"));

  gruppo("TESTI wa.me · IL PREVENTIVO (dalla riga dei preventivi)");
  const P = mod["preventivi/messaggi"];
  const inv = P.componiPerPreventivo("invio", { nome: "Giulia", cognome: "Verdi", consulente: "Mirko", link: LINK });
  forma("invio preventivo", inv);
  c("invio preventivo: «Lo trova qui:» e il link", true, inv.includes(`Lo trova qui:\n${LINK}\n\n`));
  //  Senza link la riga sparisce INTERA, introduzione compresa (come quando era «Lo trova qui: {link}»).
  const invSenza = P.componiPerPreventivo("invio", { nome: "Giulia", cognome: "Verdi", consulente: "Mirko", link: "" });
  c("invio preventivo senza link: sparisce anche «Lo trova qui:»", false, /Lo trova qui/.test(invSenza));
  c("invio preventivo senza link: il resto c'è e non ci sono buchi", true, invSenza.includes("abbiamo parlato.\n\nSe lo apre con calma") && !/\n{3,}/.test(invSenza));
  c("l'introduzione cade solo se il segnaposto è tutta la riga (con una frase intorno, quella prima resta)", "Intro:\nA presto", WA.componiMessaggio("Intro:\nVedi {link}\nA presto", {}));
  c("un modello con un'introduzione e il link presente la tiene", "Qui:\nhttps://x.it", WA.componiMessaggio("Qui:\n{link}", { link: "https://x.it" }));
  c("un modello con l'introduzione e il link vuoto la toglie", "Dopo", WA.componiMessaggio("Qui:\n{link}\n\nDopo", {}));

  gruppo("TESTI wa.me · IL PREVENTIVO (tasto del pannello e pagina del preventivo)");
  const dalPannello = T.testoPreventivoWa({ nome: "Giulia", riferimento: "HG-1234", link: LINK });
  c(
    "dal pannello: saluto, informazione, link da solo, chiusura",
    `Ciao Giulia!\n\nEcco il tuo preventivo HG-1234.\n\nPer aprirlo:\n${LINK}\n\nSe hai domande, scrivimi qui.`,
    dalPannello,
  );
  forma("preventivo dal pannello", dalPannello);
  c("dal pannello senza nome: «Ciao!»", true, T.testoPreventivoWa({ nome: "", riferimento: "HG-1234", link: LINK }).startsWith("Ciao!\n\n"));
  const dallaPagina = T.testoPreventivoWa({ riferimento: "HG-1234", totale: "€ 1.200", link: LINK });
  c("dalla pagina (senza nome): informazione, poi il link da solo", `Preventivo Hair Genius Labs HG-1234 — € 1.200.\n\nPer aprirlo:\n${LINK}`, dallaPagina);
  c("dalla pagina: il link è solo e %0A nel link wa.me", true, dallaPagina.split("\n").includes(LINK) && W.linkWaMe("+393331110000", dallaPagina).includes("%0A%0A"));

  gruppo("TESTI wa.me · POSA (installazione)");
  // Il modulo è una finestra React: lo si impacchetta qui, a parte, come altre prove di sorgente.
  const dove = mkdtempSync(join(tmpdir(), "testi-wame-"));
  try {
    execFileSync(
      "npx",
      ["esbuild", "src/crm/InstallationScheduleDialog.tsx", "--bundle", "--format=cjs", `--outfile=${join(dove, "inst.cjs")}`, "--loader:.tsx=tsx", "--alias:@=./src", "--log-level=error"],
      { cwd: radice, stdio: ["ignore", "ignore", "inherit"] },
    );
    const INST = createRequire(import.meta.url)(join(dove, "inst.cjs"));
    const lead = { id: "x", data: { nome: "Giulia", installazione: { dataInstallazione: "2026-11-12", orarioInstallazione: "15:00" } } };
    const conData = INST.messaggioInstallazione(lead);
    c("posa con data: saluto, informazione e chiusura a blocchi", true, /^Buongiorno Giulia,\n\n/.test(conData) && conData.split("\n\n").length >= 3);
    c("posa con data: giorno e ora restano", true, /12 novembre/i.test(conData) && conData.includes("alle 15:00"));
    const senzaData = INST.messaggioPosaSenzaData(lead);
    c(
      "posa senza data: saluto, richiesta, domanda",
      "Buongiorno Giulia,\n\nPossiamo fissare la data di installazione.\n\nMi indica i giorni in cui è disponibile?",
      senzaData,
    );
    c("posa senza data: nel link wa.me gli a capo sono %0A", true, W.linkWaMe("+393331110000", senzaData).includes("%0A%0A"));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  gruppo("TESTI wa.me · LA SCHEDA DEL SITO (PublicLeadDetailSheet)");
  const scheda = readFileSync(join(radice, "src/crm/PublicLeadDetailSheet.tsx"), "utf8");
  c("la richiesta ricevuta passa dall'aiuto comune (saluto + blocchi)", true, /testoWa\(\[\s*salutoWa\(draft\.nome\)/.test(scheda));
  c("…e non è più una frase unica con il saluto in mezzo", false, /testo=\{`Ciao \$\{draft\.nome\}, ho ricevuto/.test(scheda));
  const ric = T.testoWa([T.salutoWa("Giulia"), "Ho ricevuto la tua richiesta per Prodotto.", "Ti contatto a breve!"]);
  c("risultato: tre blocchi", "Ciao Giulia!\n\nHo ricevuto la tua richiesta per Prodotto.\n\nTi contatto a breve!", ric);

  gruppo("TESTI wa.me · SOLO L'AIUTO, NIENTE LINK IN MEZZO ALLA FRASE");
  // Nessun sorgente costruisce più «…: ${link}» sulla stessa riga dentro un ?text=.
  for (const f of ["src/shop/QuotesPanel.tsx", "src/routes/preventivo.tsx"]) {
    const src = readFileSync(join(radice, f), "utf8");
    c(`${f}: usa testoPreventivoWa`, true, src.includes("testoPreventivoWa("));
  }
}
