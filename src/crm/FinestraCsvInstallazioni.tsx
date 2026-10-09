/** ── IL FOGLIO DELLE POSE, IMPORTATO ED ESPORTATO ──────────────────────────
 *
 *  Il committente teneva le installazioni su un foglio di calcolo. Questa
 *  finestra lo legge: nome, telefono, quanto ha pagato, il prezzo, il giorno
 *  del montaggio, e tutto il resto come nota.
 *
 *  ── ⚠️ SI VEDE PRIMA, SI IMPORTA DOPO ────────────────────────────────────
 *  Ottanta righe scritte a mano da persone diverse non si versano dentro un
 *  gestionale a scatola chiusa: qui si leggono, si vede riga per riga cosa ha
 *  capito il programma e COSA FARÀ — una scheda nuova o l'aggiornamento di una
 *  che c'è già — e si toglie la spunta a quelle che non convincono. Un import
 *  che parte da solo è un import che qualcuno passa la settimana a disfare.
 *
 *  ── ⚠️ CHI C'È GIÀ NON SI DUPLICA ────────────────────────────────────────
 *  Si riconosce dal TELEFONO, non dal nome: nel foglio vero «Mauro» compare
 *  due volte e «Umberto Vitiello» tre, e di omonimi in un archivio di mille
 *  schede ce ne sono sempre. Il numero invece è unico per davvero.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Finestra, Pillola } from "@/crm/ui/Finestra";
import { useCRM } from "@/crm/CRMContext";
import { eur } from "@/crm/ui";
import { esportaCsv, importaCsv, type RigaImportata } from "@/crm/installazioni-csv";
import { soloCifre } from "@/crm/ui";
import type { Lead, LeadData } from "@/crm/types";

/** Le ultime cifre di un numero: è così che si riconosce lo stesso telefono
 *  scritto «351 324 4425», «+39 351 3244425» o «3513244425». */
const coda = (t?: string): string => soloCifre(String(t ?? "")).slice(-9);

export function FinestraCsvInstallazioni({
  aperta,
  onCambio,
  leads,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  leads: Lead[];
}) {
  const { createLead, updateLead } = useCRM();
  const input = useRef<HTMLInputElement | null>(null);
  const [righe, setRighe] = useState<RigaImportata[]>([]);
  const [scelte, setScelte] = useState<Set<number>>(new Set());
  const [inCorso, setInCorso] = useState(false);
  const [saltate, setSaltate] = useState(0);

  const trovaLead = (r: RigaImportata): Lead | undefined => {
    const c = coda(r.telefono);
    if (!c || c.length < 7) return undefined;
    return leads.find((l) => coda(l.data.telefono) === c);
  };

  const leggiFile = async (f?: File | null) => {
    if (!f) return;
    const testo = await f.text();
    const esito = importaCsv(testo);
    setRighe(esito.righe);
    setSaltate(esito.saltate);
    //  ⚠️ Tutte spuntate tranne quelle con un dubbio: il caso normale è «va
    //   bene tutto», e far spuntare ottanta righe a mano vorrebbe dire non
    //   usare l'import. Le righe incerte partono spente, così la scelta di
    //   portarle dentro è di chi guarda.
    setScelte(new Set(esito.righe.map((r, i) => (r.dubbi.length ? -1 : i)).filter((i) => i >= 0)));
    if (esito.righe.length === 0) {
      toast.error("Da questo file non è uscita nessuna pratica", {
        description: "Serve un CSV con almeno il nome nella prima colonna.",
      });
    }
    if (input.current) input.current.value = "";
  };

  const importa = async () => {
    if (inCorso) return;
    setInCorso(true);
    let nuovi = 0;
    let aggiornati = 0;
    let falliti = 0;
    for (let i = 0; i < righe.length; i += 1) {
      if (!scelte.has(i)) continue;
      const r = righe[i];
      const esistente = trovaLead(r);
      /** ⚠️ Le note NON si sovrascrivono, si accodano: sulla scheda ci può
       *  essere quello che ha scritto un collega al telefono, e un import che
       *  lo cancella è un import che fa perdere lavoro invece di portarne. */
      const notePrima = String(esistente?.data.notePostCall ?? "").trim();
      const nota = [notePrima, r.note && `Dal foglio: ${r.note}`].filter(Boolean).join("\n");
      const patch: Partial<LeadData> = {
        ...(r.email ? { email: r.email } : {}),
        ...(r.pagato > 0 || r.totale > 0
          ? {
              payment: {
                ...(esistente?.data.payment ?? {}),
                ...(r.totale > 0 ? { prezzoTotale: r.totale } : {}),
                ...(r.pagato > 0 ? { accontoPagato: r.pagato } : {}),
              },
            }
          : {}),
        ...(r.dataInstallazione
          ? {
              installazione: {
                ...(esistente?.data.installazione ?? {}),
                dataInstallazione: r.dataInstallazione,
                ...(r.ora ? { orarioInstallazione: r.ora } : {}),
              },
            }
          : {}),
        ...(nota ? { notePostCall: nota } : {}),
      };
      try {
        if (esistente) {
          const ok = await updateLead(esistente.id, patch);
          if (ok) aggiornati += 1;
          else falliti += 1;
        } else {
          const pezzi = r.nome.split(/\s+/);
          const creato = await createLead({
            nome: pezzi[0] ?? r.nome,
            cognome: pezzi.slice(1).join(" "),
            telefono: r.telefono,
            //  ⚠️ Lo stato: una riga di questo foglio è una vendita fatta (c'è
            //   un prezzo, quasi sempre un acconto) ma NON si sa come arriva
            //   l'impianto. «Acconto incassato» è l'unico stato vinto che non
            //   promette una consegna che nessuno ha deciso.
            stato: r.pagato > 0 ? "acconto" : "da_contattare",
            ...patch,
          } as LeadData);
          if (creato) nuovi += 1;
          else falliti += 1;
        }
      } catch {
        falliti += 1;
      }
    }
    setInCorso(false);
    toast.success(`Importate ${nuovi + aggiornati} pratiche`, {
      description: [
        nuovi ? `${nuovi} schede nuove` : "",
        aggiornati ? `${aggiornati} aggiornate` : "",
        falliti ? `${falliti} non riuscite` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
    setRighe([]);
    setScelte(new Set());
    onCambio(false);
  };

  const scegli = (i: number) =>
    setScelte((p) => {
      const d = new Set(p);
      if (d.has(i)) d.delete(i);
      else d.add(i);
      return d;
    });

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Il foglio delle pose"
      contesto={righe.length ? `${righe.length} righe lette · ${scelte.size} da importare` : "CSV"}
      icona={FileSpreadsheet}
      larghezza="lg"
      azioni={
        <>
          <Button variant="ghost" size="sm" onClick={() => onCambio(false)}>
            Chiudi
          </Button>
          <Button size="sm" disabled={!scelte.size || inCorso} onClick={() => void importa()}>
            <Upload className="mr-1 h-3.5 w-3.5" />
            {inCorso ? "Importo…" : `Importa ${scelte.size || ""}`.trim()}
          </Button>
        </>
      }
    >
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => void leggiFile(e.target.files?.[0])}
      />

      {righe.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <p className="text-[13px] text-slate-600">
            Scegli il foglio esportato dal calcolo (CSV). Si legge qui e non si importa niente
            finché non lo dici tu.
          </p>
          <Button className="mt-3" size="sm" onClick={() => input.current?.click()}>
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Scegli il file
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Pillola onClick={() => setScelte(new Set(righe.map((_, i) => i)))}>Tutte</Pillola>
            <Pillola onClick={() => setScelte(new Set())}>Nessuna</Pillola>
            <Pillola onClick={() => input.current?.click()}>Cambia file</Pillola>
            {saltate > 0 && (
              <span className="text-[11.5px] text-slate-500">{saltate} righe vuote saltate</span>
            )}
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8 p-2" />
                  <th className="p-2">Chi</th>
                  <th className="p-2">Pagato</th>
                  <th className="p-2">Posa</th>
                  <th className="p-2">Cosa succede</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r, i) => {
                  const esistente = trovaLead(r);
                  return (
                    <tr key={`${r.nome}-${i}`} className="border-t border-slate-100 align-top">
                      <td className="p-2">
                        <Checkbox checked={scelte.has(i)} onCheckedChange={() => scegli(i)} />
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-800">{r.nome}</div>
                        <div className="text-[11px] text-slate-500">{r.telefono || "senza numero"}</div>
                        {!!r.note && (
                          <div className="mt-0.5 line-clamp-2 max-w-[22rem] text-[11px] text-slate-500">
                            {r.note}
                          </div>
                        )}
                        {r.dubbi.map((d) => (
                          <div key={d} className="mt-0.5 flex items-start gap-1 text-[11px] text-amber-700">
                            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                            {d}
                          </div>
                        ))}
                      </td>
                      <td className="whitespace-nowrap p-2 tabular-nums">
                        {r.pagato > 0 ? eur(r.pagato) : "—"}
                        <span className="text-slate-400"> / </span>
                        {r.totale > 0 ? eur(r.totale) : "—"}
                      </td>
                      <td className="whitespace-nowrap p-2 tabular-nums">
                        {r.dataInstallazione || "—"}
                        {!!r.ora && <span className="text-slate-500"> {r.ora}</span>}
                      </td>
                      <td className="p-2 text-[11.5px]">
                        {esistente ? (
                          <span className="text-sky-700">
                            aggiorna {esistente.data.nome} {esistente.data.cognome}
                          </span>
                        ) : (
                          <span className="text-emerald-700">scheda nuova</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Finestra>
  );
}

/** Il tasto che scarica le pose in un foglio. ⚠️ Le stesse colonne che si
 *  sanno leggere: un export che l'import non riconosce è un viaggio di sola
 *  andata, e il guaio si scopre provando a rimetterlo dentro. */
export function TastoScaricaCsv({ leads, nomeFile = "installazioni" }: { leads: Lead[]; nomeFile?: string }) {
  const scarica = () => {
    const testo = esportaCsv(
      leads.map((l) => ({
        nome: `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim(),
        telefono: l.data.telefono,
        email: l.data.email,
        pagato: Number(l.data.payment?.accontoPagato ?? 0),
        totale: Number(l.data.payment?.prezzoTotale ?? 0),
        data: l.data.installazione?.dataInstallazione ?? "",
        ora: l.data.installazione?.orarioInstallazione ?? "",
        note: String(l.data.notePostCall ?? "").replace(/\s+/g, " ").trim(),
      })),
    );
    //  ⚠️ Il BOM davanti: senza, Excel apre il file e mostra «Perchï¿½» al
    //   posto di «Perché». È un carattere invisibile che fa la differenza fra
    //   un foglio leggibile e uno da rifare.
    const blob = new Blob([`﻿${testo}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeFile}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button size="sm" variant="outline" onClick={scarica} title="Scarica queste pose in un foglio CSV">
      <Download className="mr-1 h-3.5 w-3.5" /> Scarica CSV
    </Button>
  );
}
