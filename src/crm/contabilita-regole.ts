/** ── LE REGOLE DI DEDUCIBILITÀ, E IL TEMPO ─────────────────────────────────
 *
 *  «Questo costo lo posso scaricare?» non è una domanda con una risposta sola:
 *  è una domanda con una risposta PER OGNI PERIODO. Un compenso pagato senza
 *  documento a marzo non si scarica; da settembre lo stesso fornitore comincia
 *  a fatturare e quello stesso costo diventa deducibile. Le due cose sono vere
 *  tutte e due, ognuna nel suo mese.
 *
 *  ── ⚠️ IL DIFETTO CHE QUESTO FILE ESISTE PER IMPEDIRE ─────────────────────
 *  La prima versione teneva una spunta sola per voce: `{ installatore:
 *  { scaricabile: false } }`. Sembra ovvio e ha un guasto che non si vede.
 *  Cambiando quella spunta a settembre, il conto di MARZO cambiava insieme:
 *  l'utile imponibile del primo trimestre — un numero già letto, magari già
 *  girato al commercialista, magari già dichiarato — si riscriveva da solo.
 *  Nessun errore, nessun avviso: la stessa pagina, riaperta, diceva un'altra
 *  cosa. In contabilità è il difetto peggiore che ci sia, perché fa perdere
 *  fiducia a TUTTI i numeri, non solo a quello sbagliato.
 *
 *  ── COME FUNZIONA ─────────────────────────────────────────────────────────
 *  Una voce non ha una regola: ha una STORIA di regole, ognuna con il mese da
 *  cui vale.
 *
 *      installatore: [
 *        { da: "0000-00", scaricabile: true,  ivaDetraibile: false },
 *        { da: "2026-09", scaricabile: false, ivaDetraibile: false },
 *      ]
 *
 *  Per sapere com'era trattato un costo del 12 marzo 2026 si cerca l'ULTIMA
 *  riga con `da` ≤ "2026-03": è la prima, quindi a marzo era deducibile. Per un
 *  costo di ottobre vince la seconda. Cambiare la regola oggi AGGIUNGE una
 *  riga: non ne modifica nessuna, e il passato resta quello che era.
 *
 *  ── ⚠️ PERCHÉ IL MESE E NON IL GIORNO ────────────────────────────────────
 *  Perché l'IVA si liquida per periodo e le imposte per esercizio: una regola
 *  che cambia il 17 spaccherebbe un mese in due metà trattate diversamente, e
 *  quella è una cosa che il commercialista deve poter spiegare. Al mese si
 *  spiega in una riga: «da settembre in poi, no».
 *
 *  ── ⚠️ IL MESE DA CUI VALE LO SCEGLIE CHI CAMBIA ─────────────────────────
 *  Il valore proposto è il mese corrente — è quello che si intende dicendo «da
 *  adesso» — ma si può spostare indietro, perché a volte ci si accorge in
 *  ottobre di una cosa vera da luglio. Spostarlo indietro RISCRIVE quei mesi,
 *  ed è una cosa che si deve poter fare di proposito e mai per sbaglio: chi lo
 *  fa deve vedere scritto quali mesi sta cambiando (vedi `mesiToccatiDa`).
 *
 *  ── ⚠️ IL RIPIEGO È «SCARICABILE, IVA NON DETRATTA» ──────────────────────
 *  Una voce di cui nessuno ha mai detto niente si considera deducibile — è il
 *  caso normale, e chiederlo per ogni voce prima di mostrare un numero
 *  renderebbe la pagina inservibile — ma la sua IVA NON si detrae, perché
 *  detrarre l'IVA di un costo senza una fattura valida abbassa l'IVA da versare
 *  ed è l'errore che costa. Gli errori, dove il programma non sa, vanno tutti
 *  dalla parte prudente.
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── IL MOMENTO DA CUI VALE UNA REGOLA ────────────────────────────────────
 *  «2026-09» (dal primo di settembre) oppure «2026-09-17» (da quel giorno).
 *
 *  ⚠️ LE DUE PRECISIONI CONVIVONO SENZA UN CAMPO IN PIÙ, e non è un trucco: le
 *   date ISO hanno lunghezza fissa e zeri davanti, quindi l'ordine alfabetico È
 *   l'ordine cronologico, e «2026-09» viene prima di «2026-09-01» come deve —
 *   una regola scritta sul mese vale dal primo giorno di quel mese. È il motivo
 *   per cui il formato è questo e non «settembre 2026» o «9/2026».
 *
 *  ⚠️ MA IL CONFRONTO VA FATTO SUL GIORNO DEL COSTO, non sul suo mese. Finché
 *   le regole erano solo mensili si poteva troncare il costo al mese e
 *   confrontare mese con mese. Con una regola al giorno quel troncamento
 *   sbaglia in silenzio: un costo del 20 settembre, ridotto a «2026-09»,
 *   risulterebbe PRIMA di una regola che parte il 17 — cioè la regola non
 *   scatterebbe mai per il mese in cui è stata scritta. Vedi `momentoDelCosto`. */
export type Momento = string;
/** Il vecchio nome, per chi lo importa ancora: è lo stesso tipo. */
export type Mese = Momento;

/** Il momento più remoto possibile: la riga che vale «da sempre». */
export const DA_SEMPRE: Momento = "0000-00";

export interface RegolaNelTempo {
  /** Il momento da cui questa regola vale, compreso. */
  da: Momento;
  /** ── LA FINE, QUANDO C'È ────────────────────────────────────────────────
   *  Assente = «da lì in poi», ed è il caso normale: una decisione presa vale
   *  finché non se ne prende un'altra.
   *  Presente = un INTERVALLO chiuso, compreso: «da marzo a giugno non si
   *  scaricava». Serve per i periodi che si sa già essere finiti — un
   *  fornitore che per tre mesi non ha fatturato, un contratto sospeso — e
   *  senza si dovevano scrivere DUE regole, quella che apre e quella che
   *  richiude, con il rischio di scordare la seconda e trattare male tutti i
   *  mesi successivi senza accorgersene.
   *
   *  ⚠️ SI CONSERVA SEMPRE COME GIORNO, anche quando l'utente sceglie un mese:
   *   in quel caso è l'ULTIMO giorno del mese. Tenendolo come «2026-06» il
   *   confronto `«2026-06-15» <= «2026-06»` sarebbe falso, e la regola
   *   smetterebbe di valere il 1º giugno invece che il 30 — quattro settimane
   *   trattate male da un confronto fra stringhe. */
  a?: Momento;
  /** false = non abbassa l'utile imponibile. Si sottrae alla fine, per intero. */
  scaricabile: boolean;
  /** true = su questo costo c'è IVA che si può portare in detrazione. */
  ivaDetraibile: boolean;
  /** Perché è stata cambiata. Facoltativa, e serve al commercialista più che a
   *  noi: «da settembre fattura regolarmente» è la riga che risparmia una
   *  telefonata. */
  nota?: string;
  /** ── IL TITOLO COM'È SCRITTO ────────────────────────────────────────────
   *  La chiave di una voce è normalizzata («installatore»), e va bene per
   *  confrontare. Ma per MOSTRARE serve com'era scritta davvero — e serve
   *  soprattutto per le voci che in questo periodo non hanno costi: di quelle
   *  la chiave è l'unica cosa che resta, e un elenco di parole tutte minuscole
   *  senza accenti sembra un elenco di codici. */
  titolo?: string;
}

/** La storia di una voce, dalla più vecchia alla più recente. */
export type StoriaVoce = RegolaNelTempo[];
export type RegoleContabili = Record<string, StoriaVoce>;

export const REGOLA_DI_PARTENZA: Omit<RegolaNelTempo, "da"> = {
  scaricabile: true,
  ivaDetraibile: false,
};

/** ── LA CHIAVE DI UNA VOCE ────────────────────────────────────────────────
 *  I titoli li scrive una persona: «Installatore», «installatore » e
 *  «INSTALLATORE» sono la stessa voce per chiunque tranne che per un confronto
 *  fra stringhe. Gli accenti se ne vanno per lo stesso motivo — «contabilità» e
 *  «contabilita» non sono due costi diversi. */
export const chiaveVoce = (titolo: string): string =>
  String(titolo ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

/** Il mese di una data ISO. Serve dove il mese è davvero l'unità giusta —
 *  contare i mesi già chiusi che una regola riscriverebbe. */
export const meseDi = (iso?: string | null): Momento => {
  const s = String(iso ?? "");
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : DA_SEMPRE;
};

/** ── IL MOMENTO DI UN COSTO, ED È QUESTO CHE SI CONFRONTA ─────────────────
 *  ⚠️ NON SI CHIAMA `giornoDi`, e non è pignoleria: in `crm/kpi-calcoli` esiste
 *   già una `giornoDi` che fa quasi la stessa cosa con un ripiego DIVERSO —
 *   una data illeggibile là torna stringa vuota, qui torna `DA_SEMPRE`. Due
 *   funzioni omonime a un import di distanza, in un punto dove il ripiego
 *   decide se un costo è deducibile, è il genere di scambio che il
 *   completamento automatico fa da solo e che nessuno rilegge.
 *  ⚠️ Una data illeggibile NON diventa «oggi»: diventa `DA_SEMPRE`, cioè cade
 *   sulla regola più vecchia. Farla cadere su oggi vorrebbe dire applicare a un
 *   costo di data ignota la regola di adesso — e la regola di adesso è proprio
 *   quella che qualcuno ha appena cambiato. */
export const momentoDelCosto = (iso?: string | null): Momento => {
  const s = String(iso ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : meseDi(s);
};

export const meseCorrente = (): Mese => new Date().toISOString().slice(0, 7);

/** ── LA REGOLA CHE VALEVA IN QUEL MESE ────────────────────────────────────
 *  Il cuore del file: l'ultima riga scritta per un mese minore o uguale a
 *  quello chiesto. Niente riga = il ripiego prudente.
 *  ⚠️ Si ORDINA prima di scegliere, e non si dà per scontato che l'elenco
 *   arrivi ordinato: è un dato che sta in archivio come testo, e una scrittura
 *   fatta a mano o una versione futura potrebbero metterlo in disordine. Un
 *   confronto fra stringhe «2026-09» ≤ «2026-10» funziona perché il formato è
 *   a lunghezza fissa e con lo zero davanti: è il motivo per cui è quello. */
/** Vale questa regola in quel momento? Comincia prima o allora, e — se ha una
 *  fine — non è ancora finita. */
const copre = (r: RegolaNelTempo, m: Momento): boolean =>
  !!r && typeof r === "object" && typeof r.da === "string" && r.da <= m && (!r.a || m <= r.a);

export function regolaNelMese(storia: StoriaVoce | undefined, mese: Momento): RegolaNelTempo {
  if (!Array.isArray(storia) || storia.length === 0)
    return { da: DA_SEMPRE, ...REGOLA_DI_PARTENZA };
  /*  ── ⚠️ FRA QUELLE CHE COPRONO QUEL MOMENTO, VINCE LA PIÙ RECENTE ───────
      Con gli intervalli le regole possono sovrapporsi, e serve un criterio per
      decidere. È questo: fra tutte quelle che coprono il momento, comanda
      quella che comincia più tardi — cioè la decisione presa per ultima su
      quel periodo.
      È anche ciò che fa funzionare da solo il caso «da marzo a giugno no, poi
      come prima»: ad aprile la regola aperta e quella chiusa coprono tutte e
      due, e vince la chiusa perché comincia dopo; a luglio la chiusa non copre
      più, e resta l'aperta. Senza intervalli servivano due regole, e
      bisognava ricordarsi di scrivere anche la seconda. */
  const valide = storia.filter((r) => copre(r, mese)).sort((a, b) => a.da.localeCompare(b.da));
  const ultima = valide[valide.length - 1];
  return ultima ?? { da: DA_SEMPRE, ...REGOLA_DI_PARTENZA };
}

/** ── ⚠️ C'È UNA REGOLA SCRITTA, O STIAMO RIPIEGANDO? ──────────────────────
 *  Serve a distinguere due cose che `regolaNelMese` restituisce uguali: «il
 *  titolare ha detto che questa voce si scarica» e «nessuno ha detto niente,
 *  quindi si ripiega». Sono diverse, perché il ripiego può dipendere da cosa
 *  si sta guardando — un costo con una fattura in mano non è un costo di cui
 *  non si sa niente. */
export function esisteRegola(storia: StoriaVoce | undefined, mese: Momento): boolean {
  return Array.isArray(storia) && storia.some((r) => copre(r, mese));
}

/** Comodità: la regola per un costo, dato il suo titolo e la sua data. */
export function regolaDi(
  titolo: string,
  dataDelCosto: string | null | undefined,
  regole: RegoleContabili,
): RegolaNelTempo {
  //  ⚠️ `momentoDelCosto` e non `meseDi`: vedi la nota su `Momento`. Troncare
  //   il costo al mese farebbe non scattare mai una regola scritta a metà mese.
  return regolaNelMese(regole[chiaveVoce(titolo)], momentoDelCosto(dataDelCosto));
}

/** La regola in vigore oggi: è quella che l'interfaccia mostra come stato
 *  corrente della spunta. */
export const regolaOggi = (titolo: string, regole: RegoleContabili): RegolaNelTempo =>
  //  Oggi per intero: una regola che parte fra tre giorni non deve risultare
  //  già in vigore nella pastiglia che dice «come è trattata adesso».
  regolaNelMese(regole[chiaveVoce(titolo)], new Date().toISOString().slice(0, 10));

/** ── CAMBIARE UNA REGOLA ──────────────────────────────────────────────────
 *  Torna le regole NUOVE, senza toccare quelle vecchie: questa funzione non
 *  modifica niente, costruisce.
 *
 *  ⚠️ SE ESISTE GIÀ UNA RIGA PER QUEL MESE, quella si sostituisce invece di
 *   affiancarne una seconda. Due righe con lo stesso `da` sono un'ambiguità che
 *   si risolverebbe per ordinamento, cioè per caso: chi cambia idea due volte
 *   nello stesso mese deve ottenere una storia con una riga per mese, non due
 *   che si contraddicono.
 *
 *  ⚠️ E SE LA NUOVA REGOLA DICE LA STESSA COSA DI QUELLA GIÀ IN VIGORE, non si
 *   scrive niente. Una riga che non cambia nulla sporca la storia e fa credere
 *   a chi la legge che in quel mese sia successo qualcosa. */
export function conRegola(
  regole: RegoleContabili,
  titolo: string,
  nuova: RegolaNelTempo,
): RegoleContabili {
  const k = chiaveVoce(titolo);
  const storia = Array.isArray(regole[k]) ? regole[k] : [];
  /*  ── ⚠️ SI CONFRONTA SOLO CON UNA REGOLA DAVVERO SCRITTA ────────────────
      Qui c'era un difetto trovato provandolo, e valeva una funzione intera.
      Il confronto era con `regolaNelMese`, che quando non c'è niente scritto
      restituisce il RIPIEGO. Risultato: chiedere «su questo fornitore l'IVA
      non si detrae» — che è identico al ripiego generico — non scriveva
      niente. La spunta tornava indietro da sola e sembrava che il salvataggio
      non funzionasse.
      È diventato grave da quando le fatture caricate hanno un ripiego loro
      (l'IVA si detrae, perché il documento c'è): spegnerla su un fornitore
      preciso — l'auto, la rappresentanza — era proprio la cosa che non si
      riusciva più a fare, cioè l'unico caso in cui quella spunta serve.
      Adesso si tace solo quando esiste una regola SCRITTA che dice già la
      stessa cosa: allora sì che riscriverla non aggiunge niente. */
  const uguale =
    esisteRegola(storia, nuova.da) &&
    (() => {
      const inVigore = regolaNelMese(storia, nuova.da);
      return (
        inVigore.scaricabile === nuova.scaricabile && inVigore.ivaDetraibile === nuova.ivaDetraibile
      );
    })();
  if (uguale && !storia.some((r) => r.da === nuova.da)) return regole;
  //  Una riga che comincia lo STESSO momento si sostituisce: due regole con lo
  //  stesso `da` si risolverebbero per ordinamento, cioè per caso.
  const senzaQuelMese = storia.filter((r) => r.da !== nuova.da);
  //  Il titolo com'è scritto viaggia con la regola: vedi `titolo` sul tipo.
  const conTitolo = { ...nuova, titolo: nuova.titolo ?? titolo.trim() };
  return {
    ...regole,
    [k]: [...senzaQuelMese, conTitolo].sort((a, b) => a.da.localeCompare(b.da)),
  };
}

/** Toglie una riga dalla storia: serve a disfare un cambio scritto per sbaglio.
 *  ⚠️ Non si può togliere l'unica riga rimasta se non è `DA_SEMPRE`: la voce
 *   tornerebbe al ripiego, che è un'altra cosa ancora, e chi guarda vedrebbe la
 *   spunta muoversi da sola. */
export function senzaRegola(regole: RegoleContabili, titolo: string, da: Mese): RegoleContabili {
  const k = chiaveVoce(titolo);
  const storia = Array.isArray(regole[k]) ? regole[k] : [];
  const rimaste = storia.filter((r) => r.da !== da);
  if (rimaste.length === 0) {
    const { [k]: _via, ...altre } = regole;
    return altre;
  }
  return { ...regole, [k]: rimaste };
}

/** ── QUALI MESI STO CAMBIANDO ─────────────────────────────────────────────
 *  Scrivere una regola con una data nel passato riscrive i conti di quei mesi.
 *  È una cosa legittima — a ottobre ci si accorge di una cosa vera da luglio —
 *  ma deve essere una cosa fatta di proposito, e chi la fa deve vedere scritto
 *  che cosa sta toccando. Questa funzione dice quanti mesi, e quali.
 *
 *  ⚠️ Conta i mesi CHIUSI, cioè fino al mese scorso: il mese in corso non è un
 *   conto già letto da nessuno, e includerlo farebbe suonare l'allarme anche
 *   per il cambio normale — quello che parte da adesso. */
export function mesiToccatiDa(da: Momento): Momento[] {
  const oggi = meseCorrente();
  //  Del momento si guarda il MESE: un giorno a metà mese tocca comunque il
  //  mese in cui cade, e quello che interessa a chi legge è quanti mesi già
  //  chiusi cambiano — non quanti giorni.
  const daMese = meseDi(da);
  if (daMese >= oggi || da === DA_SEMPRE) return [];
  const fuori: Momento[] = [];
  const [a0, m0] = daMese.split("-").map(Number);
  let a = a0;
  let m = m0;
  //  ⚠️ Un tetto c'è, e non è pigrizia: una data assurda («1970-01») produrrebbe
  //   seicento mesi e una schermata piena di date. Sopra i ventiquattro si dice
  //   il numero e basta — chi sta riscrivendo due anni di contabilità non ha
  //   bisogno dell'elenco, ha bisogno di fermarsi.
  while (fuori.length < 240) {
    const mese = `${a}-${String(m).padStart(2, "0")}`;
    if (mese >= oggi) break;
    fuori.push(mese);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return fuori;
}

/** Il momento scritto come lo direbbe una persona: «settembre 2026» per una
 *  regola mensile, «17 settembre 2026» per una al giorno.
 *  ⚠️ La differenza si SCRIVE, non si lascia dedurre: chi legge «settembre
 *   2026» accanto a due costi trattati diversamente nello stesso mese pensa a
 *   un errore, finché non vede che l'altra regola parte dal 17. */
export function meseLeggibile(mese: Momento): string {
  if (mese === DA_SEMPRE) return "da sempre";
  const alGiorno = /^\d{4}-\d{2}-\d{2}$/.test(mese);
  const d = new Date(`${alGiorno ? mese : `${mese}-01`}T12:00:00`);
  if (Number.isNaN(d.getTime())) return mese;
  return d.toLocaleDateString(
    "it-IT",
    alGiorno
      ? { day: "numeric", month: "long", year: "numeric" }
      : { month: "long", year: "numeric" },
  );
}

/** ── TUTTE LE VOCI CHE HANNO UNA REGOLA SCRITTA ───────────────────────────
 *  Serve a una schermata che le mostri TUTTE, anche quelle che nel periodo
 *  guardato non hanno nessun costo: senza, una regola scritta a marzo per una
 *  voce che a novembre non compare diventa invisibile — c'è, decide, e nessuno
 *  la trova più per cambiarla.
 *  Il titolo è quello scritto l'ultima volta; se manca — regole salvate prima
 *  che il titolo si conservasse — resta la chiave, che è comunque leggibile. */
export function vociConRegola(regole: RegoleContabili): { chiave: string; titolo: string }[] {
  return Object.entries(regole)
    .map(([chiave, storia]) => {
      const ultima = [...(Array.isArray(storia) ? storia : [])]
        .sort((a, b) => a.da.localeCompare(b.da))
        .reverse()
        .find((r) => r?.titolo);
      return { chiave, titolo: ultima?.titolo || chiave };
    })
    .sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
}

/** L'ultimo giorno del mese di un momento: serve a chiudere un intervallo
 *  scelto al mese. Vedi il perché su `a` in RegolaNelTempo. */
export function fineDelMese(momento: Momento): Momento {
  const m = meseDi(momento);
  if (m === DA_SEMPRE) return m;
  const [a, mm] = m.split("-").map(Number);
  //  `new Date(a, mm, 0)` è il giorno zero del mese dopo, cioè l'ultimo di
  //  questo: bisestili compresi, senza tabelle.
  const ultimo = new Date(a, mm, 0).getDate();
  return `${m}-${String(ultimo).padStart(2, "0")}`;
}

/** Come si legge un periodo di validità: «da settembre 2026», «dal 17 settembre
 *  2026 al 30 giugno 2027», «da sempre». */
export function periodoLeggibile(r: RegolaNelTempo): string {
  const da = r.da === DA_SEMPRE ? "da sempre" : `da ${meseLeggibile(r.da)}`;
  return r.a ? `${da} al ${meseLeggibile(r.a)}` : da;
}
