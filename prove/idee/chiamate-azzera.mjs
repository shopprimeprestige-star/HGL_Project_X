/** ── PROVE: IL CONTATORE DELLE CHIAMATE SI AZZERA AL FISSATO (31/10/2026) ──────
 *  Regole in src/crm/chiamate.ts (`patchAzzeraChiamate`, `totaleChiamateDi`, `senzaChiamate`).
 *  Decisione del titolare: il conto riparte da 0 quando la scheda ENTRA in
 *  «Appuntamento fissato» o «rifissato»; il totale di sempre resta a parte.
 *  Due parti: la regola pura, e i punti che scrivono lo stato (letti dal sorgente:
 *  uno che scrive il fissato senza chiamare la funzione fa fallire la prova).
 *  Dati inventati: nessun cliente vero. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export function proveChiamateAzzera(mod, { c, gruppo, radice }) {
  const C = mod["chiamate"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const ORA = new Date("2026-11-05T10:00:00Z");
  const conta = (volte, extra = {}) => ({
    volte,
    prima: "2026-10-31T09:00:00.000Z",
    ultima: "2026-11-04T09:00:00.000Z",
    ...extra,
  });

  gruppo("CHIAMATE · SI AZZERA SOLO IN INGRESSO NELL'APPUNTAMENTO");
  const prima = { stato: "non_risponde", chiamate: conta(4) };
  const dopo = { ...prima, stato: "appuntamento_fissato" };
  const r = C.patchAzzeraChiamate(prima, dopo, ORA).chiamate;
  c(
    "da «Non risponde» a fissato con 4 chiamate: volte 0, totale 4, data dell'azzeramento",
    [0, 4, ORA.toISOString()],
    [r?.volte, r?.totale, r?.azzerateIl],
  );
  c("…la prima e l'ultima chiamata restano", ["2026-10-31T09:00:00.000Z", "2026-11-04T09:00:00.000Z"], [r?.prima, r?.ultima]);
  c(
    "da «Da riprogrammare» a rifissato: azzera",
    0,
    C.patchAzzeraChiamate({ stato: "da_spostare", chiamate: conta(2) }, { stato: "appuntamento_rifissato", chiamate: conta(2) }, ORA).chiamate?.volte,
  );
  c(
    "il totale si somma ai giri precedenti (4 azzerate prima + 2 adesso = 6)",
    6,
    C.patchAzzeraChiamate(
      { stato: "da_spostare", chiamate: conta(2, { totale: 4 }) },
      { stato: "appuntamento_fissato", chiamate: conta(2, { totale: 4 }) },
      ORA,
    ).chiamate?.totale,
  );
  c(
    "fissato → rifissato: niente (era già un appuntamento)",
    {},
    C.patchAzzeraChiamate({ stato: "appuntamento_fissato", chiamate: conta(1) }, { stato: "appuntamento_rifissato", chiamate: conta(1) }, ORA),
  );
  c(
    "fissato → fissato (salvataggio del modulo): niente",
    {},
    C.patchAzzeraChiamate({ stato: "appuntamento_fissato", chiamate: conta(1) }, { stato: "appuntamento_fissato", chiamate: conta(1) }, ORA),
  );
  c(
    "in uscita (fissato → da riprogrammare): niente, il conto riparte da quello che è",
    {},
    C.patchAzzeraChiamate({ stato: "appuntamento_fissato", chiamate: conta(3) }, { stato: "da_spostare", chiamate: conta(3) }, ORA),
  );
  c("ingresso con 0 chiamate: niente (nessuna scrittura inutile)", {}, C.patchAzzeraChiamate({ stato: "da_contattare" }, { stato: "appuntamento_fissato" }, ORA));
  c(
    "ingresso con volte già 0 e un totale: niente",
    {},
    C.patchAzzeraChiamate({ stato: "da_spostare", chiamate: conta(0, { totale: 5 }) }, { stato: "appuntamento_fissato", chiamate: conta(0, { totale: 5 }) }, ORA),
  );
  c("stato che non è un appuntamento: niente", {}, C.patchAzzeraChiamate(prima, { ...prima, stato: "sta_valutando" }, ORA));
  c("dato rotto (volte testo): niente, mai NaN", {}, C.patchAzzeraChiamate({ stato: "da_spostare" }, { stato: "appuntamento_fissato", chiamate: { volte: "x" } }, ORA));
  const copia = JSON.stringify(prima);
  C.patchAzzeraChiamate(prima, dopo, ORA);
  c("non modifica gli argomenti", copia, JSON.stringify(prima));

  gruppo("CHIAMATE · IL TOTALE DI SEMPRE");
  c("mai chiamato: 0", 0, C.totaleChiamateDi({}));
  c("senza azzeramenti: coincide con le volte", 3, C.totaleChiamateDi({ chiamate: conta(3) }));
  c("dopo l'azzeramento: resta il totale", 4, C.totaleChiamateDi({ ...dopo, ...C.patchAzzeraChiamate(prima, dopo, ORA) }));
  c("azzerato e richiamato 2 volte: 4 + 2", 6, C.totaleChiamateDi({ chiamate: conta(2, { totale: 4 }) }));
  c("valori rotti: 0", 0, C.totaleChiamateDi({ chiamate: { volte: "x", totale: -2 } }));
  const dopoAzz = { ...dopo, ...C.patchAzzeraChiamate(prima, dopo, ORA) };
  const richiamato = C.patchChiamata(dopoAzz, new Date("2026-11-06T10:00:00Z")).chiamate;
  c(
    "il tocco dopo l'azzeramento riparte da 1 e non perde totale né data",
    [1, 4, ORA.toISOString()],
    [richiamato.volte, richiamato.totale, richiamato.azzerateIl],
  );
  c("il conto visibile è quello di adesso (volte), non il totale", 1, C.chiamateDi({ chiamate: richiamato }));
  c("title: «Chiamato 1 volta (5 in tutto)»", "Chiamato 1 volta (5 in tutto)", C.titoloChiamate({ chiamate: richiamato }));
  c("title senza azzeramenti: come prima, niente «in tutto»", "Chiamato 3 volte", C.titoloChiamate({ chiamate: conta(3) }));
  c("le frasi di prima non cambiano", ["Mai chiamato", "Chiamato 1 volta", "Chiamato 4 volte"], [0, 1, 4].map((n) => C.frasiChiamate(n)));

  gruppo("CHIAMATE · UN MODULO CON VALORI VECCHI NON LE RISCRIVE");
  //  Quello che fa `updateLead`: la modifica del modulo perde `chiamate`, poi si fonde e si applica l'azzeramento.
  const salva = (archivio, modifica, ammesse = false) => {
    const p = C.senzaChiamate(modifica, ammesse);
    const fuso = { ...archivio, ...p };
    return { ...fuso, ...C.patchAzzeraChiamate(archivio, fuso, ORA) };
  };
  const inArchivio = { stato: "appuntamento_fissato", nome: "Anna", chiamate: conta(0, { totale: 5, azzerateIl: ORA.toISOString() }) };
  const moduloVecchio = { ...inArchivio, nome: "Anna B.", chiamate: conta(5) };
  const dopoModulo = salva(inArchivio, moduloVecchio);
  c("modulo aperto prima dell'azzeramento (5 chiamate): volte 0 e totale 5 restano", [0, 5], [dopoModulo.chiamate.volte, dopoModulo.chiamate.totale]);
  c("…il resto del modulo si salva", "Anna B.", dopoModulo.nome);
  const senzaChiave = salva(inArchivio, { nome: "Anna C.", chiamate: undefined });
  c("modulo con la chiave vuota: non cancella il conto", [0, 5], [senzaChiave.chiamate?.volte, senzaChiave.chiamate?.totale]);
  const archivio2 = { stato: "non_risponde", chiamate: conta(5) };
  const modulo2 = { ...archivio2, chiamate: conta(2), stato: "appuntamento_fissato" };
  const salvato2 = salva(archivio2, modulo2);
  c(
    "modulo vecchio (2) che porta la scheda a fissato: vale l'archivio (5) e si azzera, totale 5",
    [0, 5],
    [salvato2.chiamate.volte, salvato2.chiamate.totale],
  );
  const tocco = salva(archivio2, C.patchChiamata(archivio2, ORA), true);
  c("il tocco sulla cornetta (ammesso) sale a 6", 6, tocco.chiamate.volte);
  const stessa = {};
  c("senza chiave `chiamate` la modifica passa com'è (stesso oggetto)", true, C.senzaChiamate(stessa, false) === stessa);

  gruppo("CHIAMATE · OGNI SCRITTORE DEL FISSATO AZZERA");
  const src = join(radice, "src");
  const tutti = [];
  const giro = (d) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      if (statSync(p).isDirectory()) {
        if (nome === "integrations" || nome === "node_modules") continue;
        giro(p);
      } else if (/\.(ts|tsx)$/.test(nome) && !/\.gen\.ts$/.test(nome)) tutti.push(relative(radice, p));
    }
  };
  giro(src);
  //  Scrive lo stato verso l'appuntamento: «stato … "appuntamento_(ri)fissato"» o `update("stato", …)`.
  const SCRIVE = /\bstato\b[^\n]*"appuntamento_(?:ri)?fissato"|"stato",\s*"appuntamento_(?:ri)?fissato"/;
  const scrittori = tutti.filter((f) =>
    senzaCommenti(readFileSync(join(radice, f), "utf8"))
      .split("\n")
      .some((riga) => SCRIVE.test(riga) && !/===|!==|\.includes\(/.test(riga)),
  );
  //  1) Scrivono la scheda da sé: DEVONO chiamare `patchAzzeraChiamate`.
  const DIRETTI = ["src/crm/CRMContext.tsx", "src/crm/manychat/prenota-scheda.ts", "src/routes/api.consulente.azione.ts"];
  //  2) Salvano passando da `updateLead` (che azzera): non devono scrivere in archivio per conto loro.
  const DA_UPDATELEAD = ["src/crm/LeadDialog.tsx", "src/crm/QuickStatusDialog.tsx", "src/crm/agenda/AgendaDaySheet.tsx"];
  //  3) Costruiscono solo un valore (campo del modulo, precompilazione) o lo leggono: non salvano.
  const SOLO_VALORI = ["src/crm/doppione-orario.ts", "src/routes/CRM.agenda.tsx", "src/crm/importa/ricarico.ts", "src/crm/SchedaCliente.tsx"];
  //  4) Creano una scheda NUOVA (nessun conto da azzerare).
  const SCHEDA_NUOVA = ["src/routes/CRM.nuovi-contatti.tsx"];
  const conosciuti = [...DIRETTI, ...DA_UPDATELEAD, ...SOLO_VALORI, ...SCHEDA_NUOVA];
  c("ogni elenco punta a file che esistono", [], conosciuti.filter((f) => !existsSync(join(radice, f))));
  c(
    "nessun file scrive il fissato senza essere classificato (un file nuovo va messo in uno dei quattro elenchi)",
    [],
    scrittori.filter((f) => !conosciuti.includes(f)),
  );
  const chiamano = (f) => /\bpatchAzzeraChiamate\(/.test(senzaCommenti(leggi(f)));
  c("i tre che scrivono la scheda da sé chiamano patchAzzeraChiamate", [], DIRETTI.filter((f) => !chiamano(f)));
  const conChiFissa = tutti.filter(
    (f) => f !== "src/crm/chi-ha-fissato.ts" && /\bpatchChiFissa\(/.test(senzaCommenti(readFileSync(join(radice, f), "utf8"))),
  );
  c("ogni file che chiama patchChiFissa chiama anche patchAzzeraChiamate", [], conChiFissa.filter((f) => !chiamano(f)));
  const scriveInArchivio = (f) => /from\("crm_leads"\)[\s\S]{0,200}\.(update|upsert)\(/.test(senzaCommenti(leggi(f)));
  c(
    "chi passa da updateLead lo chiama davvero e non scrive in archivio per conto suo",
    [],
    DA_UPDATELEAD.filter((f) => !/\bupdateLead\(/.test(senzaCommenti(leggi(f))) || scriveInArchivio(f)),
  );
  c(
    "chi costruisce solo valori non salva (niente updateLead, createLead, archivio)",
    [],
    SOLO_VALORI.filter((f) => /\b(updateLead|createLead)\(/.test(senzaCommenti(leggi(f))) || scriveInArchivio(f)),
  );
  c(
    "nuovi-contatti crea schede nuove (createLead) e non aggiorna quelle esistenti",
    [true, false],
    [/\bcreateLead\(/.test(leggi(SCHEDA_NUOVA[0])), /\bupdateLead\(/.test(senzaCommenti(leggi(SCHEDA_NUOVA[0])))],
  );

  gruppo("CHIAMATE · COME SONO COLLEGATI");
  const ctx = senzaCommenti(leggi("src/crm/CRMContext.tsx"));
  c(
    "updateLead: l'azzeramento sta accanto a patchChiFissa, sullo stato finale, e non scatta con «annulla»",
    true,
    /\.\.\.patchChiFissa\(\{[\s\S]*?\}\),\s*\};\s*if \(!opzioni\.annulla\) merged = \{ \.\.\.merged, \.\.\.patchAzzeraChiamate\(current\.data, merged\) \};/.test(ctx),
  );
  c(
    "updateLead: `chiamate` della modifica passa solo con registraChiamata o annulla",
    true,
    /senzaChiamate\(\s*patch,\s*opzioni\.registraChiamata === true \|\| opzioni\.annulla === true,?\s*\)/.test(ctx),
  );
  c("l'opzione registraChiamata esiste", true, /registraChiamata\?: boolean/.test(ctx));
  const ui = senzaCommenti(leggi("src/crm/ContaChiamate.tsx"));
  c("il tocco sulla cornetta dichiara registraChiamata", true, /patchChiamata\(d\),\s*\{ registraChiamata: true \}/.test(ui));
  c("il tondino dice anche «in tutto» nel title", true, /titoloChiamate\(lead\?\.data\)/.test(ui));
  const pren = senzaCommenti(leggi("src/crm/manychat/prenota-scheda.ts"));
  c("prenota-scheda: l'azzeramento viene dopo patchChiFissa e `chiamate` si disfa con il resto", true, /patchChiFissa\([\s\S]*?patchAzzeraChiamate\(prima, nuova/.test(pren) && /"chiamate"/.test(pren));
  const az = senzaCommenti(leggi("src/routes/api.consulente.azione.ts"));
  c("rotta del consulente: azzera sul risultato finale, dopo conStatoDal", true, /conStatoDal\(attuale, aggiornato[\s\S]*?patchAzzeraChiamate\(attuale, aggiornato/.test(az));
  const undoChat = senzaCommenti(leggi("src/crm/chatwa/useChatWa.ts"));
  const undoImporta = senzaCommenti(leggi("src/routes/CRM.importa.tsx"));
  c("«Annulla» della chat e della coda rimettono anche il conto di prima", [true, true], [/chiamate: lead\.data\.chiamate/.test(undoChat), /chiamate: l\.data\.chiamate/.test(undoImporta)]);
}
