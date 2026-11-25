/** ── I PEZZI DELLA SCHEDA SPOSTATI DAL GUSCIO (scheda/pezzi.tsx) ──────────────
 *  Commessa 2026-11-25-editor-prodotti, E5 (PIANO §1.3). `Campo`, `VoceLink`, `Caratteristiche` e `Domande` erano dentro `SchedaProdotto.tsx`:
 *  qui hanno lo stile del kit (`polaris.tsx`) e le stesse regole di prima: gli identificativi `f-<campo>` (`idCampo`) sono quelli a cui portano
 *  i link «Vai» di «Prima di pubblicare», ogni errore è una frase accanto al campo, nessuna riga è un riquadro dentro il riquadro.
 *  Il guscio smette di definirli e li importa da qui (compito E7): finché non lo fa, i due file convivono e non si toccano.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura; i cambi risalgono con `cambia`. */
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Voce } from "@/shop/cms/pubblicazione";
import { idCampo, type CampoModulo, type Modulo } from "../scheda-pura";
import { CLASSI_CAMPO, CLASSI_TASTO, CampoP, MessaggiCampo } from "./polaris";

type Riga = Modulo["caratteristiche"][number];

/** Un campo della scheda: l'identificativo viene da `idCampo(k)`. Il resto è `CampoP`. */
export function Campo({
  k,
  etichetta,
  aiuto,
  contatore,
  errore,
  avvisi,
  facoltativo,
  children,
}: {
  k: CampoModulo;
  etichetta: string;
  aiuto?: string;
  contatore?: { n: number; max: number };
  errore?: string;
  avvisi?: string[];
  facoltativo?: boolean;
  children: (p: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  return (
    <CampoP
      id={idCampo(k)}
      etichetta={etichetta}
      aiuto={aiuto}
      contatore={contatore}
      errore={errore}
      avvisi={avvisi}
      facoltativo={facoltativo}
    >
      {children}
    </CampoP>
  );
}

/** Una voce di «Prima di pubblicare»: la frase e «Vai» (alta 44 px sul telefono). Rosa = da sistemare, ambra = da controllare; sempre con l'icona. */
export function VoceLink({
  voce,
  tono,
  vai,
}: {
  voce: Voce;
  tono: "blocco" | "info";
  vai: () => void;
}) {
  return (
    <button
      type="button"
      onClick={vai}
      className={cn(
        "flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-[13px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tono === "blocco"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {tono === "blocco" ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">{voce.frase}</span>
      <span className="flex shrink-0 items-center gap-0.5 font-medium">
        Vai
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

const ETICHETTA_CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

/** Le caratteristiche: una riga per voce (nome, valore, stato, fonte). Solo le «confermate» escono sul sito. */
export function Caratteristiche({
  modulo,
  cambia,
  errore,
  avvisi,
}: {
  modulo: Pick<Modulo, "caratteristiche">;
  cambia: (p: Partial<Modulo>) => void;
  errore?: string;
  avvisi: string[];
}) {
  const righe = modulo.caratteristiche;
  const imposta = (k: number, p: Partial<Riga>) =>
    cambia({ caratteristiche: righe.map((r, i) => (i === k ? { ...r, ...p } : r)) });
  return (
    <div id={idCampo("caratteristiche")} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <p className="text-[13px] text-muted-foreground">
        Le righe «da confermare» non si mostrano mai ai clienti. Per confermarne una serve la fonte
        (la scheda del fornitore).
      </p>
      {righe.length === 0 && <p className="text-[13px]">Non c'è ancora nessuna caratteristica.</p>}
      {righe.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {righe.map((r, k) => (
            <li
              key={k}
              className="grid grid-cols-1 gap-3 py-3 first:pt-0 md:grid-cols-[1fr_1fr_11rem_1fr_auto] md:items-end"
            >
              <label className={ETICHETTA_CAMPO}>
                Nome
                <input
                  value={r.etichetta}
                  onChange={(e) => imposta(k, { etichetta: e.target.value })}
                  className={CLASSI_CAMPO}
                />
              </label>
              <label className={ETICHETTA_CAMPO}>
                Valore
                <input
                  value={r.valore}
                  onChange={(e) => imposta(k, { valore: e.target.value })}
                  className={CLASSI_CAMPO}
                />
              </label>
              <label className={ETICHETTA_CAMPO}>
                Stato
                <select
                  value={r.stato}
                  onChange={(e) => imposta(k, { stato: e.target.value as Riga["stato"] })}
                  className={CLASSI_CAMPO}
                >
                  <option value="da_confermare">Da confermare</option>
                  <option value="confermato">Confermata</option>
                </select>
              </label>
              <label className={ETICHETTA_CAMPO}>
                Fonte
                <input
                  value={r.fonte ?? ""}
                  onChange={(e) => imposta(k, { fonte: e.target.value })}
                  className={CLASSI_CAMPO}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className={CLASSI_TASTO}
                onClick={() => cambia({ caratteristiche: righe.filter((_, i) => i !== k) })}
              >
                Togli la riga
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          className={CLASSI_TASTO}
          onClick={() =>
            cambia({
              caratteristiche: [
                ...righe,
                { etichetta: "", valore: "", stato: "da_confermare", fonte: null },
              ],
            })
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Aggiungi una caratteristica
        </Button>
      </div>
      <MessaggiCampo id={idCampo("caratteristiche")} errore={errore} avvisi={avvisi} />
    </div>
  );
}

/** Le domande frequenti: domanda e risposta, una coppia per volta. */
export function Domande({
  modulo,
  cambia,
  errore,
  avvisi,
}: {
  modulo: Pick<Modulo, "faq">;
  cambia: (p: Partial<Modulo>) => void;
  errore?: string;
  avvisi: string[];
}) {
  const righe = modulo.faq;
  const imposta = (k: number, p: Partial<{ d: string; r: string }>) =>
    cambia({ faq: righe.map((f, i) => (i === k ? { ...f, ...p } : f)) });
  return (
    <div id={idCampo("faq")} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <h3 className="text-[13px] font-medium">Domande frequenti</h3>
      {righe.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {righe.map((f, k) => (
            <li key={k} className="flex flex-col gap-3 py-3 first:pt-0">
              <label className={ETICHETTA_CAMPO}>
                Domanda
                <input
                  value={f.d}
                  onChange={(e) => imposta(k, { d: e.target.value })}
                  className={CLASSI_CAMPO}
                />
              </label>
              <label className={ETICHETTA_CAMPO}>
                Risposta
                <textarea
                  rows={3}
                  value={f.r}
                  onChange={(e) => imposta(k, { r: e.target.value })}
                  className={cn(CLASSI_CAMPO, "py-2")}
                />
              </label>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className={CLASSI_TASTO}
                  onClick={() => cambia({ faq: righe.filter((_, i) => i !== k) })}
                >
                  Togli la domanda
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          className={CLASSI_TASTO}
          onClick={() => cambia({ faq: [...righe, { d: "", r: "" }] })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Aggiungi una domanda
        </Button>
      </div>
      <MessaggiCampo id={idCampo("faq")} errore={errore} avvisi={avvisi} />
    </div>
  );
}
