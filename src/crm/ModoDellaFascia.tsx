/** ── «QUEST'ORA LA TENGO PER UNA PERSONA SOLA» — IN TUTTO IL CRM ───────────
 *
 *  Richiesta del committente: «quando importo lead mi dà solo l'opzione di 3
 *  persone su quello slot; invece deve esserci una spunta che, cliccandola,
 *  blocca quello slot per una persona sola. E mettilo in tutto il CRM».
 *
 *  ── COM'ERA ──────────────────────────────────────────────────────────────
 *  La regola esisteva già e funzionava: una fascia può essere «solo» o
 *  «aperta», sta in `app_config` sotto la chiave della fascia, e la fa
 *  rispettare anche il server — quindi nemmeno il cliente che si prenota dal
 *  link pubblico può entrare in un'ora tenuta per uno solo
 *  (api.crm.fascia-modo, crm/fascia-consulenza).
 *  Ma la si poteva dire da UN SOLO posto: la scheda del cliente. Dalla coda
 *  dei lead importati, dall'agenda e dal cambio di stato veloce — cioè dalle
 *  schermate in cui gli appuntamenti si fissano davvero, una dietro l'altra —
 *  l'ora restava aperta fino a tre e non c'era modo di dire altrimenti.
 *
 *  ── COM'È ADESSO ─────────────────────────────────────────────────────────
 *  Un gancio e una spunta, questi, usati da tutte le schermate che fissano un
 *  appuntamento. Chi li usa non deve sapere com'è fatta la riga di
 *  configurazione, né quando si può chiudere una fascia: quella decisione sta
 *  in `spuntaSoloUno` (crm/fascia-consulenza), è provata senza database, ed è
 *  la stessa per tutti.
 *
 *  ⚠️ UNA SOLA LETTURA PER GIORNO, non una per orario. La schermata disegna
 *   venti pillole: venti richieste a ogni cambio di giorno sono venti
 *   richieste che si pagano (il 27/09/2026 il sito si è fermato per il tetto
 *   giornaliero del piano). La rotta risponde con tutte le fasce «solo» di un
 *   giorno in un colpo.
 *  ⚠️ SI APPLICA SUBITO E SI CORREGGE SE IL SERVER DICE DI NO. Chi preme una
 *   spunta che non cambia niente la preme di nuovo — e il secondo colpo
 *   disfarebbe il primo.
 *  ⚠️ SE LA LETTURA FALLISCE, TUTTE LE FASCE RISULTANO APERTE: è il
 *   comportamento di sempre. Un errore di rete non deve chiudere l'agenda.
 *
 *  ── ⚠️ «NON SONO RIUSCITO A CAMBIARLA — RIENTRA COL TUO PIN» ─────────────
 *  Segnalazione del committente, ripetuta più volte: premendo la spunta usciva
 *  quell'avviso, e rientrare col PIN non serviva a niente perché non era mai
 *  stato un problema di sessione scaduta.
 *
 *  LA CAUSA, e non è «ogni tanto»: queste due chiamate partivano con `fetch`
 *  nudo — `headers: { "Content-Type": "application/json" }` e basta. Il gettone
 *  del PIN viaggia nell'intestazione `x-crm-token` e il gettone del titolare in
 *  `Authorization`: **non ne partiva nessuno dei due**. Il server, che non ha
 *  altro modo di sapere chi sta chiedendo, rispondeva 401 con la frase che si
 *  leggeva a schermo — cioè diceva l'unica cosa vera che poteva dire. Il
 *  messaggio mandava a cercare il guasto nel posto sbagliato: non era il PIN,
 *  era che non glielo stavamo mandando.
 *
 *  ⚠️ SI PASSA DA `fetchCRM` E NON DA `fetch`: quella funzione attacca le
 *   intestazioni di chi è collegato ADESSO e, se il server risponde 401,
 *   rinfresca la sessione e riprova una volta sola. È la stessa porta da cui
 *   passano le altre schermate del CRM, ed è il motivo per cui su quelle il
 *   difetto non si vedeva: `QuickStatusDialog` chiedeva le stesse fasce a
 *   QUESTA STESSA ROTTA attaccando le intestazioni, e infatti funzionava.
 *  ⚠️ C'È UNA PROVA CHE LO IMPEDISCE DI NUOVO (`proveDelleChiamateCRM` in
 *   prove/prove.mjs): nessuna chiamata a `/api/crm/…` può partire senza
 *   credenziali, in nessun file. Una correzione su un file solo sarebbe durata
 *   fino alla prossima schermata scritta di fretta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { spuntaSoloUno, type ModoFascia } from "@/crm/fascia-consulenza";
//  ⚠️ La porta con le credenziali: vedi il cartello qui sopra. Mai `fetch`
//   nudo verso /api/crm/.
import { fetchCRM } from "@/crm/AuthContext";

export type ModiDelGiorno = Record<string, ModoFascia>;

export interface GancioModi {
  /** Le fasce del giorno tenute per una persona sola: «HH:MM» → modo. */
  modi: ModiDelGiorno;
  /** Tiene questa fascia per uno solo, o la riapre. */
  cambia: (ora: string, modo: ModoFascia, durata?: number) => Promise<void>;
  /** Un cambio è in corso: la spunta non si preme due volte. */
  salvando: boolean;
}

/** Com'è messa ogni fascia di questo giorno, e come si cambia. */
export function useModiFascia(
  consultantId?: string | null,
  giorno?: string | null,
  durataDiSerie = 45,
): GancioModi {
  const [modi, setModi] = useState<ModiDelGiorno>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const cid = String(consultantId || "").trim();
    const g = String(giorno || "").trim();
    if (!cid || !g) {
      setModi({});
      return;
    }
    let vivo = true;
    fetchCRM(
      `/api/crm/fascia-modo?consultantId=${encodeURIComponent(cid)}&giorno=${encodeURIComponent(g)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo && j?.ok) setModi((j.modi ?? {}) as ModiDelGiorno);
      })
      .catch(() => {
        if (vivo) setModi({});
      });
    return () => {
      vivo = false;
    };
  }, [consultantId, giorno]);

  const cambia = useCallback(
    async (ora: string, modo: ModoFascia, durata = durataDiSerie) => {
      const cid = String(consultantId || "").trim();
      const g = String(giorno || "").trim();
      if (!cid || !g || !ora || salvando) return;
      setSalvando(true);
      setModi((m) => ({ ...m, [ora]: modo }));
      const indietro = () => setModi((m) => ({ ...m, [ora]: modo === "solo" ? "aperta" : "solo" }));
      try {
        const j = (await fetchCRM("/api/crm/fascia-modo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultantId: cid, quando: `${g}T${ora}`, modo, durata }),
        }).then((r) => r.json())) as { ok?: boolean; reason?: string };
        if (!j?.ok) {
          indietro();
          toast.error("Non sono riuscito a cambiarla", {
            description: j?.reason || "riprova fra un attimo.",
          });
        }
      } catch {
        indietro();
        toast.error("Non sono riuscito a cambiarla", { description: "controlla la connessione." });
      } finally {
        setSalvando(false);
      }
    },
    [consultantId, giorno, durataDiSerie, salvando],
  );

  return { modi, cambia, salvando };
}

/** ── LA SPUNTA ────────────────────────────────────────────────────────────
 *  Compare quando un'ora è stata scelta — prima non c'è niente da decidere — e
 *  dice con le parole di quello che succede, non con la parola «esclusiva»:
 *  chi fissa un appuntamento non deve tradurre niente. */
export function SpuntaSoloUnaPersona({
  ora,
  presi,
  capienza,
  modo,
  onCambia,
  salvando,
  durata,
  className,
}: {
  /** L'ora scelta, «HH:MM». Senza, non si disegna niente. */
  ora?: string | null;
  /** Quante persone ci sono già in quella fascia. */
  presi?: number;
  /** Quante ce ne starebbero (la capienza generale, oggi tre). */
  capienza?: number;
  modo?: ModoFascia;
  onCambia: (ora: string, modo: ModoFascia, durata?: number) => void | Promise<void>;
  salvando?: boolean;
  durata?: number;
  className?: string;
}) {
  if (!ora) return null;
  const e = spuntaSoloUno({ modo, presi, capienza });
  const id = `solo-uno-${ora.replace(":", "")}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5",
        !e.attiva && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={e.spuntata}
        disabled={!e.attiva || !!salvando}
        onCheckedChange={(v) => void onCambia(ora, v ? "solo" : "aperta", durata)}
        className="mt-px"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          Le {ora} solo per questa persona
          {/*  I posti si vedono sempre: è il numero che cambia premendo, ed è
               l'unico modo di capire che cosa fa la spunta senza provarla. */}
          <span className="font-normal text-slate-500">
            · {Math.max(0, Number(presi) || 0)}/{e.posti}
          </span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-600">{e.nota}</span>
      </span>
    </label>
  );
}
