/** ── I PREVENTIVI QUANDO SONO IN PIÙ DI UNO ────────────────────────────────
 *
 *  Richiesta del committente, per esteso: «posso compilare, quando entrano in
 *  3 o 4, preventivi: uno in comune che vedono tutti, ma solo visuale per
 *  loro, e quando lo attivo lo attiva a tutti; poi posso decidere se a qualche
 *  utente far mostrare il loro preventivo singolo individuale, e lui vede solo
 *  il suo preventivo reale in quel momento; loro possono compilare il loro
 *  preventivo da soli, e io posso andare a gestirlo in tempo reale cliccando
 *  sul nome dell'utente, e ci deve essere un pulsante per editarlo anche io
 *  con loro, che mi mostra cosa stanno facendo». E poi: «il preventivo comune:
 *  nascosto, lo accendi tu» e «quando prendi la penna, può riprendersela».
 *
 *  ── COME SI REGGE, IN UNA RIGA ───────────────────────────────────────────
 *  Ogni preventivo è una STANZA DI RISPECCHIAMENTO, e in ogni stanza c'è UNA
 *  PENNA. Chi ha la penna scrive lo stato; tutti gli altri lo rispecchiano. È
 *  lo stesso meccanismo con cui il consulente già mostra il preventivo al
 *  cliente (api.presenter.quotestate) — cambia solo che le stanze diventano
 *  tante e che la penna può stare da una parte o dall'altra.
 *
 *  Le stanze di una consulenza di gruppo:
 *   · quella COMUNE, che è la stanza della consulenza stessa (il codice nudo):
 *     la penna ce l'ha sempre il consulente, e i clienti guardano e basta;
 *   · una PER PERSONA, `<codice>--<gettone>`: la penna nasce in mano al
 *     cliente, perché quello è il suo preventivo.
 *
 *  ── ⚠️ LE TRAPPOLE ───────────────────────────────────────────────────────
 *  ⚠️ IL COMUNE NASCE SPENTO, e da spento i clienti NON devono rispecchiarlo:
 *   mentre il consulente lo prepara ci sono dentro prezzi, sconti e prove che
 *   non sono ancora una proposta. «Nascosto» non vuol dire «piccolo»: vuol
 *   dire che quella stanza, per loro, non esiste.
 *  ⚠️ LA PENNA SI RIPRENDE, SEMPRE. È la regola del committente, ed è anche
 *   la sola che rende la cosa onesta: il preventivo è suo, e un consulente che
 *   prende la penna e non la molla più è un modulo compilato da un altro. Chi
 *   la riprende non chiede permesso a nessuno — per questo la rotta è
 *   pubblica per il cliente, e limitata al SUO gettone.
 *  ⚠️ IL CONSULENTE NON PRENDE LA PENNA GUARDANDO. Aprire il preventivo di
 *   Anna e METTERCI MANO sono due cose diverse, e confonderle vuol dire
 *   scrivere sopra a quello che il cliente sta facendo in quel momento:
 *   `aperto` dice cosa sto guardando, `penne` dice chi scrive.
 *  ⚠️ UNA STANZA PER PERSONA, NON PER DISPOSITIVO: se il cliente ricarica la
 *   pagina o passa dal telefono al computer deve ritrovare il suo preventivo,
 *   e il gettone è l'unica cosa che lo segue (vedi `gettoneDi` in
 *   crm/fascia-consulenza).
 *  ───────────────────────────────────────────────────────────────────────── */

/** ── LA PENNA NON È PIÙ UN COMANDO ────────────────────────────────────────
 *  Richiesta del committente: «rivedi i pulsanti e rendili utili realmente,
 *  rimuovi quello che non serve come solo lui o solo io».
 *  Aveva ragione: il selettore a tre stati chiedeva di ragionare su una cosa
 *  che nella pratica ha una risposta sola — si compila insieme, parlandosi.
 *  La regola adesso sta in una frase: **chi lo vede lo può toccare**. Questo
 *  tipo resta perché le righe già in archivio lo portano dentro, e perché
 *  «comune» continua a voler dire «solo il consulente scrive»; ma dal
 *  pannello non si sceglie più niente.
 *  ── CHI HA LA PENNA IN UNA STANZA ─────────────────────────────────────────
 *  Tre modi, non due. Il terzo è arrivato per richiesta del committente —
 *  «fai che però posso modificare anche io il preventivo del cliente mentre
 *  lui lo edita» — ed è quello che si usa di più: si compila insieme,
 *  parlando, come si farebbe con un foglio in mezzo al tavolo.
 *   · "cliente"    → scrive lui, tu guardi (è il riposo: il preventivo è suo);
 *   · "consulente" → scrivi tu, lui guarda (serve quando vuoi fare in fretta
 *     senza che le sue mani ti cambino la pagina sotto);
 *   · "insieme"    → scrivete tutti e due, e ognuno vede comparire quello che
 *     fa l'altro.
 *  ⚠️ IN DUE SULLA STESSA PAGINA, L'ULTIMO CHE TOCCA VINCE. Non c'è nessuna
 *   fusione intelligente: lo stato è una fotografia intera della pagina, e chi
 *   scrive per ultimo la sovrascrive. Su scelte fatte parlandosi va benissimo
 *   — è come passarsi la penna — ma due dita sulla stessa voce nello stesso
 *   secondo danno un vincitore solo. È il motivo per cui "consulente" resta:
 *   quando conta la precisione, la penna si prende. */
export type Penna = "consulente" | "cliente" | "insieme";

/** La regia di una consulenza di gruppo. Una riga sola, in `app_config`. */
export interface RegiaGruppo {
  /** Il preventivo comune è acceso per tutti? Nasce spento. */
  comune: boolean;
  /** Gettone → chi ha la penna nella sua stanza. Assente = il cliente. */
  penne: Record<string, Penna>;
  /** ── CHI HA UN PREVENTIVO TUTTO SUO ──────────────────────────────────
   *  Richiesta del committente: «poi posso decidere se a qualche utente far
   *  mostrare il loro preventivo singolo individuale». Non è automatico:
   *  finché il consulente non lo apre, in una consulenza di gruppo esiste
   *  solo il comune. I gettoni delle persone a cui è stato aperto. */
  individuali: string[];
  /** Quale preventivo sta guardando il consulente: "" = il comune. */
  aperto: string;
  /** Ultimo cambiamento, per capire chi è più recente. */
  at: number;
}

export const BASE_REGIA = "regia_gruppo";

/** Quante stanze può avere una consulenza: il tetto degli attesi più il
 *  comune. Serve a non far crescere questa riga senza fine. */
export const MAX_STANZE = 12;

const testo = (v: unknown): string => String(v ?? "").trim();
/** I gettoni sono già corti e senza segni (vedi `gettoneDi`): qui si ripulisce
 *  lo stesso, perché questa stringa finisce in una chiave di archivio. */
const gettone = (v: unknown): string => testo(v).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);

export const REGIA_VUOTA: RegiaGruppo = { comune: false, penne: {}, individuali: [], aperto: "", at: 0 };

export function leggiRegia(grezzo?: string | null): RegiaGruppo {
  if (!grezzo) return { ...REGIA_VUOTA, penne: {}, individuali: [] };
  try {
    const v = JSON.parse(grezzo) as Partial<RegiaGruppo>;
    const penne: Record<string, Penna> = {};
    for (const [k, p] of Object.entries((v?.penne ?? {}) as Record<string, unknown>)) {
      const g = gettone(k);
      if (!g || Object.keys(penne).length >= MAX_STANZE) continue;
      //  ⚠️ Solo «consulente» e «insieme» si scrivono: qualunque altra cosa —
      //   un valore vecchio, un refuso — vale come «la penna è del cliente»,
      //   che è il riposo sicuro (il suo preventivo resta suo).
      if (p === "consulente" || p === "insieme") penne[g] = p;
    }
    const individuali: string[] = [];
    for (const x of Array.isArray(v?.individuali) ? v.individuali : []) {
      const g = gettone(x);
      if (g && !individuali.includes(g) && individuali.length < MAX_STANZE) individuali.push(g);
    }
    return {
      comune: v?.comune === true,
      penne,
      individuali,
      aperto: gettone(v?.aperto),
      at: Number(v?.at) || 0,
    };
  } catch {
    return { ...REGIA_VUOTA, penne: {}, individuali: [] };
  }
}

export const scriviRegia = (r: RegiaGruppo): string =>
  JSON.stringify({
    comune: !!r.comune, penne: r.penne ?? {}, individuali: r.individuali ?? [],
    aperto: gettone(r.aperto), at: Number(r.at) || 0,
  });

/** Apre (o richiude) il preventivo individuale di una persona.
 *  ⚠️ RICHIUDERLO NON LO CANCELLA: la stanza con dentro quello che ha
 *   compilato resta dov'è, e riaprendola si ritrova tutto. Toglierlo dalla
 *   vista non è buttare via il lavoro di qualcuno. */
export function conIndividuale(r: RegiaGruppo, chi: unknown, acceso: boolean, adesso = Date.now()): RegiaGruppo {
  const g = gettone(chi);
  if (!g) return r;
  const dentro = (r.individuali ?? []).filter((x) => x !== g);
  if (acceso && dentro.length >= MAX_STANZE) return r;
  return { ...r, individuali: acceso ? [...dentro, g] : dentro, at: adesso };
}

/** Questa persona ha un preventivo suo, aperto dal consulente? */
export const haIlSuo = (r: RegiaGruppo | null | undefined, chi: unknown): boolean =>
  (r?.individuali ?? []).includes(gettone(chi));

/** Chi ha la penna nella stanza di questa persona. Di norma il cliente: quel
 *  preventivo è il suo. */
export const pennaDi = (r: RegiaGruppo | null | undefined, chi: unknown): Penna => {
  const p = (r?.penne ?? {})[gettone(chi)];
  return p === "consulente" || p === "insieme" ? p : "cliente";
};

/** Passa la penna. Il cliente torna a essere il riposo: quando la penna torna
 *  a lui la voce si TOGLIE, invece di scrivere "cliente" — così la riga non
 *  cresce di una voce per ogni scambio. */
export function conLaPenna(r: RegiaGruppo, chi: unknown, a: Penna, adesso = Date.now()): RegiaGruppo {
  const g = gettone(chi);
  if (!g) return r;
  const penne = { ...(r.penne ?? {}) };
  if (a === "consulente" || a === "insieme") {
    if (!penne[g] && Object.keys(penne).length >= MAX_STANZE) return r;
    penne[g] = a;
  } else delete penne[g];
  return { ...r, penne, at: adesso };
}

/** Accende o spegne il preventivo comune per tutti. */
export const conComune = (r: RegiaGruppo, acceso: boolean, adesso = Date.now()): RegiaGruppo =>
  ({ ...r, comune: !!acceso, at: adesso });

/** Che cosa sta guardando il consulente. "" = il preventivo comune. */
export const conAperto = (r: RegiaGruppo, chi: unknown, adesso = Date.now()): RegiaGruppo =>
  ({ ...r, aperto: gettone(chi), at: adesso });

/** ── LA STANZA DI RISPECCHIAMENTO ──────────────────────────────────────────
 *  Il codice nudo è il preventivo comune — cioè esattamente quello che la
 *  consulenza faceva prima che i preventivi diventassero tanti, e per questo
 *  una consulenza con una persona sola non cambia di una virgola.
 *  ⚠️ Due trattini a separare: i codici delle stanze sono `xxx-xxxx-xxx`, e
 *   con un trattino solo `abc-def--p1` e `abc-def-p1` si confonderebbero. */
export function stanzaDelPreventivo(code: unknown, chi?: unknown): string {
  const c = testo(code).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const g = gettone(chi);
  return c && g ? `${c}--${g}` : c;
}

/** Il gettone di una stanza («abc--p1» → «p1»); "" per il comune. */
export function personaDellaStanza(stanza: unknown): string {
  const i = testo(stanza).indexOf("--");
  return i < 0 ? "" : gettone(testo(stanza).slice(i + 2));
}

/** ── CHI SCRIVE E CHI GUARDA ───────────────────────────────────────────────
 *  La domanda che ogni pagina si fa: «questo preventivo lo sto scrivendo io, o
 *  lo sto guardando?». Una sola risposta, in un posto solo, perché le due
 *  parti — quella del consulente e quella del cliente — non possono
 *  rispondersi in modo diverso: due penne nella stessa stanza vogliono dire
 *  due stati che si sovrascrivono a vicenda ogni mezzo secondo. */
export function hoLaPenna(p: {
  regia?: RegiaGruppo | null;
  /** Chi sono: il consulente, o il cliente di questo gettone. */
  io: "consulente" | "cliente";
  /** La stanza aperta su questo schermo: "" = il preventivo comune. */
  chi?: string;
}): boolean {
  const g = gettone(p.chi);
  //  Il comune è del consulente, sempre: per i clienti è «solo visuale».
  if (!g) return p.io === "consulente";
  /*  ⚠️ IL PREVENTIVO DI UNA PERSONA LO SCRIVONO TUTTI E DUE, SEMPRE.
      Prima dipendeva dalla penna; adesso la regola è «chi lo vede lo può
      toccare», e chi lo vede è deciso da due cose diverse — lui dal suo
      interruttore, tu dall'averlo aperto. Qui si risponde solo «hai il
      diritto di scriverci», e il diritto ce l'hanno entrambi: è il suo
      preventivo, e tu lo stai compilando con lui. */
  return true;
}

/** Si sta scrivendo in due in questa stanza? Chi lo chiede deve fare una cosa
 *  in più: continuare ad APPLICARE quello che arriva dall'altro pur restando
 *  una pagina viva. Con una penna sola non serve — chi non scrive è uno
 *  specchio e chi scrive non riceve niente. */
export const siScriveInDue = (r: RegiaGruppo | null | undefined, chi: unknown): boolean =>
  //  Si è in due quando il preventivo è acceso per LUI: da quel momento lo
  //  vede, e vederlo vuol dire poterlo toccare. Se è acceso solo da te —
  //  perché glielo stai preparando — dall'altra parte non c'è nessuno che
  //  scrive, e non c'è niente da conciliare.
  haIlSuo(r, chi);

/** ── CHE COSA VEDE QUESTO CLIENTE ──────────────────────────────────────────
 *  Richiesta del committente: «lui vede solo il suo preventivo reale in quel
 *  momento». Le tre risposte possibili, in un posto solo:
 *   · `"mio"`    → la stanza del suo preventivo;
 *   · `"comune"` → il preventivo comune, che il consulente ha acceso;
 *   · `"niente"` → non c'è ancora niente per lui, e non deve vedere la stanza
 *     comune spenta (ci sta dentro il lavoro in corso del consulente).
 *  ⚠️ IL SUO VIENE PRIMA DEL COMUNE: se il consulente gli ha aperto il suo
 *   preventivo, quello è il suo momento — il comune resta lì, ma non gli si
 *   cambia la pagina sotto le mani mentre lo compila. */
export function cosaVede(p: {
  regia?: RegiaGruppo | null;
  /** Il gettone di questo cliente ("" = arrivato da un link inoltrato). */
  io?: string;
  /** In questa consulenza è attesa più di una persona? */
  gruppo?: boolean;
}): "mio" | "comune" | "niente" {
  if (gettone(p.io) && haIlSuo(p.regia, p.io)) return "mio";
  /*  ── ⚠️ IL COMUNE NON SI ACCENDE PIÙ: È QUELLO CHE STAI MOSTRANDO ─────
      Decisione del committente: «quando clicco nuovo preventivo, quel
      preventivo non è di nessuno degli utenti, ma è di tutti; se attivo
      "segue me" loro vedranno quello che sto facendo io, anche il preventivo,
      e non possono cliccare nulla perché è solo a scopo dimostrativo».
      Quindi i due stati sono due mestieri diversi: «segue me» = mi guarda
      lavorare sul preventivo della consulenza, «il suo» = lavora lui sul
      proprio. Un interruttore in più per dire «adesso puoi guardare» non
      aveva più senso — e finché restava, chi seguiva vedeva un velo al posto
      del preventivo che il consulente stava spiegando. */
  return "comune";
}


/** ── CHI SONO, QUANDO NON C'È DUBBIO ──────────────────────────────────────
 *  Segnalazione del committente: con «lo vede lui» accesso il cliente veniva
 *  portato in giro lo stesso, e il pannello scriveva «acceso, ma lui non è
 *  dentro».
 *
 *  Misurato: la regola funziona, ma funziona su UN GETTONE. Il gettone lo
 *  riceve chi tocca il proprio nome alla porta — e ci sono tre strade per
 *  entrare senza toccarlo: il link inoltrato, il nome digitato a mano, e
 *  soprattutto la scheda aperta PRIMA che l'elenco degli attesi avesse
 *  risposto. Da quel momento quel cliente è «di nessuno»: il consulente
 *  accende il suo preventivo e non accade niente, perché la riga della regia
 *  parla di una persona che sul telefono del cliente non ha nome.
 *
 *  Quando la stanza aspetta UNA persona sola non c'è niente da indovinare: il
 *  cliente collegato è quello. È la stessa deduzione che la porta fa già da
 *  sé (`GuestJoinGate`), spostata dove serve anche a chi è già entrato.
 *  ⚠️ In DUE o più non si adotta niente: tirare a indovinare vorrebbe dire
 *   mettere una persona dentro il preventivo di un'altra. */
export function personaDaAdottare(
  mio: string | null | undefined,
  attesi: { gettone?: string }[] | null | undefined,
): string {
  if (gettone(mio)) return "";            // un nome ce l'ha già: non si tocca
  if (!attesi || attesi.length !== 1) return "";
  return gettone(attesi[0]?.gettone);
}

/** ── L'ELENCO È CAMBIATO? ─────────────────────────────────────────────────
 *  Serve al consulente per accorgersi che gli attesi sono arrivati (o sono
 *  cambiati) e ribattezzare le righe già in elenco.
 *  ⚠️ Non basta contarli: due persone diverse sono due, come prima. Il
 *   confronto sulla LUNGHEZZA lasciava il consulente con l'elenco della
 *   consulenza precedente per tutta la consulenza dopo. */
export const firmaDegliAttesi = (attesi: { gettone?: string }[] | null | undefined): string =>
  (attesi || []).map((a) => gettone(a?.gettone)).filter(Boolean).sort().join("|");

/** ── ⚠️ DOVE DEVE STARE QUESTO CLIENTE, DECISO DAL SERVER ──────────────────
 *  Terza segnalazione sulla stessa cosa: «se passo ai media, al cliente con il
 *  preventivo attivo passa ai media uguale».
 *
 *  Le prime due volte il rimedio stava sul telefono del cliente, e lì non
 *  poteva funzionare. Misurato sul canale della stanza vera, mentre il
 *  committente lo provava: il cliente collegato annunciava `persona: ""` ogni
 *  tre secondi — sul suo dispositivo non c'era nessun nome. Un interruttore
 *  acceso su «Daniele» non parlava di lui, e nessuna regola scritta di là
 *  avrebbe potuto cambiarlo: quel dispositivo può avere il codice di ieri,
 *  la memoria della scheda svuotata da un aggiornamento, o essere entrato da
 *  un link inoltrato.
 *
 *  La pagina che il cliente segue gliela DICE il server, una volta al secondo
 *  e mezzo (`api.presenter.curpage`). Ed è il server a sapere chi ha il
 *  preventivo acceso. Quindi la risposta cambia: a chi ha il suo preventivo
 *  acceso si risponde «il tuo preventivo», qualunque cosa stia guardando il
 *  consulente. Funziona anche con un cliente che non si è mai ricaricato.
 *
 *  ⚠️ Con UNA persona attesa non serve nemmeno che il cliente sappia chi è
 *   (`personaDaAdottare`): in quella stanza c'è lui e basta. In due o più
 *   serve il gettone, e chi non l'ha continua a seguire il consulente —
 *   indovinare vorrebbe dire aprire a uno il preventivo di un altro. */
export function paginaDiQuestoCliente(p: {
  /** La pagina del consulente ("" = non l'ha ancora scelta). */
  pagina?: unknown;
  regia?: RegiaGruppo | null;
  /** Il gettone che il cliente dichiara ("" se il suo dispositivo non lo sa). */
  io?: string;
  /** I gettoni attesi in questa stanza. */
  attesi?: { gettone?: string }[] | null;
}): string {
  const mio = gettone(p.io) || personaDaAdottare("", p.attesi);
  /*  ⚠️ E SI RISPONDE ANCHE DI CHI È QUEL PREVENTIVO. Senza, un cliente che
      non sa il proprio nome arriverebbe sulla pagina giusta ma nella stanza
      SBAGLIATA — quella del preventivo comune, che nel suo caso è vuota —
      mentre il consulente lavora nella sua. Il gettone che si manda è quello
      che il server ha già deciso essere suo: non si regala il nome di un
      altro. */
  if (mio && haIlSuo(p.regia, mio)) return `/preventivo?persona=${mio}`;
  return testo(p.pagina);
}

/** ── LO SCHERMO DEL CLIENTE LO CONFERMA LUI ────────────────────────────────
 *  Quarta segnalazione sulla stessa cosa: «se passo da contenuti a videocamera
 *  gli cambia schermata ugualmente».
 *
 *  La pagina la decide il server (`paginaDiQuestoCliente`) e quella è al
 *  sicuro. La MODALITÀ — le facce a schermo pieno invece dei contenuti — no:
 *  viaggia sul canale della stanza, da una scheda all'altra, e il server non
 *  la vede passare. A rifiutarla è il dispositivo del cliente, quindi dipende
 *  dal codice che ha dentro — e una scheda aperta da prima di un
 *  aggiornamento continua a girare con quello di ieri per ore.
 *
 *  Non si può rimediare da qui. Si può però SMETTERE DI INDOVINARE: il cliente
 *  dichiara nel suo annuncio se sta rispettando la regola (`suo` nell'hello), e
 *  il pannello lo dice in chiaro. Se non lo conferma, c'è un pulsante che gli
 *  aggiorna lo schermo — `reload`, che perfino le versioni vecchie capiscono.
 *
 *  ⚠️ «Non lo conferma» NON vuol dire «è un bugiardo»: vuol dire che quel
 *   dispositivo non lo sta dicendo — versione vecchia, o non si è riconosciuto
 *   in questa stanza. In tutti e due i casi il rimedio è lo stesso. */
export type StatoDelloSchermo = "spento" | "non-collegato" | "suo" | "non-conferma";

export function statoDelloSchermo(p: {
  /** «Lo vede lui» è acceso per questa persona? */
  acceso?: boolean;
  /** È in linea? `null` = non si sa (nessuna notizia dal canale). */
  collegato?: boolean | null;
  /** Il suo dispositivo dichiara di stare sul proprio preventivo. */
  lodice?: boolean;
}): StatoDelloSchermo {
  if (!p.acceso) return "spento";
  //  ⚠️ Prima la presenza: a chi non è dentro non si chiede una conferma, e
  //   dirgli «aggiorna lo schermo» sarebbe un consiglio inutile.
  if (p.collegato === false) return "non-collegato";
  return p.lodice === true ? "suo" : "non-conferma";
}

/** ── CHI È IN LINEA, ANCHE SE NON SI È PRESENTATO ──────────────────────────
 *  Segnalazione del committente, con la fotografia del pannello: «Daniele
 *  Francesco Ferlazzo · non ancora» e «acceso, ma lui non è dentro» — mentre
 *  Daniele era collegato e stava guardando la videochiamata.
 *
 *  Il consulente riconosce un cliente dal gettone che quello annuncia. Un
 *  dispositivo che non lo manda (una scheda aperta da prima di un
 *  aggiornamento, un link inoltrato) resta una riga senza nome: il pannello
 *  diceva «non è dentro» di una persona che era dentro, e — peggio — non
 *  offriva il pulsante per aggiornargli lo schermo, perché a chi non c'è non
 *  si consiglia di ricaricare.
 *
 *  Stessa deduzione di `personaDaAdottare`, dall'altro lato del filo: se la
 *  stanza aspetta UNA persona e c'è un ospite collegato, quell'ospite è lei.
 *  ⚠️ In due o più non si assegna niente: due righe senza nome non si sa a chi
 *   appartengano, e sbagliare vorrebbe dire dire «è in linea» di chi non c'è.
 */
export function chiEInLinea(p: {
  attesi?: { gettone?: string; leadId?: string }[] | null;
  /** Gli ospiti collegati: `leadId` solo di chi si è presentato. */
  ospiti?: { leadId?: string }[] | null;
}): string[] {
  const attesi = p.attesi ?? [];
  const ospiti = p.ospiti ?? [];
  const dentro = new Set<string>();
  let senzaNome = 0;
  for (const o of ospiti) {
    const id = testo(o?.leadId);
    if (id) dentro.add(id);
    else senzaNome++;
  }
  //  L'unico caso in cui un ospite senza nome ha un nome solo possibile.
  if (senzaNome > 0 && attesi.length === 1) {
    const id = testo(attesi[0]?.leadId);
    if (id) dentro.add(id);
  }
  return [...dentro];
}

/** ── UNO STATO SOLO PER PERSONA ────────────────────────────────────────────
 *  Segnalazione del committente, davanti al pannello: «questa funzione non va
 *  bene, analizza bene tutte le sue funzioni così le ottimizziamo».
 *
 *  Il difetto non erano le regole — quelle reggono — ma il modo di dirle. Il
 *  pannello aveva DUE interruttori, «Lo vedo io» e «Lo vede lui», che
 *  sembravano simmetrici e non lo erano: il primo ne conteneva tre (apri la
 *  sua stanza, entra in preparazione privata, e in un caso porta tutti sul
 *  preventivo) e spegnendolo non si rimetteva niente a posto; il secondo era
 *  una cosa sola. Sotto, una riga in italiano ripeteva la stessa cosa detta
 *  dagli interruttori. Tre modi di dire la stessa cosa, e nessuno che
 *  rispondesse alla domanda vera.
 *
 *  La domanda vera è una: CHE COSA HA DAVANTI LUI, ADESSO. E le risposte sono
 *  DUE:
 *   · `"segue"` → vede quello che mostri tu, come in ogni consulenza;
 *   · `"suo"`   → ha il suo preventivo e lo compila (e non lo sposti più).
 *
 *  ⚠️ IL TERZO STATO È STATO TOLTO, E VA SCRITTO PERCHÉ. C'era «solo io» — il
 *   suo preventivo davanti a me, lui fermo dov'era, cioè il «glielo preparo e
 *   poi glielo mostro» — e il committente, provandolo: «solo io non serve».
 *   Aveva ragione a tenerlo fuori: era l'unico stato che nasceva da una
 *   combinazione (spento per lui + la sua stanza aperta da me) invece che da
 *   una decisione, e per starci dentro si portava dietro la preparazione in
 *   privato, una fascia di avviso e una regola in più in shop/live.
 *   Guardare il suo preventivo mentre lo compila si fa ancora, ma è quello che
 *   è: una cosa che riguarda il MIO schermo, su un'altra riga del pannello
 *   («guarda da me»), che non cambia di una virgola quello che vede lui. */
export type StatoPersona = "segue" | "suo";

export function statoDiQuestaPersona(r: RegiaGruppo | null | undefined, chi: unknown): StatoPersona {
  const g = gettone(chi);
  if (!g) return "segue";
  return haIlSuo(r, g) ? "suo" : "segue";
}

/** La regia che risulta portando questa persona nello stato scelto.
 *  ⚠️ Un posto solo per tutte e tre le transizioni: prima ogni interruttore
 *   scriveva i suoi campi per conto proprio, ed è così che nascevano gli stati
 *   impossibili (acceso per lui MENTRE lo preparo di nascosto). */
export function conStatoPersona(
  r: RegiaGruppo | null | undefined,
  chi: unknown,
  stato: StatoPersona,
  adesso = Date.now(),
): RegiaGruppo {
  const g = gettone(chi);
  const base = leggiRegia(scriviRegia(r ?? { comune: false, penne: {}, individuali: [], aperto: "", at: 0 }));
  if (!g) return base;
  if (stato === "suo") {
    //  Acceso per lui. La stanza aperta sul mio schermo resta come sta: se ci
    //  stavo lavorando ci resto, se non c'ero non mi ci trascino.
    return conIndividuale(base, g, true, adesso);
  }
  //  «Segue me»: spento per lui, e se la stanza aperta era la sua si chiude —
  //  se no resterei a guardare un preventivo che per lui non esiste più.
  const senza = conIndividuale(base, g, false, adesso);
  return testo(base.aperto).toLowerCase() === g ? conAperto(senza, "", adesso) : senza;
}

/** ── IL PREVENTIVO DI UNA PERSONA, IN UNA RIGA ─────────────────────────────
 *  Quanto fa, quante voci, da quanto non si muove. È la cosa che il pannello
 *  non ha mai detto e che serve sempre: senza, per sapere se il cliente sta
 *  lavorando bisogna aprire il suo preventivo — cioè smettere di fare quello
 *  che si stava facendo.
 *  ⚠️ «Non l'ha ancora toccato» non è «zero euro»: un preventivo aperto e mai
 *   sfiorato non deve sembrare lavoro fatto. */
export function riassuntoInParole(
  r: { totale?: number | null; voci?: number; toccato?: boolean; quando?: number } | null | undefined,
  adesso = Date.now(),
): string {
  if (!r || !r.toccato) return "non l'ha ancora toccato";
  const pezzi: string[] = [];
  const t = Number(r.totale);
  /*  ⚠️ LO STESSO EURO DI TUTTO IL RESTO (vedi `euroLeggibile`): in italiano
      i numeri di quattro cifre non si puntano — «4200 €», non «4.200 €» — e
      due modi di scrivere lo stesso prezzo nella stessa schermata sono due
      prezzi, per chi legge di sfuggita. */
  if (Number.isFinite(t) && t > 0) {
    pezzi.push(new Intl.NumberFormat("it-IT", {
      style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Math.round(t)));
  }
  const v = Number(r.voci) || 0;
  if (v > 0) pezzi.push(v === 1 ? "1 voce" : `${v} voci`);
  const q = Number(r.quando) || 0;
  if (q > 0) {
    const min = Math.floor((adesso - q) / 60_000);
    //  Sotto il minuto si dice «adesso»: un orologio al secondo in un pannello
    //  che si guarda di sfuggita è rumore.
    pezzi.push(min <= 0 ? "adesso" : min === 1 ? "1 minuto fa" : min < 60 ? `${min} minuti fa` : "più di un'ora fa");
  }
  /*  ⚠️ IL TEMPO DA SOLO NON DICE NIENTE. Visto uscire in locale: «più di
      un'ora fa», e basta — una riga che non dice di che cosa. Succede per un
      preventivo cominciato e poi svuotato (base scelta, niente voci, nessun
      totale): «toccato» è vero, ma non c'è nessun numero da mostrare. */
  if (pezzi.length === 1 && !pezzi[0].includes("€") && !pezzi[0].includes("voc")) pezzi.unshift("iniziato");
  return pezzi.join(" · ") || "iniziato";
}

/** ── ⚠️ IL PREVENTIVO DI UNO NON PORTA I SUOI DATI A TUTTI ─────────────────
 *  Trovato provando «Rendilo il preventivo della consulenza» con due persone
 *  in stanza: la copia nel preventivo comune si portava dietro `profile` —
 *  nome, cognome, telefono, email di chi l'aveva compilato — e il comune lo
 *  vedono TUTTI. Cioè Anna avrebbe letto i dati di Bruno, davanti a Bruno.
 *  È lo stesso pericolo per cui, aprendo la stanza di una persona, si legge
 *  prima di scrivere (vedi il cartello in routes/preventivo): qui la stessa
 *  regola, dall'altro verso.
 *
 *  ⚠️ SOLO IN GRUPPO. Con una persona sola il preventivo comune È il suo, e
 *   togliergli i dati vorrebbe dire farglieli riscrivere per niente. */
export function senzaDatiPersonali(stato: Record<string, unknown>): Record<string, unknown> {
  const fuori = { ...stato };
  delete fuori.profile;
  const r = fuori.result as Record<string, unknown> | null | undefined;
  if (r && typeof r === "object") {
    const pulito = { ...r };
    for (const campo of ["nome", "cognome", "email", "telefono", "eta", "indirizzo", "citta", "cap", "cf"]) delete pulito[campo];
    fuori.result = pulito;
  }
  return fuori;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHI METTERE NEL PANNELLO — E PERCHÉ NON BASTAVANO GLI ATTESI
   ───────────────────────────────────────────────────────────────────────────
   Segnalazione del committente, in piena consulenza: «manca tutta la regia del
   preventivo».

   ⚠️ IL PANNELLO SPARIVA PER INTERO, e la regola che lo faceva sparire era
    questa: si mostra solo se la stanza ha ALMENO UNA PERSONA ATTESA. «Atteso»
    vuol dire una riga di appuntamento in archivio, con nome, cognome e scheda.
    Ma una consulenza si apre anche così: si manda il link a qualcuno, quello
    scrive il suo nome alla porta ed entra. Nessun appuntamento, nessun atteso —
    e il consulente si ritrovava senza il preventivo, senza gli interruttori,
    senza niente. Non «un pezzo non funziona»: tutto sparito.

   Chi è collegato ADESSO è una persona di questa consulenza quanto chi era in
   agenda. Non ha un gettone — cioè non ha una stanza di preventivo sua — e
   allora il suo preventivo È QUELLO COMUNE: `stanzaDelPreventivo(code, "")` è
   la stanza comune, quindi non c'è niente da inventare, c'è solo da dirlo.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PersonaDelPannello = {
  gettone: string;
  nome: string;
  leadId: string;
  /** Nessuna scheda in archivio: è entrato dal link scrivendo il suo nome.
   *  Il suo preventivo è quello comune, ed è in linea per costruzione. */
  senzaScheda?: boolean;
};

/** Chi mostrare nel pannello: gli attesi se ci sono, se no chi è collegato. */
export function personeDelPannello(p: {
  attesi: { gettone: string; nome: string; leadId: string }[];
  ospiti: { name?: string; nomeVero?: string }[];
}): PersonaDelPannello[] {
  if (p.attesi.length >= 1) return p.attesi;
  const nomi = p.ospiti
    .map((o) => String(o.nomeVero || o.name || "").trim())
    .filter(Boolean);
  if (!p.ospiti.length) return [];
  //  ⚠️ UNA RIGA SOLA, anche se sono in due. Senza gettone non hanno un
  //   preventivo per uno: vedono tutti lo stesso, quello comune. Due righe
  //   direbbero una bugia — che si possono governare separatamente.
  const nome = nomi.length === 0 ? "Il cliente"
    : nomi.length <= 2 ? nomi.join(" e ")
    : `${nomi[0]} e altri ${nomi.length - 1}`;
  return [{ gettone: "", nome, leadId: "", senzaScheda: true }];
}

/** ── CHI SI FA SPOSTARE LA PAGINA SOTTO GLI OCCHI ─────────────────────────
 *
 *  Segnalazione del committente: «il preventivo mentre lo compilo continuamente
 *  torna sopra, e devo riscorrere verso il punto».
 *
 *  ⚠️ LO SCORRIMENTO VIAGGIA INSIEME ALLO STATO, ed è giusto: quando il
 *   consulente presenta, il cliente deve guardare il punto che sta spiegando.
 *   Ma da quando si compila IN DUE nella stessa stanza, quello stato arriva
 *   anche a chi sta scrivendo — e ogni fotografia in arrivo gli riportava la
 *   pagina dove sta l'altro. Ogni secondo, mentre sceglieva le voci.
 *
 *  La regola è una riga: **lo scorrimento di un altro lo segue solo chi sta
 *  SOLO guardando**. Chi scrive tiene la sua posizione, sempre — anche se
 *  quello che scrive l'altro continua ad applicarsi (le due cose sono
 *  diverse: le scelte sono del preventivo, la posizione è degli occhi).
 */
export function loScorrimentoMiRiguarda(p: {
  /** Sto guardando lo schermo di un altro (specchio). */
  guardo?: boolean;
  /** Sto scrivendo anch'io in questa stanza. */
  scrivo?: boolean;
}): boolean {
  return !!p.guardo && !p.scrivo;
}
