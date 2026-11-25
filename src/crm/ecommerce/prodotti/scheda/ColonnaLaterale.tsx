/** ── LA COLONNA LATERALE (scheda/ColonnaLaterale.tsx) ─────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.4). Stato, «Prima di pubblicare» (il guscio lo passa come `prima`, è il suo file),
 *  Dove si vede, Organizzazione (tipo, categorie a scelta multipla con ricerca, marca, fornitore), Dati per i cataloghi (richiudibile) e Note.
 *  Le note non sono mai pubbliche e lo dicono. Lo stato non si cambia da qui: «Pubblicato» solo col tasto Pubblica e i controlli, i tasti
 *  per archiviare o rimettere in bozza li costruisce il guscio (`azioniStato`).
 *  ⚠️ Solo presentazione: nessuna rete; le categorie le legge e le scrive il guscio (`scegliCategoria`). */
import { useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { idCampo } from "../scheda-pura";
import { BadgeStato, CLASSI_CAMPO, CampoP, RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro, type SegnoRiquadroProps } from "./RiquadroCampi";

/* ══ LE CATEGORIE ═══════════════════════════════════════════════════════════ */

type Categoria = { id: string; nome: string };

/** Senza maiuscole e senza accenti, così «cura» trova «Cura dei capelli» e «capelli» trova «Capélli». */
const semplice = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Scelta multipla con ricerca. `elenco` nullo = ancora in lettura. Le scelte restano scritte sopra l'elenco anche se la ricerca le nasconde. */
export function CategorieScelta({
  elenco,
  scelte,
  scegli,
  errore,
  occupato,
  ricercaIniziale = "",
}: {
  elenco: Categoria[] | null;
  scelte: readonly string[];
  scegli: (id: string, acceso: boolean) => void;
  errore?: string | null;
  /** Un salvataggio è in corso o la scheda è ferma: le caselle si leggono ma non si toccano. */
  occupato?: boolean;
  ricercaIniziale?: string;
}) {
  const [ricerca, setRicerca] = useState(ricercaIniziale);
  const trovate = (elenco ?? []).filter((k) => semplice(k.nome).includes(semplice(ricerca.trim())));
  const nomiScelti = (elenco ?? []).filter((k) => scelte.includes(k.id)).map((k) => k.nome);
  return (
    <fieldset
      id={idCampo("categoria")}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <legend className="mb-1.5 text-[13px] font-medium">Categorie e collezioni</legend>
      {errore && (
        <p role="alert" className="text-[13px] text-rose-800">
          {errore}
        </p>
      )}
      {elenco === null && !errore && (
        <p role="status" className="text-[13px] text-muted-foreground">
          Carico le categorie…
        </p>
      )}
      {elenco?.length === 0 && (
        <p className="text-[13px]">
          Non c'è ancora nessuna categoria: creala sotto l'elenco dei prodotti, in «Categorie».
        </p>
      )}
      {elenco && elenco.length > 0 && (
        <>
          <p className="text-[13px] text-muted-foreground">
            {nomiScelti.length > 0
              ? `Scelte: ${nomiScelti.join(", ")}.`
              : "Scegline almeno una: il prodotto si trova lì nel sito."}
          </p>
          <label className="sr-only" htmlFor="f-categoria-ricerca">
            Cerca una categoria
          </label>
          <input
            id="f-categoria-ricerca"
            type="search"
            value={ricerca}
            placeholder="Cerca una categoria"
            onChange={(e) => setRicerca(e.target.value)}
            className={CLASSI_CAMPO}
          />
          <div className="max-h-56 overflow-y-auto">
            {trovate.length === 0 ? (
              <p role="status" className="px-1 py-2 text-[13px] text-muted-foreground">
                Nessuna categoria si chiama così.
              </p>
            ) : (
              trovate.map((k) => (
                <label
                  key={k.id}
                  className="flex min-h-11 items-center gap-3 rounded-md px-1 text-[13px] hover:bg-muted/60 md:min-h-9"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[color:var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    checked={scelte.includes(k.id)}
                    disabled={occupato}
                    onChange={(e) => scegli(k.id, e.target.checked)}
                  />
                  {k.nome}
                </label>
              ))
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}

/* ══ LA COLONNA ═════════════════════════════════════════════════════════════ */

const FRASE_STATO = {
  bozza:
    "Non si vede ancora sul sito. Diventa «Pubblicato» solo col tasto Pubblica, quando è tutto a posto.",
  pubblicato: "Si vede sul sito. I testi nuovi restano in bozza finché non pubblichi le modifiche.",
  archiviato: "Non si vede e non si vende. Rimettilo in bozza per modificarlo di nuovo.",
} as const;

const CANALI = [
  ["sito", "Sito"],
  ["meta", "Meta (Facebook e Instagram)"],
  ["google", "Google Merchant"],
  ["tiktok", "TikTok"],
] as const;

type SegniLaterali = Partial<
  Record<"canali" | "organizzazione" | "cataloghi" | "note", SegnoRiquadroProps>
>;

export function ColonnaLaterale({
  stato,
  azioniStato,
  prima,
  segni,
  categorie,
  cataloghiAperto,
  alternaCataloghi,
  ...p
}: Omit<ProprietaRiquadro, "segno"> & {
  stato: keyof typeof FRASE_STATO;
  /** I tasti per archiviare o rimettere in bozza, costruiti dal guscio. */
  azioniStato?: ReactNode;
  /** Il pannello «Prima di pubblicare» (`PrimaDiPubblicare`), che va subito sotto lo Stato. */
  prima?: ReactNode;
  segni?: SegniLaterali;
  categorie: {
    elenco: Categoria[] | null;
    scelte: readonly string[];
    scegli: (id: string, acceso: boolean) => void;
    errore?: string | null;
    occupato?: boolean;
  };
  cataloghiAperto: boolean;
  alternaCataloghi: () => void;
}) {
  const { modulo, cambia, errori } = p;
  return (
    <>
      <RiquadroPolaris id="stato" titolo="Stato">
        <div>
          <BadgeStato stato={stato} />
        </div>
        <p className="text-[13px] text-muted-foreground">{FRASE_STATO[stato]}</p>
        {azioniStato}
      </RiquadroPolaris>

      {prima}

      <RiquadroPolaris id="canali" titolo="Dove si vede" segno={segni?.canali}>
        <fieldset
          id={idCampo("canali")}
          tabIndex={-1}
          className="flex flex-col gap-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          aria-describedby={errori.canali ? "f-canali-errore" : undefined}
        >
          <legend className="mb-1 text-[13px] text-muted-foreground">
            Accendi almeno un canale.
          </legend>
          {CANALI.map(([c, nome]) => (
            <label
              key={c}
              className="flex min-h-11 items-center justify-between gap-3 rounded-md px-1 text-[13px] md:min-h-9"
            >
              {nome}
              <Switch
                checked={modulo.canali[c]}
                onCheckedChange={(x) => cambia({ canali: { ...modulo.canali, [c]: x } })}
                aria-label={nome}
              />
            </label>
          ))}
        </fieldset>
        {errori.canali && (
          <p id="f-canali-errore" role="alert" className="text-[13px] text-rose-800">
            {errori.canali}
          </p>
        )}
      </RiquadroPolaris>

      <RiquadroPolaris id="organizzazione" titolo="Organizzazione" segno={segni?.organizzazione}>
        <CampoP id="f-tipo" etichetta="Tipo" errore={errori.tipo}>
          {(a) => (
            <select
              {...a}
              value={modulo.tipo}
              onChange={(e) => cambia({ tipo: e.target.value as typeof modulo.tipo })}
              className={CLASSI_CAMPO}
            >
              <option value="patch">Patch</option>
              <option value="cura">Cura</option>
              <option value="kit">Kit</option>
            </select>
          )}
        </CampoP>
        <CategorieScelta {...categorie} />
        <CampoTesto k="marca" p={p} etichetta="Marca" facoltativo />
        <CampoTesto k="fornitore" p={p} etichetta="Fornitore" max={200} facoltativo />
      </RiquadroPolaris>

      <RiquadroPolaris
        id="cataloghi"
        titolo="Dati per i cataloghi"
        segno={segni?.cataloghi}
        aperto={cataloghiAperto}
        alterna={alternaCataloghi}
      >
        <CampoTesto k="mpn" p={p} etichetta="Codice produttore (MPN)" max={40} facoltativo />
        <CampoTesto k="categoriaGoogle" p={p} etichetta="Categoria Google" max={200} facoltativo />
      </RiquadroPolaris>

      <RiquadroPolaris id="note" titolo="Note" segno={segni?.note}>
        <CampoTesto
          k="noteInterne"
          p={p}
          etichetta="Nota interna"
          max={5000}
          area
          righe={3}
          facoltativo
          aiuto="Solo per chi lavora nel CRM: non si vede mai sul sito."
        />
        <CampoTesto
          k="notaTitolare"
          p={p}
          etichetta="Nota del titolare"
          max={2000}
          area
          righe={3}
          facoltativo
          aiuto="Solo per te: non si vede mai sul sito."
        />
      </RiquadroPolaris>
    </>
  );
}
