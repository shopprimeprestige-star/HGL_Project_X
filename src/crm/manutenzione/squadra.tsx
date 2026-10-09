/** ─────────────────────────────────────────────────────────────────────────
 *  CHI VA A FARE IL RITORNO — l'elenco, e cosa dire quando è vuoto
 *
 *  PERCHÉ UN FILE A PARTE E NON DENTRO LA FINESTRA
 *  Stessa ragione per cui `esecutoriPossibili` e `SenzaInstallatori` stanno
 *  accanto alla loro regola in crm/InstallationScheduleDialog: la domanda «chi
 *  può eseguire questo lavoro?» e la frase «non c'è nessuno, ecco dove si
 *  accende la spunta» sono la stessa decisione, e separarle è il modo in cui una
 *  delle due invecchia. Qui però non può stare in `regole.ts`, che è un file di
 *  funzioni PURE senza React: il riquadro del vicolo cieco ha bisogno di sapere
 *  se chi guarda può aprire l'anagrafica, e di portarcelo.
 *
 *  ⚠️ QUI NON C'È NESSUN SECONDO ELENCO DI MESTIERI. Chi affianca e chi guida si
 *  chiedono a `accompagnatoriPossibili` e `driverPossibili`, che esistono già per
 *  le pose e leggono le stesse spunte: sono lo STESSO mestiere fatto in un altro
 *  momento della giornata, e una coppia di funzioni gemelle scritta qui avrebbe
 *  prodotto due elenchi che un giorno divergono — con la conseguenza che una
 *  persona è scegliibile sulla posa e non sul ritorno, o viceversa.
 *  Il manutentore invece è un mestiere suo e la sua funzione nasce qui.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
//  «Può aprire l'anagrafica?» — serve solo a non offrire un pulsante che porta a
//  una pagina che dirà di no. Nasconde, non difende: il no vero lo dà la guardia
//  della rotta (crm/permessi.ts).
import { usePuo } from "../AuthContext";
import { mestieriDi } from "../kpi-setter";
import type { Consultant } from "../types";
import { NotaFinestra, VuotoFinestra } from "../ui/Finestra";

/** Perché «Chi la esegue» non ha nessuno da proporre. `null` = ce l'ha.
 *  Sono due mancanze diverse perché si riparano in due modi diversi — una
 *  persona da aggiungere in anagrafica, oppure una spunta da accendere su una
 *  persona che c'è già — e dirle con la stessa frase manderebbe metà delle volte
 *  nel posto sbagliato. È la stessa distinzione di `MancaEsecutore` per le pose,
 *  e vale la pena ripeterla: senza, la finestra direbbe «nessuno» e basta. */
export type MancaManutentore = "nessuno_in_anagrafica" | "nessun_manutentore" | null;

/** ── CHI PUÒ ESEGUIRE UN RITORNO ───────────────────────────────────────────
 *  SOLO I MANUTENTORI, SENZA SCORCIATOIE — la stessa porta chiusa che le pose
 *  hanno già. Prima di oggi in «Chi la esegue» comparivano TUTTI i consulenti
 *  attivi: bastava aprire la procedura e il primo nome dell'elenco si prendeva
 *  un'ora di agenda per un lavoro che magari non fa. Adesso ci compare chi è
 *  segnato manutentore, e nessun altro.
 *  ⚠️ E se non c'è nessuno l'elenco resta VUOTO, che qui vuol dire «non si fissa
 *  niente»: è un vicolo cieco e va detto come tale, non lasciato come scatola
 *  vuota. Per questo non si restituisce solo l'elenco ma anche PERCHÉ è vuoto —
 *  il testo e la via d'uscita stanno in `SenzaManutentori`, qui sotto.
 *  ⚠️ La domanda si fa sull'ANAGRAFICA e non su questo cliente: appena una
 *  persona qualsiasi viene segnata manutentore la schermata del vicolo cieco
 *  sparisce da sé, su tutte le schede, senza che nessuno debba tornare qui.
 *  ⚠️ Chi è già scritto su questo ritorno resta in elenco anche se nel frattempo
 *  è stato disattivato o gli è stato tolto il mestiere: riaprire un ritorno per
 *  spostarlo non deve svuotare il campo facendo credere che quella persona sia
 *  sparita dal CRM. */
export function manutentoriPossibili(
  consulenti: Consultant[],
  sceltoId?: string,
): { elenco: Consultant[]; manca: MancaManutentore } {
  const attivi = consulenti.filter((c) => c.data.attivo);
  const manutentori = attivi.filter((c) => mestieriDi(c.data).faManutentore);
  //  Si confrontano gli id e non gli oggetti: due letture dello stesso
  //  consulente non sono lo stesso oggetto.
  const scelto = sceltoId ? consulenti.find((c) => c.id === sceltoId) : undefined;
  const elenco =
    scelto && !manutentori.some((c) => c.id === scelto.id) ? [...manutentori, scelto] : manutentori;
  //  Il motivo si guarda sugli ATTIVI e non sull'elenco appena composto: «non
  //  c'è nessuno in anagrafica» e «ci sono persone ma nessuna fa manutenzioni»
  //  portano in due punti diversi della stessa pagina.
  const manca: MancaManutentore =
    elenco.length > 0 ? null : attivi.length === 0 ? "nessuno_in_anagrafica" : "nessun_manutentore";
  return { elenco, manca };
}

/** ── IL VICOLO CIECO SI DICE, E SI APRE ────────────────────────────────────
 *  Gemello di `SenzaInstallatori` e scritto con lo stesso criterio: un elenco
 *  vuoto, da solo, è una scatola vuota — chi la trova non ha modo di sapere che
 *  quello che manca è una spunta, né che quella spunta sta in un'altra pagina.
 *  Questo riquadro dice in una riga COSA manca e il percorso esatto per
 *  accenderlo — scheda del consulente → «Che mestiere fa» → «Fa le
 *  manutenzioni» — e poi ci porta, invece di lasciarlo cercare.
 *
 *  ⚠️ IL PULSANTE SI VEDE SOLO SE PORTA DAVVERO DA QUALCHE PARTE. L'anagrafica è
 *  dietro il permesso `consulenti`: a chi non ce l'ha aprirebbe una pagina che
 *  dice di no, cioè un secondo vicolo cieco dentro il primo. A quella persona si
 *  dice invece a chi chiederlo, che è l'unica cosa vera che può fare.
 *  ⚠️ Prima di cambiare pagina la finestra da cui si parte va CHIUSA, o resta
 *  aperta sopra l'anagrafica e copre proprio la scheda da aprire: chi lo monta
 *  passa `primaDiAndare`. */
export function SenzaManutentori({
  manca,
  primaDiAndare,
  className,
}: {
  manca: MancaManutentore;
  /** cosa fare prima di cambiare pagina (di norma: chiudere la finestra) */
  primaDiAndare?: () => void;
  className?: string;
}) {
  //  ⚠️ Gli hook stanno SOPRA il ritorno anticipato: React li conta per
  //  posizione, e uno saltato in un render sposta tutti gli altri.
  const navigate = useNavigate();
  const puoAprireAnagrafica = usePuo()("consulenti");
  if (!manca) return null;

  const vai = () => {
    primaDiAndare?.();
    void navigate({ to: "/CRM/consulenti" });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <VuotoFinestra
        icona={Repeat}
        testo={
          manca === "nessuno_in_anagrafica" ? (
            <>
              <strong>Non c&apos;è nessun consulente attivo</strong>, quindi non c&apos;è nessuno a
              cui affidare il ritorno: si aggiunge la persona in anagrafica e le si accende{" "}
              <strong>scheda del consulente → «Che mestiere fa» → «Fa le manutenzioni»</strong>.
            </>
          ) : (
            <>
              <strong>Nessuno è ancora segnato come manutentore</strong> e il ritorno non si affida
              a chi non lo fa: la spunta si accende in{" "}
              <strong>scheda del consulente → «Che mestiere fa» → «Fa le manutenzioni»</strong>. È
              una spunta a sé: non basta che la persona sia installatore.
            </>
          )
        }
      />
      {puoAprireAnagrafica ? (
        <Button variant="outline" onClick={vai} className="w-full">
          {/*  «Collaboratori» è il nome che quella sezione ha nel menu: qui si va
              a segnare un MANUTENTORE, e mandarci con la parola "consulenti"
              fa sembrare di aver sbagliato porta. */}
          Apri l&apos;anagrafica dei collaboratori <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ) : (
        //  Niente pulsante che non porta da nessuna parte: si dice chi può.
        <NotaFinestra tono="attenzione" icona={Repeat}>
          {/*  Il PERMESSO si chiama ancora «consulenti» (crm/permessi.ts) e non
              si rinomina: è una chiave scritta nei PIN già assegnati. Qui si
              nomina per esteso quello che concede, così la frase non manda a
              cercare una spunta con un nome che nella schermata dei permessi non
              c'è. */}
          L&apos;anagrafica dei collaboratori si apre solo con il permesso{" "}
          <strong>«Gestire consulenti, PIN e permessi»</strong>: la spunta va chiesta a chi ce
          l&apos;ha.
        </NotaFinestra>
      )}
    </div>
  );
}
