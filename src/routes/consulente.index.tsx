// ── LA SUA GIORNATA ─────────────────────────────────────────────────────────
//  La domanda che il consulente si fa venti volte al giorno è una sola: "chi
//  devo sentire adesso, e com'è andata con chi ho già sentito?". Questa pagina
//  risponde a quella, e solo a quella.
//
//  È l'agenda giornaliera dell'amministratore ridotta a una persona sola:
//   · una riga di giorni — due indietro, oggi, sei avanti — perché la giornata
//     non si capisce senza ieri (i no-show da recuperare) né senza domani (chi
//     va confermato stasera);
//   · tre gruppi netti — DA FARE · FATTI · NON PRESENTATI — invece di un elenco
//     unico per orario: sono tre lavori diversi, e mescolarli costringe a
//     leggere ogni riga per capire quale sia quale.
//
//  L'esito di un appuntamento non è un dato a parte: è LO STATO del lead letto
//  in chiave agenda. Così non esiste il caso "consulenza fatta ma lead ancora da
//  contattare": non ci sono due verità da tenere allineate.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  MessageCircle,
  PhoneOff,
  RefreshCw,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useConsulente, azioneLead, mieiLead } from "@/crm/consulente-sessione";
// Stessa lettura dell'agenda dell'amministratore: due funzioni diverse per
// decidere se una consulenza è stata fatta produrrebbero due agende diverse.
import { esitoDi } from "@/crm/MeetGiornalieri";
import {
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
  statiPer,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";

export const Route = createFileRoute("/consulente/")({
  component: GiornataPage,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const giornoDaOggi = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

function GiornataPage() {
  const io = useConsulente();
  const consulenteId = io?.id ?? "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [scarto, setScarto] = useState(0);

  //  Il filtro sta nella richiesta e non nel browser: un consulente non deve
  //  ricevere in pagina i lead dei colleghi, nemmeno per un istante.
  const carica = useCallback(async () => {
    if (!consulenteId) return;
    setCaricando(true);
    const esito = await mieiLead();
    if (!esito.ok) {
      setErrore(esito.motivo ?? "Non è stato possibile caricare gli appuntamenti.");
      setLeads([]);
    } else {
      setErrore(null);
      setLeads(esito.leads as Lead[]);
    }
    setCaricando(false);
  }, [consulenteId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const giorni = useMemo(() => {
    const settimana = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
    return [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((o) => {
      const d = giornoDaOggi(o);
      const nome =
        o === -2
          ? "Altro ieri"
          : o === -1
            ? "Ieri"
            : o === 0
              ? "Oggi"
              : o === 1
                ? "Domani"
                : settimana[d.getDay()];
      return { o, nome, num: d.getDate(), iso: iso(d) };
    });
  }, []);

  const giorno = giorni.find((g) => g.o === scarto) ?? giorni[2];

  const delGiorno = useMemo(
    () =>
      leads
        .filter((l) => l.data.dataMeeting === giorno.iso)
        .sort((a, b) => (a.data.oraMeeting || "").localeCompare(b.data.oraMeeting || "")),
    [leads, giorno.iso],
  );

  //  I "gestire in chat" non sono appuntamenti da fare: sono trattative che
  //  vivono in chat, e lasciarle qui significa cercarle al telefono ogni giorno
  //  senza motivo.
  const daFare = delGiorno.filter(
    (l) => esitoDi(l) === "programmato" && l.data.stato !== "gestire_in_chat",
  );
  const fatti = delGiorno.filter((l) => esitoDi(l) === "completato");
  const nonPresentati = delGiorno.filter((l) => esitoDi(l) === "no_show");

  /** ── CAMBIARE STATO DA QUI ──────────────────────────────────────────────
   *  Appena chiusa la chiamata, senza aprire nulla: è l'unico momento in cui
   *  il consulente ricorda davvero com'è andata. La riga si aggiorna subito e
   *  torna indietro se il salvataggio viene rifiutato — il permesso e
   *  l'assegnazione del lead li decide il server, non questa pagina.
   */
  const cambiaStato = async (l: Lead, stato: LeadStatus) => {
    const precedente = l.data;
    setLeads((prev) =>
      prev.map((x) => (x.id === l.id ? { ...x, data: { ...precedente, stato } } : x)),
    );
    const esito = await azioneLead(l.id, "stato", { stato });
    if (!esito.ok) {
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, data: precedente } : x)));
      toast.error("Stato non salvato", { description: esito.motivo });
      return;
    }
    //  Il lead che torna dal server porta con sé gli automatismi (acconto,
    //  data di conversione): tenersi la versione ottimistica farebbe divergere
    //  la pagina dai numeri.
    if (esito.lead) {
      const aggiornato = esito.lead.data as LeadData;
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, data: aggiornato } : x)));
    }
  };

  if (!io) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-muted-foreground">Bentornato</p>
          <h1 className="text-foreground">{io.nome || "La tua giornata"}</h1>
        </div>
        <button
          type="button"
          onClick={() => void carica()}
          title="Ricarica gli appuntamenti"
          className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${caricando ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── I GIORNI ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {giorni.map((g) => {
          const n = leads.filter((l) => l.data.dataMeeting === g.iso).length;
          const scelto = g.o === scarto;
          return (
            <button
              key={g.o}
              type="button"
              onClick={() => setScarto(g.o)}
              className={`flex min-w-[68px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition ${
                scelto
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {g.nome}
              </span>
              <span className="text-lg font-bold leading-none">{g.num}</span>
              <span
                className={`mt-0.5 text-[10px] font-medium ${scelto ? "opacity-90" : "opacity-70"}`}
              >
                {n === 0 ? "—" : `${n} meet`}
              </span>
            </button>
          );
        })}
      </div>

      {errore && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          {errore}
        </p>
      )}

      {caricando && leads.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Caricamento della giornata…
        </p>
      ) : (
        <>
          <Gruppo
            titolo="Da fare"
            icona={Clock}
            tinta="text-blue-600"
            righe={daFare}
            onStato={cambiaStato}
            nome={io.nome}
            vuoto="Nessun appuntamento in programma per questo giorno."
          />
          <Gruppo
            titolo="Fatti"
            icona={Check}
            tinta="text-emerald-600"
            righe={fatti}
            onStato={cambiaStato}
            nome={io.nome}
            vuoto="Ancora nessuna consulenza conclusa."
          />
          <Gruppo
            titolo="Non presentati"
            icona={PhoneOff}
            tinta="text-rose-600"
            righe={nonPresentati}
            onStato={cambiaStato}
            nome={io.nome}
            vuoto="Nessuno è mancato all'appuntamento."
          />
        </>
      )}
    </div>
  );
}

function Gruppo({
  titolo,
  icona: Icona,
  tinta,
  righe,
  onStato,
  nome,
  vuoto,
}: {
  titolo: string;
  icona: typeof Clock;
  tinta: string;
  righe: Lead[];
  onStato: (l: Lead, s: LeadStatus) => void;
  nome: string;
  vuoto: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icona className={`h-4 w-4 ${tinta}`} />
        <h3 className="text-foreground">{titolo}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {righe.length}
        </span>
      </header>
      {righe.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">{vuoto}</p>
      ) : (
        <ul className="divide-y divide-border">
          {righe.map((l) => (
            <li key={l.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/40">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-foreground">
                  {l.data.nome} {l.data.cognome}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  {l.data.oraMeeting && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {l.data.oraMeeting}
                    </span>
                  )}
                  {/* L'etichetta dello stato È il menu: l'elenco è quello
                      ammesso per questo lead, lo stesso che accetta la rotta,
                      così non si può segnare "venduto" un contatto mai chiamato. */}
                  <select
                    value={l.data.stato}
                    onChange={(e) => onStato(l, e.target.value as LeadStatus)}
                    className={`cursor-pointer rounded border px-1.5 py-px text-[10.5px] font-semibold outline-none ${LEAD_STATUS_COLOR[l.data.stato]}`}
                  >
                    {l.data.stato === "acconto" && (
                      <option value="acconto">{LEAD_STATUS_LABEL.acconto} (automatico)</option>
                    )}
                    {statiPer(l.data).map((st) => (
                      <option key={st} value={st}>
                        {LEAD_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {l.data.telefono && (
                <a
                  href={buildWhatsAppLink(l.data.telefono, getWhatsAppMessageForStatus(l, nome))}
                  target="_blank"
                  rel="noopener"
                  title="Scrivi su WhatsApp"
                  className="shrink-0 rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-500/10"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {l.data.linkMeeting && (
                <a
                  href={l.data.linkMeeting}
                  target="_blank"
                  rel="noopener"
                  title="Entra nella consulenza"
                  className="shrink-0 rounded-lg p-1.5 text-primary transition hover:bg-primary/10"
                >
                  <Video className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
