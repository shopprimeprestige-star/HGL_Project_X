/** ── IL RIQUADRO «MESSAGGI AUTOMATICI» (Impostazioni → WhatsApp) ────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T7. L'elenco dei 25
 *  messaggi che il CRM manda da solo su WhatsApp, in sei momenti, ognuno con il
 *  nome, l'anteprima del testo, quando parte e il suo interruttore. È l'UNICO posto
 *  dove si accendono e si spengono: i riquadri vecchi (ManyChat, conferma, fattura,
 *  prenota in chat) hanno solo un rimando qui.
 *
 *  Le regole (momenti, frasi, errori) sono in `messaggi-automatici/vista.ts` e sono
 *  provate; qui si disegna.
 *
 *  ⚠️ ACCENDERE SI CONFERMA, spegnere no. La conferma dice l'effetto vero; per i
 *   quattro messaggi dei lead nuovi dice che la data di partenza si sposta per tutti.
 *  ⚠️ IL SERVER DECIDE. Ogni clic manda `prima` (quello che vedevi): se nel frattempo
 *   qualcun altro ha cambiato la stessa riga, il server risponde 409, qui si dice e si
 *   rilegge. Il nome di chi clicca lo mette il server. Meet all'ora e acconto sono
 *   spenti nel codice: compaiono ma non si accendono.
 *  ⚠️ IL BROWSER NON SCRIVE NIENTE DA SOLO: legge e comanda da
 *   `/api/crm/messaggi-automatici` (403 a chi non ha «impostazioni»). Qui il riquadro
 *   si vede solo a chi può (nasconde, non difende).
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata prima di loro (React #310).
 *  ───────────────────────────────────────────────────────────────────────── */
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fetchCRM, usePuo } from "@/crm/AuthContext";
import type { ChiaveMessaggio } from "@/crm/messaggi-automatici/catalogo";
import type { ComandoImposta, RispostaMessaggi } from "@/crm/messaggi-automatici/tipi";
import {
  confermaAccensione,
  eConflitto,
  fraseErrore,
  fraseFascia,
  fraseModifica,
  raggruppa,
  type RigaVista,
  type TonoFascia,
} from "@/crm/messaggi-automatici/vista";
import { Finestra, NotaFinestra } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";

const ROTTA = "/api/crm/messaggi-automatici";
export const ID_PANNELLO = "messaggi-automatici";

const TONI: Record<TonoFascia, string> = {
  verde: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ambra: "border-amber-200 bg-amber-50 text-amber-900",
  rosso: "border-rose-200 bg-rose-50 text-rose-900",
  neutro: "border-border bg-muted text-foreground",
};

/** Oltre questa lunghezza l'anteprima si chiude su due righe, con «Mostra tutto». */
const ANTEPRIMA_CORTA = 130;

type Esito = { ok: true; dati: RispostaMessaggi } | { ok: false; stato: number; errore?: string };

// shortcut: le due chiamate stanno qui perché il client condiviso (`messaggi-automatici/client.ts`) lo scrive T2; quando c'è, si sostituiscono con le sue.
async function chiama(comando?: ComandoImposta): Promise<Esito> {
  try {
    const res = await fetchCRM(
      ROTTA,
      comando
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(comando),
          }
        : undefined,
    );
    const json = (await res.json().catch(() => null)) as
      | (Partial<RispostaMessaggi> & { error?: unknown })
      | null;
    if (res.ok && json && Array.isArray(json.voci) && json.fascia)
      return { ok: true, dati: json as RispostaMessaggi };
    return {
      ok: false,
      stato: res.status,
      errore: json && typeof json.error === "string" ? json.error : undefined,
    };
  } catch {
    return { ok: false, stato: 0 };
  }
}

/** La riga dei riquadri vecchi: i messaggi non si accendono più lì, e si dice dove. */
export function RimandoMessaggiAutomatici({ className }: { className?: string }) {
  const vai = () => {
    const ridotto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(ID_PANNELLO)
      ?.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
  };
  return (
    <p className={cn("text-[13px] leading-snug text-muted-foreground", className)}>
      I messaggi si accendono e si spengono in{" "}
      <button
        type="button"
        onClick={vai}
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Messaggi automatici
      </button>
      , il primo riquadro di questa pagina.
    </p>
  );
}

export function MessaggiAutomaticiPannello() {
  const puo = usePuo()("impostazioni");
  const [dati, setDati] = useState<RispostaMessaggi | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [occupato, setOccupato] = useState<ChiaveMessaggio | null>(null);
  const [conferma, setConferma] = useState<ChiaveMessaggio | null>(null);
  const [avviso, setAvviso] = useState<{ chiave: ChiaveMessaggio; testo: string } | null>(null);
  const [aperte, setAperte] = useState<ReadonlySet<ChiaveMessaggio>>(new Set());

  //  Contatore delle scritture: una lettura partita PRIMA di un clic e arrivata dopo
  //  riporterebbe l'interruttore com'era. Si scarta.
  const versione = useRef(0);

  const ricarica = useCallback(async () => {
    const mia = versione.current;
    const r = await chiama();
    if (mia !== versione.current) return;
    if (r.ok) {
      setDati(r.dati);
      setErrore(null);
    } else {
      setErrore(
        r.stato === 0 ? "Il server non risponde." : "Non riesco a leggere i messaggi automatici.",
      );
    }
    setCaricato(true);
  }, []);

  useEffect(() => {
    if (!puo) return;
    void ricarica();
    //  Tornando sulla scheda si rilegge: un collega può aver cambiato qualcosa.
    const alRitorno = () => {
      if (document.visibilityState === "visible") void ricarica();
    };
    document.addEventListener("visibilitychange", alRitorno);
    return () => document.removeEventListener("visibilitychange", alRitorno);
  }, [ricarica, puo]);

  if (!puo) return null;

  const gruppi = dati ? raggruppa(dati) : [];
  const righe = gruppi.flatMap((g) => g.righe);
  const accesi = righe.filter((r) => r.acceso).map((r) => r.chiave);
  const fascia = dati ? fraseFascia(dati.fascia, !!dati.mancaMigrazione) : null;
  const bloccato = !dati || occupato !== null;

  const manda = async (r: RigaVista, acceso: boolean) => {
    setOccupato(r.chiave);
    setAvviso(null);
    versione.current += 1;
    const esito = await chiama({ chiave: r.chiave, acceso, prima: r.acceso });
    versione.current += 1;
    setOccupato(null);
    if (esito.ok) {
      setDati(esito.dati);
      toast.success(`${r.nome}: ${acceso ? "acceso" : "spento"}`);
      return;
    }
    setAvviso({ chiave: r.chiave, testo: fraseErrore(esito.stato, esito.errore) });
    //  409: qualcuno ha cambiato la stessa riga (o è spenta dal codice): si rilegge com'è davvero.
    if (eConflitto(esito.stato)) await ricarica();
  };

  const cambia = (r: RigaVista, voglio: boolean) => {
    if (voglio) setConferma(r.chiave);
    else void manda(r, false);
  };

  const inConferma = conferma ? righe.find((r) => r.chiave === conferma) : undefined;
  const testoConferma = inConferma ? confermaAccensione(inConferma.chiave, accesi) : null;

  const alterna = (k: ChiaveMessaggio) =>
    setAperte((s) => {
      const n = new Set(s);
      if (!n.delete(k)) n.add(k);
      return n;
    });

  return (
    <Card id={ID_PANNELLO} className="scroll-mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Messaggi automatici</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Tutti i WhatsApp che il CRM manda da solo, in ordine di quando servono. Ognuno ha il suo
          interruttore: accendere chiede conferma, spegnere è subito. I messaggi scritti a mano non
          sono qui e non si fermano mai.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!caricato && (
          <div
            role="status"
            aria-live="polite"
            className="space-y-2"
            aria-label="Carico i messaggi"
          >
            <p className="text-[13px] text-muted-foreground">Carico i messaggi…</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        )}

        {caricato && !dati && (
          <div role="alert" className={cn("rounded-md border px-3 py-2 text-[13px]", TONI.rosso)}>
            <p>{errore ?? "Non riesco a leggere i messaggi automatici."}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void ricarica()}>
              Riprova
            </Button>
          </div>
        )}

        {dati && fascia && (
          <>
            <p
              role="status"
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] leading-snug",
                TONI[fascia.tono],
              )}
            >
              {fascia.frase}
            </p>
            {errore && (
              <p className="text-[12px] text-rose-800">
                Non riesco ad aggiornare l'elenco: {errore} (vedi l'ultima lettura).
              </p>
            )}

            <div className="space-y-5">
              {gruppi.map((g) => (
                <details key={g.id} open className="group">
                  <summary
                    className={cn(
                      "flex cursor-pointer list-none items-center justify-between gap-3 border-t border-slate-200 pt-4",
                      "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                    )}
                  >
                    <h3 className="text-[13px] font-semibold text-slate-900">{g.titolo}</h3>
                    <span className="flex items-center gap-2 text-[12px] tabular-nums text-muted-foreground">
                      {g.accesi} {g.accesi === 1 ? "acceso" : "accesi"} su {g.righe.length}
                      <ChevronDown
                        className="h-4 w-4 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                  </summary>
                  <ul className="mt-1 divide-y divide-slate-100">
                    {g.righe.map((r) => {
                      const idMotivo = `msg-motivo-${r.chiave.replace(":", "-")}`;
                      const lunga = r.anteprime.some((a) => a.testo.length > ANTEPRIMA_CORTA);
                      const espansa = aperte.has(r.chiave);
                      return (
                        <li key={r.chiave} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">
                                {r.nome}
                                <span
                                  className={cn(
                                    "ml-2 text-[12px] font-normal",
                                    r.acceso ? "text-emerald-700" : "text-muted-foreground",
                                  )}
                                >
                                  {r.acceso ? "acceso" : "spento"}
                                </span>
                              </p>
                              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                                {r.quando}
                              </p>
                            </div>
                            <Switch
                              checked={r.acceso}
                              disabled={bloccato || !r.modificabile}
                              onCheckedChange={(v) => cambia(r, v)}
                              aria-label={r.nome}
                              aria-describedby={r.motivo ? idMotivo : undefined}
                              className="mt-0.5 shrink-0"
                            />
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {r.anteprime.map((a) => (
                              <div
                                key={a.titolo ?? "testo"}
                                className="rounded-lg bg-slate-50 px-3 py-2"
                              >
                                {a.titolo && (
                                  <p className="text-[11px] font-medium text-slate-600">
                                    {a.titolo}
                                  </p>
                                )}
                                <p
                                  className={cn(
                                    "whitespace-pre-line text-[12px] leading-snug text-slate-700",
                                    lunga && !espansa && "line-clamp-2",
                                  )}
                                >
                                  {a.testo}
                                </p>
                              </div>
                            ))}
                            {lunga && (
                              <button
                                type="button"
                                onClick={() => alterna(r.chiave)}
                                aria-expanded={espansa}
                                className="text-[12px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {espansa ? "Mostra meno" : "Mostra tutto il testo"}
                              </button>
                            )}
                            {r.notaTesto && (
                              <p className="text-[12px] leading-snug text-muted-foreground">
                                {r.notaTesto}
                              </p>
                            )}
                          </div>

                          {r.motivo && (
                            <p
                              id={idMotivo}
                              className="mt-1.5 text-[12px] leading-snug text-amber-800"
                            >
                              {r.motivo}
                            </p>
                          )}
                          {r.ultima && (
                            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                              {r.ultima}
                            </p>
                          )}
                          {avviso?.chiave === r.chiave && (
                            <p
                              role="alert"
                              className={cn(
                                "mt-2 rounded-md border px-3 py-2 text-[12px] leading-snug",
                                TONI.ambra,
                              )}
                            >
                              {avviso.testo}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>

            <section className="space-y-2 border-t border-slate-200 pt-4">
              <h3 className="text-[13px] font-semibold text-slate-900">Ultime modifiche</h3>
              {dati.ultime.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  Nessuna modifica fatta da qui, finora.
                </p>
              ) : (
                <ul className="space-y-1">
                  {dati.ultime.map((m, i) => (
                    <li
                      key={`${m.il}-${m.chiave}-${i}`}
                      className="text-[12px] leading-snug tabular-nums text-slate-700"
                    >
                      {fraseModifica(m)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>

      <Finestra
        aperta={!!testoConferma}
        onCambio={(v) => !v && setConferma(null)}
        titolo={testoConferma?.titolo ?? ""}
        larghezza="sm"
        bloccante
        azioni={
          <>
            <Button variant="outline" onClick={() => setConferma(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                const r = inConferma;
                setConferma(null);
                if (r) void manda(r, true);
              }}
            >
              {testoConferma?.etichetta ?? "Accendi"}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5 text-[13px] leading-snug text-slate-700">
          {testoConferma?.paragrafi.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {testoConferma?.avvisi.map((a) => (
            <NotaFinestra key={a} tono="attenzione">
              {a}
            </NotaFinestra>
          ))}
        </div>
      </Finestra>
    </Card>
  );
}
