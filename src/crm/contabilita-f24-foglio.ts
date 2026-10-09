/** ── IL PROSPETTO F24 DA STAMPARE ──────────────────────────────────────────
 *
 *  Le stesse righe che stanno in pagina, su un foglio da allegare alla mail
 *  per il commercialista o da tenere accanto mentre si compila l'home banking.
 *
 *  ── ⚠️ NON DEVE SOMIGLIARE A UN F24 ───────────────────────────────────────
 *  E non è una questione di stile. Il modello F24 è un modulo dell'Agenzia con
 *  una grafica precisa; un foglio che gli somiglia verrebbe preso per quello, e
 *  una società con partita IVA non può pagare su carta — deve passare da
 *  Entratel o dall'home banking. Quindi questo si intitola «Cosa scrivere
 *  nell'F24», ha l'aspetto degli altri fogli di questa cartella, e dice in
 *  cima cosa non è. Un documento che sembra ufficiale e non lo è fa più danno
 *  di un foglio scritto a mano.
 *
 *  ⚠️ PURO, come `contabilita-foglio`: si rende in memoria e ci si contano
 *   sopra i segnaposto rimasti. In questo progetto un `${` protetto per errore
 *   ha già mandato in stampa un documento con dentro il codice invece del
 *   numero.
 *  ───────────────────────────────────────────────────────────────────────── */
import { perchePerNiente, righeF24, totaleF24 } from "./contabilita-f24";
import type { ContoFiscale } from "./contabilita";
import type { Periodo } from "./contabilita-periodo";
import type { RegimeLiquidazione } from "./contabilita-scadenze";
import type { DatiAzienda } from "./fatture/tipi";
import { prossimeScadenze } from "./contabilita-scadenze";

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );

/** Con i centesimi, sempre: questi numeri si ricopiano in un modulo di
 *  pagamento. Vedi la nota in crm/contabilita-ProspettoF24. */
const e2 = (n: number) =>
  (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const giorno = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function costruisciFoglioF24(
  conto: ContoFiscale,
  periodo: Periodo,
  regime: RegimeLiquidazione,
  azienda: DatiAzienda,
  oggi: string,
): string {
  const righe = righeF24(conto, periodo, regime);
  //  La scadenza in cui questo versamento va fatto: è la prima liquidazione
  //  che viene, ed è l'informazione che manca sempre sul foglio.
  const scadenza = prossimeScadenze(oggi, regime, 30).find((s) => s.tipo === "iva");

  const corpo =
    righe.length === 0
      ? `<p class="vuoto">${esc(perchePerNiente(conto, periodo, regime))}</p>`
      : `<table>
      <thead><tr>
        <th>Codice tributo</th><th>Rateaz./Reg./Prov.</th><th>Periodo di riferimento</th>
        <th>Anno di riferimento</th><th class="n">Importo a debito</th>
      </tr></thead>
      <tbody>
        ${righe
          .map(
            (r) =>
              `<tr><td><strong>${esc(r.codice)}</strong><span class="cosa">${esc(r.cosa)}</span></td>` +
              `<td>—</td><td>${esc(r.periodo)}</td><td>${esc(r.anno)}</td>` +
              `<td class="n">${e2(r.importo)}</td></tr>`,
          )
          .join("")}
        <tr class="forte"><td colspan="4">Totale da versare</td><td class="n">${e2(totaleF24(righe))}</td></tr>
      </tbody>
    </table>
    <p class="nota">Tutte le righe vanno nella sezione <strong>ERARIO</strong> del modello.</p>`;

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Cosa scrivere nell'F24 — ${esc(periodo.nome)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#111827;margin:0;padding:28px;background:#fff}
  .foglio{max-width:760px;margin:0 auto}
  h1{margin:0;font-size:21px;letter-spacing:-.3px}
  .sotto{margin-top:3px;font-size:13px;color:#6b7280}
  .chi{margin-top:14px;font-size:12.5px;color:#374151;line-height:1.6}
  .avviso{margin:16px 0;padding:10px 12px;border:1px solid #f0d08a;background:#fef6e7;
    border-radius:8px;font-size:12.5px;line-height:1.6;color:#92600a}
  table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
  th{text-align:left;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
    color:#6b7280;border-bottom:1px solid #e5e7eb;padding:0 8px 6px}
  td{padding:8px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .cosa{display:block;font-size:11.5px;color:#6b7280;margin-top:2px}
  tr.forte td{font-weight:800;border-top:2px solid #111827;border-bottom:none;font-size:14px}
  .nota{margin-top:8px;font-size:11.5px;color:#6b7280;line-height:1.6}
  .vuoto{margin-top:16px;font-size:13px;color:#374151;line-height:1.7}
  .piede{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;
    font-size:11px;color:#6b7280;line-height:1.6}
  @media print{body{padding:0}.foglio{max-width:none}}
</style></head><body onload="window.print()"><div class="foglio">
  <h1>Cosa scrivere nell&#39;F24</h1>
  <div class="sotto">${esc(periodo.nome)} · liquidazione ${esc(regime)}</div>
  <div class="chi">
    <strong>${esc(azienda.denominazione)}</strong><br>
    Partita IVA ${esc(azienda.partitaIva)}${azienda.codiceFiscale && azienda.codiceFiscale !== azienda.partitaIva ? ` · Codice fiscale ${esc(azienda.codiceFiscale)}` : ""}
  </div>

  <div class="avviso">
    <strong>Questo non è un modello F24 e non si può presentare.</strong> Una società con partita
    IVA deve versare per via telematica — Entratel/Fisconline o l&#39;home banking della banca
    (art. 37 c. 49 DL 223/2006). Questo foglio dice soltanto <em>cosa scrivere nelle caselle</em>.
    ${scadenza ? `Il versamento va fatto entro il <strong>${esc(giorno(scadenza.giorno))}</strong>.` : ""}
  </div>

  ${corpo}

  <div class="piede">
    Importi calcolati dalle fatture emesse e ricevute registrate in questo periodo. I codici
    tributo sono quelli ordinari e vanno confermati da chi tiene i libri: un codice sbagliato
    manda i soldi su un altro tributo, e recuperarli è un&#39;istanza.<br>
    <strong>IRES e IRAP non sono in questo foglio</strong>: il loro F24 è il saldo dell&#39;anno
    precedente più due acconti calcolati su quanto si è versato allora — numeri che stanno nella
    dichiarazione, non in questo programma.
  </div>
</div></body></html>`;
}
