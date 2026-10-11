/** ── RIAPRIRE UN PREVENTIVO COM'ERA ────────────────────────────────────────
 *
 *  Segnalazione del committente: «se clicco modifica preventivo da dentro il
 *  preventivo, mi deve rimettere tutto settato come era prima, e non che
 *  riparte da capo».
 *
 *  COSA SUCCEDEVA. Sbloccando la modifica si rimettevano soltanto i DATI DELLA
 *  PERSONA (nome, telefono, età, colore) e la quantità. La configurazione no:
 *  il configuratore ripartiva dalla combinazione di partenza, cioè dalla
 *  soluzione base di serie e dalle spunte di serie. Chi aveva davanti un
 *  preventivo da 2.400 € con otto personalizzazioni doveva ricostruirlo a
 *  memoria, voce per voce, con il cliente che guardava — e bastava dimenticarne
 *  una perché il preventivo nuovo costasse meno del vecchio senza che nessuno
 *  se ne accorgesse.
 *
 *  ── COME SI TORNA INDIETRO ────────────────────────────────────────────────
 *  Il preventivo salvato non contiene gli id delle voci: contiene i NOMI, così
 *  come il cliente li ha letti e come arrivano in produzione. Qui si fa il
 *  cammino inverso, e si fa con la funzione che c'è già — `voceDiListino` —
 *  che sa anche accorciare un nome per ritrovare la voce quando porta in coda
 *  la sotto-scelta («Mosso — onda media» → «Mosso»). Riscrivere qui una
 *  seconda regola di riconoscimento vorrebbe dire due idee diverse di quale
 *  voce sia «la stessa».
 *
 *  ⚠️ QUELLO CHE NON SI PUÒ RIMETTERE SI DICE, NON SI INDOVINA. Una voce che
 *   nel listino di oggi non esiste più finisce in `perse`: chi riapre deve
 *   sapere che quella riga non è tornata, invece di scoprirlo dal totale.
 *  ⚠️ DOVE si fa l'installazione adesso torna anche lui. Non si salvava da
 *   nessuna parte — la riga diceva soltanto che l'installazione c'è — e chi
 *   l'aveva scelta a casa propria se la ritrovava «nel nostro centro» a ogni
 *   riapertura, con le spese di viaggio che quella scelta comporta. Il posto
 *   viaggia dentro la voce (`dove`), che è la sua casa naturale: è una
 *   proprietà dell'installazione, non del preventivo.
 *   ⚠️ I preventivi emessi PRIMA non ce l'hanno, e per loro vale «nel nostro
 *    centro»: è esattamente come si sono sempre comportati, e indovinare
 *    diversamente vorrebbe dire cambiare un documento già in mano a qualcuno.
 *  ───────────────────────────────────────────────────────────────────────── */
import { voceDiListino, type QuoteMenu } from "./quote-menu";
//  Le scelte fotografate insieme al preventivo: gli ID, che non cambiano mai.
//  Vedi shop/condizioni-preventivo.
import type { ScelteFatte } from "./condizioni-preventivo";

/** Il minimo che serve sapere di un preventivo per ricostruirlo. È un pezzo di
 *  `Snapshot` (routes/preventivo), dichiarato qui in forma ridotta perché
 *  questo file non deve conoscere la pagina. */
export interface PreventivoDaRiaprire {
  /** L'id della soluzione base, quando c'è: è il legame certo. Le righe salvate
   *  prima che lo si scrivesse hanno solo il nome. */
  baseId?: string;
  baseName?: string;
  items?: { name: string; dove?: "studio" | "home" }[];
}

export interface ConfigurazioneRiaperta {
  baseId: string;
  selected: string[];
  varianti: Record<string, string>;
  simOn: boolean;
  installOn: boolean;
  installLoc: "studio" | "home";
  /** Le voci del preventivo che nel listino di oggi non esistono più. */
  perse: string[];
}

const chiave = (t?: string | null): string =>
  String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** La coda del nome salvato, cioè la sotto-scelta: da «Mosso — onda media» con
 *  la voce «Mosso» resta «onda media». Stringa vuota quando non ce n'è. */
function codaDellaVariante(salvato: string, nomeVoce: string): string {
  const s = String(salvato ?? "");
  const n = String(nomeVoce ?? "");
  if (chiave(s) === chiave(n)) return "";
  //  ⚠️ Si taglia sul nome della VOCE, non al primo trattino: parecchie voci il
  //   trattino ce l'hanno nel nome vero («Innesto rinforzato — la più
  //   duratura»), e tagliare lì restituirebbe «la più duratura» come se fosse
  //   una sotto-scelta.
  //  ⚠️ E si lavora sulla forma NORMALIZZATA di tutti e due: il separatore ha
  //   gli spazi intorno, e un `chiave(" — ")` li toglierebbe — il confronto
  //   allora non combacia mai e la sotto-scelta si perde in silenzio.
  const avvio = `${chiave(n)} — `;
  const k = chiave(s);
  return k.startsWith(avvio) ? k.slice(avvio.length).trim() : "";
}

/** Le sotto-scelte di una voce, se ne ha. */
function variantiDi(menu: QuoteMenu, id: string) {
  for (const s of menu.sections) {
    const i = s.items.find((x) => x.id === id);
    if (i) return i.variants;
  }
  return undefined;
}

/** Tutte le voci del listino di oggi, in un elenco solo. */
function vociDelMenu(menu: QuoteMenu) {
  return [
    ...menu.sections.flatMap((s) => s.items),
    ...(menu.installation ? [menu.installation] : []),
    ...(menu.simulation ? [menu.simulation] : []),
  ] as { id: string; name: string }[];
}

/** ── RIAPRIRE DAGLI ID, QUANDO CI SONO ────────────────────────────────────
 *
 *  Richiesta del committente: «se faccio modifica preventivo, riseleziona
 *  tutte le opzioni che avevo selezionato nel preventivo».
 *
 *  Il cammino dai NOMI (sotto) è l'unico possibile sui preventivi vecchi, ma
 *  ha un punto debole: basta una parola ritoccata nel listino perché la voce
 *  non si ritrovi più e torni indietro un preventivo più povero di com'era —
 *  e chi riapre se ne accorge dal totale, davanti al cliente. Dai preventivi
 *  nati da oggi le scelte viaggiano con il loro ID, che non cambia mai.
 *
 *  ⚠️ SI CONFRONTA CON IL LISTINO DI OGGI, non con quello di allora: «modifica
 *   preventivo» vuol dire proprio lavorare con le condizioni di adesso. Una
 *   voce che nel frattempo è stata tolta non torna, e si dice QUALE — è per
 *   questo che accanto all'id si è salvato anche il nome. */
function daGliId(scelte: ScelteFatte, menu: QuoteMenu): ConfigurazioneRiaperta {
  const tutte = vociDelMenu(menu);
  const esiste = (id: string) => tutte.some((v) => v.id === id);
  const base =
    menu.base.find((b) => b.id === scelte.baseId) ?? menu.base[0];
  const selected: string[] = [];
  const perse: string[] = [];
  let simOn = false;
  let installOn = false;
  for (const voce of scelte.voci) {
    if (!esiste(voce.id)) {
      perse.push(voce.nome || voce.id);
      continue;
    }
    if (menu.simulation && voce.id === menu.simulation.id) { simOn = true; continue; }
    if (menu.installation && voce.id === menu.installation.id) { installOn = true; continue; }
    if (!selected.includes(voce.id)) selected.push(voce.id);
  }
  //  Le due bandiere valgono anche senza una voce corrispondente nell'elenco:
  //  sono state salvate a parte, e l'elenco può non contenerle (un preventivo
  //  senza installazione non ha la sua riga).
  if (scelte.simOn && menu.simulation) simOn = true;
  if (scelte.installOn && menu.installation) installOn = true;
  //  Le sotto-scelte: solo quelle di voci ancora selezionate e ancora
  //  esistenti. Una scelta appesa a una voce che non c'è più non si rimette.
  const varianti: Record<string, string> = {};
  for (const [id, opzione] of Object.entries(scelte.varianti ?? {})) {
    if (!selected.includes(id)) continue;
    const voce = menu.sections.flatMap((s) => s.items).find((i) => i.id === id);
    if (voce?.variants?.options.some((o) => o.id === opzione)) varianti[id] = opzione;
  }
  return {
    baseId: base?.id ?? "",
    selected,
    varianti,
    simOn,
    installOn,
    installLoc: scelte.installLoc === "home" ? "home" : "studio",
    perse,
  };
}

export function configurazioneDa(
  preventivo: PreventivoDaRiaprire,
  menu: QuoteMenu,
  /** Le scelte fotografate quando il preventivo è nato. Quando ci sono
   *  comandano loro: sono esatte, i nomi sono un'approssimazione. */
  scelte?: ScelteFatte | null,
): ConfigurazioneRiaperta {
  if (scelte && (scelte.voci.length || scelte.baseId)) return daGliId(scelte, menu);
  //  Prima l'id (legame certo), poi il nome, e come ultimo ripiego la prima
  //  soluzione: una pagina senza soluzione base non si disegna affatto.
  const base =
    (preventivo.baseId ? menu.base.find((b) => b.id === preventivo.baseId) : undefined) ??
    menu.base.find((b) => chiave(b.name) === chiave(preventivo.baseName)) ??
    menu.base[0];

  const selected: string[] = [];
  const varianti: Record<string, string> = {};
  const perse: string[] = [];
  let simOn = false;
  let installOn = false;
  //  Il ripiego è il centro: è come si è sempre comportato, ed è quello che
  //  vale per tutti i preventivi emessi prima che il posto si salvasse.
  let installLoc: "studio" | "home" = "studio";

  for (const voce of preventivo.items ?? []) {
    const trovata = voceDiListino(voce.name, menu);
    if (!trovata) {
      perse.push(String(voce.name ?? ""));
      continue;
    }
    if (menu.simulation && trovata.id === menu.simulation.id) {
      simOn = true;
      continue;
    }
    if (menu.installation && trovata.id === menu.installation.id) {
      installOn = true;
      //  ⚠️ Solo i due valori buoni: in una colonna JSON può esserci finito
      //   qualunque cosa, e un posto inventato manderebbe la scheda su un
      //   pulsante che non esiste.
      if (voce.dove === "home" || voce.dove === "studio") installLoc = voce.dove;
      continue;
    }
    if (!selected.includes(trovata.id)) selected.push(trovata.id);
    const coda = codaDellaVariante(voce.name, trovata.name);
    if (!coda) continue;
    //  La sotto-scelta si ritrova dal suo NOME, che è l'unica cosa che il
    //  preventivo ne conserva. Se non combacia con nessuna opzione di oggi non
    //  si mette niente: la voce resta selezionata con la sua scelta di serie,
    //  che è meglio di una scelta inventata.
    const opzione = variantiDi(menu, trovata.id)?.options.find(
      (o) => chiave(o.name) === chiave(coda),
    );
    if (opzione) varianti[trovata.id] = opzione.id;
  }

  return {
    baseId: base?.id ?? "",
    selected,
    varianti,
    simOn,
    installOn,
    installLoc,
    perse,
  };
}
