/** ── LA FINESTRA PER SCRIVERE UNA COSA DA FARE ─────────────────────────────
 *
 *  La riga veloce in cima alla pagina resta dov'è ed è la strada normale:
 *  si scrive, si batte invio, è fatta. Questa finestra è per le tre cose che
 *  quella riga non può chiedere senza diventare un modulo da compilare:
 *   · A CHI tocca — prima si scriveva dentro al testo («Marco: richiamare…»),
 *     e nessun filtro può leggere una frase;
 *   · PER QUALE CLIENTE — «portare il POS alla posa» senza il nome è una
 *     riga che domani non si capisce più;
 *   · SE SI PRENDE UN PEZZO DI GIORNATA — ed è l'unica delle tre che cambia
 *     qualcosa fuori da questa pagina: quel tempo sparisce dalle ore
 *     prenotabili (vedi agenda-task.ts).
 *
 *  ── ⚠️ TUTTO FACOLTATIVO TRANNE IL TESTO ─────────────────────────────────
 *  Ogni campo in più è un motivo per non scrivere la riga. Qui si apre già
 *  pieno di ciò che si intende nove volte su dieci — oggi, io, non occupa — e
 *  si può salvare al primo istante: chi ha altro da dire lo dice, gli altri
 *  premono invio.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Plus, Search, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CampoFinestra,
  Finestra,
  Pillola,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
import type { Lead } from "@/crm/types";
import { DURATA_PREDEFINITA, DURATE, fineOrario } from "./agenda-task";

export interface NuovaCosaCampi {
  testo: string;
  data: string;
  ora: string;
  aId: string;
  aNome: string;
  perId: string;
  perNome: string;
  occupaAgenda: boolean;
  durata: number;
}

const fraGiorni = (g: number, da: Date): string => {
  const d = new Date(da);
  d.setDate(d.getDate() + g);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const nomeLead = (l: Lead): string =>
  `${l.data.nome || ""} ${l.data.cognome || ""}`.trim() || l.data.telefono || "Senza nome";

export function NuovaCosa({
  aperta,
  onCambio,
  oggi,
  adesso,
  persone,
  io,
  leads,
  salvando,
  onCrea,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  oggi: string;
  adesso: number;
  /** Chi può ricevere una cosa da fare: setter e consulenti, come nel filtro
   *  in cima alla pagina. ⚠️ La stessa lista dei due posti: due elenchi di
   *  persone che si costruiscono in due modi divergono al primo che entra. */
  persone: { id: string; nome: string }[];
  /** Chi sta scrivendo: è il valore di partenza di «a chi tocca». */
  io?: { id: string; nome: string };
  leads: Lead[];
  salvando?: boolean;
  onCrea: (campi: NuovaCosaCampi) => void;
}) {
  const [testo, setTesto] = useState("");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  const [aId, setAId] = useState("");
  const [cerca, setCerca] = useState("");
  const [per, setPer] = useState<{ id: string; nome: string } | null>(null);
  const [occupa, setOccupa] = useState(false);
  const [durata, setDurata] = useState(DURATA_PREDEFINITA);

  /** ⚠️ Si riparte puliti a ogni apertura, e «a chi» riparte da ME. Una
   *  finestra che si riapre con dentro l'ultima cosa scritta fa salvare due
   *  volte la stessa riga — e con l'assegnatario di prima la fa salvare
   *  addosso alla persona sbagliata. */
  useEffect(() => {
    if (!aperta) return;
    setTesto("");
    setData("");
    setOra("");
    setAId(io?.id || "");
    setCerca("");
    setPer(null);
    setOccupa(false);
    setDurata(DURATA_PREDEFINITA);
  }, [aperta, io?.id]);

  const trovati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads
      .filter((l) => {
        const d = l.data;
        return `${d.nome || ""} ${d.cognome || ""} ${d.telefono || ""}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 6);
  }, [cerca, leads]);

  const giorno = data || oggi;
  const nomeDi = (id: string): string =>
    persone.find((c) => c.id === id)?.nome || (id === io?.id ? io?.nome || "" : "");

  /** ── ⚠️ QUANDO «OCCUPA» NON PUÒ ESSERE ACCESO ──────────────────────────
   *  Senza un'ora non si sa QUALE pezzo di giornata togliere, e senza sapere
   *  di chi è l'agenda si chiuderebbe quella di tutto il centro (in
   *  crm/blocchi un blocco senza consulente vale per tutti). In tutti e due i
   *  casi si dice cosa manca invece di spegnere l'interruttore in silenzio. */
  const manca = occupa
    ? !ora
      ? "Serve un orario: senza, non c'è un pezzo di giornata da togliere."
      : !aId
        ? "Serve sapere di chi è l'agenda da bloccare."
        : ""
    : "";
  const puoSalvare = !!testo.trim() && !manca && !salvando;

  const salva = () => {
    if (!puoSalvare) return;
    onCrea({
      testo: testo.trim(),
      data: giorno,
      ora,
      aId,
      aNome: nomeDi(aId),
      perId: per?.id || "",
      perNome: per?.nome || "",
      occupaAgenda: occupa,
      durata,
    });
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Aggiungi una cosa da fare"
      contesto="Resta visibile a tutto il centro"
      icona={Plus}
      larghezza="md"
      azioni={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => onCambio(false)}>
            Annulla
          </Button>
          <Button type="button" size="sm" disabled={!puoSalvare} onClick={salva}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Aggiungi
          </Button>
        </>
      }
    >
      <SezioneFinestra>
        <CampoFinestra etichetta="Che cosa c'è da fare" obbligatorio>
          <Input
            autoFocus
            value={testo}
            maxLength={500}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              //  Invio salva: questa finestra si apre in mezzo a una
              //  telefonata, e staccare la mano dalla tastiera per cercare un
              //  pulsante è il motivo per cui certe righe non si scrivono.
              if (e.key === "Enter") {
                e.preventDefault();
                salva();
              }
            }}
            placeholder="Ordinare le basi · portare il POS alla posa · richiamare il fornitore"
            className="h-9 text-[13px]"
          />
        </CampoFinestra>
      </SezioneFinestra>

      <SezioneFinestra titolo="Quando">
        <div className="flex flex-wrap items-center gap-2">
          <Pillola attiva={!data || data === oggi} onClick={() => setData("")}>
            Oggi
          </Pillola>
          <Pillola
            attiva={data === fraGiorni(1, new Date(adesso))}
            onClick={() => setData(fraGiorni(1, new Date(adesso)))}
          >
            Domani
          </Pillola>
          <Input
            type="date"
            value={giorno}
            min={oggi}
            onChange={(e) => setData(e.target.value)}
            className="h-9 w-[9.5rem] text-[13px] tabular-nums"
            aria-label="Giorno"
          />
          <Input
            type="time"
            value={ora}
            onChange={(e) => setOra(e.target.value)}
            className="h-9 w-[7.5rem] text-[13px] tabular-nums"
            aria-label="Ora"
          />
          {!ora && <span className="text-[11.5px] text-slate-500">senza ora = in giornata</span>}
        </div>
      </SezioneFinestra>

      <SezioneFinestra titolo="A chi tocca">
        <div className="flex flex-wrap items-center gap-2">
          {/*  ⚠️ «Di nessuno» non è un ripiego: qui dentro le cose da fare si
              passano di mano davvero, e chi scrive «richiamare il fornitore»
              spesso non sa chi la farà. Toglierlo obbligherebbe ad assegnare a
              caso, che è peggio di non assegnare. */}
          <Pillola attiva={!aId} onClick={() => { setAId(""); if (occupa) setOccupa(false); }}>
            Di nessuno
          </Pillola>
          {io?.id && (
            <Pillola attiva={aId === io.id} onClick={() => setAId(io.id)}>
              <User className="h-3 w-3" /> Io
            </Pillola>
          )}
          {persone
            .filter((c) => c.id !== io?.id)
            .map((c) => (
              <Pillola key={c.id} attiva={aId === c.id} onClick={() => setAId(c.id)}>
                {c.nome}
              </Pillola>
            ))}
        </div>
      </SezioneFinestra>

      <SezioneFinestra titolo="Per quale cliente" nota="Facoltativo">
        {per ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700">
            {per.nome}
            <button
              type="button"
              onClick={() => { setPer(null); setCerca(""); }}
              className="text-slate-400 transition hover:text-slate-700"
              aria-label="Togli il cliente"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={cerca}
                onChange={(e) => setCerca(e.target.value)}
                placeholder="Cerca per nome, cognome o telefono"
                className="h-9 pl-8 text-[13px]"
              />
            </div>
            {/*  Sei risultati e non tutti: una tendina lunga in una finestra
                che si usa di corsa si scorre invece di leggerla. Chi non trova
                il nome scrive due lettere in più. */}
            {trovati.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1">
                {trovati.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setPer({ id: l.id, nome: nomeLead(l) }); setCerca(""); }}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="truncate font-medium">{nomeLead(l)}</span>
                    <span className="shrink-0 text-[11.5px] text-slate-500">{l.data.telefono}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SezioneFinestra>

      <SezioneFinestra titolo="Occupa l'agenda">
        <div className="flex flex-wrap items-center gap-2">
          <Pillola attiva={!occupa} onClick={() => setOccupa(false)}>
            No, è solo un promemoria
          </Pillola>
          <Pillola attiva={occupa} onClick={() => setOccupa(true)}>
            <CalendarClock className="h-3 w-3" /> Sì, blocca il tempo
          </Pillola>
        </div>
        {occupa && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-slate-500">per</span>
            {DURATE.map((m) => (
              <Pillola key={m} attiva={durata === m} onClick={() => setDurata(m)}>
                {m < 60 ? `${m} min` : m === 60 ? "1 ora" : `${m / 60} ore`}
              </Pillola>
            ))}
          </div>
        )}
        {/*  ── ⚠️ COSA SUCCEDE DAVVERO, DETTO PRIMA DI PREMERE ─────────────
            Questo interruttore è l'unico della finestra che cambia qualcosa
            FUORI da qui: quell'ora sparisce dalle disponibilità e i clienti
            non la vedono più. Una conseguenza che si scopre dopo è una
            conseguenza che qualcuno subisce. */}
        {occupa && !manca && (
          <p className="mt-2 text-[11.5px] leading-snug text-slate-600">
            Dalle <span className="font-medium">{ora}</span> alle{" "}
            <span className="font-medium">{fineOrario(ora, durata)}</span> di{" "}
            <span className="font-medium">{giorno === oggi ? "oggi" : giorno}</span>{" "}
            nessuno potrà prenotare l'agenda di{" "}
            <span className="font-medium">{nomeDi(aId) || "questa persona"}</span>.
          </p>
        )}
        {!!manca && <p className="mt-2 text-[11.5px] leading-snug text-amber-700">{manca}</p>}
      </SezioneFinestra>
    </Finestra>
  );
}
