/** ── IL PRIMO PASSO DEL CARICAMENTO: CHE COSA HAI IN MANO ──────────────────
 *  Le categorie e le loro percentuali stanno in `crm/contabilita-categorie`,
 *  con l'articolo di legge accanto a ognuna. Qui c'è solo la scelta.
 *
 *  ⚠️ «Altro» c'è, ed è l'ultima: senza una via d'uscita chi ha in mano una
 *   cosa che non è in elenco sceglie a caso la voce più vicina — e a quel
 *   punto si porta dietro una percentuale che non c'entra. Meglio nessuna
 *   proposta di una proposta sbagliata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Finestra, VoceScelta } from "@/crm/ui/Finestra";
import { CATEGORIE, type CategoriaSpesa } from "./contabilita-categorie";

export function FinestraCategoria({
  aperta,
  onCambio,
  onScelta,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  onScelta: (c: CategoriaSpesa) => void;
}) {
  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Che documento stai caricando?"
      contesto="Serve a impostare l'IVA e quanto se ne scarica"
      larghezza="md"
      classeCorpo="space-y-1.5"
    >
      {CATEGORIE.map((c) => (
        <VoceScelta
          key={c.chiave}
          titolo={
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>{c.titolo}</span>
              {/*  ⚠️ La percentuale si vede QUI, nella scelta, e non dopo:
                  è l'informazione che fa scegliere bene, e dopo sarebbe solo
                  la spiegazione di una scelta già fatta. */}
              {c.percentuale != null && c.percentuale < 100 && (
                <span className="rounded bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-800">
                  si deduce {c.percentuale}%
                </span>
              )}
              {/*  ⚠️ Le due pastiglie sono DUE perché i due numeri sono due:
                  sull'auto si deduce il 20% e si detrae il 40%. Scriverne una
                  sola farebbe leggere l'uno come se valesse anche per
                  l'altro — che è esattamente lo sbaglio che questa pagina
                  esiste per non far fare. */}
              {c.percentualeIva != null && c.percentualeIva < 100 && (
                <span className="rounded bg-sky-100 px-1.5 py-px text-[11px] font-semibold text-sky-800">
                  IVA {c.percentualeIva === 0 ? "indetraibile" : `${c.percentualeIva}%`}
                </span>
              )}
            </span>
          }
          nota={c.esempi}
          onClick={() => {
            onScelta(c);
            onCambio(false);
          }}
        />
      ))}
    </Finestra>
  );
}
