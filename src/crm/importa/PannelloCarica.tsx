/** ── CARICARE UNA LISTA DI CONTATTI ────────────────────────────────────────
 *
 *  Il pannello che legge un CSV (o un backup dell'archivio), mostra
 *  l'ANTEPRIMA e solo dopo scrive. Stava dentro routes/CRM.importa.tsx, cioè
 *  dentro la pagina della coda di chiamata, ed è uscito di lì il giorno in cui
 *  il committente ha chiesto «una scheda per importare i lead»: adesso lo usano
 *  DUE pagine — la coda, che ce l'ha ancora nella sua testata, e la scheda
 *  nuova (routes/CRM.importa-lead.tsx).
 *
 *  ⚠️ È LO STESSO IDENTICO PANNELLO, non una copia. Due schermate che leggono
 *   un CSV con due pezzi di codice diversi diventano, al primo ritocco, due
 *   schermate che importano in due modi diversi — e la differenza la si scopre
 *   sulle schede dei clienti, non qui.
 *
 *  ── ⚠️ PRIMA SI GUARDA, POI SI SCRIVE ────────────────────────────────────
 *  Sceglierne il file non scrive niente: si legge, si mostra quante righe sono
 *  e che cosa contengono, e solo dopo compare il pulsante che importa. Un
 *  caricamento fatto al buio su ottocento schede non si annulla con un tasto:
 *  si annulla ricostruendo l'archivio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check, FileSpreadsheet, Table2, Upload, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { mestieriDi } from "@/crm/kpi-setter";
import { LEAD_STATUS_LABEL, type Lead, type LeadData } from "@/crm/types";
import { Kpi, KpiRiga, dataBreve, etichettaStato } from "@/crm/ui";
import { patchRicarico } from "@/crm/importa/ricarico";
import {
  dividiLead,
  noteDelLead,
  separaRitorni,
  traduciArchivio,
  traduciCsv,
  type ArchivioCrm,
  type EsitoTraduzione,
} from "@/crm/import-backup";

/** Le colonne dell'anteprima: cinque, quelle da cui si vede se un valore è
 *  finito nella casella sbagliata. Le altre quattro che c'erano prima non
 *  rispondevano a nessuna domanda che qualcuno si fa davanti a un CSV. */
const COLONNE_ANTEPRIMA: { chiave: keyof LeadData; etichetta: string }[] = [
  { chiave: "nome", etichetta: "Nome" },
  { chiave: "cognome", etichetta: "Cognome" },
  { chiave: "telefono", etichetta: "Telefono" },
  { chiave: "citta", etichetta: "Città" },
  { chiave: "stato", etichetta: "Stato" },
];

/** I campi che si sperano riconosciuti. L'ordine è quello dell'importanza: il
 *  telefono è la ragione per cui si carica una lista. */
const CAMPI_ATTESI: { chiave: keyof LeadData; etichetta: string }[] = [
  { chiave: "telefono", etichetta: "telefono" },
  { chiave: "nome", etichetta: "nome" },
  { chiave: "cognome", etichetta: "cognome" },
  { chiave: "citta", etichetta: "città" },
  { chiave: "email", etichetta: "email" },
  { chiave: "fonte", etichetta: "fonte" },
  /*  ── ⚠️ ANCHE QUESTE DUE VANNO DETTE ──────────────────────────────────
      Le liste di Meta portano le risposte del modulo e l'inserzione da cui
      arriva il contatto, e da oggi le importiamo (vedi crm/modulo-lead.ts).
      Se non comparissero qui, chi guarda l'anteprima non avrebbe modo di
      accorgersi che NON sono state capite — e il file si importerebbe lo
      stesso, con le schede mute. */
  { chiave: "modulo", etichetta: "risposte del modulo" },
  { chiave: "tracking", etichetta: "campagna e inserzione" },
  { chiave: "note", etichetta: "note" },
];

function valoreAnteprima(d: LeadData, k: keyof LeadData): string {
  const v = d[k];
  if (v == null || v === "") return "";
  if (k === "stato") return etichettaStato(String(v));
  if (k === "createdAt") return dataBreve(String(v));
  return String(v);
}

export function PannelloCarica({
  onLetti,
}: {
  /** ── I CONTATTI DI RITORNO ESCONO DA QUI SUBITO ────────────────────────
   *  Gli id delle schede che il file ha riportato a galla, consegnati alla
   *  pagina NEL MOMENTO DELLA LETTURA e non dopo l'importazione.
   *  ⚠️ Chiamarlo dopo la scrittura sembrava naturale ed era un buco: un file
   *  fatto tutto di persone già in archivio non ha niente da creare, quindi il
   *  pulsante «Importa» resta spento e la scrittura non avviene mai — e quelle
   *  telefonate, che sono le migliori della giornata, non sarebbero mai
   *  arrivate in coda. Riconoscere non è scrivere: il primo può accadere da
   *  solo, il secondo no. */
  onLetti: (idDiRitorno: string[]) => void;
}) {
  const { leads, consultants, reload, updateLead } = useCRM();
  const { user, consulente } = useAuth();
  const [esito, setEsito] = useState<EsitoTraduzione | null>(null);
  const [nomeFile, setNomeFile] = useState("");
  const [colonneIgnorate, setColonneIgnorate] = useState<string[]>([]);
  const [lavoro, setLavoro] = useState<{ fatti: number; totale: number } | null>(null);
  const [fine, setFine] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** Chi è nuovo, chi è di ritorno, quante righe si ripetono dentro il file:
   *  UNA sola divisione, quella di import-backup. Quando il conto e l'elenco
   *  venivano da due calcoli diversi, un giorno dicevano due cose. */
  const { nuovi, ritorni, ripetute } = useMemo(
    () => separaRitorni(esito?.leads ?? [], leads ?? []),
    [esito, leads],
  );

  /** Quali campi sono arrivati pieni almeno una volta. È la sola domanda che
   *  si fa chi guarda un'anteprima: «la colonna telefono è stata capita?». */
  const capiti = useMemo(() => {
    if (!esito) return { dentro: [] as string[], fuori: [] as string[] };
    const dentro: string[] = [];
    const fuori: string[] = [];
    for (const c of CAMPI_ATTESI) {
      const pieni = esito.leads.some((d) => {
        const v = d[c.chiave];
        return v != null && v !== "";
      });
      (pieni ? dentro : fuori).push(c.etichetta);
    }
    return { dentro, fuori };
  }, [esito]);

  const leggi = async (f: File) => {
    setFine(null);
    setColonneIgnorate([]);
    try {
      const testo = await f.text();
      //  Dalla stessa porta entrano due cose diverse: una lista di contatti
      //  (CSV) e il backup completo di un CRM (JSON, con consulenti e spese).
      //  Si distinguono dall'estensione e, se manca, dalla prima parentesi.
      const csv =
        /\.(csv|tsv|txt)$/i.test(f.name) ||
        (!testo.trim().startsWith("{") && !testo.trim().startsWith("["));
      let letto: EsitoTraduzione;
      if (csv) {
        const r = traduciCsv(testo);
        letto = {
          leads: r.leads,
          consulenti: [],
          spese: [],
          statiTradotti: {},
          scartate: r.scartate,
        };
        setColonneIgnorate(r.colonneIgnorate);
      } else {
        letto = traduciArchivio(JSON.parse(testo) as ArchivioCrm);
      }
      setEsito(letto);
      setNomeFile(f.name);
      //  La divisione si rifà qui invece di aspettare il `useMemo`: quello
      //  lavora sullo stato, che a questo punto non è ancora aggiornato. È la
      //  STESSA funzione con gli STESSI argomenti, quindi non può dire una cosa
      //  diversa da quella che l'anteprima mostrerà un istante dopo.
      onLetti(separaRitorni(letto.leads, leads ?? []).ritorni.map((r) => r.scheda.id));
      toast.success("File letto", {
        description: "Niente è stato ancora scritto: controlla qui sotto e poi importa.",
      });
    } catch (err) {
      console.error(err);
      setEsito(null);
      setNomeFile("");
      toast.error("File non leggibile", {
        description: "Serve un CSV di contatti (intestazione sulla prima riga) o il backup JSON.",
      });
    }
  };

  /** ── CHI CARICA LA LISTA SE LA PRENDE ───────────────────────────────────
   *  Se a importare è un setter (o un consulente) collegato col PIN, le schede
   *  nascono già assegnate a lui. Prima nascevano di nessuno, e nessuno voleva
   *  dire due cose insieme: non comparivano nel filtro «di chi» di «Da fare
   *  oggi», e restavano lì finché un titolare non premeva «spartisci» — cioè
   *  finché qualcuno non si ricordava di una lista che aveva caricato un altro.
   *  Chi lavora i lead è chi ha almeno uno dei due mestieri: un driver o un
   *  installatore che importa un archivio non deve ritrovarsi trecento
   *  telefonate da fare.
   *  ⚠️ Il titolare che importa senza PIN NON assegna niente: le schede restano
   *   libere e le spartisce il pulsante che c'è già, che sa distribuirle per
   *   carico. Assegnarle tutte a un titolare che non telefona sarebbe peggio di
   *   lasciarle libere.
   *  ⚠️ E non si sovrascrive un'assegnazione che arriva dal file: un backup
   *   JSON porta il suo `consulenteId`, ed è la storia vera di quelle schede. */
  const mioId = useMemo(() => {
    if (!consulente?.id) return "";
    const scheda = consultants.find((c) => c.id === consulente.id);
    const m = mestieriDi(scheda?.data);
    return m.faSetter || m.faConsulente ? consulente.id : "";
  }, [consulente, consultants]);

  const scrivi = async () => {
    if (!esito || !user) return;
    //  Il nome del file si legge ADESSO: più sotto viene azzerato, e finirebbe
    //  vuoto proprio nella riga che deve dire da quale lista è tornato.
    const fileDi = nomeFile;
    setLavoro({ fatti: 0, totale: nuovi.length });
    let inseriti = 0;

    //  A blocchi: ottocento righe in una sola richiesta è il modo più semplice
    //  per farsi respingere dal database a metà strada.
    const BLOCCO = 50;
    for (let i = 0; i < nuovi.length; i += BLOCCO) {
      const parte = nuovi.slice(i, i + BLOCCO).map((d) => ({
        user_id: user.id,
        data: {
          ...d,
          importato: true,
          ...(mioId && !d.consulenteId ? { consulenteId: mioId } : {}),
        } as never,
      }));
      const { error } = await supabase.from("crm_leads").insert(parte as never);
      if (error) {
        console.error(error);
        toast.error("Importazione interrotta", { description: error.message });
        break;
      }
      inseriti += parte.length;
      setLavoro({ fatti: Math.min(i + BLOCCO, nuovi.length), totale: nuovi.length });
    }

    /*  ── ⚠️ I CONTATTI DI RITORNO SI SEGNANO SULLA SCHEDA ────────────────
        Richiesta del committente: «quando è duplicato dove va? Voglio che
        sposta il lead duplicato dentro la scheda importati, mantenendo stato
        attuale, note e tutto».
        Prima non finivano da nessuna parte: erano un `Set` di id dentro la
        schermata della coda, e caricando da «Importa lead» — cioè dalla
        schermata fatta apposta per caricare — quel `Set` veniva buttato via.
        Il conto «Di ritorno: 1» si leggeva nell'anteprima e poi quella persona
        spariva.
        Adesso si scrive sulla SUA scheda che è ricomparsa, quante volte, e che
        aspetta una decisione. Nient'altro viene toccato: stato, note,
        appuntamenti e storia restano quelli che sono.
        ⚠️ IN UN SOLO INVIO OGNI CINQUANTA, come le nuove. Una modifica per
         riga voleva dire ottanta richieste in fila su una lista di ottanta
         ritorni — su una connessione di studio sono minuti, e ogni richiesta è
         un'occasione in più di fallire a metà. */
    let segnati = 0;
    const idRitorni = ritorni.map((r) => r.scheda.id);
    /*  ── ⚠️ SI SCRIVE COME SCRIVE TUTTO IL RESTO DEL CRM ────────────────
        Qui c'era una strada sua: si rileggeva un blocco di cinquanta schede e
        si faceva un `upsert`. Rileggere era già meglio di scrivere la copia a
        schermo (era il guasto di prima), ma restavano due differenze con
        `updateLead`, che è la porta da cui passano tutte le altre venti
        schermate:
         · `updateLead` scrive SOLO SE `updated_at` combacia con quello che ha
           appena letto, e se non combacia rilegge e riprova. L'upsert scriveva
           comunque: fra la lettura e la scrittura del blocco un collega poteva
           aver cambiato stato a una di quelle schede, e quella modifica
           spariva senza un errore;
         · un `upsert` su una scheda ELIMINATA nel frattempo la fa rinascere,
           perché «upsert» vuol dire «se non c'è, crea». Una scheda cancellata
           che torna da sola è il tipo di cosa che si attribuisce a un fantasma.
        Due modi di salvare la stessa cosa sono due modi che un giorno
        divergono: adesso ce n'è uno.
        ⚠️ A ONDE DI DIECI, non una per volta e non ottanta insieme: una per
         volta su una lista di ottanta ritorni erano minuti di attesa (è il
         motivo per cui il blocco era nato), ottanta in parallelo sono ottanta
         richieste insieme su una connessione di studio. Dieci è la via di
         mezzo che tiene i tempi di prima senza perdere la guardia. */
    const ONDA = 10;
    for (let i = 0; i < idRitorni.length; i += ONDA) {
      const onda = idRitorni.slice(i, i + ONDA);
      //  ⚠️ La modifica è una FUNZIONE: si compone su `attuale`, cioè sulla
      //   scheda appena riletta da `updateLead`, non su quella che questa
      //   pagina ha in memoria — che è vecchia di tutto il tempo
      //   dell'importazione.
      const esiti = await Promise.all(
        onda.map((id) => updateLead(id, (attuale) => patchRicarico(attuale, fileDi))),
      );
      const falliti = esiti.filter((ok) => !ok).length;
      segnati += esiti.length - falliti;
      if (falliti) {
        //  Non si interrompe l'importazione: le schede nuove sono già entrate e
        //  sono la parte che non si può rifare senza sdoppiare nessuno.
        toast.error(
          falliti === 1
            ? "1 contatto di ritorno non segnato"
            : `${falliti} contatti di ritorno non segnati`,
          {
            description:
              "Le altre schede sono a posto: ricarica la lista per riprovare solo questi.",
          },
        );
      }
    }

    //  Consulenti e spese arrivano solo dal backup JSON, e i consulenti solo se
    //  il nome qui non c'è già: reimportare un archivio non deve sdoppiare le
    //  persone dello studio.
    let consAggiunti = 0;
    const nomiEsistenti = new Set(consultants.map((c) => (c.data.nome || "").trim().toLowerCase()));
    const consNuovi = esito.consulenti.filter(
      (c) => !nomiEsistenti.has((c.nome || "").trim().toLowerCase()),
    );
    if (consNuovi.length) {
      const { error } = await supabase
        .from("crm_consultants")
        .insert(consNuovi.map((d) => ({ user_id: user.id, data: d as never })) as never);
      //  La risposta si legge: un errore ingoiato qui faceva credere per giorni
      //  che i consulenti fossero entrati.
      if (error) toast.error("Consulenti non importati", { description: error.message });
      else consAggiunti = consNuovi.length;
    }
    if (esito.spese.length) {
      const { error } = await supabase
        .from("crm_ad_spending")
        .insert(esito.spese.map((d) => ({ user_id: user.id, data: d as never })) as never);
      if (error) toast.error("Spese pubblicitarie non importate", { description: error.message });
    }

    setLavoro(null);
    setFine(
      [
        `${inseriti} schede nuove`,
        segnati
          ? `${segnati} di ritorno, in cima ai «Lead importati» in attesa di una decisione`
          : "",
        ripetute ? `${ripetute} righe ripetute contate una volta` : "",
        esito.scartate ? `${esito.scartate} scartate` : "",
        consAggiunti ? `${consAggiunti} consulenti` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
    setEsito(null);
    setNomeFile("");
    await reload();
    toast.success(
      inseriti ? `Importate ${inseriti} schede` : `Segnati ${segnati} contatti di ritorno`,
      {
        description: segnati
          ? `In coda, pronte da chiamare. ${segnati === 1 ? "Una persona era" : `${segnati} persone erano`} già in archivio: ${segnati === 1 ? "la trovi" : "le trovi"} in cima ai «Lead importati», da confermare o rimettere fra i da contattare.`
          : "Sono in coda, pronte da chiamare.",
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,.csv,.tsv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void leggi(f);
          }}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Scegli il file
        </Button>
        <span className="text-[12px] text-muted-foreground">
          {nomeFile || "CSV o TSV di contatti · oppure il backup JSON di un CRM"}
        </span>
      </div>

      {fine && (
        <p className="flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12.5px] text-emerald-800">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fine}
        </p>
      )}

      {esito && (
        <>
          <KpiRiga colonne={4}>
            <Kpi etichetta="Righe lette" valore={esito.leads.length} />
            <Kpi
              etichetta="Da creare"
              valore={nuovi.length}
              nota="schede nuove"
              tono={nuovi.length > 0 ? "vinta" : "neutro"}
            />
            {/*  Non «saltati»: erano già in archivio e sono tornati. È il
                contatto più caldo che ci sia — ci abbiamo già parlato. */}
            <Kpi
              etichetta="Di ritorno"
              valore={ritorni.length}
              nota="già in archivio: aspettano una decisione"
              tono={ritorni.length > 0 ? "in_sospeso" : "neutro"}
            />
            <Kpi
              etichetta="Scartate"
              valore={esito.scartate}
              nota="senza nome né telefono"
              tono={esito.scartate > 0 ? "persa" : "neutro"}
            />
          </KpiRiga>

          {/* ── COME È STATO CAPITO, IN UNA RIGA ──────────────────────────── */}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">Capiti:</b> {capiti.dentro.join(", ") || "nessun campo"}.
            {capiti.fuori.length > 0 && ` Vuoti o assenti: ${capiti.fuori.join(", ")}.`}
            {colonneIgnorate.length > 0 && (
              <>
                {" "}
                <AlertTriangle className="inline h-3.5 w-3.5 -translate-y-px text-amber-600" />{" "}
                Colonne del file rimaste fuori:{" "}
                <b className="text-foreground">{colonneIgnorate.join(", ")}</b>. Se una contiene un
                dato che ti serve, rinominala nel file (per esempio «telefono», «email», «città») e
                ricarica: nessuna riga è stata ancora scritta.
              </>
            )}
            {Object.keys(esito.statiTradotti).length > 0 && (
              <>
                {" "}
                Stati portati al corrispondente per significato:{" "}
                {Object.entries(esito.statiTradotti)
                  .map(([da, v]) => `${da} → ${LEAD_STATUS_LABEL[v.a]} (${v.n})`)
                  .join(" · ")}
                .
              </>
            )}
          </p>

          {/* ── LE PRIME RIGHE, COME VERRANNO SCRITTE ─────────────────────── */}
          {esito.leads.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {COLONNE_ANTEPRIMA.map((c) => (
                      <th key={String(c.chiave)} className="px-3 py-1.5 font-medium">
                        {c.etichetta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {esito.leads.slice(0, 3).map((d, i) => (
                    <tr key={i}>
                      {COLONNE_ANTEPRIMA.map((c) => (
                        <td key={String(c.chiave)} className="max-w-[180px] truncate px-3 py-1.5">
                          {valoreAnteprima(d, c.chiave) || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/*  ── ⚠️ SI ACCENDE ANCHE SE NON C'È NIENTE DI NUOVO ──────────
                Restava spento quando il file era fatto tutto di persone già in
                archivio, e quello è il caso in cui serve di più: sono i
                contatti più caldi che ci siano — ci abbiamo già parlato — e
                senza questo gesto nessuno li segnava e nessuno li vedeva. */}
            <Button
              onClick={() => void scrivi()}
              disabled={!!lavoro || (nuovi.length === 0 && ritorni.length === 0)}
            >
              {lavoro
                ? `Importazione… ${lavoro.fatti}/${lavoro.totale}`
                : nuovi.length === 0
                  ? ritorni.length === 0
                    ? "Niente da importare"
                    : `Segna ${ritorni.length} di ritorno`
                  : ritorni.length === 0
                    ? `Importa ${nuovi.length} schede`
                    : `Importa ${nuovi.length} schede e segna ${ritorni.length} di ritorno`}
            </Button>
            <p className="text-[12px] text-muted-foreground">
              {nuovi.length === 0 && ritorni.length > 0
                ? "Tutte le righe leggibili risultano già in archivio: importarle di nuovo le sdoppierebbe. Vengono segnate sulla loro scheda e finiscono in cima ai «Lead importati», dove decidi se lasciarle come stanno o rimetterle fra i da contattare."
                : "Da qui in poi il database viene toccato."}
            </p>
          </div>
        </>
      )}

      <p className="border-t border-border pt-2 text-[11.5px] text-muted-foreground">
        Cerchi la copia completa del database — scaricarla e rimetterla dentro? Si fa in{" "}
        <Link
          to="/CRM/impostazioni"
          search={{ tab: "dati" }}
          className="font-medium text-foreground underline underline-offset-2"
        >
          Impostazioni → Dati
        </Link>
        . Qui si aggiunge, non si sovrascrive.
      </p>
    </div>
  );
}
