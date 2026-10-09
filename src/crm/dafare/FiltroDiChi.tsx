/** ── DI CHI SONO LE COSE DA FARE ───────────────────────────────────────────
 *
 *  Il filtro per persona era un menu a tendina, ed era la scelta sbagliata per
 *  due motivi che si vedono solo usandolo: una tendina si apre, copre la
 *  pagina, va scorsa e mostra i nomi come righe di testo tutte uguali — quindi
 *  per sapere chi è setter e chi consulente bisogna leggerle una per una. E
 *  soprattutto NON PUÒ DIRE QUANTO: la cosa che serve davvero prima di
 *  scegliere è «quante cose ha da fare questa persona», e un `<option>` non ha
 *  posto per un numero che si legga.
 *
 *  Qui è un riquadro diviso in tre blocchi, nell'ordine in cui si cerca:
 *   · TUTTO IL CENTRO, che è il modo di tornare indietro;
 *   · PER MESTIERE, due tessere grandi — i setter e i consulenti — perché
 *     «fammi vedere la giornata dei setter» è la domanda che si fa un titolare
 *     al mattino, e non deve costare la caccia a un nome;
 *   · PER PERSONA, una tessera a testa con le iniziali, il nome e il mestiere.
 *
 *  Ogni tessera porta il SUO numero, e il numero è quello che si otterrebbe
 *  premendola — cioè calcolato con gli altri filtri accesi ma non con questo.
 *  Una tessera a zero non si nasconde: si spegne. Sapere che una persona non ha
 *  niente da fare è un'informazione, scoprirlo premendo e trovando il vuoto è
 *  una perdita di tempo.
 *
 *  ⚠️ CHI NON HA NESSUNO ASSEGNATO HA LA SUA TESSERA. Un filtro che si accende
 *   e fa sparire trenta righe senza dire dove sono andate è il modo più veloce
 *   per far smettere di fidarsi dei numeri in cima alla pagina.
 */
import { useState } from "react";
import { PhoneCall, UserRound, UserRoundX, Users, Video } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Pannello } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";

export interface PersonaFiltro {
  id: string;
  nome: string;
  setter: boolean;
  consulente: boolean;
  /** ── ⚠️ QUALCUNO L'HA DETTO, O LO STIAMO INDOVINANDO? ─────────────────
   *  Il mestiere è una spunta sulla scheda del collaboratore, e su parecchie
   *  schede non l'ha mai messa nessuno: lì `faConsulente` risponde «sì» per
   *  ripiego, non perché qualcuno l'abbia scelto. Tenere insieme le due cose
   *  vuol dire un filtro «Consulenti» che comprende gente che non si sa cosa
   *  faccia — cioè la lista che il committente vede «tutta insieme». */
  dichiarato: boolean;
}

export interface ConteggiFiltro {
  /** quante per ogni persona, per id */
  perPersona: Map<string, number>;
  setter: number;
  consulente: number;
  /** Di chi ha la scheda assegnata a qualcuno che non ha un mestiere spuntato.
   *  ⚠️ Serve perché i conti TORNINO: setter + consulenti + questi + senza
   *   assegnazione fa il totale. Senza questa casella quelle righe non
   *   stavano in nessun mestiere e sparivano da ogni filtro tranne «tutto», che
   *   è il modo più rapido di far smettere di fidarsi dei numeri. */
  senzaMestiere: number;
  nessuno: number;
  tutte: number;
}

/** Le iniziali: due lettere bastano a riconoscere un collega in una griglia, e
 *  una foto qui non c'è. */
const iniziali = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const mestiereInChiaro = (p: PersonaFiltro): string =>
  //  ⚠️ «mestiere non indicato» non è un dettaglio da nascondere: è la ragione
  //   per cui questa persona non compare né fra i setter né fra i consulenti,
  //   e detta qui si capisce in un colpo invece di sembrare un guasto.
  !p.dichiarato || (!p.setter && !p.consulente)
    ? "mestiere non indicato"
    : p.setter && p.consulente
      ? "setter e consulente"
      : p.setter
        ? "setter"
        : "consulente";

/** Una tessera. Uguale per tutti e tre i blocchi — è quello che le fa leggere
 *  come un unico elenco a griglia invece che come tre elenchi diversi. */
function Tessera({
  attiva,
  vuota,
  icona,
  titolo,
  sotto,
  numero,
  onClick,
}: {
  attiva: boolean;
  vuota: boolean;
  icona: React.ReactNode;
  titolo: string;
  sotto?: string;
  numero: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      //  Una tessera a zero resta premibile solo se è quella accesa: serve a
      //  poterla spegnere. Altrimenti è spenta, e si vede che è spenta.
      disabled={vuota && !attiva}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
        attiva
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent/50",
        vuota && !attiva && "opacity-45",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
          attiva ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icona}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-foreground">{titolo}</span>
        {sotto && <span className="block truncate text-[11px] text-muted-foreground">{sotto}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold tabular-nums",
          attiva ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {numero}
      </span>
    </button>
  );
}

export function FiltroDiChi({
  valore,
  persone,
  conteggi,
  onScegli,
}: {
  /** "" = tutti · "ruolo:setter" · "ruolo:consulente" · "nessuno" · id persona */
  valore: string;
  persone: PersonaFiltro[];
  conteggi: ConteggiFiltro;
  onScegli: (v: string) => void;
}) {
  const [aperto, setAperto] = useState(false);

  const scelta = persone.find((p) => p.id === valore);
  const etichetta =
    valore === ""
      ? "Tutti"
      : valore === "ruolo:setter"
        ? "Tutti i setter"
        : valore === "ruolo:consulente"
          ? "Tutti i consulenti"
          : valore === "nessuno"
            ? "Senza assegnazione"
            : (scelta?.nome ?? "Tutti");

  const scegli = (v: string) => {
    setAperto(false);
    onScegli(v);
  };

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Mostra solo le cose da fare di un mestiere o di una persona"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition",
            valore
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="h-3.5 w-3.5" />
          {/*  Il pulsante dice SEMPRE chi è selezionato, anche da chiuso: un
              filtro acceso che non si vede è la causa numero uno delle liste
              «vuote» che vuote non sono. */}
          <span className="max-w-[9rem] truncate">{etichetta}</span>
        </button>
      </PopoverTrigger>
      <Pannello
        side="bottom"
        align="start"
        className="w-[23rem] max-w-[calc(100vw-2rem)]"
        titolo="Di chi sono le cose da fare"
        contesto={`${conteggi.tutte} in tutto`}
        classeCorpo="flex flex-col gap-3"
      >
        <Tessera
          attiva={valore === ""}
          vuota={false}
          icona={<Users className="h-4 w-4" />}
          titolo="Tutto il centro"
          sotto="Nessun filtro"
          numero={conteggi.tutte}
          onClick={() => scegli("")}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Per mestiere
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <Tessera
              attiva={valore === "ruolo:setter"}
              vuota={conteggi.setter === 0}
              icona={<PhoneCall className="h-4 w-4" />}
              titolo="Setter"
              sotto="Tutti"
              numero={conteggi.setter}
              onClick={() => scegli("ruolo:setter")}
            />
            <Tessera
              attiva={valore === "ruolo:consulente"}
              vuota={conteggi.consulente === 0}
              icona={<Video className="h-4 w-4" />}
              titolo="Consulenti"
              sotto="Tutti"
              numero={conteggi.consulente}
              onClick={() => scegli("ruolo:consulente")}
            />
          </div>
          {/*  ── ⚠️ E CHI NON HA UN MESTIERE SPUNTATO ────────────────────
              Segnalazione del committente: «correggi perché ora mette tutto
              insieme». Era vero, e il motivo stava qui: chi sulla sua scheda
              non ha né setter né consulente non entrava in nessuno dei due
              riquadri E non aveva nemmeno una tessera sua — le sue cose da
              fare si potevano vedere solo da «Tutto il centro», mescolate a
              tutte le altre.
              Adesso hanno la loro casella, con il numero, e la riga dice dove
              si sistema: è una spunta sulla scheda del collaboratore, non un
              guasto di questa pagina. */}
          {conteggi.senzaMestiere > 0 && (
            <Tessera
              attiva={valore === "ruolo:senza"}
              vuota={false}
              icona={<UserRound className="h-4 w-4" />}
              titolo="Mestiere non indicato"
              sotto="Da spuntare sulla scheda del collaboratore"
              numero={conteggi.senzaMestiere}
              onClick={() => scegli("ruolo:senza")}
            />
          )}
        </div>

        {persone.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Per persona
            </span>
            {/*  Una colonna sola: i nomi vanno letti, e due colonne di nomi
                lunghi si troncano a metà proprio dove si distinguono. */}
            <div className="flex max-h-[15rem] flex-col gap-1.5 overflow-y-auto pr-0.5">
              {persone.map((p) => (
                <Tessera
                  key={p.id}
                  attiva={valore === p.id}
                  vuota={(conteggi.perPersona.get(p.id) ?? 0) === 0}
                  icona={<span>{iniziali(p.nome)}</span>}
                  titolo={p.nome}
                  sotto={mestiereInChiaro(p)}
                  numero={conteggi.perPersona.get(p.id) ?? 0}
                  onClick={() => scegli(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {conteggi.nessuno > 0 && (
          <Tessera
            attiva={valore === "nessuno"}
            vuota={false}
            icona={<UserRoundX className="h-4 w-4" />}
            titolo="Senza assegnazione"
            sotto="Schede che non sono di nessuno"
            numero={conteggi.nessuno}
            onClick={() => scegli("nessuno")}
          />
        )}

        {persone.length === 0 && (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
            <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Nessuno risulta segnato come setter o consulente. I mestieri si spuntano sulla scheda
              di ogni collaboratore.
            </span>
          </p>
        )}
      </Pannello>
    </Popover>
  );
}
