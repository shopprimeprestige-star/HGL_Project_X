/** ── RIQUADRO «ANTEPRIMA NEI MOTORI DI RICERCA» (scheda/RiquadroSeo.tsx) ──────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.3, riquadro 7). L'anteprima come in Google (titolo blu, indirizzo verde, descrizione),
 *  poi titolo SEO (60), descrizione SEO (155), indirizzo (si cambia finché non è pubblicato) e, se il guscio passa le foto, l'immagine
 *  di condivisione. L'anteprima mostra ciò che Google taglierebbe (… dopo 60 e 155 segni); vuoto = si usano il titolo e la descrizione breve. */
import { Button } from "@/components/ui/button";
import { slugDa } from "@/shop/cms/modello";
import { CLASSI_CAMPO, CLASSI_TASTO, CampoP, RiquadroPolaris } from "./polaris";
import { CampoTesto, type ProprietaRiquadro } from "./RiquadroCampi";

const MAX_TITOLO = 60;
const MAX_DESCRIZIONE = 155;
/** Come Google: oltre il massimo si taglia e si chiude con i puntini. */
const taglia = (t: string, max: number) =>
  t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;

export function RiquadroSeo({
  pubblicato,
  dominio,
  immagini,
  immagineId,
  cambiaImmagine,
  ...p
}: ProprietaRiquadro & {
  /** Già pubblicato: l'indirizzo non si cambia più. */
  pubblicato: boolean;
  /** Il nome del sito come lo vede chi cerca («hairgenius.it»). */
  dominio: string;
  /** Le foto del prodotto tra cui scegliere l'immagine di condivisione. Senza, il campo non c'è. */
  immagini?: { id: string; nome: string }[];
  immagineId?: string;
  cambiaImmagine?: (id: string) => void;
}) {
  const { modulo } = p;
  const titolo = taglia(
    modulo.seoTitolo.trim() || modulo.nome.trim() || "Titolo del prodotto",
    MAX_TITOLO,
  );
  const descrizione = taglia(
    modulo.seoDescrizione.trim() ||
      modulo.descrizioneBreve.trim() ||
      "La descrizione comparirà qui.",
    MAX_DESCRIZIONE,
  );
  return (
    <RiquadroPolaris id="seo" titolo="Anteprima nei motori di ricerca (SEO)" segno={p.segno}>
      <div
        aria-label="Anteprima come in Google"
        role="group"
        className="min-w-0 border-b border-border pb-4"
      >
        <p className="truncate text-[12px] text-emerald-800">
          {dominio} › shop › prodotto › {modulo.slug || "…"}
        </p>
        <p className="break-words text-[16px] font-medium leading-snug text-sky-800">{titolo}</p>
        <p className="break-words text-[13px] leading-snug text-muted-foreground">{descrizione}</p>
      </div>
      <CampoTesto
        k="seoTitolo"
        p={p}
        etichetta="Titolo SEO"
        max={MAX_TITOLO}
        facoltativo
        aiuto="Oltre 60 segni Google lo taglia. Vuoto = si usa il titolo del prodotto."
      />
      <CampoTesto
        k="seoDescrizione"
        p={p}
        etichetta="Descrizione SEO"
        max={MAX_DESCRIZIONE}
        area
        righe={3}
        facoltativo
        aiuto="Oltre 155 segni Google la taglia."
      />
      <CampoTesto
        k="slug"
        p={p}
        etichetta="Indirizzo"
        disabilitato={pubblicato}
        trasforma={(v) => v.toLowerCase()}
        aiuto={
          pubblicato
            ? "Già pubblicato: l'indirizzo non si cambia più, i link condivisi funzionano."
            : `Nel sito: /shop/prodotto/${modulo.slug || "…"}`
        }
        accanto={
          !pubblicato && (
            <Button
              type="button"
              variant="outline"
              className={`${CLASSI_TASTO} shrink-0`}
              onClick={() => p.cambia({ slug: slugDa(modulo.nome) })}
            >
              Dal titolo
            </Button>
          )
        }
      />
      {immagini && cambiaImmagine && (
        <CampoP
          id="f-seoMediaId"
          etichetta="Immagine di condivisione"
          facoltativo
          aiuto="Si vede quando il link viene condiviso. Vuoto = la foto principale."
        >
          {(a) => (
            <select
              {...a}
              value={immagineId ?? ""}
              onChange={(e) => cambiaImmagine(e.target.value)}
              className={CLASSI_CAMPO}
            >
              <option value="">Foto principale</option>
              {immagini.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}
        </CampoP>
      )}
    </RiquadroPolaris>
  );
}
