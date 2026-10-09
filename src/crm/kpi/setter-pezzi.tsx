/** ── I PEZZI DEL SETTER ────────────────────────────────────────────────────
 *  Una copia sola dei riquadri e della tabella di chi telefona, usata da tutte
 *  e tre le schermate che li mostrano: la scheda della persona, l'elenco della
 *  pagina Consulenti e la scheda «Consulenti» dei KPI. Due copie della stessa
 *  tabella divergono al primo dettaglio (una colonna, una soglia, un colore) e
 *  chi legge conclude che sono due calcoli diversi.
 *
 *  ── PERCHÉ UNA TABELLA A PARTE E NON UNA COLONNA IN PIÙ ───────────────────
 *  Setter e consulente rispondono di cose diverse: il primo di quanti
 *  appuntamenti mette in agenda, il secondo di quante consulenze diventano
 *  clienti. Metterli in una tabella sola produce una classifica in cui chi
 *  telefona tutto il giorno risulta "peggiore" di chi non telefona affatto —
 *  cioè una classifica che non significa niente.
 *
 *  ── OGNI PERCENTUALE PORTA LA SUA BASE ────────────────────────────────────
 *  Sempre, e sotto la soglia di volume non si mostra affatto (`conBase` in
 *  ./basi): «40%» su cinque schede non è un'informazione, è rumore con la
 *  virgola — e con quel numero si sposta il lavoro di una persona.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ComponentType } from "react";
import { Car, PhoneCall, Repeat, UserPlus, Video, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Kpi, KpiRiga, VuotoRiga } from "@/crm/ui";
import { conBase } from "@/crm/kpi/basi";
import {
  GRUPPI_SETTER,
  type GruppoSetter,
  type MetricheSetter,
  totaliSetter,
} from "@/crm/kpi-setter";

/* ═══════════════════════════════════════════════════════════════════════════
   I DUE INTERRUTTORI DEL MESTIERE
   ═════════════════════════════════════════════════════════════════════════ */

/** Un mestiere, con la riga che dice che cosa vuol dire.
 *  Vive qui e non dentro la scheda del consulente perché serve in DUE posti —
 *  quando si crea la persona e quando la si modifica — e due copie della stessa
 *  domanda prendono due formulazioni diverse nel giro di un mese. */
export function InterruttoreMestiere({
  icona: Icona,
  titolo,
  nota,
  acceso,
  onCambio,
}: {
  icona: ComponentType<{ className?: string }>;
  titolo: string;
  nota: string;
  acceso: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
        acceso ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icona
          className={cn("mt-0.5 h-4 w-4 shrink-0", acceso ? "text-slate-600" : "text-slate-300")}
        />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-slate-900">{titolo}</p>
          <p className="text-[11.5px] leading-snug text-slate-600">{nota}</p>
        </div>
      </div>
      <Switch checked={acceso} onCheckedChange={onCambio} />
    </div>
  );
}

/** ── ⚠️ QUESTE SPUNTE DANNO ANCHE I PERMESSI ──────────────────────────────
 *  Non sono più solo «come va misurata»: da esse dipende che cosa la persona
 *  può toccare nel CRM — il permesso è l'unione di ciò che serve a ogni
 *  mestiere acceso (crm/permessi.ts). Per questo ogni riga qui sotto dice anche
 *  CHE COSA APRE: chi accende una spunta sta consegnando un accesso, e deve
 *  leggerlo lì, non scoprirlo dopo da una schermata che si è aperta o chiusa.
 *  Lo stesso componente compare in due posti — l'anagrafica e «Accesso → Che
 *  cosa può fare» — ed è lo stesso dato: una sola formulazione per una sola
 *  domanda.
 *
 *  Le righe stanno nell'ordine del lavoro: prima chi telefona, poi chi fa la
 *  consulenza, poi chi va a posare, poi chi lo aiuta sul posto, poi chi lo
 *  porta, e in fondo chi fa tornare il cliente. Si possono accendere tutte, in
 *  qualunque combinazione: installatore e setter, solo installatore,
 *  installatore e driver, manutentore e basta.
 *  ⚠️ I quattro mestieri di campo stanno con gli altri due e non in una sezione
 *  loro: è la stessa domanda («che lavoro fa»), e una seconda schermata per un
 *  mestiere in più sarebbe il secondo elenco di ruoli che questo CRM ha deciso
 *  di non avere.
 *  ⚠️⚠️ ACCOMPAGNATORE E DRIVER SONO DUE RIGHE E RESTANO DUE RIGHE. Il driver è
 *  quello del passo «viene da solo o con un driver»: porta la gente, e per
 *  questo ha un compenso da pagare in più. L'accompagnatore va insieme
 *  all'installatore a FARE il lavoro, e quel compenso non lo prende. Una riga
 *  sola per tutti e due avrebbe messo un pagamento addosso a chi non lo riceve.
 *  Chi fa entrambe le cose accende entrambe.
 *  ⚠️⚠️ E IL MANUTENTORE NON È L'INSTALLATORE. Posare è montare un impianto
 *  nuovo, quasi sempre fuori e con la strada addosso; la manutenzione è
 *  rifissare un impianto che c'è già, quasi sempre in sede e in un'ora. Sono due
 *  elenchi di persone diversi, e dedurre il secondo dal primo avrebbe messo fra
 *  i manutentori tutti gli installatori — cioè avrebbe tolto la scelta proprio a
 *  chi la sta facendo. */
export function SceltaMestieri({
  faSetter,
  faConsulente,
  faDriver,
  faInstallatore,
  faAccompagnatore,
  faManutentore,
  onCambio,
}: {
  faSetter: boolean;
  faConsulente: boolean;
  faDriver: boolean;
  faInstallatore: boolean;
  faAccompagnatore: boolean;
  faManutentore: boolean;
  onCambio: (patch: {
    faSetter?: boolean;
    faConsulente?: boolean;
    faDriver?: boolean;
    faInstallatore?: boolean;
    faAccompagnatore?: boolean;
    faManutentore?: boolean;
  }) => void;
}) {
  return (
    <div className="space-y-2">
      <InterruttoreMestiere
        icona={PhoneCall}
        titolo="Fa il setter"
        nota="Chi telefona i contatti e fissa gli appuntamenti. Gli apre i propri lead e l'agenda: «fissare» è scrivere in agenda."
        acceso={faSetter}
        onCambio={(v) => onCambio({ faSetter: v })}
      />
      <InterruttoreMestiere
        icona={Video}
        titolo="Fa il consulente"
        nota="Chi svolge le videoconsulenze e chiude le vendite. Gli apre quello del setter più i preventivi e la registrazione degli incassi: spegnendolo li perde."
        acceso={faConsulente}
        onCambio={(v) => onCambio({ faConsulente: v })}
      />
      <InterruttoreMestiere
        icona={Wrench}
        titolo="Fa l'installatore"
        nota="Va a posare. È l'unica spunta che mette una persona nell'elenco «Chi la esegue» quando si programma un'installazione: quel giorno la posa le toglie il suo slot più due ore di strada prima e due dopo. Gli apre la pagina «Installazioni e spedizioni», cioè dove e quando deve andare."
        acceso={faInstallatore}
        onCambio={(v) => onCambio({ faInstallatore: v })}
      />
      <InterruttoreMestiere
        icona={UserPlus}
        titolo="Fa l'accompagnatore"
        nota="Va INSIEME all'installatore a fare il lavoro. Acceso, si può scegliere come accompagnatore quando si programma una posa: quel giorno la sua agenda si blocca come quella di chi esegue — la posa più due ore di strada prima e due dopo. Gli apre le installazioni, per la stessa ragione dell'installatore."
        acceso={faAccompagnatore}
        onCambio={(v) => onCambio({ faAccompagnatore: v })}
      />
      {/*  Il driver resta una riga a sé, sotto l'accompagnatore: la nota dice la
          differenza, perché è l'unico posto in cui si sceglie e l'unico in cui
          si può capire quale delle due spunte serve. */}
      <InterruttoreMestiere
        icona={Car}
        titolo="Fa il driver"
        nota="PORTA chi va a posare: è un servizio di trasporto, con un compenso da pagare in più. Non è l'accompagnatore, che invece il lavoro lo fa. Acceso, compare fra i driver al passo «come ci va»: quel giorno la sua agenda si blocca per la posa più tre ore di strada prima e tre dopo. Gli apre le installazioni, per sapere dove deve portarlo."
        acceso={faDriver}
        onCambio={(v) => onCambio({ faDriver: v })}
      />
      {/*  Il manutentore chiude la fila perché il ritorno è la cosa che viene
          dopo tutte le altre: prima si vende, poi si posa, poi si torna. */}
      <InterruttoreMestiere
        icona={Repeat}
        titolo="Fa le manutenzioni"
        nota="Esegue i RITORNI: ogni due o quattro settimane l'impianto si rifissa, quasi sempre in sede e in un'ora. È l'unica spunta che mette una persona nell'elenco «Chi la esegue» quando si fissa un ritorno: quel giorno il ritorno le toglie il suo slot più mezz'ora prima e mezz'ora dopo. Non è l'installatore — posare un impianto nuovo è un altro lavoro, e chi fa tutti e due accende tutte e due. Gli apre le installazioni, dove sta anche la lente delle manutenzioni."
        acceso={faManutentore}
        onCambio={(v) => onCambio({ faManutentore: v })}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA FRASE CHE VA SEMPRE SOTTO I NUMERI DEL SETTER
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL LIMITE, DICHIARATO A SCHERMO ───────────────────────────────────────
 *  Due cose che il CRM non sa, e che vanno dette dove si guardano i numeri —
 *  non in un commento che legge solo chi scrive il codice:
 *   · CHI HA FISSATO non è registrato: c'è un nome solo per scheda, ed è quello
 *     di chi la ha in carico. Se il setter fissa per un collega, quella riga
 *     finisce nei numeri del collega;
 *   · QUANDO non esiste una data di assegnazione: il periodo taglia sulla data
 *     di INGRESSO del lead, la stessa della tabella dei consulenti. Una scheda
 *     vecchia lavorata oggi non compare fra i numeri di oggi.
 *  Tacerle significherebbe pubblicare una classifica che in certi giorni premia
 *  la persona sbagliata. Non è un avviso di errore — è ambra, non rosso: i
 *  numeri sono giusti, è l'attribuzione che dipende da come si lavora. */
export function NotaAttribuzioneSetter({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "border-t border-amber-200 bg-amber-50/60 px-4 py-2.5 text-[11.5px] leading-relaxed text-amber-900",
        className,
      )}
    >
      <strong>Come sono attribuiti questi numeri.</strong> Il CRM non registra chi ha{" "}
      <em>fissato</em> l&apos;appuntamento: di ogni scheda conosce una persona sola, quella a cui è
      assegnata. Se il setter fissa un appuntamento e la scheda passa al collega che farà la
      consulenza, quella riga esce dai suoi numeri ed entra in quelli del collega. E non esiste una
      data di assegnazione: il periodo taglia sulla <strong>data di ingresso del contatto</strong>,
      come nella tabella dei consulenti — una scheda arrivata prima del periodo e chiamata oggi non
      compare qui.
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I NUMERI DI UNA PERSONA SOLA
   ═════════════════════════════════════════════════════════════════════════ */

/** I riquadri del setter nella scheda della persona. Si mostrano SOLO a chi fa
 *  questo mestiere: un blocco di zeri sulla scheda di chi non telefona è un
 *  giudizio, non un dato. */
export function NumeriSetter({
  metrica,
  gruppo,
  onGruppo,
}: {
  metrica: MetricheSetter;
  gruppo?: GruppoSetter;
  onGruppo?: (g: GruppoSetter) => void;
}) {
  const fissaggio = conBase(metrica.fissatiPerCento, metrica.fissati, metrica.lavorati, {
    casi: "contatti lavorati",
  });
  //  ⚠️ La base è `esitoNoto`, non `fissati`: gli appuntamenti ancora in
  //  calendario non sono né una presenza né un'assenza, e tenerli nel
  //  denominatore farebbe scendere il tasso ogni volta che il setter fissa
  //  qualcosa — cioè peggiorerebbe il suo numero proprio quando lavora.
  const presenza = conBase(metrica.tassoPresenza, metrica.presentati, metrica.esitoNoto, {
    casi: "appuntamenti già svolti",
  });

  return (
    <KpiRiga colonne={3}>
      {/*  Il numero principale sta per primo: è l'unica domanda a cui questo
          blocco risponde — «ogni cento contatti lavorati, quanti ne mette in
          agenda». */}
      <Kpi
        etichetta="Fissati su 100 contatti"
        valore={fissaggio.valore}
        nota={fissaggio.base}
        icona={PhoneCall}
        onClick={onGruppo ? () => onGruppo("fissati") : undefined}
        attivo={gruppo === "fissati"}
      />
      <Kpi
        etichetta="Contatti lavorati"
        valore={metrica.lavorati}
        nota={`${metrica.assegnati} assegnati nel periodo`}
        onClick={onGruppo ? () => onGruppo("lavorati") : undefined}
        attivo={gruppo === "lavorati"}
      />
      <Kpi
        etichetta="Appuntamenti fissati"
        valore={metrica.fissati}
        //  Quanti devono ancora succedere si dice QUI, accanto al totale: è la
        //  differenza fra questo numero e la base del tasso di presenza, e
        //  senza dirla sembrerebbero due conti scollegati.
        nota={
          metrica.daSvolgere > 0
            ? `No show compresi · ${metrica.daSvolgere} ancora da svolgere`
            : "No show compresi: fissarlo è il suo lavoro"
        }
        tono={metrica.fissati > 0 ? "vinta" : "neutro"}
        onClick={onGruppo ? () => onGruppo("fissati") : undefined}
        attivo={gruppo === "fissati"}
      />
      <Kpi
        etichetta="Si sono presentati"
        valore={presenza.valore}
        nota={presenza.base}
        onClick={onGruppo ? () => onGruppo("presentati") : undefined}
        attivo={gruppo === "presentati"}
      />
      <Kpi
        etichetta="No show"
        valore={metrica.noShow}
        tono={metrica.noShow > 0 ? "persa" : "neutro"}
        nota={
          metrica.daRiprogrammare > 0
            ? `+ ${metrica.daRiprogrammare} da riprogrammare`
            : "Fissati e non presentatisi"
        }
        onClick={onGruppo ? () => onGruppo("noShow") : undefined}
        attivo={gruppo === "noShow"}
      />
      <Kpi
        etichetta="Ancora da chiamare"
        valore={metrica.daLavorare}
        nota="Assegnati e mai lavorati"
        tono={metrica.daLavorare > 0 ? "in_sospeso" : "neutro"}
        onClick={onGruppo ? () => onGruppo("daLavorare") : undefined}
        attivo={gruppo === "daLavorare"}
      />
      {/*  Compare solo se la pila esiste: un riquadro a zero accanto agli altri
          sarebbe un giudizio su un mestiere fatto bene. Quando c'è, invece, è
          esso stesso la notizia — dice quanti appuntamenti aspettano un esito
          che nessuno ha ancora scritto, e perché il tasso di presenza qui
          accanto è calcolato su meno casi dei fissati. */}
      {metrica.daSvolgere > 0 && (
        <Kpi
          etichetta="Esito ancora da segnare"
          valore={metrica.daSvolgere}
          nota="In calendario, esito non registrato"
          tono="in_sospeso"
          onClick={onGruppo ? () => onGruppo("daSvolgere") : undefined}
          attivo={gruppo === "daSvolgere"}
        />
      )}
    </KpiRiga>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONFRONTO FRA SETTER
   ═════════════════════════════════════════════════════════════════════════ */

/** Numero + la sua base sotto, nella stessa cella. La base non è un
 *  suggerimento nascosto in un `title`: su un telefono il `title` non esiste,
 *  e la percentuale resterebbe da sola proprio dove è più fragile. */
function ValoreConBase({
  valore,
  base,
  className,
}: {
  valore: string;
  base: string;
  className?: string;
}) {
  return (
    <span className={cn("block", className)}>
      <span className="block font-semibold tabular-nums">{valore}</span>
      <span className="block text-[11px] font-normal text-muted-foreground">{base}</span>
    </span>
  );
}

/** L'elenco dei setter a confronto: schede su telefono, tabella da tablet in
 *  su. Le colonne sono poche di proposito — quello che il setter controlla
 *  davvero è quanto lavora la lista e quanto la converte in appuntamenti. */
export function ConfrontoSetter({
  righe,
  onApri,
  vuoto = "Nessuno è segnato come setter: apri la scheda di una persona e indica che telefona.",
}: {
  righe: MetricheSetter[];
  /** Il numero premuto apre la scheda della persona su quell'elenco. */
  onApri?: (setterId: string, gruppo: GruppoSetter) => void;
  vuoto?: string;
}) {
  if (righe.length === 0) return <VuotoRiga testo={vuoto} />;

  const cella = (r: MetricheSetter) => ({
    fissaggio: conBase(r.fissatiPerCento, r.fissati, r.lavorati, { casi: "contatti lavorati" }),
    //  Base = appuntamenti già svolti, non tutti i fissati: vedi la nota in
    //  `NumeriSetter`. Le due schermate devono dire lo stesso numero.
    presenza: conBase(r.tassoPresenza, r.presentati, r.esitoNoto, {
      casi: "appuntamenti già svolti",
    }),
  });

  return (
    <>
      {/* telefono */}
      <ul className="divide-y divide-border md:hidden">
        {righe.map((r) => {
          const c = cella(r);
          return (
            <li key={r.id} className="space-y-2 px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onApri?.(r.id, "fissati")}
                  className="min-w-0 truncate text-left text-[13px] font-semibold"
                >
                  {r.nome}
                </button>
                <span className="shrink-0 text-right">
                  <ValoreConBase valore={c.fissaggio.valore} base="fissati su 100 lavorati" />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <VoceSetter
                  etichetta="Lavorati"
                  valore={r.lavorati}
                  nota={`su ${r.assegnati} assegnati`}
                  onClick={() => onApri?.(r.id, "lavorati")}
                />
                <VoceSetter
                  etichetta="Fissati"
                  valore={r.fissati}
                  nota={r.daSvolgere > 0 ? `${r.daSvolgere} da svolgere` : "no show compresi"}
                  tono={r.fissati > 0 ? "text-emerald-700" : undefined}
                  onClick={() => onApri?.(r.id, "fissati")}
                />
                <VoceSetter
                  etichetta="Presentati"
                  valore={c.presenza.valore}
                  nota={c.presenza.base}
                  onClick={() => onApri?.(r.id, "presentati")}
                />
                <VoceSetter
                  etichetta="No show"
                  valore={r.noShow || "—"}
                  nota={r.daRiprogrammare > 0 ? `+${r.daRiprogrammare} da riprogr.` : ""}
                  tono={r.noShow > 0 ? "text-rose-600" : undefined}
                  onClick={() => onApri?.(r.id, "noShow")}
                />
                <VoceSetter
                  etichetta="Da chiamare"
                  valore={r.daLavorare || "—"}
                  nota={r.daLavorare > 0 ? "coda di lavoro" : ""}
                  tono={r.daLavorare > 0 ? "text-amber-700" : undefined}
                  onClick={() => onApri?.(r.id, "daLavorare")}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* tablet e desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] text-[12.5px]">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Setter</th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.assegnati.spiegazione}>
                Assegnati
              </th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.lavorati.spiegazione}>
                Lavorati
              </th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.daLavorare.spiegazione}>
                Da chiamare
              </th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.fissati.spiegazione}>
                Fissati
              </th>
              {/*  Sta accanto ai fissati e prima del tasso di presenza perché è
                 la differenza fra i due: senza questa colonna, «12 fissati» e
                 «su 7 già svolti» sembrano due conti che non tornano. */}
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.daSvolgere.spiegazione}>
                Da svolgere
              </th>
              <th className="px-3 py-2 text-right">Fissati / 100 lavorati</th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.presentati.spiegazione}>
                Si presentano
              </th>
              <th className="px-3 py-2 text-right" title={GRUPPI_SETTER.noShow.spiegazione}>
                No show
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {righe.map((r) => {
              const c = cella(r);
              return (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => onApri?.(r.id, "fissati")}
                      className="max-w-full truncate text-left hover:underline"
                    >
                      {r.nome}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.assegnati || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.lavorati || "—"}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      r.daLavorare > 0 && "text-amber-700",
                    )}
                  >
                    {r.daLavorare || "—"}
                  </td>
                  {/*  Il verde solo dove c'è davvero un appuntamento: un
                     trattino verde è colore che non dice niente. */}
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      r.fissati > 0 && "text-emerald-700",
                    )}
                  >
                    {r.fissati || "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      r.daSvolgere > 0 && "text-amber-700",
                    )}
                  >
                    {r.daSvolgere || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValoreConBase valore={c.fissaggio.valore} base={c.fissaggio.base} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ValoreConBase valore={c.presenza.valore} base={c.presenza.base} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      r.noShow > 0 && "text-rose-600",
                    )}
                  >
                    {r.noShow || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VoceSetter({
  etichetta,
  valore,
  nota,
  tono,
  onClick,
}: {
  etichetta: string;
  valore: string | number;
  nota?: string;
  tono?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 text-left">
      <span className="block text-[11px] text-muted-foreground">{etichetta}</span>
      <span className={cn("block truncate text-[13px] font-medium tabular-nums", tono)}>
        {valore}
      </span>
      {nota ? (
        <span className="block truncate text-[11px] text-muted-foreground">{nota}</span>
      ) : null}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA RIGA DI TESTATA DELLA SQUADRA DEI SETTER
   ═════════════════════════════════════════════════════════════════════════ */

/** I totali della squadra che telefona. Le percentuali sono ricalcolate sui
 *  totali (vedi `totaliSetter`), non sono la media delle percentuali. */
export function TotaliSetter({ righe }: { righe: MetricheSetter[] }) {
  const t = totaliSetter(righe);
  const fissaggio = conBase(t.fissatiPerCento, t.fissati, t.lavorati, {
    casi: "contatti lavorati",
  });
  const presenza = conBase(t.tassoPresenza, t.presentati, t.esitoNoto, {
    casi: "appuntamenti già svolti",
  });
  return (
    <KpiRiga colonne={5}>
      <Kpi etichetta="Contatti assegnati" valore={t.assegnati} nota="Alla squadra dei setter" />
      <Kpi etichetta="Lavorati" valore={t.lavorati} nota={`${t.daLavorare} ancora da chiamare`} />
      <Kpi
        etichetta="Appuntamenti fissati"
        valore={t.fissati}
        tono={t.fissati > 0 ? "vinta" : "neutro"}
        nota={
          t.daSvolgere > 0 ? `No show compresi · ${t.daSvolgere} da svolgere` : "No show compresi"
        }
      />
      <Kpi
        etichetta="Fissati su 100 contatti"
        valore={fissaggio.valore}
        nota={fissaggio.base}
        icona={PhoneCall}
      />
      <Kpi etichetta="Si presentano" valore={presenza.valore} nota={presenza.base} />
    </KpiRiga>
  );
}
