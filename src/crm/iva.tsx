/** ── L'IVA: UNA REGOLA SOLA PER TRE FINESTRE ───────────────────────────────
 *
 *  L'IVA si chiedeva in un posto solo — la finestra dell'incasso del saldo — e
 *  con una domanda a due risposte: «questo incasso comprende l'IVA?» sì / no.
 *  Andava bene finché l'unica cosa che l'IVA cambiava era il MARGINE: sì =
 *  scorpora prima di sottrarre i costi, no = conta per intero.
 *
 *  ⚠️ MA I CASI VERI SONO TRE, NON DUE, e il terzo cambia quello che il cliente
 *   deve pagare — non solo quello che noi guadagniamo:
 *    · AGGIUNTA  — il prezzo pattuito è al netto e l'IVA si somma. Il totale
 *      SALE del 22%: mille euro diventano milleduecentoventi, e il cliente ne
 *      deve ancora duecentoventi.
 *    · INCLUSA   — il prezzo li comprende già. Il totale NON si muove; l'IVA si
 *      scorpora dentro, e la vede solo il margine.
 *    · SENZA     — non se ne applica. Il totale non si muove e nel margine
 *      l'incasso entra per intero.
 *   Le ultime due erano le vecchie «sì» e «no». La prima non c'era, e la sua
 *   mancanza si pagava a mano: si riapriva l'importo totale, si moltiplicava per
 *   1,22 con la calcolatrice del telefono e si riscriveva la cifra — con l'ovvia
 *   conseguenza che chi si dimenticava di farlo chiudeva la pratica al netto e
 *   il ventidue per cento non lo chiedeva più nessuno.
 *
 *  ── PERCHÉ STA IN UN FILE SUO ─────────────────────────────────────────────
 *  Perché adesso la stessa domanda si fa in TRE momenti diversi, e sono tre
 *  file diversi:
 *   · quando si registra l'acconto           (crm/QuickStatusDialog)
 *   · quando si chiude la vendita            (crm/ChiusuraDialog)
 *   · quando la posa è fatta e si salda      (crm/InstallationScheduleDialog)
 *  Tre copie del ventidue per cento in tre file è la ricetta certa per cui, il
 *  giorno in cui l'aliquota cambia o si aggiunge un caso, due schermate su tre
 *  fanno il conto vecchio e nessuno se ne accorge fino alla dichiarazione.
 *  Qui c'è il conto e c'è la domanda a schermo; chi la monta decide solo su
 *  quale cifra farla.
 *
 *  ⚠️ QUI NON SI SCRIVE NIENTE. Nessun `updateLead`, nessun `payment`: questo
 *   file sa fare un conto e disegnare tre riquadri. Chi salva è chi possiede la
 *   pratica — ed è anche l'unico che sa se quella cifra è un acconto, un saldo o
 *   un totale.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Banknote, Percent, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "./ui";
import { VoceScelta } from "./ui/Finestra";

/** L'aliquota ordinaria. ⚠️ È l'UNICO posto in cui il numero 22 vuol dire
 *  «IVA» in tutto il CRM che scrive: `kpi-netto` ne ha una sua per LEGGERE gli
 *  archivi vecchi (`ALIQUOTA_IVA_PREDEFINITA`, il ripiego per le schede che
 *  dicono «con IVA» senza dire quanta), e le due restano separate apposta —
 *  cambiare l'aliquota di domani non deve riscrivere il passato. */
export const ALIQUOTA_IVA = 22;

/** I tre modi in cui l'IVA può stare dentro una cifra pattuita. */
export type ModoIva = "aggiunta" | "inclusa" | "senza";

/** L'ordine in cui si presentano, e non è alfabetico: prima quella che CAMBIA
 *  il totale — perché è la sola che va scelta con attenzione — poi le due che
 *  lo lasciano dov'è. */
export const MODI_IVA: ModoIva[] = ["aggiunta", "inclusa", "senza"];

/** ⚠️ IL RIPIEGO È «inclusa», E NON È NEUTRO. È la traduzione fedele di quello
 *  che il CRM salvava prima: `payment.costi.ivaInclusa = true`, cioè «il prezzo
 *  la comprende». Mettere «aggiunta» come predefinito farebbe salire del 22% il
 *  totale di chiunque prema invio senza guardare, e un totale che cresce da solo
 *  è la cosa peggiore che possa succedere fra noi e un cliente. */
export const MODO_IVA_PREDEFINITO: ModoIva = "inclusa";

export interface ContoIva {
  modo: ModoIva;
  /** l'aliquota applicata: 22, oppure 0 senza IVA */
  aliquota: number;
  /** la cifra su cui si calcola il margine, IVA tolta */
  imponibile: number;
  /** quanto di quel totale è IVA */
  imposta: number;
  /** quello che il cliente paga davvero */
  totale: number;
  /** vero quando il totale è diverso dalla cifra di partenza: serve a chi
   *  disegna, per dire «attenzione, questa scelta cambia il prezzo» */
  cambiaIlTotale: boolean;
}

/** L'unico posto in cui i centesimi si arrotondano. Senza, «1000 × 1,22» in
 *  virgola mobile può uscire 1219,9999999999998 e finire scritto così in cassa. */
const centesimi = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Il conto, dato quello che è stato PATTUITO e come ci sta dentro l'IVA.
 *  `base` è sempre la cifra scritta a mano da chi vende: con «aggiunta» è un
 *  imponibile, con le altre due è già il totale. */
export function contoIva(base: number, modo: ModoIva): ContoIva {
  const b = Math.max(0, Number(base) || 0);
  if (modo === "aggiunta") {
    const imposta = centesimi((b * ALIQUOTA_IVA) / 100);
    return {
      modo,
      aliquota: ALIQUOTA_IVA,
      imponibile: centesimi(b),
      imposta,
      totale: centesimi(b + imposta),
      cambiaIlTotale: imposta > 0,
    };
  }
  if (modo === "inclusa") {
    const imponibile = centesimi(b / (1 + ALIQUOTA_IVA / 100));
    return {
      modo,
      aliquota: ALIQUOTA_IVA,
      imponibile,
      imposta: centesimi(b - imponibile),
      totale: centesimi(b),
      cambiaIlTotale: false,
    };
  }
  return {
    modo,
    aliquota: 0,
    imponibile: centesimi(b),
    imposta: 0,
    totale: centesimi(b),
    cambiaIlTotale: false,
  };
}

/** Il vecchio interruttore a due posizioni, per chi legge il margine.
 *  ⚠️ «aggiunta» vale `true`: l'IVA c'è, e nel totale scritto in cassa ci sta
 *   dentro — il fatto che ce l'abbiamo messa noi un minuto fa non cambia come si
 *   scorpora dopo. Confonderlo con `false` farebbe contare come ricavo anche i
 *   duecentoventi euro dello Stato. */
export function conIvaBool(modo: ModoIva): boolean {
  return modo !== "senza";
}

/** Il verso opposto: come si legge una pratica salvata prima che i modi
 *  fossero tre. Un archivio non può dire «aggiunta» — quella scelta cambia il
 *  totale, e il totale lì è già scritto — quindi si torna alle due vecchie. */
export function modoDaBooleano(conIva: boolean | null | undefined): ModoIva {
  return conIva ? "inclusa" : "senza";
}

const TESTI: Record<ModoIva, { titolo: string; nota: (c: ContoIva, base: number) => string }> = {
  aggiunta: {
    titolo: `Aggiungi IVA ${ALIQUOTA_IVA}%`,
    nota: (c, base) => `${eur(base)} + ${eur(c.imposta)} di IVA: il cliente paga ${eur(c.totale)}`,
  },
  inclusa: {
    titolo: "IVA già inclusa nel prezzo",
    nota: (c) => `Il totale non cambia: dentro ci sono ${eur(c.imposta)} di IVA`,
  },
  senza: {
    titolo: "Senza IVA",
    nota: (c) => `Il totale non cambia: ${eur(c.totale)}, niente IVA da scorporare`,
  },
};

/** ── LA DOMANDA, A SCHERMO ─────────────────────────────────────────────────
 *  Tre riquadri, uno per modo, ognuno con IL CONTO GIÀ FATTO sulla cifra vera
 *  di questa pratica. Non è decorazione: «Aggiungi IVA 22%» da solo obbliga chi
 *  legge a moltiplicare a mente mille per 1,22 mentre il cliente aspetta, e a
 *  mente si sbaglia. Con la cifra scritta, la scelta si fa guardando il numero
 *  che si sta per chiedere.
 *
 *  ⚠️ SI SCEGLIE, NON SI CONFERMA: premere un riquadro cambia solo il modo, e la
 *   scrittura resta al pulsante della finestra che lo ospita. Nella finestra
 *   dell'incasso era il contrario — premere la risposta SALVAVA — ed era giusto
 *   finché le risposte erano due e nessuna toccava il prezzo. Con «aggiunta» in
 *   mezzo, un tocco per sbaglio alzerebbe il totale del 22% e lo salverebbe
 *   nello stesso gesto. */
export function ScegliIva({
  modo,
  onCambia,
  /** la cifra pattuita su cui si fa il conto: un acconto, un saldo, un totale */
  base,
  /** ── ⚠️ QUALI RISPOSTE OFFRIRE ────────────────────────────────────────
   *  Non tutte le schermate hanno le stesse tre. Dove si REGISTRA UNA VENDITA
   *  le risposte vere sono due — il prezzo l'IVA ce l'ha dentro, oppure si
   *  aggiunge — e «senza IVA» è una terza strada che allunga la scelta senza
   *  cambiare il totale: chi la premeva per sbaglio non se ne accorgeva,
   *  perché a schermo non succede niente.
   *  Resta disponibile dove serve davvero (l'incasso del saldo, dove una parte
   *  può essere fuori campo IVA): la decide chi monta la domanda, non questo
   *  file. */
  modi = MODI_IVA,
  className,
}: {
  modo: ModoIva;
  onCambia: (m: ModoIva) => void;
  base: number;
  modi?: ModoIva[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {modi.map((m) => {
        const c = contoIva(base, m);
        const Icona = m === "aggiunta" ? PlusCircle : m === "inclusa" ? Percent : Banknote;
        return (
          <VoceScelta
            key={m}
            icona={Icona}
            titolo={TESTI[m].titolo}
            nota={base > 0 ? TESTI[m].nota(c, base) : undefined}
            selezionata={modo === m}
            onClick={() => onCambia(m)}
            //  La cifra a destra è SEMPRE il totale che ne esce: è il numero da
            //  confrontare fra i tre riquadri, e va incolonnato. Quello che
            //  cambia sale in grassetto — è l'unico che merita un secondo
            //  sguardo prima di premere.
            coda={
              base > 0 ? (
                <span
                  className={cn("tabular-nums", c.cambiaIlTotale && "font-semibold text-slate-900")}
                >
                  {eur(c.totale)}
                </span>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
