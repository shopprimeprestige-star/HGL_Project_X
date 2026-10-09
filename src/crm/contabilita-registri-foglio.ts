/** ── I REGISTRI IVA, DA STAMPARE ───────────────────────────────────────────
 *  Le righe le costruisce `crm/contabilita-registri`, che è puro e quindi si
 *  prova; qui c'è solo il foglio. Il perché sono libri obbligatori — e perché
 *  tenerli in digitale e stamparli su richiesta è regolare — sta là.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  righeAcquisti,
  righeVendite,
  soloIntegrazioni,
  totaliPerAliquota,
  type RigaRegistro,
} from "./contabilita-registri";
import type { Fattura, DatiAzienda } from "./fatture/tipi";
import type { FatturaFornitore } from "./contabilita-fornitori";
import type { Periodo } from "./contabilita-periodo";

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );

const e2 = (n: number) =>
  (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const giorno = (iso: string) => {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString("it-IT");
};

function tabella(righe: RigaRegistro[], conProtocollo: boolean): string {
  if (righe.length === 0) {
    return `<p class="vuoto">Nessun documento registrato in questo periodo.</p>`;
  }
  const totali = totaliPerAliquota(righe);
  return `<table>
    <thead><tr>
      <th>${conProtocollo ? "Protocollo" : "Numero"}</th>
      <th>Data</th>
      ${conProtocollo ? "<th>Doc. n.</th>" : ""}
      <th>${conProtocollo ? "Fornitore" : "Cliente"}</th>
      <th>Partita IVA / C.F.</th>
      <th class="n">Imponibile</th><th class="n">Aliq.</th><th class="n">Imposta</th>
    </tr></thead>
    <tbody>
      ${righe
        .map(
          (r) =>
            `<tr><td class="rif">${esc(r.riferimento)}</td><td>${giorno(r.data)}</td>` +
            (conProtocollo ? `<td>${esc(r.numeroDocumento ?? "")}</td>` : "") +
            `<td>${esc(r.chi)}${r.nota ? `<span class="nota">${esc(r.nota)}</span>` : ""}</td>` +
            `<td class="piva">${esc(r.partitaIva)}</td>` +
            `<td class="n">${e2(r.imponibile)}</td><td class="n">${r.aliquota}%</td>` +
            `<td class="n">${e2(r.imposta)}</td></tr>`,
        )
        .join("")}
    </tbody>
    <tfoot>
      ${totali
        .map(
          (t) =>
            `<tr><td colspan="${conProtocollo ? 5 : 4}">Totale aliquota ${t.aliquota}%</td>` +
            `<td class="n">${e2(t.imponibile)}</td><td></td><td class="n">${e2(t.imposta)}</td></tr>`,
        )
        .join("")}
      <tr class="forte"><td colspan="${conProtocollo ? 5 : 4}">Totale del periodo</td>
        <td class="n">${e2(totali.reduce((s, t) => s + t.imponibile, 0))}</td><td></td>
        <td class="n">${e2(totali.reduce((s, t) => s + t.imposta, 0))}</td></tr>
    </tfoot>
  </table>`;
}

export function costruisciRegistri(
  fatture: Fattura[],
  fornitori: FatturaFornitore[],
  numeri: Map<string, string>,
  periodo: Periodo,
  azienda: DatiAzienda,
): string {
  const vendite = righeVendite(fatture);
  const acquisti = righeAcquisti(fornitori, numeri);
  const integrazioni = soloIntegrazioni(acquisti);

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Registri IVA ${esc(periodo.nome)} — ${esc(azienda.denominazione)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#111827;margin:0;padding:24px;background:#fff}
  .foglio{max-width:940px;margin:0 auto}
  h1{margin:0;font-size:20px;letter-spacing:-.3px}
  .sotto{margin-top:3px;font-size:13px;color:#6b7280}
  .chi{margin-top:10px;font-size:12.5px;color:#374151;line-height:1.6}
  h2{margin:26px 0 4px;font-size:12px;font-weight:800;letter-spacing:.12em;
    text-transform:uppercase;color:#374151}
  .norma{margin:0 0 8px;font-size:11.5px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
    color:#6b7280;border-bottom:1px solid #e5e7eb;padding:0 6px 5px}
  td{padding:5px 6px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .rif{font-weight:700;white-space:nowrap}
  .piva{color:#6b7280;white-space:nowrap}
  .nota{display:block;font-size:10.5px;color:#6b7280}
  tfoot td{border-top:1px solid #e5e7eb;border-bottom:none;font-size:11.5px;color:#374151}
  tfoot tr.forte td{font-weight:800;border-top:2px solid #111827;font-size:12.5px;color:#111827}
  .vuoto{margin:6px 0 0;font-size:12.5px;color:#6b7280}
  .avviso{margin:10px 0 0;padding:9px 11px;border:1px solid #f0d08a;background:#fef6e7;
    border-radius:8px;font-size:11.5px;line-height:1.6;color:#92600a}
  .piede{margin-top:26px;padding-top:12px;border-top:1px solid #e5e7eb;
    font-size:10.5px;color:#6b7280;line-height:1.6}
  @media print{body{padding:0}.foglio{max-width:none}h2{page-break-after:avoid}}
</style></head><body onload="window.print()"><div class="foglio">
  <h1>Registri IVA</h1>
  <div class="sotto">${esc(periodo.nome)}</div>
  <div class="chi"><strong>${esc(azienda.denominazione)}</strong><br>
    Partita IVA ${esc(azienda.partitaIva)}</div>

  <h2>Registro delle fatture emesse</h2>
  <p class="norma">art. 23 DPR 633/72</p>
  ${tabella(vendite, false)}

  <h2>Registro degli acquisti</h2>
  <p class="norma">art. 25 DPR 633/72 — numerate progressivamente nell&#39;ordine in cui sono state ricevute</p>
  ${tabella(acquisti, true)}

  ${
    integrazioni.length === 0
      ? ""
      : `<div class="avviso"><strong>${
          integrazioni.length === 1
            ? "L&#39;integrazione qui sopra va annotata"
            : `Le ${integrazioni.length} integrazioni qui sopra vanno annotate`
        } anche nel registro delle vendite.</strong>
      Su un acquisto in inversione contabile l&#39;imposta si detrae fra gli acquisti e si versa fra
      le vendite: è il meccanismo, non una duplicazione. Imposta da annotare:
      ${e2(integrazioni.reduce((s, r) => s + r.imposta, 0))} €.</div>`
  }

  <div class="piede">
    Registri tenuti in forma digitale: sono regolari anche senza stampa, a condizione che siano
    stampati su richiesta in sede di controllo (art. 7 c. 4-quater DL 357/1994). Questa copia è
    prodotta dal CRM dai documenti registrati nel periodo; la tenuta e la conservazione a norma
    restano in capo a chi tiene i libri.
  </div>
</div></body></html>`;
}
