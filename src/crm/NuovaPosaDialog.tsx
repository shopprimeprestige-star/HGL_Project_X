/** ── AGGIUNGERE UNA POSA CHE NON È MAI PASSATA DALLA TRATTATIVA ─────────────
 *
 *  PERCHÉ ESISTE. Metà del lavoro del reparto posa non nasce da un lead: è il
 *  cliente del passaparola che si presenta e compra, o quello di tre anni fa che
 *  torna per una manutenzione. Finora l'unico modo di metterlo in calendario era
 *  aprire la scheda «nuovo lead» — cioè un percorso in quattro passi pensato per
 *  una TRATTATIVA da coltivare: chiedeva il motivo del contatto, la piattaforma
 *  pubblicitaria, l'appuntamento da fissare. Domande senza risposta, per una
 *  vendita che è già stata fatta. E infatti quelle pose finivano su un foglio a
 *  parte, o da nessuna parte.
 *
 *  ⚠️ IL CONSULENTE PUÒ RESTARE VUOTO, ED È IL PUNTO DELICATO.
 *   Una posa arrivata per passaparola non l'ha venduta nessuno, e attribuirla
 *   «a qualcuno tanto per» significa gonfiare il suo tasso di conversione con
 *   una vendita che non ha fatto — cioè falsare l'unico numero su cui si giudica
 *   il lavoro di una persona. Qui il consulente si può lasciare a «Nessuno», e
 *   quel lead resta fuori da OGNI riga della tabella consulenti.
 *   VERIFICATO ESEGUENDO, non solo leggendo: aggiungendo alle 843 pratiche vere
 *   una posa venduta e incassata SENZA consulente, nessuna delle tre righe
 *   cambia di un carattere; assegnandola a un consulente ne cambiano tutte e
 *   tre (le quote di spesa sono relative). La guardia sta in `kpi-calcoli`
 *   (`if (!id) continue`) e in `kpi-setter`, ed è la ragione per cui questa
 *   scheda si permette di lasciare il campo vuoto.
 *
 *  COSA SCRIVE. Un lead vero in `crm_leads`, con lo stato «venduto» — che è una
 *  chiusura vinta, quindi la pratica compare subito nella pagina Installazioni
 *  senza bisogno di altri passaggi. Niente scorciatoie e nessuna tabella
 *  parallela: una posa aggiunta di qui è indistinguibile da una nata dal funnel,
 *  e questo è esattamente ciò che si vuole — i totali del denaro devono tornare.
 *
 *  DOVE FINISCE POI. Creato il lead, si apre subito la finestra che serve:
 *  quella dell'installazione o quella della manutenzione, le stesse di sempre.
 *  Questa scheda NON ricopia quei due moduli: chiede il minimo per far esistere
 *  la persona, e passa la mano. Rifarli qui avrebbe voluto dire due posti dove
 *  si fissa una data, e da lì in poi due comportamenti diversi. */
import { useEffect, useState } from "react";
import { HandCoins, Store, Megaphone, Search as Lente, UserPlus, Wrench, Repeat } from "lucide-react";
import { Finestra } from "@/crm/ui/Finestra";
import { Segmento } from "@/crm/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import type { Lead, LeadData, LeadFonte } from "@/crm/types";

/** ── DA DOVE ARRIVA QUESTA PERSONA ─────────────────────────────────────────
 *  Sono le QUATTRO fonti che il CRM conosce già (`LeadFonte`), non una quinta
 *  inventata qui: i KPI raggruppano per questo campo, e un valore che esiste
 *  solo in questa finestra comparirebbe nei rapporti come una categoria
 *  sconosciuta — o, peggio, non comparirebbe affatto.
 *  «Passa parola» sta per prima perché è il motivo per cui questa scheda
 *  esiste: è il caso che non passa mai dal funnel. */
const PROVENIENZE: { valore: LeadFonte; testo: string; icona: typeof Store; nota: string }[] = [
  { valore: "Passa parola", testo: "Passaparola", icona: HandCoins, nota: "Mandato da un altro cliente" },
  { valore: "Store", testo: "Cliente nuovo", icona: Store, nota: "Arrivato da sé, in negozio o al telefono" },
  { valore: "Organico", testo: "Organico", icona: Lente, nota: "Ci ha trovati da solo online" },
  { valore: "ADV", testo: "Pubblicità", icona: Megaphone, nota: "Da una campagna" },
];

type Tipo = "installazione" | "manutenzione";

export function NuovaPosaDialog({
  aperta,
  onCambio,
  onCreato,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** Il lead appena nato, per aprirci sopra la finestra giusta. */
  onCreato: (lead: Lead, tipo: Tipo) => void;
}) {
  const { consultants, createLead } = useCRM();
  const [tipo, setTipo] = useState<Tipo>("installazione");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [citta, setCitta] = useState("");
  const [fonte, setFonte] = useState<LeadFonte>("Passa parola");
  const [consulenteId, setConsulenteId] = useState("");
  const [prezzo, setPrezzo] = useState("");
  const [acconto, setAcconto] = useState("");
  const [note, setNote] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState("");

  //  Riaprendo si riparte puliti: la finestra serve ad aggiungere PERSONE
  //  diverse una dopo l'altra, e ritrovarci dentro il nome di prima è il modo
  //  più rapido per creare due volte lo stesso cliente.
  useEffect(() => {
    if (!aperta) return;
    setTipo("installazione");
    setNome("");
    setCognome("");
    setTelefono("");
    setCitta("");
    setFonte("Passa parola");
    setConsulenteId("");
    setPrezzo("");
    setAcconto("");
    setNote("");
    setErrore("");
  }, [aperta]);

  const salva = async () => {
    //  Nome e telefono sono l'unico obbligo: senza il numero la pratica non è
    //  richiamabile, e una posa che non si può richiamare non serve a niente.
    if (!nome.trim() || !telefono.trim()) {
      setErrore("Servono almeno il nome e il telefono.");
      return;
    }
    setSalvo(true);
    setErrore("");
    const p = Number(prezzo) || 0;
    const a = Number(acconto) || 0;
    const dati: LeadData = {
      nome: nome.trim(),
      cognome: cognome.trim(),
      telefono: telefono.trim(),
      citta: citta.trim() || undefined,
      fonte,
      //  ⚠️ VUOTO VUOL DIRE VUOTO. `null` e non `""`: il campo va in un
      //   database, e la guardia dei KPI legge la verità del valore — una
      //   stringa vuota è falsa in JavaScript, ma lasciarla scritta significa
      //   che un domani basta un `!== undefined` da qualche parte perché la
      //   pratica si attacchi a un consulente che non esiste.
      consulenteId: consulenteId || null,
      //  «venduto» è una chiusura vinta: la pratica entra subito in
      //  Installazioni e nei conti del denaro come tutte le altre.
      stato: "venduto",
      createdAt: new Date().toISOString(),
      note: note.trim() || undefined,
      ...(p > 0 || a > 0
        ? { payment: { ...(p > 0 ? { prezzoTotale: p } : {}), ...(a > 0 ? { accontoPagato: a } : {}) } }
        : {}),
    };
    const creato = await createLead(dati);
    setSalvo(false);
    if (!creato) {
      //  ⚠️ SI DICE CHE NON È ANDATA. Un salvataggio rifiutato che chiude la
      //   finestra in silenzio fa credere di aver aggiunto un cliente che non
      //   c'è: lo si scopre settimane dopo, quando non si presenta nessuno.
      setErrore("Non è stato possibile salvare. Riprova, o controlla la connessione.");
      return;
    }
    onCambio(false);
    onCreato(creato, tipo);
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      icona={UserPlus}
      titolo="Aggiungi una posa"
      contesto="Un cliente che non è mai passato dalla trattativa"
      larghezza="md"
      azioni={
        <>
          <Button variant="outline" size="sm" onClick={() => onCambio(false)} disabled={salvo}>
            Annulla
          </Button>
          <Button size="sm" onClick={() => void salva()} disabled={salvo}>
            {salvo ? "Salvo…" : tipo === "installazione" ? "Crea e fissa la posa" : "Crea e segna il ritorno"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ── CHE COSA SI STA AGGIUNGENDO ─────────────────────────────────
              La prima domanda, perché cambia la finestra che si apre dopo. */}
        <Riga etichetta="Che cosa">
          <div className="flex flex-wrap gap-1.5">
            <Segmento attivo={tipo === "installazione"} onClick={() => setTipo("installazione")}>
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                Installazione
              </span>
            </Segmento>
            <Segmento attivo={tipo === "manutenzione"} onClick={() => setTipo("manutenzione")}>
              <span className="inline-flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5 shrink-0" />
                Manutenzione
              </span>
            </Segmento>
          </div>
        </Riga>

        <Riga etichetta="Chi è">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Testo valore={nome} cambia={setNome} segnaposto="Nome *" />
            <Testo valore={cognome} cambia={setCognome} segnaposto="Cognome" />
            <Testo valore={telefono} cambia={setTelefono} segnaposto="Telefono *" tipo="tel" />
            <Testo valore={citta} cambia={setCitta} segnaposto="Città" />
          </div>
        </Riga>

        <Riga etichetta="Come è arrivato">
          <div className="flex flex-wrap gap-1.5">
            {PROVENIENZE.map((p) => (
              <Segmento
                key={p.valore}
                attivo={fonte === p.valore}
                onClick={() => setFonte(p.valore)}
                titolo={p.nota}
              >
                <span className="inline-flex items-center gap-1.5">
                  <p.icona className="h-3.5 w-3.5 shrink-0" />
                  {p.testo}
                </span>
              </Segmento>
            ))}
          </div>
        </Riga>

        {/* ── CHI L'HA VENDUTA — E IL PERMESSO DI NON RISPONDERE ───────────
              ⚠️ «Nessuno» è la scelta PREDEFINITA, non un ripiego. Il caso per
               cui questa scheda esiste — il passaparola — non ha un venditore,
               e mettercene uno per non lasciare il campo vuoto gli regalerebbe
               una conversione che non ha fatto. La riga sotto dice a voce
               quello che succede, perché è una conseguenza sui numeri di una
               persona e non deve essere una sorpresa. */}
        <Riga etichetta="Venduta da">
          <select
            value={consulenteId}
            onChange={(e) => setConsulenteId(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-foreground"
          >
            <option value="">Nessuno</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {consulenteId
              ? "Conterà nel tasso di conversione di questa persona."
              : "Senza consulente non entra nel tasso di conversione di nessuno."}
          </p>
        </Riga>

        <Riga etichetta="Soldi">
          <div className="grid grid-cols-2 gap-2">
            <Testo valore={prezzo} cambia={setPrezzo} segnaposto="Prezzo concordato €" tipo="number" />
            <Testo valore={acconto} cambia={setAcconto} segnaposto="Già incassato €" tipo="number" />
          </div>
          {/*  Si possono lasciare vuoti: il prezzo si mette spesso dopo, e
                obbligare qui vorrebbe dire inventare una cifra per poter
                andare avanti — che poi resta scritta come se fosse vera. */}
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Si possono aggiungere dopo, dalla scheda della posa.
          </p>
        </Riga>

        <Riga etichetta="Note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Chi l'ha mandato, cosa ha chiesto, tutto quello che serve a chi la lavorerà…"
            className="w-full resize-y rounded-lg border border-border bg-card px-2 py-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </Riga>

        {!!errore && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-2 text-[12.5px] text-red-700">
            {errore}
          </p>
        )}
      </div>
    </Finestra>
  );
}

/** Etichetta a sinistra sul monitor, sopra sul telefono: sotto i 640 punti una
 *  colonna di etichette mangia metà della larghezza dei campi. */
function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
      <span className="pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etichetta}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Testo({
  valore,
  cambia,
  segnaposto,
  tipo = "text",
}: {
  valore: string;
  cambia: (v: string) => void;
  segnaposto: string;
  tipo?: string;
}) {
  return (
    <input
      type={tipo}
      value={valore}
      onChange={(e) => cambia(e.target.value)}
      placeholder={segnaposto}
      aria-label={segnaposto}
      className={cn(
        "w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[13px] text-foreground outline-none",
        "placeholder:text-muted-foreground focus:border-foreground",
      )}
    />
  );
}
