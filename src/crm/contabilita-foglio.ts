/** ── IL FOGLIO DA CONSEGNARE AL COMMERCIALISTA ─────────────────────────────
 *
 *  Non è un riepilogo di cortesia: è il documento con cui si consegna un
 *  periodo. Perché serva a qualcosa deve dire tre cose che un elenco di numeri
 *  non dice da solo:
 *   · su che PERIODO è calcolato, con il primo e l'ultimo giorno per esteso —
 *     «settembre» detto a novembre non basta;
 *   · COSA È STATO ESCLUSO, perché e DA QUANDO, voce per voce: sono le prime
 *     domande che farebbe al telefono, e messe qui la telefonata non si fa;
 *   · che è un conto GESTIONALE. Un foglio con dentro «IRES» e una cifra al
 *     centesimo, senza quella riga, si legge come una dichiarazione.
 *
 *  ⚠️ FUNZIONE PURA, IN UN FILE SUO. Stava dentro la rotta, e lì non si poteva
 *   provare: questi fogli sono template annidati dentro altri template, e in
 *   questo stesso progetto un `${` protetto per errore ha già mandato in stampa
 *   un documento con scritto alla lettera il codice al posto del dato. Qui la
 *   si rende in memoria e ci si contano sopra i segnaposto rimasti.
 *
 *  ⚠️ Si stampa come gli altri documenti di questo CRM — finestra propria,
 *   niente CSS dell'applicazione — perché deve uscire identico fra un anno.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ContoFiscale, Aliquote } from "./contabilita";
import { DA_SEMPRE, type RegoleContabili } from "./contabilita-regole";
import type { Periodo } from "./contabilita-periodo";
import type { DatiAzienda } from "./fatture/tipi";

/** ── ⚠️ IL FOGLIO PER IL COMMERCIALISTA, E COSA CI VA SCRITTO SOPRA ───────
 *  Non è un riepilogo di cortesia: è il documento con cui si consegna un
 *  periodo. Perché serva a qualcosa deve dire tre cose che un elenco di numeri
 *  non dice da solo:
 *   · su che PERIODO è calcolato, con il primo e l'ultimo giorno per esteso —
 *     «settembre» detto a novembre non basta;
 *   · COSA È STATO ESCLUSO e perché, voce per voce: è la prima domanda che
 *     farebbe al telefono, e messa qui la telefonata non si fa;
 *   · che è un conto GESTIONALE. Un foglio con dentro «IRES» e una cifra al
 *     centesimo, senza quella riga, si legge come una dichiarazione.
 *
 *  ⚠️ SI STAMPA COME GLI ALTRI DOCUMENTI di questo CRM — finestra propria,
 *   niente CSS dell'applicazione — perché deve uscire identico fra un anno.
 *   Vale la stessa nota che sta sulla fattura leggibile (crm/fatture/documento):
 *   il `<` e lo `/script>` si scrivono separati, o il browser chiude qui lo
 *   script che sta leggendo. */
export function costruisciFoglio(
  conto: ContoFiscale,
  aliquote: Aliquote,
  periodo: Periodo,
  azienda: DatiAzienda,
  regole: RegoleContabili,
): string {
  const esc = (v: unknown) =>
    String(v ?? "").replace(
      /[<>&"]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
    );
  const e2 = (n: number) =>
    `€ ${(Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const data = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  /*  ── ⚠️ DUE MOTIVI DIVERSI PER ESCLUDERE UN COSTO, E NON SI MESCOLANO ──
      Questa sezione diceva, di TUTTI i costi esclusi, che stavano fuori «per
      scelta del titolare» e invitava a rimetterli dentro se deducibili. Da
      quando esiste il divieto di legge — carburante e trasferte pagati in
      contanti — quella frase è diventata falsa su una parte delle righe, e
      falsa nel modo peggiore: invitava il commercialista a dedurre un costo
      che l'articolo 164 comma 1-bis non lascia dedurre a nessuno.
      Le due liste restano separate, ognuna con la sua frase. */
  const perScelta = new Map<string, number>();
  const perLegge = new Map<string, { importo: number; perche: string }>();
  for (const r of conto.righe) {
    if (r.scaricabile) continue;
    if (r.bloccoDiLegge) {
      const c = perLegge.get(r.titolo) ?? { importo: 0, perche: r.bloccoDiLegge };
      perLegge.set(r.titolo, { importo: c.importo + r.importo, perche: c.perche });
    } else {
      perScelta.set(r.titolo, (perScelta.get(r.titolo) ?? 0) + r.importo);
    }
  }
  const totaleScelta = [...perScelta.values()].reduce((a, b) => a + b, 0);
  const totaleLegge = [...perLegge.values()].reduce((a, b) => a + b.importo, 0);

  const riga = (etichetta: string, valore: number, forte = false, segno = "") =>
    `<tr class="${forte ? "forte" : ""}"><td>${segno}${esc(etichetta)}</td><td class="n">${e2(valore)}</td></tr>`;

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Contabilità ${esc(periodo.nome)} — ${esc(azienda.denominazione)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#111827;margin:0;padding:28px;background:#fff}
  .foglio{max-width:760px;margin:0 auto}
  h1{margin:0;font-size:21px;letter-spacing:-.3px}
  .sotto{margin-top:3px;font-size:13px;color:#6b7280}
  .avviso{margin:16px 0;padding:10px 12px;border:1px solid #f0d08a;background:#fef6e7;
    border-radius:8px;font-size:12.5px;line-height:1.6;color:#92600a}
  h2{margin:22px 0 6px;font-size:11px;font-weight:800;letter-spacing:.14em;
    text-transform:uppercase;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  td{padding:6px 0;border-bottom:1px solid #f3f4f6;vertical-align:top}
  td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tr.forte td{font-weight:700;border-top:1px solid #e5e7eb;border-bottom:2px solid #e5e7eb}
  .piede{margin-top:22px;font-size:11.5px;line-height:1.7;color:#6b7280}
  @media print{body{padding:14mm}@page{margin:0}}
</style></head><body>
<div class="foglio">
  <h1>${esc(azienda.denominazione || "—")}</h1>
  <div class="sotto">
    P.IVA ${esc(azienda.partitaIva || "—")} · Contabilità di ${esc(periodo.nome)}
    (dal ${data(periodo.dal)} al ${data(periodo.al)})
  </div>

  <div class="avviso">
    <strong>Conto gestionale, non una dichiarazione.</strong> È ricavato dai documenti e dai costi
    registrati nel gestionale del centro, con le aliquote impostate lì
    (IRES ${aliquote.ires}%, IRAP ${aliquote.irap}%, IVA ${aliquote.iva}%). Non tiene conto di
    acconti già versati, perdite riportate, ammortamenti, deducibilità parziali né della base
    imponibile propria dell'IRAP.
  </div>

  <h2>IVA del periodo</h2>
  <table>
    ${riga("IVA a debito", conto.ivaADebito)}
    ${
      conto.ivaAutoliquidata > 0
        ? riga("di cui autoliquidata (inversione contabile)", conto.ivaAutoliquidata)
        : ""
    }
    ${riga("IVA sugli acquisti portata in detrazione", conto.ivaACredito, false, "− ")}
    ${
      conto.creditoPrecedente > 0
        ? riga("Credito IVA riportato dal periodo precedente", conto.creditoPrecedente, false, "− ")
        : ""
    }
    ${riga("IVA da versare", conto.ivaDaVersare, true, "= ")}
    ${
      conto.creditoIvaDaRiportare > 0
        ? riga(
            "Credito IVA che avanza, da riportare al periodo dopo",
            conto.creditoIvaDaRiportare,
            true,
            "= ",
          )
        : ""
    }
  </table>

  <h2>Imposte sul reddito</h2>
  <table>
    ${riga("Fatturato imponibile", conto.imponibileFatturato)}
    ${riga("Costi deducibili", conto.costiDeducibili, false, "− ")}
    ${riga("Utile imponibile", conto.utileImponibile, true, "= ")}
    ${riga(`IRES ${aliquote.ires}%`, conto.ires, false, "− ")}
    ${riga(`IRAP ${aliquote.irap}% (stima)`, conto.irap, false, "− ")}
    ${riga("Utile dopo le imposte", conto.utileDopoLeImposte, true, "= ")}
  </table>

  ${
    conto.ivaAutoliquidata > 0
      ? `<p style="font-size:12px;color:#6b7280;margin:6px 0 0;line-height:1.6">
      Gli acquisti in inversione contabile sono stati portati a debito e a credito per pari
      importo, secondo il regime indicato su ogni documento. Le autofatture non sono emesse da
      questo programma.
    </p>`
      : ""
  }

  <h2>Costi esclusi dal calcolo delle imposte</h2>
  ${
    perScelta.size === 0 && perLegge.size === 0
      ? `<p style="font-size:13px;color:#6b7280;margin:6px 0 0">Nessuno: tutti i costi del periodo sono stati considerati deducibili.</p>`
      : ""
  }
  ${
    perScelta.size === 0
      ? ""
      : `<table>${[...perScelta.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([t, v]) => riga(t, v))
          .join("")}
    ${riga("In tutto", totaleScelta, true, "= ")}</table>
    <p style="font-size:12px;color:#6b7280;margin:6px 0 0;line-height:1.6">
      Sono uscite reali del periodo, tenute FUORI dal calcolo delle imposte per scelta del titolare
      — tipicamente perché prive di un documento valido. Si prega di verificarle: se qualcuna è
      deducibile, l'utile imponibile qui sopra è più alto del dovuto.
    </p>`
  }
  ${
    perLegge.size === 0
      ? ""
      : `<h3 style="font-size:13px;margin:14px 0 0">Esclusi per legge, non per scelta</h3>
    <table>${[...perLegge.entries()]
      .sort((a, b) => b[1].importo - a[1].importo)
      .map(([t, v]) => riga(t, v.importo))
      .join("")}
    ${riga("In tutto", totaleLegge, true, "= ")}</table>
    <p style="font-size:12px;color:#6b7280;margin:6px 0 0;line-height:1.6">
      ${[...new Set([...perLegge.values()].map((v) => v.perche))].map(esc).join(" ")}
      Queste NON vanno rimesse fra i costi deducibili: il pagamento non tracciato fa perdere la
      deduzione e la detrazione per norma di legge (art. 164 c. 1-bis TUIR e art. 19-bis1
      DPR 633/72 per i carburanti; L. 207/2024 per trasferte e rappresentanza dal 2025). Se il
      pagamento è invece avvenuto con carta o bonifico, va corretto il dato sul documento.
    </p>`
  }

  ${
    //  ── ⚠️ LE REGOLE, CON LE LORO DATE ────────────────────────────────
    //   Il foglio diceva COSA è stato escluso e non DA QUANDO né perché. Alla
    //   prima occhiata il commercialista trova un costo dedotto a maggio e lo
    //   stesso costo escluso a ottobre, e l'unica cosa che può fare è
    //   telefonare. Qui c'è la riga che risponde prima che lo faccia — e
    //   quando è stata scritta una nota, c'è anche il motivo, con le parole
    //   del titolare.
    //   ⚠️ Solo le regole che TOCCANO questo periodo: l'elenco completo dei
    //    cambi degli ultimi tre anni non lo legge nessuno, e allungherebbe il
    //    foglio proprio dove deve restare corto.
    (() => {
      const dentroIlPeriodoOprima = (da: string) => da === DA_SEMPRE || da <= periodo.al;
      const righeRegole = Object.entries(regole)
        .flatMap(([, storia]) =>
          (Array.isArray(storia) ? storia : [])
            .filter((r) => dentroIlPeriodoOprima(r.da))
            .map((r) => ({ ...r, titolo: r.titolo || "" })),
        )
        .filter((r) => !r.scaricabile || !r.ivaDetraibile)
        .sort((a, b) => (a.titolo || "").localeCompare(b.titolo || "", "it"));
      if (righeRegole.length === 0) return "";
      return `<h2>Come sono stati trattati i costi</h2>
    <table>${righeRegole
      .map(
        (r) =>
          `<tr><td>${esc(r.titolo || "—")}${
            r.nota ? `<br><span style="font-size:11.5px;color:#9ca3af">${esc(r.nota)}</span>` : ""
          }</td><td class="n" style="white-space:normal;text-align:right">${
            r.da === DA_SEMPRE ? "sempre" : `da ${esc(r.da)}`
          }<br><span style="font-size:11.5px;color:#6b7280">${
            r.scaricabile ? "costo dedotto" : "costo NON dedotto"
          } · ${r.ivaDetraibile ? "IVA detratta" : "IVA non detratta"}</span></td></tr>`,
      )
      .join("")}</table>
    <p style="font-size:12px;color:#6b7280;margin:6px 0 0;line-height:1.6">
      Ogni regola vale dal mese indicato in avanti: i costi dei mesi precedenti restano trattati
      come lo erano allora. È il motivo per cui la stessa voce può risultare dedotta in un periodo
      e non nel successivo.
    </p>`;
    })()
  }

  ${
    conto.incassiSenzaIva > 0
      ? `<h2>Incassi registrati senza IVA</h2>
    <table>${riga("Fuori dal fatturato del periodo", conto.incassiSenzaIva)}</table>
    <p style="font-size:12px;color:#6b7280;margin:6px 0 0;line-height:1.6">
      Somme incassate e registrate nel gestionale senza IVA e non comprese nel fatturato qui sopra.
      Sono riportate perché il quadro sia completo.
    </p>`
      : ""
  }

  <div class="piede">
    Documento generato dal gestionale del centro il ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}.
    I documenti che lo compongono — fatture emesse e fatture ricevute — sono disponibili in formato
    XML su richiesta.
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}${"<" + "/script>"}
</body></html>`;
}
