/** La tabella «Patch standard / Invisible Derm, riga per riga». Da `md` una `<table>` vera;
 *  sul telefono una carta per riga (si confronta riga per riga). L'altra versione è `display: none`,
 *  mai due letture. Intestazioni uguali, nessuna icona, nessun colore buono/cattivo. */
import { TABELLA } from "@/landing/testi-invisible-derm";

const [intPatch, intDerm] = TABELLA.intestazioni;

export function TabellaConfronto() {
  return (
    <>
      <table className="hidden w-full border border-white/15 bg-navy/40 text-left md:table">
        <caption className="sr-only">{TABELLA.caption}</caption>
        <thead>
          <tr className="bg-white/5">
            <th scope="col" className="p-4"><span className="sr-only">Caratteristica</span></th>
            <th scope="col" className="p-4 text-etichetta font-semibold uppercase tracking-[0.18em] text-white">{intPatch}</th>
            <th scope="col" className="p-4 text-etichetta font-semibold uppercase tracking-[0.18em] text-white">{intDerm}</th>
          </tr>
        </thead>
        <tbody>
          {TABELLA.righe.map((r) => (
            <tr key={r.nome} className="border-t border-white/15">
              <th scope="row" className="p-4 text-base font-semibold text-white">{r.nome}</th>
              <td className="p-4 text-base text-white/85">{r.patch}</td>
              <td className="p-4 text-base text-white/85">{r.derm}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-3 md:hidden">
        {TABELLA.righe.map((r) => (
          <div key={r.nome} className="overflow-hidden rounded-md border border-white/15 bg-navy/40">
            <p className="bg-white/5 px-4 py-3 text-base font-semibold text-white">{r.nome}</p>
            <dl className="grid grid-cols-2 gap-4 p-4">
              {[[intPatch, r.patch], [intDerm, r.derm]].map(([nome, valore]) => (
                <div key={nome}>
                  <dt className="text-etichetta font-semibold uppercase tracking-[0.18em] text-white/75">{nome}</dt>
                  <dd className="mt-1 text-base text-white/85">{valore}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
