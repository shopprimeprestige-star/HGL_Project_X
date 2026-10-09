// ── I SUOI NUMERI ───────────────────────────────────────────────────────────
//  Sette numeri, non un cruscotto: quanti lead gli sono stati affidati, quanti
//  appuntamenti ne ha ricavato, quante persone si sono presentate, quante hanno
//  comprato, quanto ha incassato, quanto converte e quanti buchi ha in agenda.
//
//  OGNI NUMERO HA LA SUA DATA, ed è la scelta che rende questa pagina onesta:
//   · i lead si contano dal giorno in cui sono arrivati;
//   · gli appuntamenti dal giorno in cui erano fissati;
//   · le vendite dal giorno in cui sono state chiuse, non da quello in cui il
//     contatto è entrato in archivio.
//  Attribuire tutto alla data di ingresso farebbe sparire dal mese in corso una
//  vendita chiusa oggi su un lead di marzo — cioè proprio il lavoro fatto.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Euro, PhoneOff, Target, TrendingUp, UserCheck, Users } from "lucide-react";
import { useConsulente, mieiLead } from "@/crm/consulente-sessione";
import { esitoDi } from "@/crm/MeetGiornalieri";
import { leadAttributionDate, leadConversionDate } from "@/crm/lead-analytics";
import type { Lead } from "@/crm/types";

export const Route = createFileRoute("/consulente/kpi")({
  component: NumeriPage,
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PERIODI = [
  { giorni: 7, etichetta: "7 giorni" },
  { giorni: 30, etichetta: "30 giorni" },
  { giorni: 90, etichetta: "90 giorni" },
  { giorni: 0, etichetta: "Sempre" },
] as const;

const euro = (n: number) => `€ ${n.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;

function NumeriPage() {
  const io = useConsulente();
  const consulenteId = io?.id ?? "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [giorni, setGiorni] = useState<number>(30);

  const carica = useCallback(async () => {
    if (!consulenteId) return;
    setCaricando(true);
    const esito = await mieiLead();
    if (!esito.ok) {
      setErrore(esito.motivo ?? "Non è stato possibile caricare i dati.");
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

  const numeri = useMemo(() => {
    const oggi = new Date();
    oggi.setHours(12, 0, 0, 0);
    const inizio = new Date(oggi);
    inizio.setDate(inizio.getDate() - (giorni > 0 ? giorni - 1 : 0));
    //  "Sempre" non è un periodo lunghissimo ma l'assenza di un limite: un
    //  archivio importato può avere date più vecchie di qualsiasi finestra.
    const dal = giorni > 0 ? iso(inizio) : "0000-01-01";
    const al = iso(oggi);
    const dentro = (g?: string | null) => !!g && g >= dal && g <= al;

    const assegnati = leads.filter((l) => {
      const d = leadAttributionDate(l);
      return d ? dentro(iso(d)) : false;
    }).length;

    const conAppuntamento = leads.filter((l) => dentro(l.data.dataMeeting?.slice(0, 10)));
    const appuntamenti = conAppuntamento.length;
    const presentati = conAppuntamento.filter((l) => esitoDi(l) === "completato").length;
    const noShow = conAppuntamento.filter((l) => esitoDi(l) === "no_show").length;

    const venduti = leads.filter((l) => {
      const d = leadConversionDate(l);
      return d ? dentro(iso(d)) : false;
    });
    const acconti = venduti.reduce(
      (somma, l) => somma + (Number(l.data.payment?.accontoPagato) || 0),
      0,
    );

    //  La conversione si misura su chi si è presentato: chi non si presenta non
    //  è una trattativa persa dal consulente, è un appuntamento mai avvenuto —
    //  e infatti ha un contatore tutto suo.
    const conversione = presentati > 0 ? (venduti.length / presentati) * 100 : null;
    const presenza = appuntamenti > 0 ? (presentati / appuntamenti) * 100 : null;

    return {
      assegnati,
      appuntamenti,
      presentati,
      venduti: venduti.length,
      acconti,
      conversione,
      presenza,
      noShow,
    };
  }, [leads, giorni]);

  if (!io) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-foreground">I miei numeri</h1>
        <p className="text-[12px] text-muted-foreground">Solo i lead assegnati a te.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODI.map((p) => (
          <button
            key={p.giorni}
            type="button"
            onClick={() => setGiorni(p.giorni)}
            className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
              giorni === p.giorni
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
            }`}
          >
            {p.etichetta}
          </button>
        ))}
      </div>

      {errore && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          {errore}
        </p>
      )}

      {caricando && leads.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">Calcolo dei numeri…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Riquadro
              icona={Users}
              tinta="text-primary"
              titolo="Lead assegnati"
              valore={numeri.assegnati}
            />
            <Riquadro
              icona={CalendarCheck}
              tinta="text-blue-600"
              titolo="Appuntamenti fissati"
              valore={numeri.appuntamenti}
            />
            <Riquadro
              icona={UserCheck}
              tinta="text-cyan-600"
              titolo="Presentati"
              valore={numeri.presentati}
            />
            <Riquadro
              icona={Target}
              tinta="text-emerald-600"
              titolo="Venduti"
              valore={numeri.venduti}
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Riquadro
              icona={Euro}
              tinta="text-emerald-600"
              titolo="Acconti incassati"
              valore={euro(numeri.acconti)}
              nota="Somma degli acconti sulle vendite del periodo"
            />
            <Riquadro
              icona={TrendingUp}
              tinta="text-emerald-600"
              titolo="Tasso di conversione"
              valore={numeri.conversione === null ? "—" : `${numeri.conversione.toFixed(1)}%`}
              nota="Venduti su chi si è presentato"
            />
            <Riquadro
              icona={PhoneOff}
              tinta="text-rose-600"
              titolo="No show"
              valore={numeri.noShow}
              nota={
                numeri.presenza === null
                  ? "Nessun appuntamento nel periodo"
                  : `Presenza ${numeri.presenza.toFixed(0)}% sugli appuntamenti`
              }
            />
          </div>

          {/* ── COSA STO GUARDANDO ──────────────────────────────────────────
              Un numero senza la sua definizione si legge come si preferisce, e
              a fine mese diventa una discussione. Qui la regola è scritta. */}
          <section className="rounded-xl border border-border bg-card p-3">
            <h3 className="mb-1.5 text-foreground">Come si contano</h3>
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              <li>I lead contano dal giorno in cui ti sono stati affidati.</li>
              <li>
                Gli appuntamenti e i no show dal giorno in cui erano in agenda: quelli ancora da
                fare entreranno alla loro data.
              </li>
              <li>Vendite e acconti dal giorno in cui la trattativa è stata chiusa.</li>
              <li>Chi non si presenta resta fuori dal tasso di conversione.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Riquadro({
  icona: Icona,
  tinta,
  titolo,
  valore,
  nota,
}: {
  icona: typeof Users;
  tinta: string;
  titolo: string;
  valore: number | string;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icona className={`h-4 w-4 ${tinta}`} />
        <p className="text-[11.5px] text-muted-foreground">{titolo}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold leading-none text-foreground">{valore}</p>
      {nota && <p className="mt-1.5 text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}
