// ── IL REGISTRO DELLA SPESA ─────────────────────────────────────────────────
//  (era la scheda «KPI manuale», che è sparita)
//
//  ── PERCHÉ NON È PIÙ UNA SCHEDA ───────────────────────────────────────────
//  «KPI manuale» era un nome che descriveva COME il dato entra, non cosa
//  mostra. Registrare la spesa della sera è un GESTO, non una sezione di
//  analisi — e quella scheda, per giustificarsi come sezione, ripeteva dodici
//  numeri che stavano già nella panoramica, calcolati però su un'altra spesa.
//  Due «costo per cliente» nella stessa pagina.
//
//  Adesso ci sono due pezzi, e stanno tutti e due nella scheda dei soldi:
//   · IL MODULO, sempre in vista in cima, accanto alla copertura della spesa:
//     data già a oggi, importo, Invio. È l'unica cosa per cui si apriva quella
//     scheda;
//   · IL REGISTRO, a scomparsa in fondo: le registrazioni con correggi ed
//     elimina, e il giorno per giorno ridotto a quello che serve a controllare
//     la spesa — giorno, campagne, speso, lead.
//
//  ── COSA È SPARITO DAL GIORNO PER GIORNO, E PERCHÉ ────────────────────────
//  Aveva anche fatturato, margine, costo per lead e costo per cliente
//  GIORNALIERI. Quelle quattro colonne contraddicono per costruzione la testa
//  della pagina: attribuiscono le vendite alla data del MEETING (in alto tutto
//  è agganciato alla data di ingresso del lead) e tolgono la spesa dal margine
//  SOLO nei giorni in cui c'è stata una vendita. Il file di calcolo lo dichiara
//  in una nota di sei righe, e la pagina doveva scusarsene in un paragrafo: un
//  numero che ha bisogno di essere scusato non merita una colonna.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdSpending } from "@/crm/types";
import { Scheda, VuotoRiga } from "@/crm/ui";
import { giornoDi, type FiltroPeriodo, type MetricheGiorno } from "@/crm/kpi-calcoli";
import { euroPreciso } from "@/crm/kpi/basi";
import { giornoBreve } from "@/crm/kpi/finestra";
import {
  correggiSpesa,
  eliminaSpesa,
  leggiImporto,
  registraSpesa,
} from "@/crm/kpi/spesa-scrittura";

/** Oggi come «AAAA-MM-GG» con l'orologio locale: `toISOString()` lavora in UTC
 *  e d'estate, dopo le 22, darebbe già il giorno dopo — proprio nell'ora in cui
 *  questa spesa viene scritta. */
function oggiLocale(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL GESTO — registrare la spesa di oggi
   ═════════════════════════════════════════════════════════════════════════ */

/** ── TRE CAMPI, DI CUI DUE GIÀ COMPILATI ───────────────────────────────────
 *  La data è oggi e la campagna ha un nome di riserva: in pratica si scrive
 *  l'importo e si preme Invio. Il campo campagna resta perché una giornata può
 *  avere più annunci attivi, e saperlo dopo — guardando il registro — è l'unico
 *  modo di capire quale dei due stava funzionando. */
export function ModuloSpesa({ onVediRegistro }: { onVediRegistro: () => void }) {
  const { adSpending, reload } = useCRM();
  const { user } = useAuth();
  const [giorno, setGiorno] = useState(oggiLocale());
  const [importo, setImporto] = useState("");
  const [campagna, setCampagna] = useState("");
  /** Il giorno per cui si è accettato di aggiungere una seconda voce. */
  const [forzato, setForzato] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  //  TUTTE le registrazioni, non solo quelle del periodo: il doppione va
  //  scoperto anche quando si scrive una data fuori dall'intervallo scelto.
  const gia = adSpending.filter((s) => giornoDi(s.data.data) === giorno);
  const giaTotale = gia.reduce((t, s) => t + (Number(s.data.importoSpeso) || 0), 0);
  //  ── IL DOPPIONE SI DICE, NON SI CREA IN SILENZIO ──────────────────────
  //   Registrare due volte la stessa giornata raddoppia la spesa e dimezza il
  //   ritorno: l'errore si scopre settimane dopo, guardando un numero che non
  //   torna. Finché non si dichiara di volerlo davvero, il salvataggio è fermo.
  const bloccato = gia.length > 0 && forzato !== giorno;

  const salva = async () => {
    const valore = leggiImporto(importo);
    if (valore <= 0) {
      toast.error("Scrivi quanto hai speso");
      return;
    }
    if (bloccato) {
      toast.warning(`Il ${giornoBreve(giorno)} è già registrato`, {
        description: "Correggi la registrazione esistente oppure conferma la seconda voce.",
      });
      return;
    }
    if (!user) {
      toast.error("Spesa non salvata", {
        description: "Non risulti collegato: rientra nel CRM e riprova.",
      });
      return;
    }
    setInCorso(true);
    try {
      const esito = await registraSpesa(user.id, {
        data: giorno,
        campagna: campagna.trim() || "Budget giornaliero",
        fonte: "ADV",
        importoSpeso: valore,
        //  Lead, meet e conversioni NON si scrivono a mano: arrivano dalle
        //  schede reali. Restano a zero perché il tipo li richiede.
        leadGenerati: 0,
        meetFissati: 0,
        conversioni: 0,
      });
      if (!esito.ok) {
        //  L'importo resta scritto nel campo: chi ha il pannello degli annunci
        //  aperto davanti riprova col tasto, non riscrive la cifra.
        toast.error("Spesa non salvata", { description: esito.errore });
        return;
      }
      await reload();
      toast.success(`Registrati ${euroPreciso(valore)} il ${giornoBreve(giorno)}`);
      setImporto("");
      setCampagna("");
      setForzato(null);
    } finally {
      setInCorso(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_8rem_1fr_auto]"
      >
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Giorno</span>
          <Input
            type="date"
            value={giorno}
            onChange={(e) => setGiorno(e.target.value)}
            className="mt-0.5 h-9"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Speso (€)</span>
          <Input
            //  `inputMode` decimale: su telefono apre il tastierino numerico,
            //  che è dove questa riga viene compilata la sera.
            inputMode="decimal"
            placeholder="0,00"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="mt-0.5 h-9 tabular-nums"
          />
        </label>
        <label className="col-span-2 min-w-0 sm:col-span-1">
          <span className="text-[11px] text-muted-foreground">Campagna (facoltativa)</span>
          <Input
            placeholder="Budget giornaliero"
            value={campagna}
            onChange={(e) => setCampagna(e.target.value)}
            className="mt-0.5 h-9"
          />
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <Button type="submit" size="sm" disabled={inCorso} className="h-9 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Registra
          </Button>
        </div>
      </form>

      {gia.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2">
          <p className="flex items-start gap-1.5 text-[12px] leading-snug text-amber-900">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Il {giornoBreve(giorno)} è già registrato: {euroPreciso(giaTotale)} in {gia.length}{" "}
              {gia.length === 1 ? "voce" : "voci"}.
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7"
              onClick={onVediRegistro}
            >
              <Pencil className="h-3.5 w-3.5" /> Apri il registro e correggi
            </Button>
            {forzato !== giorno ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-amber-900 hover:bg-amber-100"
                onClick={() => setForzato(giorno)}
              >
                Aggiungi comunque una seconda voce
              </Button>
            ) : (
              <span className="self-center text-[11px] text-amber-900">
                Seconda voce consentita: premi Registra.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL REGISTRO — le registrazioni e il giorno per giorno
   ═════════════════════════════════════════════════════════════════════════ */

export function RegistroSpesa({
  dentro,
  giorni,
  aperto,
  onCambiaAperto,
}: {
  dentro: FiltroPeriodo;
  /** Il giorno per giorno già calcolato dalla pagina, con la STESSA spesa dei
   *  numeri in cima: ricalcolarlo qui vorrebbe dire due totali diversi. */
  giorni: MetricheGiorno[];
  aperto: boolean;
  onCambiaAperto: (v: boolean) => void;
}) {
  const { adSpending, reload } = useCRM();
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);

  //  Chiudendo il registro non deve restare aperta una correzione a metà: alla
  //  riapertura si ritroverebbe un campo modificato che nessuno ha salvato.
  useEffect(() => {
    if (!aperto) {
      setInModifica(null);
      setDaEliminare(null);
    }
  }, [aperto]);

  const speseNelPeriodo = useMemo(
    () => adSpending.filter((s) => dentro(s.data.data)),
    [adSpending, dentro],
  );

  /** Se una registrazione è aperta in modifica resta a schermo anche quando
   *  cade fuori dall'intervallo: altrimenti premere «correggi» farebbe sparire
   *  proprio la riga da correggere. Il CONTEGGIO però resta quello del periodo,
   *  altrimenti mentre si corregge una riga vecchia il numero crescerebbe di
   *  uno senza motivo. */
  const speseMostrate = useMemo(() => {
    const fuoriMaAperta = adSpending.filter(
      (s) => s.id === inModifica && !speseNelPeriodo.some((x) => x.id === s.id),
    );
    return [...speseNelPeriodo, ...fuoriMaAperta].sort((a, b) =>
      giornoDi(b.data.data).localeCompare(giornoDi(a.data.data)),
    );
  }, [adSpending, speseNelPeriodo, inModifica]);

  const fuoriPeriodo = adSpending.length - speseNelPeriodo.length;

  const salvaModifica = async (id: string, dati: AdSpending["data"]) => {
    const esito = await correggiSpesa(id, dati);
    if (!esito.ok) {
      toast.error("Modifica non salvata", { description: esito.errore });
      return;
    }
    await reload();
    setInModifica(null);
    toast.success("Spesa aggiornata");
  };

  const elimina = async (s: AdSpending) => {
    const esito = await eliminaSpesa(s.id);
    if (!esito.ok) {
      toast.error("Spesa non eliminata", { description: esito.errore });
      return;
    }
    setDaEliminare(null);
    await reload();
    toast.success(`Eliminata la spesa del ${giornoBreve(giornoDi(s.data.data))}`);
  };

  return (
    <Scheda
      //  Il titolo NON è «Registro della spesa»: quella è la scheda qui sopra,
      //  dove si registra e si dichiara la copertura. Questa ne è il dettaglio,
      //  e due blocchi con lo stesso titolo fanno credere a un doppione.
      titolo="Le registrazioni, giorno per giorno"
      nota={
        fuoriPeriodo > 0
          ? `${speseNelPeriodo.length} registrazioni nel periodo · altre ${fuoriPeriodo} fuori dall'intervallo scelto`
          : `${speseNelPeriodo.length} ${speseNelPeriodo.length === 1 ? "registrazione" : "registrazioni"} nel periodo`
      }
      azioni={
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => onCambiaAperto(!aperto)}
          aria-expanded={aperto}
        >
          {aperto ? "Chiudi" : "Apri"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aperto && "rotate-180")} />
        </Button>
      }
      senzaPadding
    >
      {/*  Chiuso di partenza: è materiale di verifica, non di lettura. Chi lo
          apre lo fa per un motivo preciso — controllare una giornata. */}
      {aperto && (
        <>
          {speseMostrate.length === 0 ? (
            <VuotoRiga testo="Nessuna spesa registrata a mano in questo periodo." />
          ) : (
            <ul className="divide-y divide-border">
              {speseMostrate.map((s) => (
                <RigaSpesa
                  key={s.id}
                  spesa={s}
                  inModifica={inModifica === s.id}
                  inConferma={daEliminare === s.id}
                  fuoriPeriodo={!dentro(s.data.data)}
                  onModifica={() => {
                    setDaEliminare(null);
                    setInModifica(s.id);
                  }}
                  onAnnulla={() => setInModifica(null)}
                  onSalva={(dati) => salvaModifica(s.id, dati)}
                  onChiediElimina={() => {
                    setInModifica(null);
                    setDaEliminare(s.id);
                  }}
                  onAnnullaElimina={() => setDaEliminare(null)}
                  onElimina={() => elimina(s)}
                />
              ))}
            </ul>
          )}

          {/* ── GIORNO PER GIORNO, QUATTRO COLONNE ─────────────────────────
              Serve a controllare la spesa: quale giornata è scoperta, quali
              campagne c'erano, quanti contatti ha prodotto. Niente fatturato
              né margine giornalieri: usano un'attribuzione diversa da quella
              della testa della pagina (vedi l'intestazione di questo file). */}
          <div className="border-t border-border">
            <p className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Giorno per giorno, con la spesa che sta usando la pagina — registrata a mano dove c'è,
              sincronizzata da Meta dove non c'è. I <strong>lead</strong> sono quelli ENTRATI in
              quel giorno.
            </p>
            {giorni.length === 0 ? (
              <VuotoRiga testo="Nessun dato in questo periodo." />
            ) : (
              <>
                <ul className="divide-y divide-border md:hidden">
                  {giorni.map((g) => (
                    <li key={g.giorno} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
                      <span className="w-24 shrink-0 text-[12.5px] font-medium">
                        {giornoBreve(g.giorno)}
                      </span>
                      <span className="shrink-0 text-[12.5px] tabular-nums">
                        {g.spesa ? euroPreciso(g.spesa) : "—"}
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                        {g.lead} lead
                      </span>
                      {g.spese.length > 0 && (
                        <span className="min-w-0 basis-full">
                          <ChipCampagne spese={g.spese} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[560px] text-[12.5px]">
                    <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Giorno</th>
                        <th className="px-3 py-2 text-left">Campagne</th>
                        <th className="px-3 py-2 text-right">Speso</th>
                        <th className="px-3 py-2 text-right">Lead</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {giorni.map((g) => (
                        <tr key={g.giorno} className="hover:bg-accent/40">
                          <td className="px-3 py-2 font-medium">{giornoBreve(g.giorno)}</td>
                          <td className="px-3 py-2">
                            {g.spese.length === 0 ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : (
                              <ChipCampagne spese={g.spese} />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {g.spesa ? euroPreciso(g.spesa) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{g.lead || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Scheda>
  );
}

/** Una riga del registro: si legge, si corregge e si elimina senza cambiare
 *  pagina. L'eliminazione chiede conferma NELLA riga — una finestra di sistema
 *  si chiude a occhi chiusi, una domanda dove stava il pulsante no. */
function RigaSpesa({
  spesa,
  inModifica,
  inConferma,
  fuoriPeriodo,
  onModifica,
  onAnnulla,
  onSalva,
  onChiediElimina,
  onAnnullaElimina,
  onElimina,
}: {
  spesa: AdSpending;
  inModifica: boolean;
  inConferma: boolean;
  /** aperta in modifica ma con una data fuori dal periodo mostrato */
  fuoriPeriodo: boolean;
  onModifica: () => void;
  onAnnulla: () => void;
  onSalva: (dati: AdSpending["data"]) => Promise<void>;
  onChiediElimina: () => void;
  onAnnullaElimina: () => void;
  onElimina: () => void;
}) {
  //  Il modulo di correzione è un componente a parte, montato solo quando
  //  serve: così ogni apertura riparte dai valori salvati. Tenendo i campi
  //  sempre montati, chi annullava una correzione se la ritrovava a schermo
  //  alla riapertura, come se fosse quella registrata.
  if (inModifica) {
    return (
      <li className="bg-accent/30 px-3 py-2.5">
        <ModificaSpesa spesa={spesa} onSalva={onSalva} onAnnulla={onAnnulla} />
        {fuoriPeriodo && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Questa registrazione è fuori dal periodo che stai guardando: appare qui solo finché la
            stai correggendo.
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <span className="w-24 shrink-0 text-[12.5px] font-medium">
        {giornoBreve(giornoDi(spesa.data.data))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
        {spesa.data.campagna || "Budget giornaliero"}
      </span>
      <span className="shrink-0 text-[13px] font-semibold tabular-nums">
        {euroPreciso(Number(spesa.data.importoSpeso) || 0)}
      </span>

      {inConferma ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11.5px] text-muted-foreground">Eliminare?</span>
          <Button type="button" size="sm" variant="destructive" className="h-7" onClick={onElimina}>
            Sì, elimina
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={onAnnullaElimina}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            title="Correggi questa registrazione"
            onClick={onModifica}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground hover:text-rose-700"
            title="Elimina questa registrazione"
            onClick={onChiediElimina}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      )}
    </li>
  );
}

/** I campi per correggere una registrazione già salvata. Stessa disposizione
 *  del modulo in cima alla pagina: correggere e registrare sono lo stesso
 *  gesto, e cambiarne la forma costringerebbe a ri-orientarsi. */
function ModificaSpesa({
  spesa,
  onSalva,
  onAnnulla,
}: {
  spesa: AdSpending;
  onSalva: (dati: AdSpending["data"]) => Promise<void>;
  onAnnulla: () => void;
}) {
  const [giorno, setGiorno] = useState(giornoDi(spesa.data.data));
  const [importo, setImporto] = useState(String(spesa.data.importoSpeso ?? "").replace(".", ","));
  const [campagna, setCampagna] = useState(spesa.data.campagna || "");
  const [inCorso, setInCorso] = useState(false);

  const salva = async () => {
    const valore = leggiImporto(importo);
    if (valore <= 0) {
      toast.error("L'importo deve essere maggiore di zero");
      return;
    }
    setInCorso(true);
    try {
      await onSalva({
        //  Si riscrivono solo i tre campi editabili: fonte e conteggi restano
        //  quelli con cui la riga è nata.
        ...spesa.data,
        data: giorno,
        campagna: campagna.trim() || "Budget giornaliero",
        importoSpeso: valore,
      });
    } finally {
      setInCorso(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salva();
      }}
      className="grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_8rem_1fr_auto]"
    >
      <Input
        type="date"
        value={giorno}
        onChange={(e) => setGiorno(e.target.value)}
        className="h-9"
      />
      <Input
        inputMode="decimal"
        value={importo}
        onChange={(e) => setImporto(e.target.value)}
        className="h-9 tabular-nums"
      />
      <Input
        value={campagna}
        onChange={(e) => setCampagna(e.target.value)}
        className="col-span-2 h-9 sm:col-span-1"
      />
      <div className="col-span-2 flex gap-1.5 sm:col-span-1">
        <Button type="submit" size="sm" className="h-9" disabled={inCorso}>
          <Check className="h-4 w-4" /> Salva
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

/** Le campagne di un giorno, con quanto è costata ognuna. Non sono più
 *  pulsanti: le righe sintetiche (Meta sincronizzata, stima TikTok) non
 *  esistono nel database e non si possono correggere — un pulsante che a volte
 *  non fa niente è peggio di nessun pulsante. Le registrazioni scritte a mano
 *  si correggono nell'elenco qui sopra. */
function ChipCampagne({ spese }: { spese: { id: string; campagna: string; importo: number }[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {spese.map((s) => (
        <span
          key={s.id}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px]"
        >
          <span className="truncate">{s.campagna}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {euroPreciso(s.importo)}
          </span>
        </span>
      ))}
    </span>
  );
}
