/** ── /CRM/importa-lead — LA SCHEDA CHE IMPORTA I CONTATTI ──────────────────
 *
 *  Richiesta del committente: «aggiungi una scheda per importare lead, che poi
 *  andranno su lead importati».
 *
 *  ── ⚠️ PERCHÉ NON BASTAVA QUELLO CHE C'ERA ───────────────────────────────
 *  Il pannello per caricare un CSV esisteva già, ma stava in due posti in cui
 *  nessuno lo trova: dietro un pulsante da premere nella testata della coda di
 *  chiamata, e dentro il riquadro della giornata. Peggio: chiedeva il permesso
 *  «Creare nuovi lead», che il SETTER non ha mai avuto — cioè era invisibile
 *  proprio alla persona il cui mestiere è lavorare una lista. Chi doveva
 *  caricarla chiedeva a un admin di farlo per lui.
 *  Adesso è una schermata sua, con la sua riga nel menu, e il setter ce l'ha
 *  (vedi BASE_SETTER in crm/permessi.ts).
 *
 *  ── ⚠️ DOVE FINISCONO I CONTATTI, DETTO PRIMA E DETTO DOPO ───────────────
 *  In «Lead importati», che è la coda di chiamata. È l'unica domanda che si fa
 *  chi carica un file — «e adesso dove sono?» — e resta senza risposta in ogni
 *  schermata che importa e poi tace: la si scrive in cima, prima di caricare, e
 *  la si ripete col pulsante che ci porta, finito.
 *
 *  ── ⚠️ IL PANNELLO È LO STESSO, NON UNA COPIA ────────────────────────────
 *  `PannelloCarica` (crm/importa/PannelloCarica) è esattamente quello della
 *  coda. Due schermate che leggono un CSV con due pezzi di codice diversi
 *  diventano, al primo ritocco, due schermate che importano in modo diverso — e
 *  la differenza si scopre sulle schede dei clienti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Link, createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, PhoneCall, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePuo } from "@/crm/AuthContext";
import { PannelloCarica } from "@/crm/importa/PannelloCarica";
import { Pagina, Scheda, Titolo, Vuoto } from "@/crm/ui";

export const Route = createFileRoute("/CRM/importa-lead")({ component: ImportaLeadPage });

function ImportaLeadPage() {
  const puo = usePuo();
  //  ⚠️ La pagina si apre anche scrivendo l'indirizzo: il menu nasconde la
  //   voce, ma nascondere non è difendere. Qui si dice che cosa manca e a chi
  //   chiederlo, invece di mostrare un modulo che poi non scrive.
  if (!puo("lead.crea")) {
    return (
      <Pagina>
        <Titolo
          testo="Importa lead"
          nota="Carichi una lista di contatti e finiscono nella coda di chiamata"
          icona={Upload}
        />
        <Vuoto
          titolo="Non puoi caricare liste"
          testo="I nuovi contatti li carica chi ha il permesso «Creare nuovi lead». Chiedilo a un admin: si accende dalla tua scheda, in Collaboratori."
          icona={Upload}
        />
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Titolo
        testo="Importa lead"
        nota="Carichi il file, guardi l'anteprima, importi. I contatti finiscono in «Lead importati»."
        icona={Upload}
        azioni={
          //  La porta verso il posto in cui finiscono: sta in cima perché la
          //  domanda «dove vanno?» viene PRIMA di caricare, non dopo.
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/CRM/importa">
              <PhoneCall className="mr-1 h-3.5 w-3.5" /> Vai ai lead importati
            </Link>
          </Button>
        }
      />

      <Scheda
        titolo="Carica una lista"
        nota="Sceglierla non scrive nulla: prima si guarda l'anteprima, poi si importa"
        icona={FileSpreadsheet}
      >
        {/*  ⚠️ `onLetti` qui non serve a niente e va passato lo stesso: nella
             coda di chiamata segna i contatti «di ritorno» per metterli in
             cima al giro. Qui non c'è nessun giro da riordinare — si carica e
             si va a chiamare dall'altra schermata — quindi si accetta e si
             lascia cadere, invece di far finta che il pannello sia un altro. */}
        <PannelloCarica onLetti={() => {}} />
      </Scheda>
    </Pagina>
  );
}
