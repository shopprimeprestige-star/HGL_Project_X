/** ── CHI FA LA CONSULENZA: L'UNICA PORTA ───────────────────────────────────
 *
 *  LE CONSULENZE LE FANNO SOLO I CONSULENTI. Prima di questo file ogni elenco
 *  in cui si sceglie chi svolge una consulenza — il filtro della giornata, il
 *  menu «Assegna», la catena dell'appuntamento sulla scheda del lead, la
 *  griglia degli orari liberi — mostrava TUTTA l'anagrafica: setter, driver,
 *  installatori e accompagnatori compresi. Il risultato non era solo un elenco
 *  lungo: era che una consulenza poteva finire addosso a chi non ne fa, e
 *  l'errore si scopriva il giorno dell'appuntamento.
 *
 *  ⚠️⚠️ PERCHÉ STA IN UN FILE SOLO, E PERCHÉ CI DEVE RESTARE.
 *  Il committente ha chiesto di correggere «da tutte le parti», e la ragione è
 *  più forte della fatica risparmiata: un elenco filtrato e uno no non fanno
 *  «metà lavoro», fanno un CRM che dà due risposte diverse alla stessa domanda.
 *  Chi trova un nome nel menu «Assegna» e non lo trova nel filtro della giornata
 *  smette di fidarsi del filtro — e da lì in poi controlla a mano ogni elenco,
 *  che è esattamente il lavoro che questi elenchi dovevano togliere.
 *  Quindi: la regola si scrive QUI, e chi aggiunge una schermata nuova in cui si
 *  sceglie un consulente chiama `consulentiPerConsulenza` invece di rifare il
 *  filtro a mano. Un secondo `filter(faConsulente)` scritto altrove è il modo in
 *  cui fra un mese le due schermate divergono senza che nessuno se ne accorga.
 *
 *  ── IL RIPIEGO, CIOÈ LA TRAPPOLA GIÀ VISTA SUGLI INSTALLATORI ─────────────
 *  I mestieri sono arrivati da poco (kpi-setter.ts) e oggi quasi nessuno ha le
 *  spunte a posto. Un filtro secco avrebbe svuotato ogni elenco il giorno del
 *  rilascio: nessuno assegnabile, nessuna consulenza fissabile, e in mano a chi
 *  lavora solo una tendina vuota da cui non si capisce che manca una spunta in
 *  un'altra pagina. È già successo con gli installatori (vedi `esecutoriPossibili`
 *  e `SenzaInstallatori` in InstallationScheduleDialog.tsx), con una differenza
 *  che decide la scelta opposta: là fermarsi è giusto — una posa affidata a chi
 *  non posa è un tecnico mandato a casa di un cliente — mentre qui fermarsi
 *  vorrebbe dire non poter assegnare NIENTE, cioè bloccare il CRM intero.
 *  Quindi finché in anagrafica non c'è NESSUN consulente segnato l'elenco NON si
 *  svuota: mostra tutti, e LO DICE con il percorso per accendere la spunta
 *  (`NotaSoloConsulenti` / `TESTO_SOLO_CONSULENTI` qui sotto). Il ripiego si
 *  spegne da sé nel momento in cui esiste il primo consulente segnato: non c'è
 *  nessuna riga da tornare a togliere, e nessuna data oltre la quale scade.
 *
 *  ⚠️ E CHI È GIÀ ASSEGNATO RESTA IN ELENCO anche senza spunta. Togliere dalla
 *  tendina il nome di chi ha in mano dei lead farebbe due danni in una volta:
 *  la scheda aperta mostrerebbe un campo vuoto al posto di una persona che ci
 *  sta lavorando, e il filtro non avrebbe più nessun modo di arrivare a quei
 *  lead — che resterebbero in archivio, assegnati, e irraggiungibili.
 *  È la stessa regola che driver e accompagnatori hanno già
 *  (`driverPossibili`, `accompagnatoriPossibili`): il mestiere decide chi si può
 *  SCEGLIERE ADESSO, mai chi è già scritto da qualche parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { mestieriDi } from "@/crm/kpi-setter";
import type { Consultant, Lead } from "@/crm/types";

/** Cosa torna a chi chiede l'elenco. `ripiego` non è un dettaglio da ignorare:
 *  è la differenza fra «questi sono i consulenti» e «non lo sa ancora nessuno,
 *  quindi ci sono tutti», e le due cose a schermo si vedono identiche. Chi lo
 *  riceve DEVE dirlo — per questo il campo non ha un valore predefinito
 *  comodo da dimenticare. */
export interface ElencoConsulenti {
  /** Chi si può scegliere adesso, nell'ordine in cui è arrivato. */
  elenco: Consultant[];
  /** true = nessuno è segnato consulente in anagrafica, quindi ci sono tutti.
   *  Va SEMPRE accompagnato a schermo da `NotaSoloConsulenti`. */
  ripiego: boolean;
}

/** Chi è già scritto da qualche parte e non deve sparire dall'elenco. Tutti i
 *  campi sono facoltativi perché i punti in cui si sceglie un consulente non
 *  hanno tutti le stesse cose in mano: la finestra del lead conosce il nome
 *  scelto, una pagina di elenco conosce i lead. */
export interface ChiResta {
  /** L'archivio da cui si leggono le assegnazioni già fatte (`consulenteId`).
   *  Serve ai FILTRI: senza, il nome di chi ha lead in mano ma non ha la spunta
   *  sparirebbe dalla barra e quei lead non si potrebbero più isolare. */
  leads?: Lead[];
  /** Id da tenere comunque: di norma quello già scelto sulla scheda aperta. */
  anche?: (string | null | undefined)[];
}

/** ── L'ELENCO DI CHI PUÒ FARE UNA CONSULENZA ───────────────────────────────
 *  Non filtra per «attivo»: quella è una domanda diversa e la fanno già (in modi
 *  diversi, e per buone ragioni) i punti che chiamano questa funzione. Qui si
 *  risponde a UNA domanda sola — chi fa le consulenze — perché una funzione che
 *  ne risponde a due diventa quella che nessuno sa più cosa nasconde.
 *  L'ordine di partenza non si tocca: le pagine ordinano già come vogliono, e
 *  un riordino qui dentro sposterebbe i nomi sotto le dita di chi li cerca. */
export function consulentiPerConsulenza(
  consulenti: Consultant[] | null | undefined,
  chiResta?: ChiResta,
): ElencoConsulenti {
  //  L'elenco si guarda prima di usarlo: arriva da un contesto che può non aver
  //  ancora caricato, e negli archivi importati una riga può essere nulla.
  const tutti = Array.isArray(consulenti) ? consulenti.filter(Boolean) : [];

  const segnati = new Set<string>();
  for (const c of tutti) if (mestieriDi(c.data).faConsulente) segnati.add(c.id);

  //  ⚠️ IL RIPIEGO SI DECIDE PRIMA di aggiungere chi è già assegnato, e l'ordine
  //  conta. Al contrario, su un'anagrafica senza nemmeno un consulente segnato,
  //  una scheda con un nome già scritto tornerebbe un elenco di UNA persona: non
  //  un ripiego ma un vicolo cieco travestito da elenco pieno, in cui l'unico
  //  assegnabile è quello che c'è già.
  if (segnati.size === 0) return { elenco: tutti, ripiego: true };

  const tenuti = new Set<string>();
  for (const id of chiResta?.anche ?? []) if (typeof id === "string" && id) tenuti.add(id);
  for (const l of chiResta?.leads ?? []) {
    const id = l?.data?.consulenteId;
    if (typeof id === "string" && id) tenuti.add(id);
  }

  return { elenco: tutti.filter((c) => segnati.has(c.id) || tenuti.has(c.id)), ripiego: false };
}

/** Comodità per i punti che vogliono solo l'elenco (una griglia di orari, un
 *  conteggio): la nota del ripiego la mostrano comunque, ma altrove nella
 *  schermata. Chi non ha bisogno nemmeno di quella sta usando la funzione
 *  sbagliata — vuol dire che sta filtrando qualcosa che non è una consulenza. */
export function soloConsulenti(
  consulenti: Consultant[] | null | undefined,
  chiResta?: ChiResta,
): Consultant[] {
  return consulentiPerConsulenza(consulenti, chiResta).elenco;
}

/** ── LA FRASE, SCRITTA UNA VOLTA SOLA ──────────────────────────────────────
 *  Serve in due forme perché i posti in cui compare sono di due tipi: dove c'è
 *  spazio si mostra il riquadro (`NotaSoloConsulenti`), dentro una tendina di
 *  sistema — dove non entra nient'altro che testo — si usa questa stringa in
 *  un'opzione spenta o in un `title`.
 *  Il percorso è scritto per esteso apposta: «manca una spunta» senza dire DOVE
 *  è un vicolo cieco educato. */
export const TESTO_SOLO_CONSULENTI =
  "Nessuno è ancora segnato come consulente, quindi qui ci sono tutti: " +
  "la spunta si accende in scheda del collaboratore → «Che mestiere fa» → «Fa il consulente».";

/** Il riquadro da mettere accanto all'elenco quando `ripiego` è true.
 *  ⚠️ Nessun hook qui dentro, e nemmeno un ritorno anticipato prima di uno:
 *  questo componente si monta dentro finestre e barre che si ridisegnano di
 *  continuo, ed è il posto giusto per NON aggiungere stato. Se `ripiego` è
 *  false non c'è niente da dire e non si occupa spazio. */
export function NotaSoloConsulenti({
  ripiego,
  className,
  children,
}: {
  ripiego: boolean;
  className?: string;
  /** una frase in più per il punto specifico, quando serve */
  children?: ReactNode;
}) {
  if (!ripiego) return null;
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5",
        "text-[11px] leading-snug text-amber-900",
        className,
      )}
    >
      <UserRound className="mt-px h-3 w-3 shrink-0 opacity-70" />
      <span className="min-w-0">
        {TESTO_SOLO_CONSULENTI}
        {children}
      </span>
    </p>
  );
}
