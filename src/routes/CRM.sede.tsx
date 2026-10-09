/** ─────────────────────────────────────────────────────────────────────────
 *  /CRM/sede — CHI VIENE IN SEDE
 *
 *  COS'ERA E PERCHÉ NON FUNZIONAVA
 *  Due elenchi divisi per "acconto pagato" / "in attesa di acconto", e dentro
 *  ogni riga la data dell'appuntamento scritta come tutto il resto: una
 *  pastiglia di testo in mezzo ad altre pastiglie di testo. Il risultato è che
 *  la domanda vera — CHI ARRIVA OGGI, e chi è già venuto senza che nessuno
 *  abbia detto com'è andata — si poteva rispondere solo leggendo riga per riga.
 *  E l'acconto, per quanto conti, non è il criterio con cui si guarda questa
 *  pagina la mattina: il criterio è il tempo.
 *
 *  COM'È ADESSO
 *   · IL SEGNO GRAFICO — ogni riga si apre con la <TesseraSede/>: spillo, data e
 *     ora in un blocco solo, colorato dall'urgenza. Chi viene di persona non
 *     somiglia più a chi fa la consulenza a distanza (che nella riga resta una
 *     pastiglia grigia con l'icona del video).
 *   · L'ORDINE È QUELLO DELLA GIORNATA — Da chiudere · Oggi · Prossimi giorni ·
 *     Data da fissare · Esito registrato. Ogni gruppo è anche un filtro, e ogni
 *     numero in cima porta al suo elenco con un clic.
 *   · LE AZIONI SEMPRE NELLO STESSO POSTO — in fondo a ogni riga, nello stesso
 *     ordine: chiamare, scrivere, registrare il fatto, aprire il pannello.
 *     Quelle a un clic scrivono SUBITO (qui non c'è nessuna bozza aperta).
 *   · UNA SOLA FINESTRA — <FinestraSede/>. Da lì non se ne apre una seconda:
 *     "Scheda completa" chiude prima questa e poi apre quella.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ListFilter,
  MapPin,
  Phone,
  Search,
  UserCheck,
  UserX,
  Video,
  Wallet,
} from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BarraAzioni,
  Chip,
  Kpi,
  KpiRiga,
  PUNTO_TONO,
  Pagina,
  Scheda,
  Segmento,
  Titolo,
  Vuoto,
  etichettaQuando,
  eur,
  normalizza,
  soloCifre,
  soloData,
  useRicerca,
  type Tono,
} from "@/crm/ui";
import {
  ChipVisita,
  FinestraSede,
  TesseraSede,
  cosaMancaVisita,
  patchConfermaSede,
  patchEsitoSede,
  visitaDi,
  type Visita,
} from "@/crm/PannelloSede";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";
import type { Lead, LeadData } from "@/crm/types";

export const Route = createFileRoute("/CRM/sede")({
  component: PaginaSede,
});

/* ═══════════════════════════════════════════════════════════════════════════
   1. I GRUPPI — sono anche i filtri, e sono anche i numeri in cima
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UN SOLO ELENCO DI GRUPPI ──────────────────────────────────────
 *  Titoli, filtri e riquadri numerici nascono tutti da qui. Quando erano tre
 *  elenchi separati bastava aggiungere un caso in uno solo dei tre per far dire
 *  al numero una cosa e all'elenco un'altra — ed è il modo più veloce per far
 *  smettere di fidarsi dei numeri. */
type ChiaveGruppo = "da_chiudere" | "oggi" | "prossimi" | "da_fissare" | "esito";

const GRUPPI: {
  chiave: ChiaveGruppo;
  titolo: string;
  breve: string;
  nota: string;
  tono: Tono;
}[] = [
  {
    chiave: "da_chiudere",
    titolo: "Da chiudere",
    breve: "Da chiudere",
    nota: "L'appuntamento è passato e nessuno ha detto com'è andata",
    tono: "persa",
  },
  {
    chiave: "oggi",
    titolo: "Oggi in sede",
    breve: "Oggi",
    nota: "Arrivano oggi: controlla chi li riceve e cosa devono portare",
    tono: "da_lavorare",
  },
  {
    chiave: "prossimi",
    titolo: "Prossimi giorni",
    breve: "Prossimi",
    nota: "In agenda: resta da farsi confermare chi non ha ancora risposto",
    tono: "in_sospeso",
  },
  {
    chiave: "da_fissare",
    titolo: "Data da fissare",
    breve: "Da fissare",
    nota: "Hanno detto che vengono, ma non c'è ancora un giorno",
    tono: "in_sospeso",
  },
  {
    chiave: "esito",
    titolo: "Esito registrato",
    breve: "Con esito",
    nota: "Sappiamo com'è andata: manca il passo successivo",
    tono: "vinta",
  },
];

/** In quale gruppo cade una visita. Una sola regola, usata da conteggi, filtri
 *  e intestazioni. */
function gruppoDi(v: Visita): ChiaveGruppo {
  if (v.esito) return "esito";
  if (!v.fissata) return "da_fissare";
  if (v.daChiudere) return "da_chiudere";
  if (v.oggi) return "oggi";
  return "prossimi";
}

/** Il filtro attivo: un gruppo, i soli "porta l'acconto", oppure tutto. */
type Filtro = "tutte" | ChiaveGruppo | "acconto";

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA PAGINA
   ═════════════════════════════════════════════════════════════════════════ */

/** Quanto resta da incassare su una trattativa, con i campi che ci sono
 *  davvero: il preventivo meno quello che è già entrato. */
const residuoDi = (d: LeadData) => {
  const prezzo = Number(d.payment?.prezzoFinaleVendita) || Number(d.payment?.prezzoTotale) || 0;
  const acconto = Number(d.payment?.accontoPagato) || 0;
  return prezzo > 0 ? Math.max(0, prezzo - acconto) : 0;
};

/** ── L'OROLOGIO DELLA PAGINA ──────────────────────────────────────────────
 *  Questa pagina resta aperta tutto il giorno sul banco della sede, e quasi
 *  tutto quello che dice dipende dall'ora: chi è atteso adesso, chi è già
 *  passato senza che nessuno abbia detto com'è andata. Con l'ora congelata al
 *  momento dell'apertura, l'appuntamento delle 15 resterebbe in "Oggi in sede"
 *  anche alle 19 — e il colore direbbe il falso proprio mentre lo si guarda.
 *  Un battito al minuto basta: le righe cambiano gruppo da sole, senza che
 *  nessuno debba ricaricare per vedere la verità. */
function useAdesso(): Date {
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    const battito = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(battito);
  }, []);
  return adesso;
}

function PaginaSede() {
  const { leads, consultants, updateLead } = useCRM();
  const ricerca = useRicerca();
  const adesso = useAdesso();

  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [cerca, setCerca] = useState("");
  const [idAperto, setIdAperto] = useState<string | null>(null);
  const [finestraAperta, setFinestraAperta] = useState(false);

  const nomeConsulente = (id?: string | null) =>
    consultants.find((c) => c.id === id)?.data.nome ?? "Da assegnare";

  /** Le righe della pagina: la visita si calcola UNA volta per lead e poi la
   *  usano il gruppo, il filtro, l'ordinamento e la riga. */
  const righe = useMemo(() => {
    return leads
      .filter((l) => l.data.stato === "viene_in_sede")
      .map((l) => {
        const v = visitaDi(l.data, adesso);
        return { lead: l, v, gruppo: gruppoDi(v) };
      })
      .sort((a, b) => {
        //  Chi ha una data viene prima di chi non ce l'ha, e fra le date vince
        //  la più vicina: è l'ordine in cui si lavora la giornata.
        const da = a.v.fissata ? `${a.v.data} ${a.v.ora || "99:99"}` : "9999";
        const db = b.v.fissata ? `${b.v.data} ${b.v.ora || "99:99"}` : "9999";
        return (
          da.localeCompare(db) ||
          `${a.lead.data.cognome || ""} ${a.lead.data.nome || ""}`.localeCompare(
            `${b.lead.data.cognome || ""} ${b.lead.data.nome || ""}`,
          )
        );
      });
  }, [leads, adesso]);

  const conteggi = useMemo(() => {
    const n: Record<ChiaveGruppo, number> = {
      da_chiudere: 0,
      oggi: 0,
      prossimi: 0,
      da_fissare: 0,
      esito: 0,
    };
    let acconto = 0;
    let daIncassare = 0;
    for (const r of righe) {
      n[r.gruppo] += 1;
      if (r.lead.data.accontoVieneInSede) {
        acconto += 1;
        daIncassare += residuoDi(r.lead.data);
      }
    }
    return { ...n, acconto, daIncassare };
  }, [righe]);

  /** La ricerca locale serve con cinquanta righe aperte: si cerca per nome o
   *  per numero, e il numero si confronta a sole cifre (chi cerca non deve
   *  indovinare come è stato scritto il prefisso). */
  const visibili = useMemo(() => {
    const q = normalizza(cerca).trim();
    const cifre = soloCifre(cerca);
    return righe.filter((r) => {
      if (filtro === "acconto" && !r.lead.data.accontoVieneInSede) return false;
      if (filtro !== "tutte" && filtro !== "acconto" && r.gruppo !== filtro) return false;
      if (!q) return true;
      const d = r.lead.data;
      const testo = normalizza(`${d.nome || ""} ${d.cognome || ""} ${d.citta || ""}`);
      return testo.includes(q) || (cifre.length >= 3 && soloCifre(d.telefono).includes(cifre));
    });
  }, [righe, filtro, cerca]);

  const perGruppo = useMemo(
    () =>
      GRUPPI.map((g) => ({ ...g, righe: visibili.filter((r) => r.gruppo === g.chiave) })).filter(
        (g) => g.righe.length > 0,
      ),
    [visibili],
  );

  const apri = (id: string) => {
    setIdAperto(id);
    setFinestraAperta(true);
  };

  //  Il lead della finestra si rilegge SEMPRE dal contesto: dopo un'azione a un
  //  clic l'elenco si aggiorna, e una copia congelata mostrerebbe ancora il
  //  vecchio stato dentro il pannello.
  const leadAperto = useMemo(() => leads.find((l) => l.id === idAperto) ?? null, [leads, idAperto]);

  /** Un filtro si preme due volte per toglierlo: è il gesto che ci si aspetta
   *  da un numero cliccabile, e risparmia il viaggio fino a "Tutte". */
  const alternaFiltro = (f: Filtro) => setFiltro((x) => (x === f ? "tutte" : f));

  return (
    <Pagina>
      <Titolo
        testo="Appuntamento in sede"
        nota={
          righe.length === 0
            ? "Nessuna visita in sede aperta"
            : `${righe.length} ${righe.length === 1 ? "persona attesa" : "persone attese"} in sede · ${conteggi.da_chiudere + conteggi.oggi} da seguire oggi`
        }
        icona={MapPin}
        azioni={
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/CRM/trattative">Tutte le trattative</Link>
          </Button>
        }
      />

      {/* ── I NUMERI ────────────────────────────────────────────────────────
          Ognuno è un pulsante che porta al proprio elenco: un numero che non
          si può aprire costringe a ricostruirlo a mano scorrendo le righe. */}
      <KpiRiga colonne={5}>
        <Kpi
          etichetta="Da chiudere"
          valore={conteggi.da_chiudere}
          nota="Appuntamento passato, esito mancante"
          tono={conteggi.da_chiudere > 0 ? "persa" : "neutro"}
          attivo={filtro === "da_chiudere"}
          onClick={() => alternaFiltro("da_chiudere")}
        />
        <Kpi
          etichetta="Oggi in sede"
          valore={conteggi.oggi}
          nota="Arrivano nella giornata"
          tono={conteggi.oggi > 0 ? "da_lavorare" : "neutro"}
          attivo={filtro === "oggi"}
          onClick={() => alternaFiltro("oggi")}
        />
        <Kpi
          etichetta="Prossimi giorni"
          valore={conteggi.prossimi}
          nota="Già in agenda"
          attivo={filtro === "prossimi"}
          onClick={() => alternaFiltro("prossimi")}
        />
        <Kpi
          etichetta="Data da fissare"
          valore={conteggi.da_fissare}
          nota="Manca il giorno della visita"
          tono={conteggi.da_fissare > 0 ? "in_sospeso" : "neutro"}
          attivo={filtro === "da_fissare"}
          onClick={() => alternaFiltro("da_fissare")}
        />
        <Kpi
          etichetta="Da incassare in sede"
          valore={eur(conteggi.daIncassare)}
          nota={`${conteggi.acconto} ${conteggi.acconto === 1 ? "cliente porta" : "clienti portano"} l'acconto`}
          tono={conteggi.daIncassare > 0 ? "in_sospeso" : "neutro"}
          attivo={filtro === "acconto"}
          onClick={() => alternaFiltro("acconto")}
        />
      </KpiRiga>

      <BarraAzioni>
        <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Segmento
          attivo={filtro === "tutte"}
          onClick={() => setFiltro("tutte")}
          conteggio={righe.length}
        >
          Tutte
        </Segmento>
        {GRUPPI.map((g) => (
          <Segmento
            key={g.chiave}
            attivo={filtro === g.chiave}
            onClick={() => alternaFiltro(g.chiave)}
            conteggio={conteggi[g.chiave]}
            titolo={g.nota}
          >
            {g.breve}
          </Segmento>
        ))}
        <Segmento
          attivo={filtro === "acconto"}
          onClick={() => alternaFiltro("acconto")}
          conteggio={conteggi.acconto}
          titolo="Chi deve portare l'acconto il giorno della visita"
        >
          Porta l'acconto
        </Segmento>
        <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca nome, città o telefono"
            className="h-8 pl-7 text-[12px]"
          />
        </div>
      </BarraAzioni>

      {perGruppo.length === 0 ? (
        <Vuoto
          titolo={righe.length === 0 ? "Nessuno atteso in sede" : "Nessuna riga con questo filtro"}
          testo={
            righe.length === 0
              ? "Le trattative in stato «Appuntamento in sede» compaiono qui con giorno, ora e stato della visita."
              : "Togli il filtro o cambia il testo cercato."
          }
          icona={MapPin}
          azione={
            righe.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFiltro("tutte");
                  setCerca("");
                }}
              >
                Mostra tutte
              </Button>
            ) : undefined
          }
        />
      ) : (
        perGruppo.map((g) => (
          <Scheda
            key={g.chiave}
            titolo={
              <span className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", PUNTO_TONO[g.tono])} />
                {g.titolo}
              </span>
            }
            nota={g.nota}
            azioni={
              <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                {g.righe.length}
              </span>
            }
            senzaPadding
          >
            <ul>
              {g.righe.map((r) => (
                <RigaSede
                  key={r.lead.id}
                  lead={r.lead}
                  visita={r.v}
                  consulente={nomeConsulente(r.lead.data.consulenteId)}
                  onApri={() => apri(r.lead.id)}
                  onScrivi={(patch) => updateLead(r.lead.id, patch)}
                />
              ))}
            </ul>
          </Scheda>
        ))
      )}

      <FinestraSede
        lead={leadAperto}
        aperta={finestraAperta}
        onCambio={setFinestraAperta}
        consulenti={consultants}
        onSalva={updateLead}
        onApriScheda={ricerca.apriLead}
      />
    </Pagina>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA RIGA — tessera a sinistra, azioni in fondo
   ═════════════════════════════════════════════════════════════════════════ */

function RigaSede({
  lead,
  visita,
  consulente,
  onApri,
  onScrivi,
}: {
  lead: Lead;
  visita: Visita;
  consulente: string;
  onApri: () => void;
  /** scrive subito sul database: qui non c'è nessuna bozza da perdere */
  onScrivi: (patch: Partial<LeadData>) => void;
}) {
  const d = lead.data;
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  //  La visita è quella già calcolata dalla pagina: se la ricalcolasse la riga,
  //  la tessera e la frase "Manca:" leggerebbero l'orologio in due momenti.
  const manca = cosaMancaVisita(d, visita);
  const acconto = Number(d.payment?.accontoPagato) || 0;
  const meeting = soloData(d.dataMeeting);
  const wa = d.telefono
    ? buildWhatsAppLink(d.telefono, getWhatsAppMessageForStatus(lead, consulente))
    : null;

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex items-start gap-3 px-3 py-3">
        {/*  IL SEGNO: spillo + giorno + ora. È la prima cosa che l'occhio
            incontra, e da sola distingue una visita in sede da tutto il resto. */}
        <TesseraSede visita={visita} />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onApri}
            className="block max-w-full truncate text-left text-[14px] font-semibold leading-tight hover:underline"
          >
            {nome}
          </button>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {[d.telefono, consulente, d.citta].filter(Boolean).join(" · ")}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChipVisita visita={visita} />
            {acconto > 0 ? (
              <Chip tono="vinta" icona={Wallet}>
                Acconto {eur(acconto)}
              </Chip>
            ) : d.accontoVieneInSede ? (
              <Chip tono="in_sospeso" icona={Wallet}>
                Porta l'acconto
              </Chip>
            ) : null}
            {/*  La consulenza a distanza resta visibile ma spenta: serve a
                capire che questa persona ci ha già parlato, non a competere
                con la tessera della visita. */}
            {meeting && (
              <Chip tono="neutro" icona={Video}>
                A distanza {etichettaQuando(meeting, d.oraMeeting || undefined)}
              </Chip>
            )}
          </div>

          {manca.length > 0 && (
            <p className="mt-1 text-[11px] leading-snug text-amber-700">
              Manca: {manca.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* ── LE AZIONI, SEMPRE IN FONDO E SEMPRE NELLO STESSO ORDINE ────────
          chiamare · scrivere · registrare il fatto del giorno · aprire. Le due
          di mezzo cambiano con il momento della visita, la posizione no. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-muted/30 px-3 py-2">
        {d.telefono && (
          <>
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11.5px]">
              <a href={`tel:${d.telefono}`}>
                <Phone className="mr-1 h-3.5 w-3.5" /> Chiama
              </a>
            </Button>
            {wa && (
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11.5px]">
                <a href={wa} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            )}
          </>
        )}

        {/*  Prima della visita si chiede la conferma; dal giorno stesso in poi
            si registra se è arrivato. Mai le due cose insieme: sono due momenti
            diversi e mostrarle entrambe fa premere quella sbagliata. */}
        {!visita.esito && visita.fissata && !visita.confermata && !visita.daChiudere && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11.5px]"
            onClick={() => onScrivi(patchConfermaSede(true))}
            title="Il cliente ha garantito che verrà"
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Ha confermato
          </Button>
        )}

        {!visita.esito && (visita.oggi || visita.daChiudere) && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-emerald-500/40 px-2 text-[11.5px] text-emerald-700"
              onClick={() => onScrivi(patchEsitoSede("arrivato"))}
            >
              <UserCheck className="mr-1 h-3.5 w-3.5" /> È arrivato
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-rose-500/40 px-2 text-[11.5px] text-rose-700"
              onClick={() => onScrivi(patchEsitoSede("non_presentato"))}
            >
              <UserX className="mr-1 h-3.5 w-3.5" /> Non presentato
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 px-2 text-[11.5px]"
          onClick={onApri}
        >
          {visita.esito ? "Scegli il passo" : visita.fissata ? "Gestisci" : "Fissa la data"}
        </Button>
      </div>
    </li>
  );
}
