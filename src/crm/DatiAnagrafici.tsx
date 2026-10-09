/** ── I DATI ANAGRAFICI DEL CLIENTE, SULLA SUA SCHEDA ───────────────────────
 *
 *  Codice fiscale, nascita, residenza. Stanno sulla scheda del lead e non solo
 *  dentro la finestra della fattura, ed è la differenza fra scriverli una
 *  volta e riscriverli ogni volta: chi telefona due mesi dopo per la seconda
 *  fattura, prima, ricominciava da capo.
 *
 *  ── ⚠️ «CALCOLA» NON INVENTA IL NOME ─────────────────────────────────────
 *  Dal codice fiscale il nome e il cognome NON si ricavano: il codice ne porta
 *  le consonanti spremute in tre lettere, e da «RSS» si torna a Rossi come a
 *  Russo. Quello che il tasto fa è due cose vere:
 *   · tira fuori quello che nel codice c'è per intero — data di nascita, età,
 *     sesso, comune di nascita;
 *   · CONTROLLA nome e cognome: li ricalcola e li confronta, e se non
 *     combaciano lo dice prima che la fattura parta intestata male.
 *
 *  ⚠️ E NON SOVRASCRIVE MAI nome e cognome scritti da qualcuno: se il codice
 *   dice un'altra cosa, la decisione è di chi guarda — può essere sbagliato il
 *   codice tanto quanto il nome.
 */
import { useState } from "react";
import { Calculator, Check, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { combaciaConNome, datiDaCodiceFiscale, normalizzaCF } from "./codice-fiscale";
import type { LeadData } from "./types";

/** Come si legge una data a schermo: «1 gennaio 1980». */
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
export function dataInChiaro(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return "";
  return `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}`;
}

export function BloccoAnagrafica({
  form,
  update,
  classeCampo,
}: {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  classeCampo?: string;
}) {
  const [esito, setEsito] = useState<{ tono: "ok" | "avviso"; testo: string } | null>(null);

  const calcola = () => {
    const cf = normalizzaCF(form.codiceFiscale || "");
    const d = datiDaCodiceFiscale(cf);
    if (!d.valido) {
      setEsito({
        tono: "avviso",
        //  ⚠️ Si dice PERCHÉ non va: «non valido» da solo fa ribattere lo
        //   stesso codice tre volte. Quasi sempre è un carattere letto male da
        //   una tessera — «0» per «O», «1» per «I».
        testo: cf.length === 16
          ? "Questo codice fiscale non torna: di solito è un carattere letto male (0 e O, 1 e I)."
          : "Un codice fiscale è di sedici caratteri.",
      });
      return;
    }
    //  Il codice si riscrive pulito: maiuscolo, senza spazi. È quello che
    //  finisce in fattura, e uno spazio di troppo lo fa scartare.
    update("codiceFiscale", cf);
    if (d.dataNascita) update("dataNascita", d.dataNascita);
    //  ⚠️ L'età si scrive SOLO se si ricava dalla nascita: quella dichiarata
    //   nel modulo pubblico è un'altra cosa, ma questa è esatta e la sostituisce.
    if (typeof d.eta === "number") update("eta", d.eta);
    if (d.sesso) update("sesso", d.sesso);

    const combacia = combaciaConNome(cf, form.nome || "", form.cognome || "");
    const nato = d.dataNascita ? `Nato${d.sesso === "F" ? "a" : ""} il ${dataInChiaro(d.dataNascita)}` : "";
    const anni = typeof d.eta === "number" ? `${d.eta} anni` : "";
    const dove = d.comuneNascita ? `comune ${d.comuneNascita}` : "";
    const riga = [nato, anni, dove].filter(Boolean).join(" · ");
    setEsito(
      combacia === "no"
        ? {
            tono: "avviso",
            testo: `${riga}. ⚠️ Il codice NON corrisponde a ${form.nome} ${form.cognome}: controlla quale dei due è sbagliato.`,
          }
        : { tono: "ok", testo: combacia === "si" ? `${riga} · il codice corrisponde al nome` : riga },
    );
  };

  const campo = (
    etichetta: string,
    valore: string,
    scrivi: (v: string) => void,
    extra?: { larghezza?: string; maiuscolo?: boolean; tipo?: string },
  ) => (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {etichetta}
      </span>
      <Input
        type={extra?.tipo}
        value={valore}
        onChange={(e) => scrivi(extra?.maiuscolo ? e.target.value.toUpperCase() : e.target.value)}
        className={cn("h-9 text-[13px]", extra?.larghezza, classeCampo)}
      />
    </label>
  );

  const res = form.residenza ?? {};
  const scriviRes = (k: keyof NonNullable<LeadData["residenza"]>, v: string) =>
    update("residenza", { ...res, [k]: v });

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end gap-2">
        {campo(
          "Codice fiscale",
          form.codiceFiscale || "",
          (v) => update("codiceFiscale", v),
          { maiuscolo: true, larghezza: "font-mono tracking-wide" },
        )}
        {/*  ⚠️ Il tasto sta ATTACCATO al campo e non in fondo al blocco: è la
            cosa da fare subito dopo aver scritto il codice, e a tre campi di
            distanza non la fa nessuno. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0"
          onClick={calcola}
          disabled={!String(form.codiceFiscale || "").trim()}
          title="Ricava nascita, età e sesso dal codice fiscale, e controlla che corrisponda al nome"
        >
          <Calculator className="mr-1 h-3.5 w-3.5" /> Calcola
        </Button>
      </div>

      {!!esito && (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
            esito.tono === "ok"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
          )}
        >
          {esito.tono === "ok" ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {esito.testo}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {campo("Data di nascita", form.dataNascita || "", (v) => update("dataNascita", v), {
          tipo: "date",
          larghezza: "w-[10rem] tabular-nums",
        })}
        {campo("Età", form.eta === undefined || form.eta === "" ? "" : String(form.eta), (v) =>
          update("eta", v), { larghezza: "w-[5.5rem] tabular-nums" })}
      </div>

      {/*  ── LA RESIDENZA ─────────────────────────────────────────────────
          ⚠️ NON è l'indirizzo di consegna: possono coincidere, e spesso
          coincidono, ma una consegna in ufficio non cambia la residenza di
          nessuno — e in fattura ci va questa. */}
      <div className="flex flex-wrap gap-2">
        {campo("Indirizzo di residenza", res.indirizzo || "", (v) => scriviRes("indirizzo", v))}
        {campo("CAP", res.cap || "", (v) => scriviRes("cap", v.replace(/\D/g, "").slice(0, 5)), {
          larghezza: "w-[6rem] tabular-nums",
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {campo("Comune", res.comune || "", (v) => scriviRes("comune", v))}
        {campo("Prov.", res.provincia || "", (v) => scriviRes("provincia", v.slice(0, 2)), {
          maiuscolo: true,
          larghezza: "w-[5rem]",
        })}
      </div>
    </div>
  );
}
