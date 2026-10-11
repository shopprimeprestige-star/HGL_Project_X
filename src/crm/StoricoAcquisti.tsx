/** ─────────────────────────────────────────────────────────────────────────
 *  StoricoAcquisti — quante volte ha comprato questo cliente
 *
 *  PERCHÉ È FATTO COSÌ
 *  Nel 90% dei casi al titolare serve un solo dato: "ha già comprato due
 *  volte". Chiedergli prodotto, data e importo per ottenere quel numero
 *  significherebbe che nessuno lo compila e che il dato non esiste. Quindi:
 *   · di base si vede SOLO il numero, con − e + per correggerlo. Un clic.
 *   · il dettaglio è FACOLTATIVO: compare quando si preme "Aggiungi prodotto",
 *     e allora si registrano prodotto, data e importo.
 *  Quando ci sono righe, il numero è la loro somma (sono il dato più preciso);
 *  quando non ce ne sono, vale il contatore a mano. La regola sta in
 *  contaAcquisti() in types.ts, così tutte le pagine contano allo stesso modo.
 *
 *  IL DETTAGLIO NON HA UN INTERRUTTORE SUO
 *  "Si vede il dettaglio" non è uno stato da tenere allineato: il dettaglio si
 *  vede se ci sono righe. Aggiungere una riga lo apre, togliere l'ultima lo
 *  richiude. Uno stato in meno è un modo in meno di andare fuori sincrono.
 *
 *  NON PARLA COL DATABASE
 *  Riceve il lead e una funzione di salvataggio: chi lo ospita decide se
 *  scrivere su Supabase, in una bozza o da nessuna parte. Il componente si
 *  limita a passare la modifica, raggruppata (vedi RITARDO_SALVATAGGIO).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  contaAcquisti,
  righeAcquistoDaArchivio,
  type Lead,
  type LeadData,
  type RigaAcquisto,
} from "./types";
import { Chip, Scheda, dataBreve, eur } from "./ui";
import { Finestra } from "./ui/Finestra";

interface Props {
  lead: Lead | null;
  /** Salvataggio delegato a chi ospita il componente. Riceve solo i campi
   *  toccati, così può unirli al resto della scheda come preferisce. */
  onSalva: (patch: Partial<LeadData>) => void | Promise<unknown>;
  /** Per chi lo incastona in una scheda già intestata (es. dentro una
   *  finestra): niente cornice né titolo, solo il contenuto. */
  senzaScheda?: boolean;
  className?: string;
}

/** Le correzioni arrivano a raffica: tre clic su "+" per portare 0 a 3, oppure
 *  un nome prodotto scritto lettera per lettera. Si salva mezzo secondo dopo
 *  l'ultimo tocco: una scrittura invece di dieci, e nessuna corsa fra risposte
 *  del server che tornano in ordine sparso. */
const RITARDO_SALVATAGGIO = 500;

/** Chiave locale di una riga nuova. Generata solo al clic (mai durante il
 *  render) perché sul server non esiste e due valori diversi fra server e
 *  browser romperebbero l'idratazione. */
function nuovaChiave(): string {
  return `acq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Una riga senza niente dentro non è un acquisto: è una riga appena aperta.
 *  Resta visibile mentre si compila, ma non viene salvata né conteggiata. */
function rigaPiena(r: RigaAcquisto): boolean {
  return !!(r.prodotto.trim() || r.data || (r.importo !== undefined && r.importo !== null));
}

/** Le righe di partenza: quelle salvate se ci sono, altrimenti quel poco di
 *  leggibile che portano gli archivi importati (dove "acquisti" può essere un
 *  array di oggetti). Tradurle invece di ignorarle evita di buttare via un
 *  dettaglio che il cliente ci ha già dato. */
function righeIniziali(d: LeadData): RigaAcquisto[] {
  if (d.acquistiDettaglio && d.acquistiDettaglio.length > 0) return d.acquistiDettaglio;
  return righeAcquistoDaArchivio(d.acquisti);
}

export function StoricoAcquisti({ lead, onSalva, senzaScheda, className }: Props) {
  // Contatore a mano: vale quando non ci sono righe di dettaglio.
  const [numero, setNumero] = useState(0);
  const [righe, setRighe] = useState<RigaAcquisto[]>([]);

  // Si ricarica solo quando cambia LA SCHEDA, non a ogni aggiornamento del
  // lead: dopo un salvataggio il lead torna aggiornato dal padre e ricopiarlo
  // qui cancellerebbe quello che si sta scrivendo in quel momento.
  useEffect(() => {
    const d = lead?.data;
    if (!d) {
      setNumero(0);
      setRighe([]);
      return;
    }
    setNumero(contaAcquisti(d));
    setRighe(righeIniziali(d));
    //  `lead.data` è volutamente fuori dalle dipendenze: rimetterlo dentro (come
    //  chiede la regola) farebbe ripartire l'effetto a ogni salvataggio e
    //  sovrascriverebbe il testo mentre lo si sta scrivendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  /* ── SALVATAGGIO RAGGRUPPATO ───────────────────────────────────────────
     Tutto passa da qui: si accumula l'ultima modifica e la si invia dopo la
     pausa. I ref servono perché il timer parte dentro un render e deve poter
     usare i valori più recenti quando scatta. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendenteRef = useRef<Partial<LeadData> | null>(null);
  const onSalvaRef = useRef(onSalva);
  useEffect(() => {
    onSalvaRef.current = onSalva;
  });

  const inviaOra = () => {
    const patch = pendenteRef.current;
    pendenteRef.current = null;
    timerRef.current = null;
    if (patch) void onSalvaRef.current(patch);
  };

  const programmaSalvataggio = (n: number, r: RigaAcquisto[]) => {
    const pulite = r.filter(rigaPiena);
    // "acquisti" resta sempre un numero: è il campo che leggono le altre
    // pagine, e non devono sapere che esiste un dettaglio. Quando il dettaglio
    // sparisce si toglie la chiave (undefined non finisce nel JSON) e il
    // contatore a mano torna a comandare.
    pendenteRef.current =
      pulite.length > 0
        ? { acquisti: pulite.length, acquistiDettaglio: pulite }
        : { acquisti: n, acquistiDettaglio: undefined };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(inviaOra, RITARDO_SALVATAGGIO);
  };

  // Chiudendo la finestra subito dopo l'ultimo clic la modifica sarebbe ancora
  // in attesa: qui si forza l'invio invece di perderla.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        inviaOra();
      }
    };
  }, []);

  if (!lead) return null;

  const cambiaNumero = (delta: number) => {
    const n = Math.max(0, numero + delta);
    setNumero(n);
    programmaSalvataggio(n, righe);
  };

  const aggiungiRiga = () => {
    const prossime = [...righe, { id: nuovaChiave(), prodotto: "" }];
    setRighe(prossime);
    // La riga è ancora vuota: niente da salvare finché non si scrive qualcosa.
  };

  const modificaRiga = (id: string, campi: Partial<RigaAcquisto>) => {
    const prossime = righe.map((r) => (r.id === id ? { ...r, ...campi } : r));
    setRighe(prossime);
    programmaSalvataggio(numero, prossime);
  };

  const togliRiga = (id: string) => {
    const prossime = righe.filter((r) => r.id !== id);
    setRighe(prossime);
    programmaSalvataggio(numero, prossime);
  };

  const pulite = righe.filter(rigaPiena);
  /** C'è un elenco da mostrare (anche solo la riga appena aperta). */
  const conRighe = righe.length > 0;
  /** C'è dettaglio VERO, cioè almeno una riga compilata: solo allora il numero
   *  smette di essere modificabile a mano. Una riga ancora vuota non deve
   *  togliere i pulsanti − e +, altrimenti chi la apre per sbaglio si ritrova
   *  il contatore bloccato a zero. */
  const dettaglioReale = pulite.length > 0;
  const totale = dettaglioReale ? pulite.length : numero;
  const speso = pulite.reduce((s, r) => s + (r.importo || 0), 0);
  // Se il contatore a mano era più alto delle righe, il numero scende: va detto
  // prima, altrimenti sembra che il CRM abbia perso degli acquisti.
  const contatoreSuperato = dettaglioReale && numero > pulite.length;

  const corpo = (
    <div className="flex flex-col gap-3">
      {/* IL NUMERO — la riga che serve quasi sempre */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {!dettaglioReale && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => cambiaNumero(-1)}
              disabled={numero <= 0}
              aria-label="Togli un acquisto"
              title="Togli un acquisto"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="min-w-16 text-center">
            <div className="text-[19px] font-semibold leading-tight tabular-nums">{totale}</div>
            <div className="text-[11px] text-muted-foreground">
              {totale === 1 ? "acquisto" : "acquisti"}
            </div>
          </div>
          {!dettaglioReale && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => cambiaNumero(1)}
              aria-label="Aggiungi un acquisto"
              title="Aggiungi un acquisto"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
          {dettaglioReale ? (
            <>
              Il numero segue le righe qui sotto: togli una riga per abbassarlo.
              {contatoreSuperato &&
                ` Il contatore a mano (${numero}) resta salvato e torna a valere se togli tutte le righe.`}
            </>
          ) : conRighe ? (
            "Compila la riga per registrare il prodotto, oppure toglila: il numero resta modificabile a mano."
          ) : (
            "Basta il numero. Il dettaglio dei prodotti è facoltativo."
          )}
        </div>

        {speso > 0 && (
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Totale speso</div>
            <div className="text-[13px] font-semibold tabular-nums">{eur(speso)}</div>
          </div>
        )}
      </div>

      {/* IL DETTAGLIO — solo se qualcuno ha premuto "Aggiungi prodotto" */}
      {conRighe && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {righe.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Input
                value={r.prodotto}
                onChange={(e) => modificaRiga(r.id, { prodotto: e.target.value })}
                placeholder="Prodotto"
                aria-label="Prodotto acquistato"
                className="h-8 min-w-40 flex-1 text-[13px]"
              />
              <Input
                type="date"
                value={r.data || ""}
                onChange={(e) => modificaRiga(r.id, { data: e.target.value || undefined })}
                aria-label="Data dell'acquisto"
                title={r.data ? dataBreve(r.data) : "Data dell'acquisto"}
                className="h-8 w-36 text-[13px]"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={10}
                value={r.importo ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = Number(v);
                  // Campo vuoto o testo non numerico: l'importo semplicemente
                  // non c'è, non è zero (zero direbbe "regalato").
                  modificaRiga(r.id, {
                    importo: v === "" || !Number.isFinite(n) ? undefined : n,
                  });
                }}
                placeholder="€"
                aria-label="Importo dell'acquisto"
                className="h-8 w-28 text-[13px] tabular-nums"
              />
              <button
                type="button"
                onClick={() => togliRiga(r.id)}
                aria-label="Togli questo prodotto"
                title="Togli questo prodotto"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Il pulsante che apre il dettaglio sta anche qui e non solo
          nell'intestazione: quando il componente è senza scheda l'intestazione
          non c'è, e l'azione deve restare raggiungibile. */}
      {(senzaScheda || conRighe) && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={aggiungiRiga} className="h-8">
            <Plus className="h-3.5 w-3.5" />
            Aggiungi prodotto
          </Button>
        </div>
      )}
    </div>
  );

  if (senzaScheda) return <div className={cn("min-w-0", className)}>{corpo}</div>;

  return (
    <Scheda
      titolo="Storico acquisti"
      nota={conRighe ? "Numero e dettaglio dei prodotti" : "Quante volte ha comprato"}
      icona={ShoppingBag}
      className={className}
      azioni={
        !conRighe && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={aggiungiRiga}
            className="h-7 text-[11px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi prodotto
          </Button>
        )
      }
    >
      {corpo}
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTATORE NELLE LISTE — "· 3 acquisti", e si apre solo se serve
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UN SECONDO COMPONENTE E NON UN SECONDO STORICO ────────────────
 *  Nelle installazioni il dato serve mentre si scorre l'elenco: un cliente che
 *  ha già comprato due volte non si tratta come uno nuovo — si saluta per nome,
 *  alla consegna gli si propone il ricambio. Ma la riga di un elenco non è il
 *  posto per tre campi di testo.
 *
 *  Quindi qui c'è SOLO il numero, in un chip che si può premere. Premendolo si
 *  apre la stessa identica scheda di sempre (<StoricoAcquisti senzaScheda/>):
 *  nessuna seconda versione da tenere allineata, nessun secondo modo di contare.
 *  Il dettaglio dei prodotti resta facoltativo com'è sempre stato: compare solo
 *  se qualcuno preme "Aggiungi prodotto".
 *
 *  Anche "nessun acquisto" è un'informazione, e si scrive: "Primo acquisto" dice
 *  al tecnico che quel cliente non ci ha mai visti prima. Un chip vuoto no. */
export function ContatoreAcquisti({
  lead,
  onSalva,
  className,
}: {
  lead: Lead;
  onSalva: (patch: Partial<LeadData>) => void | Promise<unknown>;
  className?: string;
}) {
  const [aperta, setAperta] = useState(false);
  const n = contaAcquisti(lead.data);
  const nome = `${lead.data.nome} ${lead.data.cognome}`.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setAperta(true)}
        aria-haspopup="dialog"
        title={
          n > 0
            ? "Acquisti registrati: apri per correggere il numero o elencare i prodotti"
            : "Nessun acquisto registrato: apri per aggiungerlo"
        }
        className={cn("inline-flex max-w-full items-center rounded-full", className)}
      >
        <Chip tono="neutro" icona={ShoppingBag} className="hover:brightness-95">
          {n === 0 ? "Primo acquisto" : n === 1 ? "1 acquisto" : `${n} acquisti`}
        </Chip>
      </button>

      <Finestra
        aperta={aperta}
        onCambio={setAperta}
        larghezza="sm"
        icona={ShoppingBag}
        titolo="Acquisti del cliente"
        contesto={nome}
      >
        <StoricoAcquisti lead={lead} onSalva={onSalva} senzaScheda />
      </Finestra>
    </>
  );
}

export default StoricoAcquisti;
