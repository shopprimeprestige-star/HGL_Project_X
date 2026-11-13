/** ── FATTURE DALLA CHAT · T8 · PASSO 1: SI SCELGONO I CLIENTI ───────────────
 *  Commessa 2026-11-13-fatture-dalla-chat, T8 (SPEC §3 passo 1, §6.1). Solo
 *  presentazione: candidati, ricerca e selezione arrivano già pronti da chi
 *  monta questo componente (`CaricaDallaChat`, in `bulk/FinestraBulk.tsx`),
 *  che parla con la rotta. Qui non c'è nessun `fetch`.
 *
 *  ⚠️ Il telefono che si vede è SOLO le ultime 9 cifre (mai il numero intero):
 *   `CandidatoChat.telefono` arriva già così dal server (SPEC §5, divieto sui
 *   log/sui dati che finiscono in `app_config` — qui è solo testo a schermo,
 *   ma la stessa disciplina vale anche per non abituare a mostrarne di più). */
import { useMemo } from "react";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CLASSE_CAMPO, NotaFinestra, Pillola, VoceScelta, VuotoFinestra } from "@/crm/ui/Finestra";
import { euroEsatti, dataItaliana } from "../bulk/AnteprimaBulk";
import type { CandidatoChat } from "./tipi";

/** Il numero com'è: solo le ultime 9 cifre, a gruppi di 3 per leggerlo a colpo
 *  d'occhio (mai un prefisso internazionale: non lo abbiamo). */
function telefonoLeggibile(t: string): string {
  const cifre = t.replace(/\D/g, "");
  if (cifre.length < 9) return cifre || "—";
  return `···${cifre.slice(0, 3)} ${cifre.slice(3, 6)} ${cifre.slice(6)}`;
}

export function ListaClientiChat({
  candidati,
  caricando,
  errore,
  ricerca,
  onRicerca,
  scelti,
  onScelti,
  occupato,
  onCerca,
}: {
  candidati: CandidatoChat[];
  /** La lista sta ancora leggendo i candidati o rispondendo alla ricerca. */
  caricando: boolean;
  errore: string | null;
  ricerca: string;
  onRicerca: (v: string) => void;
  /** `schedaId` dei clienti spuntati. */
  scelti: Set<string>;
  onScelti: (s: Set<string>) => void;
  /** Un altro lavoro (ricerca, emissione…) è già in corso: si guarda, non si tocca. */
  occupato: boolean;
  onCerca: () => void;
}) {
  const tutteScelte = candidati.length > 0 && candidati.every((c) => scelti.has(c.schedaId));
  const conPagamento = useMemo(
    () => candidati.filter((c) => c.importoPagato !== null).length,
    [candidati],
  );

  const commuta = (id: string) => {
    const n = new Set(scelti);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onScelti(n);
  };
  const spuntaTutte = () => {
    if (tutteScelte) {
      onScelti(new Set());
      return;
    }
    onScelti(new Set(candidati.map((c) => c.schedaId)));
  };

  return (
    <div className="space-y-3">
      <p className="max-w-[65ch] text-[13px] leading-relaxed text-slate-600">
        Scegli uno o più clienti: per ognuno guardo la sua chat WhatsApp e cerco codice fiscale e
        indirizzo. Qui sotto ci sono già i clienti con un pagamento registrato in scheda e senza
        fattura; con la ricerca puoi aggiungere anche un cliente qualsiasi.
      </p>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Input
          value={ricerca}
          onChange={(e) => onRicerca(e.target.value)}
          placeholder="Cerca per nome o telefono"
          aria-label="Cerca per nome o telefono"
          className={cn(CLASSE_CAMPO, "h-11 w-full pl-9 sm:h-9")}
        />
      </div>

      {errore && (
        <NotaFinestra tono="attenzione">
          <span role="alert">{errore}</span>
        </NotaFinestra>
      )}

      {ricerca.trim() === "" && conPagamento === 0 && !caricando && candidati.length === 0 ? (
        <VuotoFinestra
          icona={Users}
          testo="Nessun cliente con un pagamento in scheda senza fattura. Cerca per nome o telefono per aggiungerne uno qualsiasi."
        />
      ) : candidati.length === 0 && !caricando ? (
        <VuotoFinestra icona={Users} testo="Nessun cliente trovato con questa ricerca." />
      ) : (
        <div
          className="max-h-[50vh] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2"
          aria-busy={caricando}
        >
          {candidati.map((cand) => (
            <VoceScelta
              key={cand.schedaId}
              selezionata={scelti.has(cand.schedaId)}
              onClick={() => commuta(cand.schedaId)}
              disabilitata={occupato}
              titolo={`${cand.nome} ${cand.cognome}`.trim() || "Senza nome"}
              nota={telefonoLeggibile(cand.telefono)}
              coda={
                cand.importoPagato !== null ? (
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums text-slate-900">
                      {euroEsatti(cand.importoPagato)}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {dataItaliana(cand.dataPagamento)}
                    </span>
                  </span>
                ) : undefined
              }
            />
          ))}
          {caricando && (
            <p className="px-2 py-1.5 text-[12px] text-slate-500" aria-live="polite">
              Cerco…
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pillola onClick={spuntaTutte} disabilitata={candidati.length === 0 || occupato}>
          {tutteScelte ? "Deseleziona tutte" : "Seleziona tutte"}
        </Pillola>
        <span className="text-[12px] tabular-nums text-slate-500" aria-live="polite">
          {scelti.size} {scelti.size === 1 ? "cliente scelto" : "clienti scelti"}
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={scelti.size === 0 || occupato}
          onClick={onCerca}
        >
          Cerca nelle chat ({scelti.size})
        </Button>
      </div>
    </div>
  );
}
