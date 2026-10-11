/** ── COME HA PAGATO: UN BLOCCO SOLO, PER TUTTE LE FINESTRE ─────────────────
 *
 *  Segnalazione del committente: «quando emetto fattura e seleziono POS non
 *  deve uscire pagamento tramite bonifico sulla fattura, ma deve dire il
 *  numero di transazione che ho messo. Stessa cosa per contanti: deve uscire
 *  la fattura corretta in base al metodo di pagamento».
 *
 *  La scelta esisteva, ma solo in DUE delle finestre da cui una fattura esce.
 *  Dalla terza — quella che si apre quando i soldi arrivano, cioè l'unica che
 *  si usa quando il cliente paga al POS davanti a te — non si poteva dire
 *  niente: la fattura usciva senza modo, e «senza modo» vuol dire bonifico
 *  (è quello che il programma scriveva prima che questo campo esistesse).
 *  Da lì, «Pagamento con bonifico bancario · IBAN …» su un incasso al POS.
 *
 *  ⚠️ UN BLOCCO SOLO E NON TRE COPIE: tre blocchi gemelli si scostano al primo
 *   ritocco, e allora la stessa domanda — fatta in tre finestre — dà tre
 *   risposte diverse sullo stesso documento fiscale.
 *  ⚠️ LA GUIDA SI APRE ANCHE PREMENDOLA, non solo col mouse sopra: su un
 *   telefono il mouse non c'è, e una guida che si vede solo passandoci sopra lì
 *   non esiste.
 *  ⚠️ IL DATO NON È MAI OBBLIGATORIO: una fattura senza il codice
 *   dell'operazione è valida; una fattura che non si riesce a emettere perché
 *   manca un numero che il consulente non trova è un cliente che aspetta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CLASSE_CAMPO, Pillola } from "@/crm/ui/Finestra";
import { MODI_INCASSO, modoDi, type MetodoPagamento } from "./modi-di-incasso";

export function SceltaModoIncasso({
  metodo,
  onMetodo,
  riferimento,
  onRiferimento,
  className,
  titolo = "Come ha pagato",
}: {
  metodo?: MetodoPagamento | null;
  onMetodo: (m: MetodoPagamento) => void;
  riferimento: string;
  onRiferimento: (v: string) => void;
  className?: string;
  titolo?: string;
}) {
  const [guida, setGuida] = useState(false);
  const modoScelto = modoDi(metodo);
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-2.5 ${className ?? ""}`}>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {titolo}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MODI_INCASSO.map((m) => (
          <Pillola
            key={m.chiave}
            attiva={modoScelto.chiave === m.chiave}
            onClick={() => {
              onMetodo(m.chiave);
              setGuida(false);
            }}
            titolo={`Finisce in fattura come ${m.codice}`}
          >
            {m.titolo}
          </Pillola>
        ))}
      </div>
      {modoScelto.dato && (
        <div className="mt-2">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11.5px] font-semibold text-slate-700">
              {modoScelto.dato.etichetta}
            </span>
            <span className="text-[11px] text-slate-400">facoltativo</span>
            <button
              type="button"
              onClick={() => setGuida((v) => !v)}
              title={modoScelto.dato.dove}
              aria-label="Dove trovo questo dato?"
              className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] font-bold transition ${
                guida
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "border-slate-300 bg-white text-slate-500 hover:border-slate-500 hover:text-slate-700"
              }`}
            >
              <Info className="h-3 w-3" />
            </button>
          </div>
          <Input
            value={riferimento}
            onChange={(e) => onRiferimento(e.target.value)}
            placeholder={modoScelto.dato.esempio}
            className={CLASSE_CAMPO}
          />
          {guida && (
            <p className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] leading-snug text-slate-600">
              {modoScelto.dato.dove}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
