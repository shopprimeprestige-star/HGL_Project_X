/** ── LA TABELLA DELLE VARIANTI (scheda/TabellaVarianti.tsx) ──────────────────────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E8 (SPEC §3.3 riquadro 6). Una riga per combinazione: spunta · Variante · Prezzo · Giacenza · SKU ·
 *  Barcode · Peso · Costo · Attiva. Larga abbastanza (il riquadro, non lo schermo: `@container`) è una tabella con le intestazioni sopra;
 *  più stretta (sotto i 44 rem) ogni riga diventa una scheda con le etichette sopra ogni casella (sul telefono, 44 px, nessuno scorrimento di lato).
 *  Il prezzo vuoto vale il prezzo di base: la casella lo mostra in grigio e sotto c'è scritto «del prodotto». La variante «Unica» spenta sta in
 *  una riga chiusa. Mai un tasto per togliere una variante: si disattiva.
 *  ⚠️ Solo presentazione: niente rete, niente stato delle righe (lo tiene `EditorVarianti`). */
import type { CSSProperties, ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/crm/ui";
import { cn } from "@/lib/utils";
import type { Variante } from "@/shop/cms/modello";
import { MOTIVI_GIACENZA, type MotivoGiacenza } from "../semplice-puro";
import { CLASSI_CAMPO } from "./polaris";
import { nomeDalleOpzioni, type CampoRiga, type ErroriRiga, type RigaTesto } from "./varianti-puro";

export interface PropsTabella {
  righe: Variante[];
  /** I testi salvati e quelli in uso, per id di variante. */
  base: Record<string, RigaTesto>;
  ora: Record<string, RigaTesto>;
  errori: Record<string, ErroriRiga>;
  cambia: (id: string, campo: CampoRiga, valore: string) => void;
  /** Il motivo del movimento, solo per le righe dove i pezzi cambiano (proposto da `cambioQuantita`, modificabile). */
  motivi: Record<string, MotivoGiacenza>;
  cambiaMotivo: (id: string, motivo: MotivoGiacenza) => void;
  /** Il prezzo di base come testo («19,90»; vuoto se il prodotto non ne ha ancora uno). */
  prezzoBase: string;
  senzaPrezzo: boolean;
  /** La colonna del costo c'è (la scheda lo conosce); `costoDisponibile` falso = spenta con la sua frase. */
  conCosto: boolean;
  costoDisponibile: boolean;
  scelte: ReadonlySet<string>;
  alternaScelta: (id: string) => void;
  sceltaTutte: (si: boolean) => void;
  attiva: (v: Variante, valore: boolean) => void;
  spento: boolean;
  unicaSpenta: Variante | null;
}

const FRASE_COSTO = "Per il costo serve un aggiornamento del database.";
const cella = (extra?: string) => cn(CLASSI_CAMPO, "px-2 tabular-nums md:text-[12.5px]", extra);

/** Una casella con la sua etichetta: visibile nella scheda stretta, solo per chi legge lo schermo nella tabella larga. */
function Cella({
  nome,
  riga,
  errore,
  sotto,
  children,
}: {
  nome: string;
  riga: string;
  errore?: string;
  sotto?: string;
  children: (p: { "aria-label": string; "aria-invalid": boolean }) => ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 @[44rem]:justify-start">
      <span className="text-[12px] font-medium @[44rem]:sr-only">{nome}</span>
      {children({ "aria-label": `${nome}, ${riga}`, "aria-invalid": !!errore })}
      {sotto && <span className="text-[12px] leading-tight text-muted-foreground">{sotto}</span>}
    </label>
  );
}

export function TabellaVarianti(p: PropsTabella) {
  const colonne = [
    "1.25rem",
    "minmax(5.5rem,1fr)",
    ...(p.senzaPrezzo ? [] : ["4.5rem"]),
    "3.75rem",
    "6rem",
    "7.5rem",
    "3.5rem",
    ...(p.conCosto ? ["4.25rem"] : []),
    "2.75rem",
  ].join(" ");
  const stile = { "--col": colonne } as CSSProperties;
  const tutte = p.righe.length > 0 && p.righe.every((v) => p.scelte.has(v.id));
  const intestazioni = [
    "Variante",
    ...(p.senzaPrezzo ? [] : ["Prezzo"]),
    "Giacenza",
    "SKU",
    "Barcode",
    "Peso (g)",
    ...(p.conCosto ? ["Costo"] : []),
    "Attiva",
  ];
  return (
    <div className="@container flex min-w-0 flex-col gap-2">
      <label className="flex min-h-11 items-center gap-2 text-[13px] @[44rem]:min-h-8">
        <input
          type="checkbox"
          checked={tutte}
          onChange={(e) => p.sceltaTutte(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {tutte ? "Togli la spunta a tutte" : `Spunta tutte le ${p.righe.length} righe`}
      </label>
      <div
        aria-hidden="true"
        className="hidden gap-2 px-2 text-[12px] font-medium text-muted-foreground @[44rem]:grid @[44rem]:grid-cols-[var(--col)]"
        style={stile}
      >
        <span />
        {intestazioni.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 @[44rem]:gap-0 @[44rem]:divide-y @[44rem]:divide-border @[44rem]:border-y @[44rem]:border-border">
        {p.righe.map((v) => {
          const base = p.base[v.id];
          const ora = p.ora[v.id];
          const err = p.errori[v.id] ?? {};
          const cambiata = (Object.keys(base) as CampoRiga[]).some(
            (k) => base[k].trim() !== ora[k].trim(),
          );
          const frasi = Object.values(err);
          const prezzoBaseTesto = p.prezzoBase || "—";
          return (
            <li
              key={v.id}
              data-variante={v.id}
              style={stile}
              className={cn(
                "grid grid-cols-1 gap-x-1.5 gap-y-3 rounded-xl border border-border p-3 @[44rem]:grid-cols-[var(--col)] @[44rem]:items-start @[44rem]:gap-y-0 @[44rem]:rounded-none @[44rem]:border-0 @[44rem]:px-2 @[44rem]:py-2",
                cambiata && "bg-amber-50",
                !v.attiva && "text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 @[44rem]:contents">
                <label className="flex h-11 w-6 shrink-0 items-center justify-center @[44rem]:h-9 @[44rem]:w-5">
                  <input
                    type="checkbox"
                    checked={p.scelte.has(v.id)}
                    onChange={() => p.alternaScelta(v.id)}
                    aria-label={`Scegli ${v.nome}`}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                <div className="flex min-w-0 flex-1 flex-col gap-1 @[44rem]:flex-none">
                  <input
                    aria-label={`Variante, ${v.nome}`}
                    aria-invalid={!!err.nome}
                    value={ora.nome}
                    maxLength={120}
                    placeholder={nomeDalleOpzioni(v.opzioni)}
                    onChange={(e) => p.cambia(v.id, "nome", e.target.value)}
                    className={cn(CLASSI_CAMPO, "px-2 font-semibold md:text-[12.5px]")}
                  />
                  <div className="flex flex-wrap items-center gap-1 empty:hidden">
                    {!v.attiva && <Chip tono="neutro">Disattivata</Chip>}
                    {v.attiva && v.giacenza === 0 && <Chip tono="in_sospeso">Esaurita</Chip>}
                  </div>
                  {cambiata && (
                    <p className="text-[12px] text-amber-900">Modificata, non ancora salvata</p>
                  )}
                </div>
                <label className="flex min-h-11 items-center gap-2 text-[13px] @[44rem]:order-[9999] @[44rem]:h-9 @[44rem]:min-h-0">
                  <Switch
                    checked={v.attiva}
                    disabled={p.spento}
                    onCheckedChange={(x) => p.attiva(v, x)}
                    aria-label={`Variante ${v.nome} attiva`}
                  />
                  <span className="@[44rem]:sr-only">Attiva</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @[44rem]:contents">
                {!p.senzaPrezzo && (
                  <Cella
                    nome="Prezzo"
                    riga={v.nome}
                    errore={err.prezzo}
                    sotto={ora.prezzo.trim() === "" ? "del prodotto" : undefined}
                  >
                    {(a) => (
                      <input
                        {...a}
                        inputMode="decimal"
                        value={ora.prezzo}
                        placeholder={prezzoBaseTesto}
                        onChange={(e) => p.cambia(v.id, "prezzo", e.target.value)}
                        className={cella()}
                      />
                    )}
                  </Cella>
                )}
                <Cella nome="Giacenza" riga={v.nome} errore={err.giacenza}>
                  {(a) => (
                    <input
                      {...a}
                      inputMode="numeric"
                      value={ora.giacenza}
                      onChange={(e) => p.cambia(v.id, "giacenza", e.target.value)}
                      className={cella()}
                    />
                  )}
                </Cella>
                <Cella nome="SKU" riga={v.nome} errore={err.sku}>
                  {(a) => (
                    <input
                      {...a}
                      value={ora.sku}
                      maxLength={40}
                      autoCapitalize="characters"
                      onChange={(e) => p.cambia(v.id, "sku", e.target.value.toUpperCase())}
                      className={cella()}
                    />
                  )}
                </Cella>
                <Cella nome="Barcode" riga={v.nome} errore={err.gtin}>
                  {(a) => (
                    <input
                      {...a}
                      inputMode="numeric"
                      value={ora.gtin}
                      maxLength={20}
                      onChange={(e) => p.cambia(v.id, "gtin", e.target.value)}
                      className={cella()}
                    />
                  )}
                </Cella>
                <Cella nome="Peso (g)" riga={v.nome} errore={err.peso}>
                  {(a) => (
                    <input
                      {...a}
                      inputMode="numeric"
                      value={ora.peso}
                      onChange={(e) => p.cambia(v.id, "peso", e.target.value)}
                      className={cella()}
                    />
                  )}
                </Cella>
                {p.conCosto && (
                  <Cella nome="Costo" riga={v.nome} errore={err.costo}>
                    {(a) => (
                      <input
                        {...a}
                        inputMode="decimal"
                        value={ora.costo}
                        disabled={!p.costoDisponibile}
                        onChange={(e) => p.cambia(v.id, "costo", e.target.value)}
                        className={cella()}
                      />
                    )}
                  </Cella>
                )}
              </div>
              {p.motivi[v.id] && (
                <label className="flex flex-wrap items-center gap-2 text-[13px] @[44rem]:order-[10000] @[44rem]:col-span-full @[44rem]:pb-1">
                  <span className="font-medium">
                    Motivo del movimento ({v.giacenza} → {ora.giacenza.trim()} pezzi)
                  </span>
                  <select
                    value={p.motivi[v.id]}
                    onChange={(e) => p.cambiaMotivo(v.id, e.target.value as MotivoGiacenza)}
                    className={cn(CLASSI_CAMPO, "w-auto px-2 md:text-[12.5px]")}
                  >
                    {MOTIVI_GIACENZA.map((m) => (
                      <option key={m.valore} value={m.valore}>
                        {m.etichetta}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {frasi.length > 0 && (
                <p
                  role="alert"
                  className="text-[13px] text-rose-800 @[44rem]:order-[10000] @[44rem]:col-span-full @[44rem]:pb-1"
                >
                  {frasi.join(" ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {p.conCosto && !p.costoDisponibile && (
        <p className="text-[13px] text-muted-foreground">{FRASE_COSTO}</p>
      )}
      <p className="text-[13px] text-muted-foreground">
        Il barcode della variante si salva ma per ora il sito non lo pubblica.
      </p>
      {p.unicaSpenta && (
        <details className="rounded-xl border border-border px-3 py-1 text-[13px]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Variante unica del prodotto senza opzioni (spenta)
          </summary>
          <div className="flex flex-col gap-2 pb-3">
            <p className="text-muted-foreground">
              Era la variante di quando il prodotto non aveva opzioni, con lo SKU{" "}
              {p.unicaSpenta.sku}. Non si vende e non si cancella.
              {p.unicaSpenta.giacenza > 0
                ? ` Ha ancora ${p.unicaSpenta.giacenza} ${p.unicaSpenta.giacenza === 1 ? "pezzo" : "pezzi"} in magazzino: scrivili sulle righe qui sopra.`
                : ""}
            </p>
            <label className="flex min-h-11 items-center gap-2">
              <Switch
                checked={p.unicaSpenta.attiva}
                disabled={p.spento}
                onCheckedChange={(x) => p.attiva(p.unicaSpenta as Variante, x)}
                aria-label="Variante unica attiva"
              />
              Riattivala
            </label>
          </div>
        </details>
      )}
    </div>
  );
}
