/** ── IL MESTIERE DELLA PERSONA, E I NUMERI DI CHI TELEFONA ─────────────────
 *
 *  ⚠️⚠️ QUESTE SPUNTE ADESSO DANNO ANCHE I PERMESSI, E VA LETTO PRIMA DI
 *  TOCCARLE. Fino a ieri qui si diceva solo COME VA MISURATA una persona, e i
 *  permessi stavano da un'altra parte (un LIVELLO solo per persona, accanto al
 *  PIN). Il committente ha chiesto di poter assegnare più ruoli insieme e di
 *  dare a ciascuno «gli accessi che servono per il suo ruolo»: i ruoli che si
 *  sommano sono questi, quindi il permesso è diventato l'UNIONE di ciò che
 *  serve a ogni mestiere acceso (la tabella sta in crm/permessi.ts,
 *  `PERMESSI_MESTIERE`, e il calcolo in `risolviAccesso`).
 *  Del livello resta in piedi una cosa sola: ADMIN, le chiavi di casa.
 *
 *  Conseguenze pratiche di questo file, tutte e tre da tenere a mente:
 *   · accendere «fa il consulente» CONCEDE preventivi e incassi, e spegnerlo li
 *     toglie. Non è più una spunta innocua da mettere «per vedere i numeri»;
 *   · il valore di partenza qui sotto (`MESTIERI_DI_PARTENZA`: consulente sì)
 *     NON diventa mai un permesso da solo — se lo facesse, ogni setter
 *     dell'archivio si troverebbe gli incassi. Vale solo dove la riga porta il
 *     segno del passaggio (`daMestieri`), che scrive una persona salvando la
 *     scheda, mai un aggiornamento del programma;
 *   · nessun mestiere consegna le chiavi (`consulenti`, `impostazioni`,
 *     `listino`, `archivio`): queste spunte le scrive il browser dentro
 *     `crm_consultants.data`, il livello no. Chi aggiunge un mestiere qui e gli
 *     attacca uno di quei permessi apre una porta che nessuna guardia controlla.
 *
 *  Restano invece indipendenti la MISURA e il permesso: un admin può non fare
 *  né il setter né il consulente e restare fuori da entrambe le classifiche
 *  senza perdere un permesso, perché ADMIN non passa da qui.
 *  I mestieri sono sei — setter, consulente, installatore, accompagnatore,
 *  driver, manutentore — e ogni mestiere nuovo si aggiunge QUI, come casella in
 *  più: il giorno in cui ne nasce uno e lo si mette altrove, questo CRM ha due
 *  elenchi di ruoli e le due schermate cominciano a rispondere in modo diverso
 *  alla stessa domanda.
 *
 *  ── UNA PAROLA SOLA PER MESTIERE: «TECNICO» ADESSO SI CHIAMA «INSTALLATORE» ─
 *  Il committente lo chiama installatore, quindi si chiama installatore: a
 *  schermo, nel codice e nel database. Tenere `faTecnico` dentro e scrivere
 *  «installatore» fuori avrebbe lasciato due parole vive per la stessa spunta, e
 *  fra un mese nessuno saprebbe più quale delle due conta quando l'elenco di chi
 *  esegue una posa si comporta in modo strano.
 *  ⚠️ MA LA SPUNTA GIÀ DATA NON SI PERDE. Il campo salvato si chiama da oggi
 *  `faInstallatore`; chi in archivio ha `faTecnico` viene letto lo stesso (vedi
 *  `mestieriDi`: legge la parola nuova e, solo se non c'è, quella vecchia) e alla
 *  prima modifica della sua scheda la spunta si riscrive con il nome nuovo.
 *  La parola vecchia sopravvive in UN punto solo di tutto il progetto — il tipo
 *  `MestieriSalvati` qui sotto — e nessuno la scrive più: non è un secondo nome
 *  vivo, è un archivio che si sa leggere.
 *
 *  PERCHÉ IL TIPO STA QUI E NON IN types.ts
 *  types.ts è di un'altra mano. Il campo è dichiarato ed esportato in questo
 *  file e si scrive attraverso una variabile tipizzata (`ConsultantDataConMestieri`):
 *  un letterale con una proprietà in più verrebbe rifiutato da TypeScript, una
 *  variabile no. È lo stesso schema già usato per `payment.incassoSaldo` e per
 *  `installazione.spedizione`. In "richieste" c'è il testo esatto da incollare
 *  in `ConsultantData` quando quel file sarà libero: da quel momento questo
 *  file può togliere il tipo e importarlo.
 *
 *  ⚠️ CHI HA FISSATO L'APPUNTAMENTO NON È REGISTRATO. Vedi la sezione 3: il
 *  CRM salva UN SOLO nome per scheda (`consulenteId`), ed è quello di chi fa la
 *  consulenza. Tutti i numeri del setter qui sotto sono quindi attribuiti a chi
 *  ha la scheda ASSEGNATA, che è il criterio più onesto che i dati permettono —
 *  e va scritto a schermo, non lasciato intuire.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, eStatoNonSvolta } from "@/crm/types";
import type { Consultant, ConsultantData, Lead } from "@/crm/types";
import type { FiltroPeriodo } from "@/crm/kpi-calcoli";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL DATO — che mestiere fa
   ═════════════════════════════════════════════════════════════════════════ */

export interface MestieriConsulente {
  /** Telefona i contatti e fissa gli appuntamenti.
   *  Permessi che porta con sé: i propri lead e l'agenda — «fissare» È scrivere
   *  in agenda (crm/permessi.ts, `PERMESSI_MESTIERE`). */
  faSetter?: boolean;
  /** Svolge le videoconsulenze e chiude le vendite.
   *  Permessi che porta con sé: quelli del setter più preventivi e incassi.
   *  ⚠️ Spegnerlo li TOGLIE: non è più una spunta che riguarda solo i grafici. */
  faConsulente?: boolean;
  /** ── GUIDA, E ACCOMPAGNA CHI VA A POSARE ────────────────────────────────
   *  Il terzo mestiere, e sta qui per la stessa ragione degli altri due: è
   *  «che lavoro fa». Da oggi il lavoro che fa gli apre anche ciò che gli
   *  serve — la pagina delle installazioni e delle spedizioni, cioè dove e
   *  quando deve andare — e nient'altro. ADMIN resta l'unica cosa che passa
   *  ancora dal livello, accanto al PIN: un mestiere non consegna le chiavi.
   *  Una persona è driver, è consulente, o è tutti e due, esattamente come per
   *  setter e consulente: si sommano.
   *  ⚠️ A differenza degli altri due questo mestiere non decide dei numeri:
   *  decide chi compare nell'elenco dei driver quando si programma una posa, e
   *  di conseguenza di chi si blocca l'agenda per il tempo della strada
   *  (booking-utils.ts). Per questo NON entra in `dichiarato`: chi segna solo
   *  «fa il driver» non ha ancora detto niente su come va misurato. */
  faDriver?: boolean;
  /** ── VA A POSARE: L'INSTALLATORE ────────────────────────────────────────
   *  Il quarto mestiere, e sta qui per la stessa identica ragione dei primi
   *  tre — «che lavoro fa». Non è un elenco nuovo di ruoli: è una casella in
   *  più nello stesso blocco di interruttori, e si somma come le altre. Apre
   *  la stessa cosa del driver: installazioni e spedizioni. Una persona può essere installatore e basta,
   *  installatore e setter, installatore e driver: sono spunte indipendenti,
   *  non una scelta fra.
   *  ⚠️ Si chiamava `faTecnico`. È lo STESSO mestiere con la parola che usa il
   *  committente adesso — vedi la testata del file per come si continuano a
   *  leggere le spunte già date.
   *  ⚠️ Come il driver, NON entra in `dichiarato`: chi segna solo «va a
   *  posare» non ha detto niente su come vanno misurati i suoi numeri, e
   *  ripescare il ripiego gli assegnerebbe un mestiere che non ha scelto. */
  faInstallatore?: boolean;
  /** ── VA CON L'INSTALLATORE A FARE IL LAVORO: L'ACCOMPAGNATORE ───────────
   *  Il quinto mestiere.
   *  ⚠️⚠️ NON È IL DRIVER, E NON VANNO UNITI. Sono due persone diverse in due
   *  momenti diversi del lavoro:
   *   · il DRIVER è quello del passo «viene da solo o con un driver»: è un
   *     SERVIZIO DI TRASPORTO, si porta dietro un compenso da pagare in più
   *     (`installazione.compensoDriver`) e sta in strada più a lungo di
   *     chiunque altro — tre ore prima e tre dopo;
   *   · l'ACCOMPAGNATORE va INSIEME all'installatore a fare la posa: è una
   *     seconda paia di mani sul lavoro, non un passaggio in macchina, e non
   *     prende quel compenso.
   *  Fonderli in un mestiere solo avrebbe messo un compenso addosso a chi non lo
   *  prende — o, dal verso opposto, avrebbe tolto il compenso a chi lo prende —
   *  e in agenda avrebbe dato a chi aiuta a posare le tre ore di strada di chi
   *  guida. Chi fa tutte e due le cose accende tutte e due le spunte.
   *  ⚠️ Come driver e installatore, NON entra in `dichiarato`. */
  faAccompagnatore?: boolean;
  /** ── FA TORNARE L'IMPIANTO: IL MANUTENTORE ──────────────────────────────
   *  Il sesto mestiere, e sta qui per la stessa ragione degli altri cinque —
   *  «che lavoro fa». È chi esegue il RITORNO: ogni due o quattro settimane
   *  l'impianto si rifissa, e quel lavoro non è la posa.
   *  ⚠️ NON SI DEDUCE DA «FA L'INSTALLATORE», e i due non si fondono. Chi va a
   *  posare monta un impianto nuovo, spesso a casa del cliente e con mezza
   *  giornata di strada addosso; chi fa la manutenzione rifissa un impianto che
   *  c'è già, quasi sempre in sede e in un'ora. Sono due elenchi di persone
   *  diversi in due momenti diversi del rapporto col cliente, e riusare la
   *  spunta dell'installatore avrebbe messo fra i manutentori ogni installatore
   *  — cioè avrebbe tolto la scelta proprio a chi la stava facendo.
   *  Chi fa tutte e due le cose accende tutte e due le spunte, come sempre.
   *  ⚠️ Come installatore, accompagnatore e driver, NON entra in `dichiarato`:
   *  chi segna solo «fa le manutenzioni» non ha detto niente su come vanno
   *  misurati i suoi numeri. */
  faManutentore?: boolean;
}

/** `ConsultantData` con i mestieri. Serve per SCRIVERE senza toccare types.ts. */
export type ConsultantDataConMestieri = ConsultantData & MestieriConsulente;

/** ── COME I MESTIERI SONO SCRITTI IN ARCHIVIO ──────────────────────────────
 *  Uguale a `MestieriConsulente`, più la sola parola vecchia che nei dati esiste
 *  ancora: `faTecnico`, il nome che l'installatore aveva prima.
 *  ⚠️ È L'UNICO PUNTO DEL PROGETTO IN CUI QUELLA PAROLA COMPARE, e serve solo a
 *  LEGGERE: nessuno la scrive più (vedi `conMestieri`). Tenerla qui, dichiarata
 *  e circoscritta, è ciò che permette al resto del codice di conoscere un nome
 *  solo senza che il giorno del cambio qualcuno si ritrovi la spunta spenta.
 *  `unknown` e non `boolean` di proposito: dall'archivio arriva anche "1". */
type MestieriSalvati = MestieriConsulente & { faTecnico?: unknown };

export interface Mestieri {
  faSetter: boolean;
  faConsulente: boolean;
  /** Guida e accompagna chi va a posare. Si legge SEMPRE da qui: l'elenco dei
   *  driver nella programmazione, il segno nell'elenco delle installazioni e il
   *  blocco dell'agenda devono partire dalla stessa risposta. */
  faDriver: boolean;
  /** Va a posare. Si legge SEMPRE da qui, come per il driver: l'elenco di chi
   *  può eseguire una posa e il margine che quella posa toglie all'agenda
   *  devono partire dalla stessa risposta, o le due schermate si contraddicono
   *  sullo stesso pomeriggio. */
  faInstallatore: boolean;
  /** Va con l'installatore a fare il lavoro. Si legge SEMPRE da qui: l'elenco
   *  di chi si può mettere accanto a chi posa e il margine che quella posa
   *  toglie alla SUA agenda partono da questa stessa risposta — è tutto il
   *  punto dell'agenda unica. */
  faAccompagnatore: boolean;
  /** Esegue i ritorni per la manutenzione. Si legge SEMPRE da qui, come gli
   *  altri tre mestieri di campo: l'elenco di «chi la esegue» quando si fissa un
   *  ritorno e il margine che quel ritorno toglie alla sua agenda partono da
   *  questa stessa risposta. */
  faManutentore: boolean;
  /** false = nessuno ha mai scelto. Quello che si vede è il valore di partenza,
   *  e va detto invece che lasciato credere: «consulente» perché qualcuno
   *  l'ha spuntato e «consulente» perché non c'era niente si vedono identici. */
  dichiarato: boolean;
}

/** ── IL VALORE DI PARTENZA PER CHI C'È GIÀ ─────────────────────────────────
 *  Consulente sì, setter no.
 *  Il criterio non è «cosa è più probabile» ma «cosa NON cambia i numeri di
 *  oggi»: prima di questa riga ogni persona in anagrafica compariva nella
 *  tabella dei consulenti e in nessun'altra. Con questo valore di partenza
 *  quella tabella resta identica alla riga precedente — stesse persone, stessi
 *  numeri, stesso ordine — e la vista dei setter nasce VUOTA, cioè dichiara di
 *  non sapere ancora chi telefona invece di inventarselo.
 *  L'errore opposto (accendere il setter a tutti) avrebbe riempito una
 *  classifica di persone che non telefonano, con percentuali vere calcolate su
 *  un mestiere che non fanno: numeri credibili e sbagliati, i peggiori.
 *  ⚠️ Il valore di partenza NON viene scritto nel database: resta un ripiego di
 *  lettura finché qualcuno non spunta davvero le caselle. Così il giorno in cui
 *  si decide un ripiego diverso non c'è nessuna riga da correggere.
 *  ⚠️⚠️ E NON DIVENTA MAI UN PERMESSO DA SOLO. Da quando i mestieri danno anche
 *  i permessi, «consulente sì» letto da una riga che non ha mai scelto niente
 *  varrebbe preventivi e incassi regalati a tutto l'archivio. Per questo il
 *  calcolo per mestieri si accende solo sulle righe che portano il segno del
 *  passaggio (`daMestieri` in crm/permessi.ts), cioè quelle che una persona ha
 *  aperto e salvato: su tutte le altre comanda ancora il livello, e questo
 *  ripiego resta quello che è sempre stato — una faccenda di grafici. */
const MESTIERI_DI_PARTENZA: Readonly<Mestieri> = {
  faSetter: false,
  faConsulente: true,
  //  Driver NO, e per lo stesso criterio: accenderlo a tutti riempirebbe
  //  l'elenco dei driver di gente che non guida, e la prima posa programmata
  //  bloccherebbe per sei ore l'agenda di qualcuno che non doveva uscire.
  faDriver: false,
  //  Installatore NO, e per lo stesso criterio ancora: acceso a tutti, l'elenco
  //  di chi esegue le pose direbbe che va a posare anche chi non ha mai preso
  //  una scatola in mano, e ogni posa programmata gli toglierebbe due ore di
  //  agenda che nessuno gli aveva tolto il giorno prima.
  //  ⚠️ Il giorno del rilascio questo vuol dire che NESSUNO è installatore, e
  //  l'elenco di «chi la esegue» non ripiega più sui consulenti: resta vuoto e
  //  al suo posto compare la schermata che dice quale spunta manca e porta ad
  //  accenderla (esecutoriPossibili e SenzaInstallatori, in
  //  crm/InstallationScheduleDialog.tsx). Finché nessuno la prende, le pose non
  //  si programmano — è voluto: meglio fermarsi dicendolo che assegnare una posa
  //  a chi non posa.
  faInstallatore: false,
  //  Accompagnatore NO, stesso criterio: nessuno l'ha ancora scelto, e
  //  accenderlo a tutti riempirebbe di nomi l'elenco di chi va insieme a posare
  //  bloccando due ore di agenda a gente che non esce di casa.
  faAccompagnatore: false,
  //  Manutentore NO, stesso criterio degli altri tre: acceso a tutti, l'elenco
  //  di chi esegue un ritorno direbbe che fa manutenzioni anche chi non ne ha
  //  mai fatta una, e ogni ritorno fissato gli toglierebbe un'ora di agenda che
  //  nessuno gli aveva tolto il giorno prima.
  //  ⚠️ Il giorno del rilascio questo vuol dire che NESSUNO è manutentore, e la
  //  procedura del ritorno non ripiega più su tutti i consulenti attivi: resta
  //  vuota e al suo posto compare la schermata che dice quale spunta manca e
  //  porta ad accenderla (manutentoriPossibili e SenzaManutentori, in
  //  crm/manutenzione/squadra.tsx). È la stessa scelta già fatta per le pose:
  //  meglio fermarsi dicendolo che affidare un ritorno a chi non lo fa.
  faManutentore: false,
  dichiarato: false,
};

/** I mestieri di una persona, sempre in forma leggibile.
 *  ⚠️ Non si dà per scontato che i campi siano booleani: l'anagrafica arriva da
 *  un JSONB e negli archivi importati un campo può essere una stringa, un
 *  numero o null. Si accetta come «sì» solo ciò che è inequivocabile. */
export function mestieriDi(dati?: ConsultantData | null): Mestieri {
  if (!dati || typeof dati !== "object") return { ...MESTIERI_DI_PARTENZA };
  const d = dati as ConsultantData & MestieriSalvati;
  const scritto = (v: unknown): boolean | null => {
    //  "1" e "0" con le virgolette esistono davvero: certe esportazioni
    //  scrivono i booleani come stringhe, e senza queste due righe una scheda
    //  compilata tornerebbe al valore di partenza — cioè spegnerebbe da sola
    //  il setter a chi l'aveva acceso.
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v === false || v === "false" || v === 0 || v === "0") return false;
    return null;
  };
  const s = scritto(d.faSetter);
  const c = scritto(d.faConsulente);
  //  Il driver si legge a parte e vale per sé: non entra nel conto di
  //  «dichiarato» (vedi il campo) ma non deve nemmeno sparire quando gli altri
  //  due non sono mai stati scritti — chi ha spuntato solo «fa il driver» lo
  //  ritroverebbe spento riaprendo la scheda.
  const g = scritto(d.faDriver) === true;
  //  ── L'INSTALLATORE, E LA SPUNTA CHE NON SI PERDE ─────────────────────────
  //   Si legge come il driver — vale per sé, non entra in «dichiarato», e non
  //   deve sparire quando setter e consulente non sono mai stati scritti — con
  //   una riga in più: se la parola nuova non c'è si legge quella vecchia.
  //   ⚠️ L'ORDINE CONTA E NON SI GIRA. Prima `faInstallatore`, poi `faTecnico`:
  //   chi ha appena TOLTO la spunta (faInstallatore: false) ha in archivio anche
  //   il vecchio `faTecnico: true`, che nessuno riscrive perché nessuno lo
  //   scrive più. Leggendo prima il vecchio, quella persona si ritroverebbe
  //   installatore ogni volta che qualcuno riapre la sua scheda — cioè una
  //   spunta che si riaccende da sola e rimette in elenco chi era stato tolto.
  const i = (scritto(d.faInstallatore) ?? scritto(d.faTecnico)) === true;
  //  L'accompagnatore nasce oggi: non ha nessun nome vecchio da cui ripescare, e
  //  per il resto si comporta esattamente come gli altri due mestieri di campo.
  const a = scritto(d.faAccompagnatore) === true;
  //  Il manutentore nasce oggi come l'accompagnatore: nessun nome vecchio da
  //  ripescare, e per il resto si comporta come gli altri mestieri di campo.
  const man = scritto(d.faManutentore) === true;
  //  Basta che UNO dei due sia stato scritto perché la scheda conti come
  //  compilata: chi accende il solo setter sta dicendo anche «e non fa
  //  consulenze», e ripescare il ripiego gli rimetterebbe addosso il mestiere
  //  che ha appena tolto.
  if (s === null && c === null) {
    return {
      ...MESTIERI_DI_PARTENZA,
      faDriver: g,
      faInstallatore: i,
      faAccompagnatore: a,
      faManutentore: man,
    };
  }
  return {
    faSetter: s === true,
    faConsulente: c === true,
    faDriver: g,
    faInstallatore: i,
    faAccompagnatore: a,
    faManutentore: man,
    dichiarato: true,
  };
}

/** Comodità per chi ha in mano la riga intera invece dei soli dati. */
export function mestieriDel(c?: Consultant | null): Mestieri {
  return mestieriDi(c?.data);
}

export const faIlSetter = (c?: Consultant | null): boolean => mestieriDel(c).faSetter;
export const faIlConsulente = (c?: Consultant | null): boolean => mestieriDel(c).faConsulente;
export const faIlDriver = (c?: Consultant | null): boolean => mestieriDel(c).faDriver;
export const faLInstallatore = (c?: Consultant | null): boolean => mestieriDel(c).faInstallatore;
export const faLAccompagnatore = (c?: Consultant | null): boolean =>
  mestieriDel(c).faAccompagnatore;
export const faIlManutentore = (c?: Consultant | null): boolean => mestieriDel(c).faManutentore;

/** Frase da mettere sotto la persona: «Setter e consulente», «Solo setter»…
 *  I mestieri che non si misurano — installatore, accompagnatore, driver e
 *  manutentore — si aggiungono in CODA invece di sostituire: chi fa consulenze E
 *  va a posare deve leggersi come tutti e due, o la frase diventa una scelta fra
 *  mestieri che nessuno ha mai fatto. L'ordine della coda è quello del lavoro:
 *  prima chi posa, poi chi lo aiuta sul posto, poi chi lo porta, e in fondo chi
 *  fa tornare il cliente — che è la cosa che viene dopo tutte le altre. */
export function etichettaMestieri(m: Mestieri): string {
  const base =
    m.faSetter && m.faConsulente
      ? "Setter e consulente"
      : m.faSetter
        ? "Setter"
        : m.faConsulente
          ? "Consulente"
          : "";
  const coda = [
    m.faInstallatore ? "installatore" : null,
    m.faAccompagnatore ? "accompagnatore" : null,
    m.faDriver ? "driver" : null,
    m.faManutentore ? "manutentore" : null,
  ].filter((v): v is string => !!v);
  //  Con più voci «a e b e c» non è italiano: l'ultima si lega con la «e», le
  //  altre con la virgola. Sono poche parole in una riga che si legge di
  //  sfuggita, e una frase storta lì fa dubitare del dato che porta.
  const elenco =
    coda.length > 1 ? `${coda.slice(0, -1).join(", ")} e ${coda[coda.length - 1]}` : coda[0] || "";
  if (base && elenco) return `${base} · ${elenco}`;
  if (base) return base;
  //  Senza un mestiere misurato la coda diventa la frase intera, e va scritta
  //  con la maiuscola come qualunque altra: «installatore e driver» minuscolo,
  //  da solo in testata, si legge come un pezzo di frase troncato.
  if (elenco) return elenco.replace(/^./, (x) => x.toUpperCase());
  return "Nessun mestiere segnato";
}

/** ── SCRIVERE ──────────────────────────────────────────────────────────────
 *  Passa da una variabile TIPIZZATA e non da un letterale: è l'unico modo di
 *  aggiungere un campo che `ConsultantData` non dichiara ancora senza che
 *  TypeScript rifiuti l'oggetto (controllo delle proprietà in eccesso).
 *  Il ritorno è `ConsultantData` perché è ciò che `updateConsultant` accetta:
 *  i campi in più viaggiano dentro lo stesso JSONB e arrivano interi. */
export function conMestieri(dati: ConsultantData, patch: MestieriConsulente): ConsultantData {
  const attuali = mestieriDi(dati);
  const nuovo: ConsultantDataConMestieri = {
    ...dati,
    //  Si scrivono SEMPRE tutti, anche quelli che non sono stati toccati:
    //  salvare solo il campo cambiato lascerebbe gli altri a «mai scritto», e la
    //  scheda continuerebbe a mostrare il ripiego accanto a una scelta vera.
    faSetter: patch.faSetter ?? attuali.faSetter,
    faConsulente: patch.faConsulente ?? attuali.faConsulente,
    faDriver: patch.faDriver ?? attuali.faDriver,
    //  ⚠️ QUI AVVIENE LA MIGRAZIONE, e senza una riga di manutenzione: `attuali`
    //  arriva da `mestieriDi`, che la parola vecchia l'ha già letta. Quindi la
    //  prima volta che si salva la scheda di chi era «tecnico», la sua spunta si
    //  riscrive sotto il nome nuovo. Il campo vecchio resta dov'è, ignorato: NON
    //  si cancella, perché cancellarlo è l'unico gesto che non si può disfare se
    //  domani questa versione va rimessa indietro.
    faInstallatore: patch.faInstallatore ?? attuali.faInstallatore,
    faAccompagnatore: patch.faAccompagnatore ?? attuali.faAccompagnatore,
    faManutentore: patch.faManutentore ?? attuali.faManutentore,
  };
  return nuovo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LE REGOLE DEL TELEFONO
   ═════════════════════════════════════════════════════════════════════════ */

/** Una scheda mai toccata: sta ancora nella lista da chiamare. */
const DA_CONTATTARE = "da_contattare";

/** «L'appuntamento si fisserà più avanti»: non è un appuntamento in agenda e
 *  non deve contare come fissato. È la stessa esclusione che fa il riepilogo
 *  generale di kpi-calcoli sullo show rate. */
const MEET_DA_FISSARE = "fissa_meet_dopo";

/** Testo sicuro: dal database può arrivare un numero, un null o un oggetto, e
 *  `.trim()` su un valore storto fa morire l'intera tabella. */
const testo = (v: unknown): string => (typeof v === "string" ? v : "");

/** C'è un appuntamento messo in agenda su questa scheda?
 *  ⚠️ NO SHOW COMPRESI, ed è il punto di tutta la distinzione: il setter ha
 *  fatto il suo lavoro quando l'appuntamento è entrato in calendario. Che poi
 *  il cliente non si presenti, o non compri, non dipende da lui — per questo il
 *  suo numero principale NON è la vendita. */
export function haAppuntamentoFissato(l: Lead): boolean {
  const stato = testo(l?.data?.stato);
  return testo(l?.data?.dataMeeting).trim() !== "" && stato !== MEET_DA_FISSARE;
}

/** La scheda è stata lavorata al telefono?
 *  Due tracce, e basta una: lo stato si è mosso da «da contattare», oppure c'è
 *  un appuntamento in agenda.
 *  ⚠️ La seconda traccia non è ridondante: negli archivi importati esistono
 *  schede con la data del meeting e lo stato rimasto a «da contattare». Senza
 *  di essa quelle schede entrerebbero nei fissati ma non nei lavorati, e il
 *  numero principale del setter potrebbe superare il 100% — una percentuale
 *  impossibile a schermo fa buttare via tutta la tabella. */
export function contattoLavorato(l: Lead): boolean {
  const stato = testo(l?.data?.stato).trim();
  //  ⚠️ STATO ASSENTE = NON LAVORATO, non «lavorato».
  //  Con un semplice `!== "da_contattare"` una scheda importata senza stato
  //  passava per lavorata: entrava nel DENOMINATORE del numero principale
  //  abbassandolo, e allo stesso tempo spariva dalla colonna «ancora da
  //  chiamare», che è la coda che qualcuno deve smaltire. Il vuoto non è una
  //  prova che quella persona sia stata chiamata.
  return (stato !== "" && stato !== DA_CONTATTARE) || haAppuntamentoFissato(l);
}

/** ── L'APPUNTAMENTO C'È MA NON È ANCORA SUCCESSO ───────────────────────────
 *  Lo stato è ancora «Appuntamento fissato» (o «rifissato»): l'incontro sta in
 *  calendario e nessuno ha ancora detto com'è andato.
 *  ⚠️ QUESTA RIGA È IL MOTIVO PER CUI IL TASSO DI PRESENZA NON MENTE. Senza,
 *  un appuntamento fissato per la settimana prossima cadeva fra i «presentati»
 *  (perché «appuntamento_fissato» non è uno stato di consulenza non svolta), e
 *  su una finestra di trenta giorni — dove metà degli appuntamenti deve ancora
 *  succedere — la colonna «si presentano» si stampava vicina al 100% e i no
 *  show vicini a zero: un numero che migliora da solo mentre si guarda.
 *  È la stessa esclusione che `calcolaMetricheConsulenti` fa su
 *  `meetEffettuati` («effettuati vuol dire GIÀ SUCCESSI»): la regola del CRM
 *  esiste già e non se ne inventa una seconda.
 *  Ci finisce anche l'appuntamento di ieri che nessuno ha aggiornato — ed è
 *  giusto così: di quello non sappiamo l'esito, e «non lo so» non è «è andato
 *  bene». Si vede nel suo riquadro, dove una pila che cresce è essa stessa la
 *  notizia. */
export function appuntamentoDaSvolgere(l: Lead): boolean {
  return haAppuntamentoFissato(l) && eAppuntamento(l?.data?.stato);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. I NUMERI DEL SETTER
   ═════════════════════════════════════════════════════════════════════════ */

export interface MetricheSetter {
  id: string;
  nome: string;
  /** Schede assegnate nel periodo, in qualunque stato: il carico ricevuto. */
  assegnati: number;
  /** Schede su cui c'è traccia di una telefonata (vedi `contattoLavorato`).
   *  È il DENOMINATORE del numero principale. */
  lavorati: number;
  /** Schede assegnate e ancora ferme su «da contattare»: non è una colpa, è
   *  una coda — ma senza dirla il tasso di fissaggio sembra migliore di com'è. */
  daLavorare: number;
  /** Appuntamenti messi in agenda, NO SHOW COMPRESI. */
  fissati: number;
  /** ── FISSATI CHE NON SONO ANCORA SUCCESSI ────────────────────────────────
   *  Stanno in calendario e nessuno ha ancora detto com'è andata (vedi
   *  `appuntamentoDaSvolgere`). Contano fra i fissati — il setter il suo lavoro
   *  l'ha fatto — ma NON possono stare né fra i presentati né fra i no show. */
  daSvolgere: number;
  /** Fissati di cui si conosce l'esito: `fissati` meno quelli ancora da
   *  svolgere. È il DENOMINATORE del tasso di presenza. */
  esitoNoto: number;
  /** Di quelli già svolti, quanti si sono presentati davvero. */
  presentati: number;
  /** Fissati a cui il cliente non si è presentato. */
  noShow: number;
  /** Fissati poi saltati e in attesa di una data nuova. */
  daRiprogrammare: number;
  /** ── IL NUMERO PRINCIPALE ────────────────────────────────────────────────
   *  Appuntamenti fissati ogni cento contatti lavorati. */
  fissatiPerCento: number;
  /** Quanti degli appuntamenti che ha fissato si presentano: dice la QUALITÀ
   *  di ciò che mette in agenda, non solo la quantità.
   *  ⚠️ Si calcola sugli appuntamenti GIÀ SUCCESSI (`esitoNoto`), non su tutti
   *  i fissati: su una finestra di trenta giorni metà degli appuntamenti deve
   *  ancora avvenire, e tenerli nel conto significa scegliere fra un numero
   *  gonfiato (se contati come presenti) e uno depresso (se contati come
   *  assenti). Nessuno dei due è quello che si sta chiedendo. */
  tassoPresenza: number;
}

/** ── DA CHI SONO ATTRIBUITI QUESTI NUMERI ──────────────────────────────────
 *  Da `lead.data.consulenteId`, cioè da chi ha la scheda ASSEGNATA nel periodo.
 *  NON esiste in questo CRM un campo che dica chi ha FISSATO l'appuntamento:
 *  quando si fissa, `QuickStatusDialog` scrive in `consulenteId` la persona che
 *  SVOLGERÀ la consulenza (e se non se ne sceglie una, resta chi aveva la
 *  scheda). Se il setter fissa per un collega, quella scheda finisce quindi nei
 *  numeri del collega e non nei suoi.
 *  Finché la riga proposta in "richieste" (`fissatoDaId`) non esiste, questo è
 *  il criterio più onesto che i dati permettono — e viene DICHIARATO a schermo
 *  sotto ogni tabella, perché un grafico che tace su questo mente.
 *
 *  In elenco ci sono SOLO le persone segnate come setter: chi non telefona non
 *  deve comparire in una classifica di telefonate a zero. Chi è segnato ma non
 *  ha ricevuto schede resta con la riga a zero, altrimenti «non compare»
 *  diventa indistinguibile da «non esiste più». */
export function calcolaMetricheSetter(
  leads: Lead[],
  consultants: Consultant[],
  dentro: FiltroPeriodo,
): MetricheSetter[] {
  const setter = (Array.isArray(consultants) ? consultants : []).filter(faIlSetter);
  if (setter.length === 0) return [];

  const mappa = new Map<string, MetricheSetter>();
  for (const c of setter) {
    mappa.set(c.id, {
      id: c.id,
      nome: testo(c.data?.nome) || "Sconosciuto",
      assegnati: 0,
      lavorati: 0,
      daLavorare: 0,
      fissati: 0,
      daSvolgere: 0,
      esitoNoto: 0,
      presentati: 0,
      noShow: 0,
      daRiprogrammare: 0,
      fissatiPerCento: 0,
      tassoPresenza: 0,
    });
  }

  //  Stessa data di attribuzione della tabella dei consulenti (`createdAt`,
  //  l'ingresso del lead): due tabelle affiancate che tagliano il periodo in
  //  due modi diversi non si possono confrontare, e chi legge lo scopre solo
  //  quando i totali non tornano.
  for (const l of Array.isArray(leads) ? leads : []) {
    if (!l?.data) continue;
    if (!dentro(l.data.createdAt)) continue;
    const id = testo(l.data.consulenteId);
    if (!id) continue;
    const r = mappa.get(id);
    if (!r) continue; // non è segnato come setter: la sua riga non esiste

    r.assegnati++;
    if (contattoLavorato(l)) r.lavorati++;
    else r.daLavorare++;

    if (haAppuntamentoFissato(l)) {
      r.fissati++;
      //  ⚠️ PRIMA DI TUTTO: l'appuntamento è già successo?
      //  Un incontro fissato per la settimana prossima non è né una presenza
      //  né un'assenza. Senza questa riga finiva fra i presentati (perché
      //  «appuntamento fissato» non è uno stato di consulenza non svolta) e su
      //  trenta giorni la colonna «si presentano» si stampava vicina al 100%
      //  con i no show vicini a zero: un numero che migliora da solo mentre lo
      //  si guarda. Resta dentro i FISSATI, che è il lavoro del setter.
      if (appuntamentoDaSvolgere(l)) r.daSvolgere++;
      //  Presentato / non presentato si decide con l'UNICA regola del CRM
      //  (`eStatoNonSvolta` in types.ts), la stessa che usano l'agenda, i
      //  totali del giorno e i filtri dell'elenco. Riscriverla qui avrebbe
      //  creato il quarto elenco di stati "consulenza avvenuta" del progetto.
      else if (!eStatoNonSvolta(l.data.stato)) r.presentati++;
      else if (testo(l.data.stato) === "da_spostare") r.daRiprogrammare++;
      else r.noShow++;
    }
  }

  return [...mappa.values()]
    .map((r) => {
      //  Gli appuntamenti di cui si conosce l'esito. Si scrive come
      //  sottrazione e non come «presentati + no show + da riprogrammare»:
      //  oggi le due espressioni danno lo stesso numero, ma il giorno in cui
      //  si aggiunge una quarta categoria di esito la somma andrebbe corretta
      //  a mano e la sottrazione resta vera da sola.
      const esitoNoto = r.fissati - r.daSvolgere;
      return {
        ...r,
        esitoNoto,
        //  Divisioni protette: senza contatti lavorati la percentuale è 0, non
        //  NaN. Un «NaN%» a schermo fa chiudere la pagina e non riaprirla più.
        fissatiPerCento: r.lavorati > 0 ? (r.fissati / r.lavorati) * 100 : 0,
        tassoPresenza: esitoNoto > 0 ? (r.presentati / esitoNoto) * 100 : 0,
      };
    })
    .sort((a, b) => b.fissati - a.fissati || b.lavorati - a.lavorati);
}

/** I totali della squadra dei setter: le percentuali si RICALCOLANO sui totali,
 *  non si fa la media delle percentuali — la media di percentuali con basi
 *  diverse dà a chi ha lavorato dieci schede lo stesso peso di chi ne ha
 *  lavorate trecento. */
export function totaliSetter(righe: MetricheSetter[]): MetricheSetter {
  const t = righe.reduce(
    (a, r) => {
      a.assegnati += r.assegnati;
      a.lavorati += r.lavorati;
      a.daLavorare += r.daLavorare;
      a.fissati += r.fissati;
      a.daSvolgere += r.daSvolgere;
      a.presentati += r.presentati;
      a.noShow += r.noShow;
      a.daRiprogrammare += r.daRiprogrammare;
      return a;
    },
    {
      id: "totale",
      nome: "Squadra",
      assegnati: 0,
      lavorati: 0,
      daLavorare: 0,
      fissati: 0,
      daSvolgere: 0,
      esitoNoto: 0,
      presentati: 0,
      noShow: 0,
      daRiprogrammare: 0,
      fissatiPerCento: 0,
      tassoPresenza: 0,
    } as MetricheSetter,
  );
  t.esitoNoto = t.fissati - t.daSvolgere;
  t.fissatiPerCento = t.lavorati > 0 ? (t.fissati / t.lavorati) * 100 : 0;
  //  Stessa base della riga singola: gli appuntamenti ancora da svolgere non
  //  stanno nel denominatore, o il totale direbbe una cosa diversa dalle righe
  //  che lo compongono.
  t.tassoPresenza = t.esitoNoto > 0 ? (t.presentati / t.esitoNoto) * 100 : 0;
  return t;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LE SCHEDE DIETRO OGNI NUMERO
   ═════════════════════════════════════════════════════════════════════════ */

/** I gruppi del setter. Sono separati da quelli del consulente
 *  (`GruppoNumero` in ConsultantsPerformance) perché rispondono a domande
 *  diverse: là «quante consulenze ha condotto», qui «quante schede ha lavorato
 *  al telefono». */
export type GruppoSetter =
  | "assegnati"
  | "lavorati"
  | "daLavorare"
  | "fissati"
  | "daSvolgere"
  | "presentati"
  | "noShow";

export const GRUPPI_SETTER: Record<GruppoSetter, { etichetta: string; spiegazione: string }> = {
  assegnati: {
    etichetta: "Contatti assegnati",
    spiegazione: "Tutte le schede che gli sono state assegnate nel periodo, in qualunque stato.",
  },
  lavorati: {
    etichetta: "Contatti lavorati",
    spiegazione:
      "Schede su cui c'è traccia di una telefonata: lo stato si è mosso da «da contattare», oppure c'è già un appuntamento. È il denominatore del numero principale.",
  },
  daLavorare: {
    etichetta: "Ancora da chiamare",
    spiegazione:
      "Schede assegnate e ferme su «da contattare»: sono coda di lavoro, non un risultato negativo.",
  },
  fissati: {
    etichetta: "Appuntamenti fissati",
    spiegazione:
      "Appuntamenti entrati in agenda, no show compresi: il setter ha fatto il suo lavoro quando l'appuntamento c'è.",
  },
  daSvolgere: {
    etichetta: "Ancora da svolgere",
    spiegazione:
      "Appuntamenti in calendario di cui nessuno ha ancora detto com'è andata: restano fuori dal tasso di presenza, perché non sono né una presenza né un'assenza. Ci finisce anche l'appuntamento di ieri che nessuno ha aggiornato.",
  },
  presentati: {
    etichetta: "Presentati",
    spiegazione:
      "Appuntamenti GIÀ SVOLTI a cui il cliente si è presentato davvero (fuori i «cliente assente», i «da riprogrammare» e quelli ancora in calendario).",
  },
  noShow: {
    etichetta: "No show",
    spiegazione: "Appuntamenti fissati a cui il cliente non si è presentato.",
  },
};

/** Le schede che compongono un numero del setter, dalla più recente. */
export function leadDelGruppoSetter(
  leads: Lead[],
  setterId: string,
  gruppo: GruppoSetter,
  dentro: FiltroPeriodo,
): Lead[] {
  const suoi = (Array.isArray(leads) ? leads : []).filter(
    (l) => !!l?.data && dentro(l.data.createdAt) && testo(l.data.consulenteId) === setterId,
  );
  const scelti = suoi.filter((l) => {
    switch (gruppo) {
      case "lavorati":
        return contattoLavorato(l);
      case "daLavorare":
        return !contattoLavorato(l);
      case "fissati":
        return haAppuntamentoFissato(l);
      case "daSvolgere":
        return appuntamentoDaSvolgere(l);
      //  Le stesse condizioni del conteggio, nello stesso ordine: se l'elenco
      //  dietro il numero contenesse una riga in più del numero, chi verifica
      //  smette di fidarsi di tutta la tabella.
      case "presentati":
        return (
          haAppuntamentoFissato(l) && !appuntamentoDaSvolgere(l) && !eStatoNonSvolta(l.data.stato)
        );
      case "noShow":
        return (
          haAppuntamentoFissato(l) &&
          eStatoNonSvolta(l.data.stato) &&
          testo(l.data.stato) !== "da_spostare"
        );
      default:
        return true;
    }
  });
  return scelti.sort((a, b) => testo(b.data.createdAt).localeCompare(testo(a.data.createdAt)));
}
