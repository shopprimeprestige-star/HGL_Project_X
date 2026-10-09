// ── CONSULENTI ──────────────────────────────────────────────────────────────
//  A COSA RISPONDE
//  «Chi sta lavorando meglio, e su cosa». Non è un tabellone: in cima c'è la
//  risposta in una riga (chi chiude di più e chi chiude meglio), sotto il
//  confronto persona per persona.
//
//  ── I NUMERI NON SONO NUOVI ───────────────────────────────────────────────
//  Vengono tutti da `calcolaMetricheConsulenti` di kpi-calcoli, la trascrizione
//  fedele del CRM aziendale: stessa funzione, stesso periodo, stessa data di
//  attribuzione del riepilogo. Qui non si calcola niente — un numero diverso da
//  quello a cui l'azienda è abituata non viene creduto, anche quando è più
//  giusto.
//  Questa scheda ha SOSTITUITO la tabella «KPI consulente» che stava dentro KPI
//  manuale: era la stessa funzione con le stesse colonne, in una scheda dove
//  nessuno andava a cercarla.
//
//  ── DUE MESTIERI, DUE TABELLE ─────────────────────────────────────────────
//  In cima si sceglie: Consulenti o Setter. Non è un filtro sulle stesse
//  righe — sono due tabelle con colonne diverse, perché il setter risponde di
//  quanti appuntamenti mette in agenda e il consulente di quante consulenze
//  diventano clienti. In una tabella sola, chi telefona tutto il giorno
//  risulterebbe l'ultimo di una classifica che non misura il suo lavoro.
//  Una persona può fare entrambi i mestieri e comparire in tutte e due, con
//  numeri diversi. I numeri del setter NON vengono da kpi-calcoli (là non
//  esistono): stanno in crm/kpi-setter.ts, e ognuno è dichiarato lì.
//
//  ── DUE COSE DA SAPERE PRIMA DI CONFRONTARE ───────────────────────────────
//   · il TASSO DI CONVERSIONE è clienti ÷ consulenze SVOLTE: il consulente non
//     decide quanti lead riceve né chi si presenta;
//   · la colonna Lead conta tutti i lead assegnati, no show compresi, perché è
//     su quel numero che si ripartisce la spesa pubblicitaria. Non somma quindi
//     con «Lead entrati» della scheda «Ritorno», che i no show li esclude.
//
//  ── LA SPESA È QUELLA DELLE ALTRE SCHEDE ──────────────────────────────────
//  ⚠️ Prima questa scheda passava a `calcolaMetricheConsulenti` le sole spese
//  scritte a mano (quelle di CRMContext): la spesa attribuita e il costo per
//  cliente per consulente nascevano quindi da una spesa DIVERSA da quella della
//  scheda «Ritorno», che è lo stesso difetto per cui la pagina aveva due
//  «costo per cliente». Adesso riceve il registro unico (./useRegistroSpesa).
import { useMemo, useState } from "react";
import { PhoneCall, Users } from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import { Dato, Scheda, Segmento, VuotoRiga, eur } from "@/crm/ui";
import {
  calcolaMetricheConsulenti,
  calcolaMetricheGenerali,
  type MetricheConsulente,
  type Intervallo,
} from "@/crm/kpi-calcoli";
import { calcolaMetricheSetter, mestieriDi, totaliSetter } from "@/crm/kpi-setter";
import { ConfrontoSetter, NotaAttribuzioneSetter } from "@/crm/kpi/setter-pezzi";
import { CONSULENZE_MINIME, CVR_BASSO, VOLUME_MINIMO_LPS } from "@/crm/kpi/soglie";
import { conBase, euroPreciso, pct } from "@/crm/kpi/basi";
import { useRegistroSpesa } from "@/crm/kpi/useRegistroSpesa";
import { NumeroChiave } from "@/crm/kpi/pezzi";

/** ── QUANDO IL TASSO È UN PROBLEMA ─────────────────────────────────────────
 *  Il colore compare solo se il denominatore è abbastanza grande da voler dire
 *  qualcosa: una consulenza sola andata male fa 0% e non è una notizia. Le due
 *  soglie stanno in `@/crm/kpi/soglie` perché le usa anche il riquadro
 *  «Conversione» della scheda «Da fare»: lo stesso numero non può cambiare
 *  colore cambiando linguetta. */
function classeCvr(cvr: number, consulenze: number): string | undefined {
  if (consulenze < CONSULENZE_MINIME) return undefined;
  return cvr < CVR_BASSO ? "text-rose-700" : undefined;
}

export function ConsulentiScheda({ intervallo }: { intervallo: Intervallo }) {
  const { leads, consultants } = useCRM();
  //  ⚠️ TUTTI GLI HOOK SOPRA I RETURN ANTICIPATI. Da quando esistono le due
  //  viste un return anticipato c'è (quella dei setter), e sta DOPO l'ultimo
  //  hook e dopo tutti i calcoli: spostare un useMemo sotto di esso lo farebbe
  //  sparire dalla lista degli hook a ogni cambio di vista, e React smette di
  //  funzionare senza dire una parola.
  const { registro, dentro } = useRegistroSpesa(intervallo);
  //  Chi non ha ricevuto lead nel periodo resta fuori per non allungare il
  //  confronto con righe di trattini — ma si può rivedere: «non compare»
  //  e «non esiste più» sono due cose diverse.
  const [soloAttivi, setSoloAttivi] = useState(true);
  //  ── DUE MESTIERI, DUE CLASSIFICHE ─────────────────────────────────────
  //   Il setter risponde di quanti appuntamenti mette in agenda, il consulente
  //   di quante consulenze diventano clienti: in una tabella sola chi telefona
  //   tutto il giorno risulterebbe l'ultimo di una classifica che non sta
  //   misurando il suo lavoro. Si parte dai consulenti, che è ciò che questa
  //   scheda ha sempre mostrato.
  const [vista, setVista] = useState<"consulenti" | "setter">("consulenti");

  const righe = useMemo(
    () =>
      calcolaMetricheConsulenti(leads, consultants, registro.spese, dentro).filter((r) => {
        //  Chi non fa il consulente esce da questa tabella: le sue colonne
        //  misurano un mestiere che non fa. Per chi c'era già non cambia
        //  niente — il valore di partenza è «fa il consulente».
        //  Una riga senza anagrafica (consulente cancellato) resta: i suoi
        //  numeri sono esistiti e devono continuare a tornare.
        const c = consultants.find((x) => x.id === r.id);
        return !c || mestieriDi(c.data).faConsulente;
      }),
    [leads, consultants, registro, dentro],
  );

  const righeSetter = useMemo(
    () => calcolaMetricheSetter(leads, consultants, dentro),
    [leads, consultants, dentro],
  );

  /** ── IL NUMERO PRINCIPALE ────────────────────────────────────────────────
   *  La chiusura sulle consulenze di TUTTA la squadra: clienti ÷ consulenze
   *  davvero svolte. È `closeRate` di kpi-calcoli, la stessa formula che la
   *  colonna «Conversione» applica a una persona sola — così la riga del
   *  singolo si legge come «meglio o peggio della squadra» senza fare conti.
   *  Nessun euro esce da questa chiamata: la spesa è quella del registro,
   *  come nella tabella. */
  const squadra = useMemo(
    () => calcolaMetricheGenerali(leads, registro.spese, dentro, true),
    [leads, registro, dentro],
  );
  const chiusura = conBase(squadra.closeRate, squadra.conversioni, squadra.consulenze, {
    casi: "consulenze",
  });

  const spesaNelPeriodo = registro.origine.totale;

  const attivi = righe.filter((r) => r.lead > 0);
  const nascosti = righe.length - attivi.length;
  const mostrate = soloAttivi ? attivi : righe;

  /* ── LA RISPOSTA IN UNA RIGA ─────────────────────────────────────────────
     Chi chiude di PIÙ e chi chiude MEGLIO sono due persone diverse quasi
     sempre, e sono le due cose che si vanno a cercare scorrendo la tabella.
     Il migliore per tasso si sceglie solo fra chi ha abbastanza consulenze:
     un 100% su una consulenza sola non è un primato. */
  const piuClienti = attivi.reduce<MetricheConsulente | null>(
    (best, r) => (!best || r.conversioni > best.conversioni ? r : best),
    null,
  );
  const migliorTasso = attivi
    .filter((r) => r.consulenze >= CONSULENZE_MINIME)
    .reduce<MetricheConsulente | null>((best, r) => (!best || r.cvr > best.cvr ? r : best), null);

  //  Le colonne della spesa compaiono solo se una spesa c'è: senza, sarebbero
  //  due colonne di zeri che fanno sembrare gratis il lavoro.
  const conSpesa = spesaNelPeriodo > 0;

  //  I totali della squadra che telefona. Le percentuali si ricalcolano sui
  //  totali (dentro `totaliSetter`): la media delle percentuali darebbe a chi
  //  ha lavorato dieci schede lo stesso peso di chi ne ha lavorate trecento.
  const squadraSetter = totaliSetter(righeSetter);
  const fissaggioSquadra = conBase(
    squadraSetter.fissatiPerCento,
    squadraSetter.fissati,
    squadraSetter.lavorati,
    { casi: "contatti lavorati" },
  );

  if (vista === "setter") {
    return (
      <>
        <SceltaMestiere
          vista={vista}
          onVista={setVista}
          quantiConsulenti={righe.length}
          quantiSetter={righeSetter.length}
        />

        {/* ── IL NUMERO PRINCIPALE DEL SETTER ──────────────────────────────
            Una domanda sola: «ogni cento contatti lavorati, quanti finiscono
            in agenda». Non è la vendita, e non deve esserlo: che il cliente
            compri dipende dalla consulenza, non dalla telefonata.
            Se nessuno è segnato come setter il riquadro non compare affatto:
            un numero principale a trattino in cima alla scheda fa cercare un
            guasto, mentre la risposta — «non è ancora stato indicato chi
            telefona» — sta scritta nella tabella qui sotto. */}
        {righeSetter.length > 0 && (
          <NumeroChiave
            etichetta="Appuntamenti ogni 100 contatti lavorati"
            valore={fissaggioSquadra.valore}
            base={
              fissaggioSquadra.misurabile
                ? `${squadraSetter.fissati} appuntamenti su ${squadraSetter.lavorati} contatti lavorati`
                : fissaggioSquadra.base
            }
            formula="Appuntamenti messi in agenda ÷ contatti su cui c'è traccia di una telefonata. I no show sono DENTRO: fissarli è il lavoro del setter"
            icona={PhoneCall}
            principale
          />
        )}

        <Scheda
          titolo="Setter a confronto"
          nota="Stesso periodo delle altre schede dei KPI"
          senzaPadding
        >
          <ConfrontoSetter righe={righeSetter} />
          {righeSetter.length > 0 && <NotaAttribuzioneSetter />}
          <div className="space-y-1.5 border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              <strong>Contatti lavorati</strong> sono le schede su cui c&apos;è traccia di una
              telefonata: lo stato si è mosso da «da contattare», oppure c&apos;è già un
              appuntamento. Le schede assegnate e mai toccate stanno nella colonna{" "}
              <strong>da chiamare</strong> e restano fuori dal denominatore — contarle abbasserebbe
              il tasso di chi ha ricevuto una lista che non ha ancora finito.
            </p>
            <p>
              Gli <strong>appuntamenti fissati</strong> comprendono i no show: il setter ha fatto il
              suo lavoro quando l&apos;appuntamento entra in agenda. La colonna{" "}
              <strong>si presentano</strong> serve per quello — dice la qualità di ciò che mette in
              agenda, non la quantità. Che poi il cliente compri si misura nella vista{" "}
              <strong>Consulenti</strong>, e non è un numero suo.
            </p>
            <p>
              Gli appuntamenti <strong>da svolgere</strong> — quelli in calendario di cui nessuno ha
              ancora segnato l&apos;esito — restano fuori dal tasso di presenza: non sono né una
              presenza né un&apos;assenza, e su un periodo lungo possono essere buona parte di
              quelli fissati. È per questo che «si presentano» è calcolato su meno appuntamenti di
              quanti ne risultano fissati. Se quella colonna cresce, non è il setter: è un esito che
              nessuno ha scritto.
            </p>
            <p>
              Ogni percentuale porta la sua base. Sotto i {VOLUME_MINIMO_LPS} casi non si mostra
              affatto: «40%» su cinque schede si sposta di venti punti per una risposta sola.
            </p>
          </div>
        </Scheda>
      </>
    );
  }

  return (
    <>
      <SceltaMestiere
        vista={vista}
        onVista={setVista}
        quantiConsulenti={righe.length}
        quantiSetter={righeSetter.length}
      />

      {/* ── IL NUMERO PRINCIPALE DELLA SCHEDA ───────────────────────────────
          Una sola domanda in cima — «di dieci persone che si presentano,
          quante comprano» — e sotto chi la alza e chi la abbassa. */}
      <NumeroChiave
        etichetta="Chiusura sulle consulenze"
        valore={chiusura.valore}
        base={
          chiusura.misurabile
            ? `${squadra.conversioni} ${squadra.conversioni === 1 ? "cliente" : "clienti"} su ${squadra.consulenze} consulenze svolte`
            : chiusura.base
        }
        formula="Clienti ÷ consulenze davvero svolte. È la stessa formula della colonna «Conversione» qui sotto, applicata a tutta la squadra"
        icona={Users}
        principale
      />

      <Scheda
        titolo="Consulenti a confronto"
        nota="Stesso periodo e stessa spesa delle altre schede dei KPI"
        azioni={
          nascosti > 0 && (
            <Segmento
              attivo={soloAttivi}
              onClick={() => setSoloAttivi((x) => !x)}
              titolo="Nasconde chi non ha ricevuto nessun lead nel periodo scelto"
            >
              Solo chi ha lavorato
            </Segmento>
          )
        }
        senzaPadding
      >
        {/* ── CHI STA LAVORANDO MEGLIO ──────────────────────────────────────── */}
        {piuClienti && piuClienti.conversioni > 0 && (
          <p className="border-b border-border px-4 py-3 text-[13px] leading-relaxed">
            Chiude di più <strong>{piuClienti.nome}</strong>, con{" "}
            <strong className="tabular-nums">{piuClienti.conversioni}</strong>{" "}
            {piuClienti.conversioni === 1 ? "cliente" : "clienti"}
            {piuClienti.fatturatoLordo > 0 && <> e {eur(piuClienti.fatturatoLordo)} fatturati</>}.
            {migliorTasso && (
              <>
                {" "}
                Il tasso più alto è di <strong>{migliorTasso.nome}</strong>:{" "}
                <strong className="tabular-nums">{pct(migliorTasso.cvr)}</strong> delle consulenze
                svolte diventa cliente.
              </>
            )}
          </p>
        )}

        {mostrate.length === 0 ? (
          <VuotoRiga testo="Nessun consulente con lead assegnati nel periodo scelto." />
        ) : (
          <>
            {/*  Su telefono la tabella diventerebbe un rettangolo da trascinare di
              lato: stesse informazioni, una scheda per persona. */}
            <ul className="divide-y divide-border md:hidden">
              {mostrate.map((r) => (
                <li key={r.id} className="space-y-2 px-3 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{r.nome}</span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                      {r.fatturatoLordo ? eur(r.fatturatoLordo) : "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                    <Dato etichetta="Appuntamenti">{r.appuntamenti || "—"}</Dato>
                    <Dato etichetta="Consulenze">{r.consulenze || "—"}</Dato>
                    <Dato etichetta="Clienti">
                      <span className={r.conversioni ? "text-emerald-700" : undefined}>
                        {r.conversioni || "—"}
                      </span>
                    </Dato>
                    <Dato etichetta="Conversione">
                      <span className={classeCvr(r.cvr, r.consulenze)}>
                        {r.consulenze ? pct(r.cvr) : "—"}
                      </span>
                    </Dato>
                    <Dato etichetta="Su meet svolti">
                      {r.meetEffettuati ? pct(r.cvrSuMeet) : "—"}
                    </Dato>
                    <Dato etichetta="No show">
                      <span className={r.noShow ? "text-rose-600" : undefined}>
                        {r.noShow || "—"}
                      </span>
                    </Dato>
                    <Dato etichetta="Lead assegnati">{r.lead || "—"}</Dato>
                    <Dato etichetta="Acconti incassati">{r.acconti ? eur(r.acconti) : "—"}</Dato>
                    <Dato etichetta="Margine">
                      <span className={r.fatturatoNetto < 0 ? "text-rose-700" : undefined}>
                        {r.fatturatoNetto ? eur(r.fatturatoNetto) : "—"}
                      </span>
                    </Dato>
                    {conSpesa && (
                      <>
                        <Dato etichetta="Spesa attribuita">
                          {r.spesaAttribuita ? euroPreciso(r.spesaAttribuita) : "—"}
                        </Dato>
                        <Dato etichetta="Costo per cliente">
                          {r.cpa ? euroPreciso(r.cpa) : "—"}
                        </Dato>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-[12.5px]">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Consulente</th>
                    <th className="px-3 py-2 text-right">Lead</th>
                    <th className="px-3 py-2 text-right">Appunt.</th>
                    <th className="px-3 py-2 text-right">Consulenze</th>
                    <th className="px-3 py-2 text-right">No show</th>
                    <th className="px-3 py-2 text-right">Clienti</th>
                    <th className="px-3 py-2 text-right">Conversione</th>
                    <th className="px-3 py-2 text-right">Su meet</th>
                    <th className="px-3 py-2 text-right">Acconti</th>
                    <th className="px-3 py-2 text-right">Fatturato</th>
                    <th className="px-3 py-2 text-right">Margine</th>
                    {conSpesa && <th className="px-3 py-2 text-right">Spesa attrib.</th>}
                    {conSpesa && <th className="px-3 py-2 text-right">Costo per cliente</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mostrate.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/40">
                      <td className="px-3 py-2 font-medium">{r.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.lead || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.appuntamenti || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.consulenze || "—"}</td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          r.noShow > 0 && "text-rose-600",
                        )}
                      >
                        {r.noShow || "—"}
                      </td>
                      {/*  Il verde solo quando c'è davvero una vendita: un
                         trattino verde è colore che non dice niente. */}
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          r.conversioni > 0 && "text-emerald-700",
                        )}
                      >
                        {r.conversioni || "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          classeCvr(r.cvr, r.consulenze),
                        )}
                        title={`${r.conversioni} clienti su ${r.consulenze} consulenze svolte`}
                      >
                        {r.consulenze ? pct(r.cvr) : "—"}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        title={`${r.conversioni} clienti su ${r.meetEffettuati} meeting svolti`}
                      >
                        {r.meetEffettuati ? pct(r.cvrSuMeet) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.acconti ? eur(r.acconti) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {r.fatturatoLordo ? eur(r.fatturatoLordo) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          r.fatturatoNetto < 0 && "text-rose-700",
                        )}
                      >
                        {r.fatturatoNetto ? eur(r.fatturatoNetto) : "—"}
                      </td>
                      {conSpesa && (
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {r.spesaAttribuita ? euroPreciso(r.spesaAttribuita) : "—"}
                        </td>
                      )}
                      {conSpesa && (
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.cpa ? euroPreciso(r.cpa) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── LE REGOLE CHE SPIEGANO I NUMERI STRANI ────────────────────────── */}
        <div className="space-y-1.5 border-t border-border px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <strong>Conversione</strong> è clienti ÷ consulenze svolte: il consulente non decide
            quanti lead riceve né chi si presenta, risponde solo dei lead che ha davvero condotto.
            Accanto, <strong>su meet</strong> è lo stesso rapporto calcolato sui meeting realmente
            svolti: se i due valori divergono molto, parecchie consulenze sono rimaste senza esito
            registrato. Il rosso compare solo sotto il {CVR_BASSO}% e solo da {CONSULENZE_MINIME}{" "}
            consulenze in su.
          </p>
          <p>
            La colonna <strong>Lead</strong> conta tutti i lead assegnati, no show compresi, perché
            è su quel numero che si ripartisce la spesa pubblicitaria: non somma quindi con «Lead
            entrati» della scheda <strong>Ritorno</strong>, che i no show li esclude. Il{" "}
            <strong>margine</strong> per consulente è commerciale puro — la spesa pubblicitaria non
            è sottratta, a differenza del netto generale.
          </p>
          {conSpesa ? (
            <p>
              La <strong>spesa attribuita</strong> è la spesa unica del periodo — la stessa della
              scheda «Ritorno», registrata a mano dove c'è e sincronizzata da Meta dove non c'è —
              ripartita in proporzione ai lead ricevuti: è un criterio, non una misura, e chi riceve
              lead più cari risulta più economico di quanto sia.
            </p>
          ) : (
            <p>
              Nel periodo scelto non risulta nessuna spesa: le colonne della spesa attribuita e del
              costo per cliente non compaiono, perché sarebbero zeri e non «lead gratis». La spesa
              si registra nella scheda <strong>Ritorno</strong>, nel registro della spesa.
            </p>
          )}
          {nascosti > 0 && soloAttivi && (
            <p>
              {nascosti} {nascosti === 1 ? "consulente non ha" : "consulenti non hanno"} ricevuto
              lead in questo periodo e {nascosti === 1 ? "non compare" : "non compaiono"} in elenco.
            </p>
          )}
        </div>
      </Scheda>
    </>
  );
}

/** ── LA SCELTA DEL MESTIERE ────────────────────────────────────────────────
 *  Due tabelle, non un filtro sulle stesse righe: le colonne sono diverse
 *  perché le domande sono diverse. Il conteggio accanto al nome risponde in
 *  anticipo alla domanda «perché la tabella dei setter è vuota»: perché
 *  nessuno è ancora segnato come tale nella sua scheda. */
function SceltaMestiere({
  vista,
  onVista,
  quantiConsulenti,
  quantiSetter,
}: {
  vista: "consulenti" | "setter";
  onVista: (v: "consulenti" | "setter") => void;
  quantiConsulenti: number;
  quantiSetter: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Segmento
        attivo={vista === "consulenti"}
        onClick={() => onVista("consulenti")}
        conteggio={quantiConsulenti}
        titolo="Chi svolge le videoconsulenze: si misura sulla chiusura"
      >
        Consulenti
      </Segmento>
      <Segmento
        attivo={vista === "setter"}
        onClick={() => onVista("setter")}
        conteggio={quantiSetter}
        titolo="Chi telefona e fissa: si misura sugli appuntamenti messi in agenda"
      >
        Setter
      </Segmento>
      <span className="text-[11px] text-muted-foreground">
        Chi fa entrambi i mestieri compare in tutte e due, con numeri suoi
      </span>
    </div>
  );
}
