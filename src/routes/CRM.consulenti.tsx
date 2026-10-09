/** ── COLLABORATORI ─────────────────────────────────────────────────────────
 *
 *  IL NOME DELLA SEZIONE, E PERCHÉ L'INDIRIZZO NON LO SEGUE
 *  A schermo questa pagina si chiama «Collaboratori». Si chiamava
 *  «Consulenti», ma qui dentro ci sono consulenti, setter, driver,
 *  installatori e accompagnatori — i cinque mestieri di crm/kpi-setter.ts, che
 *  stanno tutti nella stessa scheda: il nome vecchio ne nominava UNO e faceva
 *  sembrare gli altri quattro degli ospiti.
 *  ⚠️ IL PERCORSO RESTA /CRM/consulenti, E NON È UNA DIMENTICANZA: rinominarlo
 *   romperebbe i preferiti e i link già mandati ai colleghi in cambio di
 *   niente — nessuno legge la barra degli indirizzi di un CRM. Vale anche per
 *   il nome del file, per la chiave della scheda (`consulenti` in
 *   UserSettingsContext) e per il permesso `consulenti`: sono nomi di codice,
 *   non parole da leggere. Chi fra sei mesi «allinea» tutto questo al titolo
 *   sta solo rompendo dei link.
 *  ⚠️ La parola «consulente» resta dov'è un MESTIERE — il filtro
 *   «Consulenti / Setter» sopra gli elenchi, le etichette dei ruoli, i testi
 *   che parlano di chi svolge le consulenze: lì è esatta. È cambiato il nome
 *   della SEZIONE, non quello del lavoro.
 *
 *  A COSA SERVE QUESTA PAGINA
 *  A rispondere in dieci secondi a una domanda sola: chi sta lavorando bene.
 *  Prima erano riquadri con «Lead / Venduti / No show» — tre conteggi grezzi da
 *  cui il rendimento non si capiva: chi aveva ricevuto il doppio dei lead
 *  sembrava il migliore anche chiudendo la metà. Adesso ogni riga porta gli
 *  appuntamenti, le consulenze svolte, i clienti chiusi e il tasso di
 *  conversione, cioè i numeri con cui si decide a chi dare il prossimo lead.
 *
 *  UN PERIODO SOLO
 *  Il periodo si sceglie qui in alto e vale per tutto: elenco, totali e scheda
 *  del singolo. Due finestre temporali nella stessa pagina fanno litigare due
 *  numeri e non si sa più a quale credere.
 *
 *  LA GESTIONE STA NELLA SCHEDA
 *  Anagrafica, PIN di accesso, orari e disponibilità vivevano in tre posti
 *  diversi (una finestra, un'altra finestra, una striscia gialla dentro la
 *  riga). Ora sono un pannello laterale ampio: si apre premendo il nome o un
 *  numero del consulente.
 *
 *  CHI NON ENTRA VIENE DETTO PRIMA DI TUTTO
 *  Il PIN è la cosa che rende vero un consulente: senza, non apre il CRM e non
 *  entra come presentatore in videoconsulenza. Risultava assegnato a UNA persona
 *  sola, perché stava in fondo a una finestra che nessuno apriva. Adesso, se
 *  qualcuno degli attivi è rimasto fuori, la pagina lo dice in cima con il tasto
 *  che assegna il codice — un clic dall'elenco, non tre.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, KeyRound, Plus, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter, rangeMatch, type DateRange } from "@/crm/DateRangeFilter";
import { BarraAzioni, Pagina, Scheda, Segmento, SepBarra, Titolo } from "@/crm/ui";
import { CLASSE_CAMPO, CampoFinestra, Finestra, SezioneFinestra } from "@/crm/ui/Finestra";
import {
  BottoneCestino,
  ConfermaRimozione,
  ConsultantsPerformance,
  type FiltroAttivi,
  type GruppoNumero,
} from "@/crm/ConsultantsPerformance";
import { SchedaConsulente, type VistaConsulente } from "@/crm/ConsultantKPIDialog";
import { GuardiaPagina } from "@/crm/CRMSidebar";
import { usePuo, fetchCRM } from "@/crm/AuthContext";
import type { FiltroPeriodo } from "@/crm/kpi-calcoli";
import { conMestieri, mestieriDi, type MestieriConsulente } from "@/crm/kpi-setter";
import { SceltaMestieri } from "@/crm/kpi/setter-pezzi";
import type { Consultant, ConsultantData } from "@/crm/types";

interface RichiestaConsulente {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  citta: string | null;
  esperienza: string | null;
  motivazione: string | null;
  status: string;
  created_at: string;
}

export const Route = createFileRoute("/CRM/consulenti")({
  //  Il titolo della finestra è quello che si legge nella linguetta del browser
  //  e nei preferiti: deve dire il nome della sezione, non quello del percorso.
  head: () => ({ meta: [{ title: "Collaboratori — CRM" }] }),
  component: PaginaConsulenti,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const giorniFa = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** Il periodo di partenza. Non «tutto»: sui numeri di sempre nessuno sa a cosa
 *  si riferisce una percentuale, e un consulente arrivato il mese scorso
 *  sembrerebbe fermo. Trenta giorni è la finestra con cui si ragiona in
 *  riunione. */
const PERIODO_INIZIALE: DateRange = { from: giorniFa(29), to: iso(new Date()) };

/** ── LA PERSONA NUOVA NASCE CON UN MESTIERE ────────────────────────────────
 *  Chi si aggiunge da questa pagina può essere un consulente, un setter o
 *  entrambi: sceglierlo qui costa un tocco, e chiederlo dopo vuol dire non
 *  chiederlo mai — la persona finirebbe nella classifica sbagliata dal primo
 *  giorno. Si parte da «consulente», che è il caso più frequente e lo stesso
 *  valore di partenza di chi era già in anagrafica. */
const MESTIERI_NUOVO: MestieriConsulente = { faSetter: false, faConsulente: true };

const gg = (v: string | null) => (v ? v.slice(8, 10) + "/" + v.slice(5, 7) : "—");

function PaginaConsulenti() {
  const { consultants, createConsultant, reload } = useCRM();
  //  ── CHI PUÒ TOGLIERE QUALCUNO ────────────────────────────────────────────
  //   Serve il permesso `consulenti`, lo stesso che apre questa pagina: chi non
  //   ce l'ha non deve nemmeno vedere il cestino. È una cortesia, non una
  //   difesa — il no vero lo dice il server alla prima scrittura (la revoca del
  //   PIN passa da `guardiaCRM(request, cors, "consulenti")`). Si chiede lo
  //   stesso, e non ci si affida alla guardia della pagina: questa tabella
  //   potrebbe finire domani in una schermata senza guardia.
  const puo = usePuo();
  const puoRimuovere = puo("consulenti");

  const [periodo, setPeriodo] = useState<DateRange>(PERIODO_INIZIALE);
  const [filtro, setFiltro] = useState<FiltroAttivi>("tutti");
  const [richieste, setRichieste] = useState<RichiestaConsulente[]>([]);
  const [accessi, setAccessi] = useState<Record<string, boolean>>({});

  const [nuovoAperto, setNuovoAperto] = useState(false);
  //  ⚠️ La scheda vuota passa da `conMestieri`: i due campi del mestiere non
  //  stanno (ancora) in `ConsultantData`, e un letterale con una proprietà in
  //  più verrebbe rifiutato da TypeScript. Stesso schema di
  //  `payment.incassoSaldo` e di `installazione.spedizione`.
  const schedaVuota = (): ConsultantData =>
    conMestieri(
      {
        nome: "",
        email: "",
        giorniLavorativi: [1, 2, 3, 4, 5],
        fasceOrarie: [{ inizio: "09:00", fine: "18:00" }],
        attivo: true,
      },
      MESTIERI_NUOVO,
    );
  const [nuovo, setNuovo] = useState<ConsultantData>(schedaVuota);

  //  Chi si sta togliendo: la finestra di conferma è una sola per tutta la
  //  pagina, e vale sia per il riquadro giallo sia per l'elenco sotto — due
  //  copie della stessa conferma diventano due testi diversi al primo ritocco.
  const [daRimuovere, setDaRimuovere] = useState<Consultant | null>(null);

  const [schedaDi, setSchedaDi] = useState<Consultant | null>(null);
  const [schedaAperta, setSchedaAperta] = useState(false);
  const [gruppoIniziale, setGruppoIniziale] = useState<GruppoNumero>("lead");
  const [vistaIniziale, setVistaIniziale] = useState<VistaConsulente>("numeri");

  /** Un solo filtro-periodo per la pagina: `rangeMatch` è già la regola usata
   *  da tutte le altre schermate con lo stesso selettore di date. */
  const dentro = useCallback<FiltroPeriodo>((v) => rangeMatch(v, periodo), [periodo]);

  const etichettaPeriodo = useMemo(() => {
    if (!periodo.from && !periodo.to) return "tutto lo storico";
    if (periodo.from && periodo.to && periodo.from === periodo.to) return `il ${gg(periodo.from)}`;
    return `dal ${gg(periodo.from || periodo.to)} al ${gg(periodo.to || periodo.from)}`;
  }, [periodo]);

  const conteggi = useMemo(
    () => ({
      tutti: consultants.length,
      attivi: consultants.filter((c) => c.data.attivo).length,
      spenti: consultants.filter((c) => !c.data.attivo).length,
    }),
    [consultants],
  );

  //  ── CHI HA L'ACCESSO ────────────────────────────────────────────────────
  //   Il PIN non è leggibile (il server non lo restituisce), ma sapere CHI può
  //   entrare sì: senza, un consulente attivo da settimane resta fuori dal CRM
  //   e nessuno se ne accorge finché non chiama.
  const chiavi = consultants.map((c) => c.id).join(",");
  useEffect(() => {
    let vivo = true;
    const ids = chiavi ? chiavi.split(",") : [];
    if (ids.length === 0) {
      setAccessi({});
      return;
    }
    Promise.all(
      ids.map(async (id) => {
        try {
          //  Con le credenziali: la rotta chiede il permesso «consulenti», e
          //  senza intestazioni risponderebbe 401 a ogni riga dell'elenco.
          const r = await fetchCRM(`/api/crm/consulente-pin?consultantId=${id}`).then((x) =>
            x.json(),
          );
          if (!r?.ok) return null;
          return [id, !!r.attivo] as const;
        } catch {
          //  Richiesta fallita = non lo sappiamo, e la chiave resta fuori.
          //  Scrivere `false` avrebbe acceso l'allarme "non entra nel CRM" su
          //  gente che ha il PIN: un falso allarme lo si impara a ignorare, e
          //  con lui si ignora anche quello vero.
          return null;
        }
      }),
    ).then((voci) => {
      if (vivo)
        setAccessi(
          Object.fromEntries(voci.filter((v): v is readonly [string, boolean] => v !== null)),
        );
    });
    return () => {
      vivo = false;
    };
  }, [chiavi]);

  //  Gli attivi rimasti fuori: sono il motivo per cui questa pagina ha un
  //  avviso in cima invece di una colonna in più.
  const senzaAccesso = useMemo(
    () => consultants.filter((c) => c.data.attivo && accessi[c.id] === false),
    [consultants, accessi],
  );

  const leggiRichieste = useCallback(async () => {
    const { data } = await supabase
      .from("consultant_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setRichieste(data as RichiestaConsulente[]);
  }, []);

  useEffect(() => {
    void leggiRichieste();
  }, [leggiRichieste]);

  const approva = async (r: RichiestaConsulente) => {
    const creato = await createConsultant({
      nome: r.nome,
      email: r.email,
      telefono: r.telefono ?? undefined,
      giorniLavorativi: [1, 2, 3, 4, 5],
      fasceOrarie: [{ inizio: "09:00", fine: "18:00" }],
      attivo: true,
      approvalStatus: "approved",
      applicationId: r.id,
    });
    if (!creato) {
      toast.error("Errore creazione consulente");
      return;
    }
    await supabase
      .from("consultant_applications")
      .update({
        status: "approved",
        consultant_id: creato.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    toast.success(`${r.nome} approvato`, { description: "Manca solo il PIN per farlo entrare." });
    void leggiRichieste();
    void reload();
    //  Approvare e basta lasciava una persona in anagrafica che non poteva
    //  entrare da nessuna parte: la scheda si apre subito sull'accesso.
    apriAccesso(creato);
  };

  const rifiuta = async (r: RichiestaConsulente) => {
    if (!confirm(`Rifiutare la candidatura di ${r.nome}?`)) return;
    await supabase
      .from("consultant_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    toast.success("Candidatura rifiutata");
    void leggiRichieste();
  };

  const crea = async () => {
    if (!nuovo.nome.trim()) return;
    const creato = await createConsultant({ ...nuovo, approvalStatus: "approved" });
    setNuovoAperto(false);
    setNuovo(schedaVuota());
    //  Si apre subito la sua scheda, e sull'accesso: un consulente appena creato
    //  non ha né PIN né orari, ma senza PIN non entra nemmeno a vedere gli
    //  orari. Prima le chiavi, poi il resto.
    if (creato) apriAccesso(creato);
  };

  const apriScheda = (id: string, gruppo: GruppoNumero) => {
    const c = consultants.find((x) => x.id === id);
    if (!c) {
      //  Righe "Sconosciuto": lead di un consulente cancellato. I numeri
      //  restano nell'elenco, ma non c'è una scheda da aprire.
      toast.message("Consulente non più in anagrafica", {
        description: "I suoi lead restano contati, ma la scheda non esiste più.",
      });
      return;
    }
    setSchedaDi(c);
    setGruppoIniziale(gruppo);
    setVistaIniziale("numeri");
    setSchedaAperta(true);
  };

  /** Un numero del SETTER apre la stessa scheda, sui Numeri: i due mestieri
   *  vivono nello stesso pannello, uno sotto l'altro, perché sono la stessa
   *  persona. Il gruppo del setter lo tiene la scheda (parte da «fissati», il
   *  suo numero principale): passarne uno diverso da qui vorrebbe dire
   *  duplicare in questa pagina l'elenco dei gruppi del telefono. */
  const apriSetter = (id: string) => {
    const c = consultants.find((x) => x.id === id);
    if (!c) return;
    setSchedaDi(c);
    setVistaIniziale("numeri");
    setSchedaAperta(true);
  };

  /** Apre la scheda già sull'accesso: da qui il PIN è una cosa sola da fare,
   *  non una da cercare. */
  const apriAccesso = (c: Consultant | string) => {
    const trovato = typeof c === "string" ? consultants.find((x) => x.id === c) : c;
    if (!trovato) return;
    setSchedaDi(trovato);
    setVistaIniziale("accesso");
    setSchedaAperta(true);
  };

  /** Il cestino, da qualunque dei due punti sia stato premuto: la persona si
   *  ripesca dall'elenco vivo, così la conferma non lavora su una copia
   *  vecchia di dati (nome ed «attivo» cambiano il testo che si legge). */
  const chiediRimozione = (c: Consultant | string) => {
    const trovato = typeof c === "string" ? consultants.find((x) => x.id === c) : c;
    if (!trovato) return;
    setDaRimuovere(trovato);
  };

  /** Fatto: la persona è spenta o cancellata, e in tutti e due i casi il suo
   *  accesso non c'è più. Si scrive subito nella mappa degli accessi, altrimenti
   *  chi è stato solo SPENTO resterebbe segnato «entra nel CRM» fino al
   *  prossimo giro di richieste — cioè finché qualcuno non ricarica. */
  const rimozioneFatta = (id: string) => {
    setAccessi((a) => ({ ...a, [id]: false }));
    if (schedaDi?.id === id) setSchedaAperta(false);
  };

  //  La scheda deve mostrare i dati aggiornati anche dopo un salvataggio:
  //  si ripesca dall'elenco vivo invece di tenere una copia congelata.
  const consulenteAperto = useMemo(
    () => (schedaDi ? (consultants.find((c) => c.id === schedaDi.id) ?? schedaDi) : null),
    [consultants, schedaDi],
  );

  //  ── LA PORTA DELLA PAGINA ────────────────────────────────────────────────
  //  Da qui si assegnano PIN e permessi: è la cassaforte, e chi ci arriva con
  //  l'indirizzo salvato nei preferiti deve leggere perché non entra invece di
  //  trovare un elenco vuoto. Non è la difesa — quella la fa
  //  api.crm.consulente-pin con `guardiaCRM(request, cors, "consulenti")` — ma
  //  è ciò che evita la telefonata «il CRM è rotto».
  return (
    <GuardiaPagina permesso="consulenti">
      <Pagina larga>
        <Titolo
          testo="Collaboratori"
          nota="Chi sta lavorando bene, setter e consulenti su due confronti separati. Apri una scheda per mestiere, accesso, orari e anagrafica."
          icona={Users}
          azioni={
            //  «Persona» e non «consulente»: da qui si aggiunge anche chi fa
            //  solo il setter, e un tasto che dice «consulente» farebbe
            //  cercare un secondo tasto che non esiste.
            <Button onClick={() => setNuovoAperto(true)}>
              <Plus className="h-4 w-4" />
              Aggiungi persona
            </Button>
          }
        />

        <BarraAzioni>
          <DateRangeFilter value={periodo} onChange={setPeriodo} />
          <SepBarra />
          <Segmento
            attivo={filtro === "tutti"}
            onClick={() => setFiltro("tutti")}
            conteggio={conteggi.tutti}
          >
            Tutti
          </Segmento>
          <Segmento
            attivo={filtro === "attivi"}
            onClick={() => setFiltro("attivi")}
            conteggio={conteggi.attivi}
            titolo="Ricevono nuovi lead"
          >
            Attivi
          </Segmento>
          <Segmento
            attivo={filtro === "spenti"}
            onClick={() => setFiltro("spenti")}
            conteggio={conteggi.spenti}
            titolo="Non ricevono più lead, ma i loro numeri restano"
          >
            Spenti
          </Segmento>
        </BarraAzioni>

        {/*  ── CHI NON PUÒ ENTRARE ───────────────────────────────────────────
          Ambra perché manca un passaggio, non perché qualcosa è rotto. Sparisce
          da sola quando tutti hanno le chiavi: un avviso permanente diventa
          arredamento e smette di essere letto. */}
        {senzaAccesso.length > 0 && (
          <Scheda
            titolo={
              senzaAccesso.length === 1
                ? "Un consulente attivo non entra nel CRM"
                : `${senzaAccesso.length} consulenti attivi non entrano nel CRM`
            }
            nota="Senza PIN non aprono il CRM e non entrano in videoconsulenza"
            icona={KeyRound}
            className="border-amber-300/70"
            senzaPadding
          >
            <ul className="divide-y divide-border">
              {senzaAccesso.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{c.data.nome}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {c.data.email || "Nessuna email"}
                    </span>
                  </span>
                  <Button size="sm" onClick={() => apriAccesso(c)}>
                    <KeyRound className="h-3.5 w-3.5" /> Assegna PIN
                  </Button>
                  {/*  Il cestino anche qui, ma in sordina: in questo riquadro
                      la cosa da fare è dare il PIN, e chi ha appena approvato
                      una persona non deve trovarsi due tasti che pesano
                      uguale. Serve però esserci: capita di accorgersi proprio
                      adesso che quella persona non doveva entrare. */}
                  {puoRimuovere && (
                    <BottoneCestino
                      nome={c.data.nome || "questa persona"}
                      onClick={() => chiediRimozione(c)}
                      className="-mr-1"
                    />
                  )}
                </li>
              ))}
            </ul>
          </Scheda>
        )}

        {richieste.length > 0 && (
          <Scheda
            titolo={`Richieste in attesa (${richieste.length})`}
            nota="Candidature arrivate dal modulo pubblico"
            icona={UserCheck}
            /*  Sky: è una decisione da prendere adesso. L'ambra è riservata a
              quello che è già dentro e resta a metà (il PIN mancante). */
            className="border-sky-300/70"
            senzaPadding
          >
            <ul className="divide-y divide-border">
              {richieste.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">{r.nome}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {r.email} · {r.telefono || "—"} · {r.citta || "—"}
                    </p>
                    {r.esperienza && (
                      <p className="mt-1 text-[12px]">
                        <span className="text-muted-foreground">Esperienza: </span>
                        {r.esperienza}
                      </p>
                    )}
                    {r.motivazione && (
                      <p className="mt-0.5 text-[12px]">
                        <span className="text-muted-foreground">Motivazione: </span>
                        {r.motivazione}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" onClick={() => approva(r)}>
                      <Check className="h-3.5 w-3.5" /> Approva
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rifiuta(r)}>
                      <X className="h-3.5 w-3.5" /> Rifiuta
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Scheda>
        )}

        <ConsultantsPerformance
          dentro={dentro}
          etichettaPeriodo={etichettaPeriodo}
          filtro={filtro}
          accessi={accessi}
          onApri={apriScheda}
          onApriSetter={apriSetter}
          onAccesso={apriAccesso}
          onElimina={puoRimuovere ? chiediRimozione : undefined}
        />

        <ConfermaRimozione
          consulente={daRimuovere}
          aperta={!!daRimuovere}
          onCambio={(v) => {
            if (!v) setDaRimuovere(null);
          }}
          accessoAttivo={daRimuovere ? accessi[daRimuovere.id] : undefined}
          onFatto={rimozioneFatta}
        />

        <SchedaGoogle />

        <SchedaConsulente
          consulente={consulenteAperto}
          aperta={schedaAperta}
          onCambio={setSchedaAperta}
          dentro={dentro}
          etichettaPeriodo={etichettaPeriodo}
          gruppoIniziale={gruppoIniziale}
          vistaIniziale={vistaIniziale}
          onAccessoCambiato={(id, attivo) => setAccessi((a) => ({ ...a, [id]: attivo }))}
        />

        <Finestra
          aperta={nuovoAperto}
          onCambio={setNuovoAperto}
          titolo="Aggiungi una persona"
          contesto="Nome, email e mestiere: PIN e orari si impostano subito dopo, nella sua scheda."
          icona={UserPlus}
          larghezza="sm"
          azioni={
            <>
              <Button
                variant="outline"
                onClick={() => setNuovoAperto(false)}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                Annulla
              </Button>
              <Button onClick={crea} disabled={!nuovo.nome.trim()}>
                Crea consulente
              </Button>
            </>
          }
        >
          <SezioneFinestra classeCorpo="p-4 space-y-3">
            <CampoFinestra etichetta="Nome" obbligatorio>
              <Input
                value={nuovo.nome}
                onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
                placeholder="Mario Rossi"
                className={CLASSE_CAMPO}
              />
            </CampoFinestra>
            <CampoFinestra etichetta="Email" nota="Serve per riconoscerlo e per le comunicazioni.">
              <Input
                value={nuovo.email || ""}
                onChange={(e) => setNuovo({ ...nuovo, email: e.target.value })}
                placeholder="nome@studio.it"
                className={CLASSE_CAMPO}
              />
            </CampoFinestra>

            {/*  ── CHE MESTIERE FA ──────────────────────────────────────────
              È qui e non nella scheda perché decide in quale confronto
              comparirà da subito — e da oggi anche che cosa potrà toccare:
              chiederlo dopo vuol dire non chiederlo mai. Sono interruttori
              indipendenti e si sommano — una persona può telefonare la mattina,
              fare consulenze il pomeriggio, andare a posare il giorno dopo,
              affiancare un collega su una posa e guidare quando serve — e il
              permesso è la somma di quello che serve a ciascuno.
              ⚠️ Qui però NON si apre ancora niente: senza PIN non si entra da
              nessuna parte, e i permessi si scrivono nella riga del PIN. Si
              assegna dalla scheda, in «Accesso», dove si vede anche l'elenco per
              esteso di che cosa quella persona potrà fare. */}
            <CampoFinestra
              etichetta="Che mestiere fa"
              nota="Decide su quali numeri viene misurata, cosa le si può far fare su una posa (eseguirla, affiancarla, portarci qualcuno) o su un ritorno per la manutenzione, e che cosa potrà toccare nel CRM: ogni mestiere apre quello che gli serve, e si possono accendere tutti. Le chiavi di casa (ADMIN) no: quelle si danno dalla scheda, insieme al PIN."
            >
              <SceltaMestieri
                faSetter={mestieriDi(nuovo).faSetter}
                faConsulente={mestieriDi(nuovo).faConsulente}
                faDriver={mestieriDi(nuovo).faDriver}
                faInstallatore={mestieriDi(nuovo).faInstallatore}
                faAccompagnatore={mestieriDi(nuovo).faAccompagnatore}
                faManutentore={mestieriDi(nuovo).faManutentore}
                onCambio={(patch) => setNuovo((d) => conMestieri(d, patch))}
              />
            </CampoFinestra>
          </SezioneFinestra>
        </Finestra>
      </Pagina>
    </GuardiaPagina>
  );
}

/** ── GOOGLE CALENDAR: ISTRUZIONI, NON FUNZIONE ─────────────────────────────
 *  Il collegamento non serve più (appuntamenti, link e disponibilità li fa la
 *  piattaforma), ma su installazioni vecchie l'errore «redirect_uri_mismatch»
 *  compare ancora: le istruzioni restano, chiuse, in fondo alla pagina, dove
 *  non rubano attenzione a chi sta guardando i numeri. */
function SchedaGoogle() {
  const [aperta, setAperta] = useState(false);
  const [origine, setOrigine] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigine(window.location.origin);
  }, []);
  const callback = origine ? `${origine}/api/google-oauth-callback` : "";
  const copia = (t: string) => {
    void navigator.clipboard.writeText(t).then(() => toast.success("Copiato"));
  };
  return (
    <Scheda senzaPadding>
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
          Google Calendar — non serve più collegarlo. Istruzioni per l&apos;errore
          «redirect_uri_mismatch»
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aperta ? "rotate-180" : ""}`}
        />
      </button>
      {aperta && (
        <div className="space-y-3 border-t border-border px-4 py-3 text-[12px]">
          <p className="text-muted-foreground">
            Vale solo se stai ancora usando un collegamento Google storico. Autorizza gli URL di
            callback nella Google Cloud Console → Credentials, dentro il tuo OAuth 2.0 Client ID.
          </p>
          <RigaCopia testo={callback} onCopia={copia} />
          <RigaCopia
            testo="https://developer-hairgeniuslabs.lovable.app/api/google-oauth-callback"
            onCopia={copia}
          />
          <p className="text-muted-foreground">
            Salva, attendi un paio di minuti e riprova. L&apos;URL di anteprima cambia a ogni
            ricostruzione: conviene provare sul dominio pubblicato.
          </p>
        </div>
      )}
    </Scheda>
  );
}

function RigaCopia({ testo, onCopia }: { testo: string; onCopia: (t: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
      <code className="min-w-0 flex-1 break-all text-[11px]">{testo || "—"}</code>
      <Button size="sm" variant="outline" onClick={() => onCopia(testo)} disabled={!testo}>
        Copia
      </Button>
    </div>
  );
}
