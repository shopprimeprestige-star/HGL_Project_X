/** ── I PREVENTIVI DI QUESTO LEAD, DENTRO LA SUA SCHEDA ─────────────────────
 *
 *  Richiesta del committente: «aprendo la scheda posso vedere tutti i
 *  preventivi creati per il lead selezionato, e posso aprirli con Meetly
 *  oppure ottenere il link da inviare al cliente». Prima per farlo bisognava
 *  uscire dalla trattativa, andare in «Preventivi», cercare il cognome e
 *  sperare che fosse la persona giusta — con due omonimi si sbagliava, e il
 *  link partiva al cliente sbagliato.
 *
 *  ── ⚠️ COME SI DECIDE CHE UN PREVENTIVO È SUO ────────────────────────────
 *  Con la STESSA regola della pagina Preventivi (`agganciaLead` in
 *  crm/preventivi/dati): prima il numero del preventivo scritto sulla scheda
 *  (`quoteRef`), che è un legame dichiarato e non si discute; poi le ultime
 *  nove cifre del telefono. Riscrivere qui una regola diversa vorrebbe dire
 *  che la stessa coppia lead/preventivo risulta collegata di là e scollegata
 *  di qua, e nessuna delle due schermate saprebbe dire quale ha ragione.
 *  ⚠️ L'aggancio per telefono è un'IPOTESI e viene detto: chi ha passato il
 *   numero al fratello non deve mandargli il preventivo di qualcun altro.
 *
 *  ── ⚠️ SI LEGGE SOLO QUANDO SI APRE ──────────────────────────────────────
 *  Non all'apertura del pannello del lead: quello si apre decine di volte al
 *  giorno solo per leggere un numero di telefono, e una lettura a database per
 *  ognuna sarebbe traffico speso per una domanda che nessuno ha fatto.
 *
 *  ── ⚠️ IL LINK SI GENERA AL CLIC, MAI PRIMA ──────────────────────────────
 *  `linkPreventivo` non è una funzione pura: APRE una sessione di consulenza e
 *  la registra sul server insieme al numero del preventivo. Chiamarla mentre si
 *  disegna l'elenco vorrebbe dire aprire una sessione per ogni preventivo che
 *  si sta soltanto guardando. Stessa cautela di `PannelloWhatsApp` in
 *  crm/preventivi/Riga.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Copy, FileText, Package, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Finestra, SezioneFinestra, VoceScelta, VuotoFinestra } from "@/crm/ui/Finestra";
import { dataBreve, eur, soloCifre } from "@/crm/ui";
import type { Lead } from "@/crm/types";
import { linkPreventivo } from "@/shop/quote-link";
import { leggiPreventiviDelLead, perStato, totaleDi, type RigaPreventivo } from "./dati";

/** Quanti se ne mostrano. Un lead con più di dieci preventivi non esiste: se
 *  succede è un aggancio per telefono troppo largo, e il tetto evita che la
 *  scheda diventi un elenco. */
const MAX = 10;

/*  ── LA LETTURA STA IN `dati.ts` ─────────────────────────────────────────
    Era qui dentro, e faceva la stessa identica domanda che adesso fa anche la
    finestra della fattura: «quali preventivi sono di questa persona?».
    Due copie della stessa regola diventano due risposte diverse sullo stesso
    cliente il giorno in cui una delle due viene ritoccata. */
const leggiPreventivi = (lead: Lead) => leggiPreventiviDelLead(lead, MAX);

/** Vero se questo preventivo è collegato per RIFERIMENTO (legame certo) e non
 *  soltanto perché i numeri di telefono coincidono. */
const perRiferimento = (q: RigaPreventivo, lead: Lead): boolean => {
  const rif = String(lead.data?.quoteRef ?? "").trim();
  return (
    !!rif &&
    String(q.quote_ref ?? "")
      .trim()
      .toUpperCase() === rif.toUpperCase()
  );
};

export function FinestraPreventiviLead({
  lead,
  aperta,
  onCambio,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
}) {
  const [righe, setRighe] = useState<RigaPreventivo[] | null>(null);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (!aperta) return;
    let annullato = false;
    setErrore("");
    void leggiPreventivi(lead)
      .then((r) => {
        if (!annullato) setRighe(r);
      })
      .catch(() => {
        //  ⚠️ Si DICE. Un elenco vuoto per un errore di rete e un elenco vuoto
        //   perché preventivi non ce ne sono si leggono uguali, e il primo fa
        //   telefonare dicendo «non le abbiamo mai mandato niente».
        if (!annullato) {
          setRighe([]);
          setErrore("Non è stato possibile leggere i preventivi. Riprova fra un momento.");
        }
      });
    return () => {
      annullato = true;
    };
  }, [aperta, lead]);

  const apri = (ref: string, dove: "preventivo" | "percorso") =>
    window.open(`/${dove}?id=${encodeURIComponent(ref)}`, "_blank", "noopener");

  const copiaLink = async (ref: string) => {
    try {
      const url = linkPreventivo(ref);
      await navigator.clipboard.writeText(url);
      toast.success("Link copiato", {
        description: "La consulenza è aperta: il cliente vedrà quello che gli mostri.",
      });
    } catch (e) {
      //  ⚠️ Due guasti diversi finiscono qui — la sessione non aperta e gli
      //   appunti negati dal browser — e la differenza la vede solo chi legge
      //   il messaggio: nel dubbio si mostra l'indirizzo da copiare a mano.
      toast.error("Link non copiato", {
        description: e instanceof Error ? e.message : "Apri il preventivo e copia l'indirizzo.",
      });
    }
  };

  const nome = `${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""}`.trim();

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      icona={FileText}
      titolo="I preventivi del cliente"
      contesto={nome || "Scheda senza nome"}
      larghezza="md"
      classeCorpo="space-y-3"
    >
      {righe === null ? (
        <p className="px-1 py-6 text-center text-[12.5px] text-muted-foreground">Sto leggendo…</p>
      ) : righe.length === 0 ? (
        <VuotoFinestra
          icona={FileText}
          testo={
            errore ||
            "Per questo cliente non risulta nessun preventivo, né collegato alla scheda né con lo stesso numero di telefono."
          }
        />
      ) : (
        righe.map((q) => {
          const stato = perStato(q.status);
          const certo = perRiferimento(q, lead);
          return (
            <SezioneFinestra
              key={q.id}
              titolo={q.quote_ref}
              nota={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{dataBreve(q.created_at)}</span>
                  <span className="opacity-40">·</span>
                  <span className="font-semibold text-slate-700">{eur(totaleDi(q))}</span>
                  {/*  ⚠️ Se il valore a database non è fra i cinque conosciuti si
                      mostra COM'È, non si nasconde: uno stato scritto a mano o
                      arrivato da un'altra versione è comunque un'informazione,
                      e una riga senza stato si legge «non lo abbiamo mai
                      mandato». */}
                  {(stato || q.status) && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{stato ? stato.etichetta : q.status}</span>
                    </>
                  )}
                </span>
              }
              classeCorpo="p-3 space-y-1.5"
            >
              {/*  ⚠️ Il dubbio si scrive PRIMA dei pulsanti che mandano roba al
                  cliente, non dopo: dopo lo legge chi ha già premuto. */}
              {!certo && (
                <p className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-800">
                  Collegato dal numero di telefono, non dalla scheda: controlla che sia davvero suo
                  prima di mandarlo.
                </p>
              )}
              <VoceScelta
                icona={Presentation}
                titolo="Aprilo per la consulenza"
                nota="La pagina come la vede lui"
                onClick={() => apri(q.quote_ref, "preventivo")}
              />
              <VoceScelta
                icona={Copy}
                titolo="Copia il link per il cliente"
                nota="Apre la consulenza e copia l'indirizzo"
                onClick={() => void copiaLink(q.quote_ref)}
              />
              <VoceScelta
                icona={Package}
                titolo="Il percorso"
                nota="Selfie, video, colore, produzione, installazione"
                onClick={() => apri(q.quote_ref, "percorso")}
              />
            </SezioneFinestra>
          );
        })
      )}
    </Finestra>
  );
}

/** Il pulsante che la apre. Sta nella scheda del lead, accanto agli altri
 *  gesti, e non conta i preventivi finché non lo si preme: contarli vorrebbe
 *  dire leggerli, cioè la lettura che questo pannello evita apposta. */
export function PulsantePreventivi({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setAperta(true)}>
        <FileText className="mr-1 h-3.5 w-3.5" /> Preventivi
      </Button>
      {/*  Si monta solo da aperta: montarla sempre vorrebbe dire un effetto di
          lettura appeso a ogni riga dell'elenco. */}
      {aperta && <FinestraPreventiviLead lead={lead} aperta={aperta} onCambio={setAperta} />}
    </>
  );
}
