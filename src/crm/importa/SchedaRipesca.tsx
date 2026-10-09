/** ── RIPESCA — IL MAGAZZINO DELLE SCHEDE FERME ─────────────────────────────
 *
 *  Misurato in archivio il 7/10/2026: 823 schede su 1.081 ferme in «annullato»,
 *  «non si è presentato» o «da ricontattare», e diciassette in coda. Il lavoro
 *  vero stava in un magazzino che nessuna schermata apriva: l'unico modo di far
 *  riemergere un «non si è presentato» di tre mesi fa era ricaricare un file
 *  che lo contenesse.
 *
 *  Qui si sceglie da quanto tempo una scheda deve tacere per valere una riga su
 *  WhatsApp, e si scrive — con il messaggio che il programma sa già comporre
 *  (`messaggioRifissa`: dice cose diverse a chi la consulenza l'ha fatta, a chi
 *  l'ha saltata e a chi non l'ha mai fissata).
 *
 *  ⚠️ NIENTE SI MUOVE DA SOLO. Nessuno stato cambia, nessun messaggio parte
 *   senza che una persona prema: si parla a gente che aveva detto no, e un
 *   automatismo qui è il modo di farsi bloccare trenta numeri in una mattina.
 *  ⚠️ SI SCRIVE A UNO PER VOLTA, e non è una mancanza: WhatsApp apre una chat
 *   alla volta, e un messaggio identico mandato a venti persone in cinque
 *   minuti è esattamente ciò che fa finire un numero fra gli spam. Il gruppo
 *   serve a SEGNARE, non a mandare.
 *  ⚠️ IL SEGNO «RIPESCATO» NON È UNO STATO. Scrivere non è avere una risposta:
 *   lo stato resta quello di prima, e il segno serve solo a far ricominciare il
 *   conto del silenzio — se no la stessa persona torna in cima ogni volta che
 *   si apre la pagina (vedi crm/importa/ripesca).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { Check, FishSymbol, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
import {
  BarraSelezione,
  CLASSE_BADGE_STATO,
  Scheda,
  Vuoto,
  classiStato,
  dataBreve,
  etichettaStato,
} from "@/crm/ui";
import { buildWhatsAppLink } from "@/crm/whatsapp";
import { messaggioRifissa } from "./ricarico";
import {
  SILENZIO_PREDEFINITO_GG,
  STATI_DORMIENTI,
  contiPerStato,
  dormienti,
  etichettaSilenzio,
  giorniDiSilenzio,
  volteRipescato,
} from "./ripesca";
import { useSelezioneRighe, testoSelezionaTutti } from "./selezione";

/** Le soglie proposte. Tre, non un cursore: «da quanto tace» non è una misura
 *  fine, e un cursore fa perdere tempo a cercare il numero giusto. */
const SOGLIE: { giorni: number; nome: string }[] = [
  { giorni: 30, nome: "1 mese" },
  { giorni: 90, nome: "3 mesi" },
  { giorni: 180, nome: "6 mesi" },
];

export function SchedaRipesca({
  leads,
  onApri,
  onRipescato,
  onRipescatiInBlocco,
  nomeConsulente,
}: {
  /** TUTTO l'archivio: qui si pesca fuori dalla lista importata, perché una
   *  scheda ferma è ferma anche se è arrivata da un modulo del sito. */
  leads: Lead[];
  onApri: (l: Lead) => void;
  /** Premuto WhatsApp su una riga: si segna che è stata ripescata. */
  onRipescato: (l: Lead) => void;
  /** «Le ho scritte tutte»: lo stesso segno, su un gruppo. */
  onRipescatiInBlocco: (righe: Lead[]) => void;
  nomeConsulente?: (id?: string | null) => string;
}) {
  const [giorniMin, setGiorniMin] = useState<number>(SILENZIO_PREDEFINITO_GG);
  const [stato, setStato] = useState<LeadStatus | null>(null);

  const conti = useMemo(() => contiPerStato(leads, giorniMin), [leads, giorniMin]);
  const righe = useMemo(
    () => dormienti(leads, { giorniMin, ...(stato ? { stati: [stato] } : {}) }),
    [leads, giorniMin, stato],
  );
  const sel = useSelezioneRighe(righe);
  const totale = useMemo(() => dormienti(leads, { giorniMin }).length, [leads, giorniMin]);

  return (
    <>
      <Scheda
        titolo="Ripesca"
        nota={
          totale === 0
            ? "Nessuna scheda ferma da tanto: l'archivio è in pari"
            : `${totale} ${totale === 1 ? "scheda ferma" : "schede ferme"} da almeno ${SOGLIE.find((s) => s.giorni === giorniMin)?.nome ?? `${giorniMin} giorni`} · in cima le più dimenticate`
        }
        icona={FishSymbol}
        senzaPadding
        azioni={
          righe.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={sel.tuttiSelezionati ? sel.azzera : sel.selezionaTutti}
            >
              {testoSelezionaTutti(sel.tuttiSelezionati, sel.tettoStretto, righe.length)}
            </Button>
          ) : undefined
        }
      >
        {/*  I due filtri: da quanto tace, e in che stato è rimasta. I numeri
            sugli stati si contano sul silenzio scelto — un filtro che mostra il
            conteggio di sé stesso direbbe sempre «tutti». */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
          <span className="mr-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Ferme da
          </span>
          {SOGLIE.map((s) => (
            <Button
              key={s.giorni}
              type="button"
              size="sm"
              variant={giorniMin === s.giorni ? "default" : "outline"}
              className="h-7 px-2.5 text-[12px]"
              onClick={() => {
                setGiorniMin(s.giorni);
                sel.azzera();
              }}
            >
              {s.nome}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            size="sm"
            variant={stato === null ? "default" : "outline"}
            className="h-7 px-2.5 text-[12px]"
            onClick={() => {
              setStato(null);
              sel.azzera();
            }}
          >
            Tutti
          </Button>
          {STATI_DORMIENTI.filter((s) => (conti.get(s) ?? 0) > 0).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={stato === s ? "default" : "outline"}
              className="h-7 px-2.5 text-[12px]"
              onClick={() => {
                setStato(s);
                sel.azzera();
              }}
            >
              {etichettaStato(s)}{" "}
              <span className="ml-1 tabular-nums opacity-60">{conti.get(s)}</span>
            </Button>
          ))}
        </div>

        {righe.length === 0 ? (
          <div className="px-4 py-10">
            <Vuoto
              titolo="Niente da ripescare"
              icona={FishSymbol}
              testo="Con questi filtri non c'è nessuna scheda ferma da abbastanza tempo. Prova ad abbassare il silenzio, o a togliere il filtro di stato."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {righe.map((l) => (
              <Riga
                key={l.id}
                lead={l}
                scelta={sel.selezione.has(l.id)}
                onScegli={(blocco) => sel.scegli(l.id, blocco)}
                onApri={() => onApri(l)}
                onRipescato={() => onRipescato(l)}
                firma={nomeConsulente?.(l.data?.consulenteId) ?? ""}
              />
            ))}
          </ul>
        )}
      </Scheda>

      {/*  ⚠️ IL GRUPPO SEGNA, NON MANDA: WhatsApp apre una chat alla volta, e
          venti messaggi identici in cinque minuti sono il modo di farsi
          segnalare. Il tasto serve a chi le ha scritte davvero, una per una. */}
      <BarraSelezione conteggio={sel.selezionati.length} onAnnulla={sel.azzera}>
        <Button
          type="button"
          size="sm"
          className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => onRipescatiInBlocco(sel.selezionati)}
          title="Segna che le hai riscritte: lo stato non cambia, ma il conto del silenzio riparte e non te le ritrovi in cima domani"
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Segna come riscritte
        </Button>
      </BarraSelezione>
    </>
  );
}

function Riga({
  lead,
  scelta,
  onScegli,
  onApri,
  onRipescato,
  firma,
}: {
  lead: Lead;
  scelta: boolean;
  onScegli: (blocco: boolean) => void;
  onApri: () => void;
  onRipescato: () => void;
  firma?: string;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  const telefono = String(d.telefono || "");
  const giorni = giorniDiSilenzio(lead);
  const volte = volteRipescato(d);
  //  Lo stesso messaggio dei contatti di ritorno: dice cose diverse a chi la
  //  consulenza l'ha fatta, a chi l'ha saltata e a chi non l'ha mai fissata.
  const messaggio = messaggioRifissa(d, new Date(), firma);
  const link = telefono && messaggio ? buildWhatsAppLink(telefono, messaggio) : "";

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.06]">
        <Checkbox
          checked={scelta}
          onCheckedChange={() => onScegli(false)}
          onClick={(e) => onScegli(e.shiftKey)}
          aria-label={`Seleziona ${nome}`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={onApri} className="min-w-0 flex-1 text-left">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold underline-offset-2 hover:underline">
                {nome}
              </span>
              <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                {etichettaStato(d.stato)}
              </span>
              <span
                className={cn(
                  CLASSE_BADGE_STATO,
                  giorni >= 180
                    ? "border-slate-300 bg-slate-100 text-slate-600"
                    : "border-amber-300 bg-amber-50 text-amber-800",
                )}
              >
                {etichettaSilenzio(giorni)}
              </span>
              {/*  ⚠️ Chi è già stato ripescato lo dice: riscrivere una terza
                   volta a chi non ha mai risposto non è insistere, è disturbare. */}
              {volte > 0 && (
                <span
                  className={cn(CLASSE_BADGE_STATO, "border-red-300 bg-red-50 text-red-700")}
                  title="Le è già stato riscritto da qui e non ha risposto"
                >
                  <MessageCircle className="h-3 w-3 shrink-0" /> ripescata {volte}{" "}
                  {volte === 1 ? "volta" : "volte"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
              {[
                telefono || "senza telefono",
                d.citta || null,
                d.dataMeeting ? `consulenza del ${dataBreve(d.dataMeeting)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={onApri}>
              <User className="mr-1 h-3.5 w-3.5" /> Scheda
            </Button>
            {link && (
              <Button
                asChild
                size="sm"
                className="h-8 bg-[#25D366] text-white hover:bg-[#1da851]"
                onClick={onRipescato}
              >
                <a href={link} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> Riscrivile
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
