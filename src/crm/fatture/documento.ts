/** ── LA COPIA DI CORTESIA ──────────────────────────────────────────────────
 *
 *  Il foglio leggibile della fattura: quello che si manda al cliente e quello
 *  che si guarda per controllare prima di consegnare l'XML al commercialista.
 *
 *  ⚠️ NON È LA FATTURA. La fattura è l'XML che passa dallo SDI (vedi xml.ts):
 *   questo è il documento umano che gli sta accanto, come la copia di cortesia
 *   che qualunque gestionale stampa. Chi lo guarda deve poter verificare che i
 *   numeri siano giusti PRIMA che il file parta, perché dopo si corregge solo
 *   con una nota di credito.
 *
 *  Si apre in una finestra sua e si stampa, come il riepilogo di consegna
 *  (crm/ricevuta) e la trascrizione della consulenza: nessuna dipendenza,
 *  nessun font da incorporare, e «Salva come PDF» è già nel browser.
 *  ⚠️ E come quello, non eredita una riga di CSS dall'applicazione: un
 *   documento contabile deve uscire identico fra un anno.
 *  ───────────────────────────────────────────────────────────────────────── */
import { etichettaNumero } from "./archivio";
import type { DatiAzienda, Fattura } from "./tipi";
//  Come si chiama la causale, e come si racconta il pagamento: una regola
//  sola per il foglio, la schermata e l'XML.
import { modoDi, pagamentoInChiaro } from "./modi-di-incasso";

const esc = (v: unknown): string =>
  String(v ?? "").replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );

const euro = (n: number): string =>
  `€ ${(Number(n) || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dataLunga = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
};

/** Il nome per esteso di chi riceve: azienda o persona, mai un misto. */
export function nomeCliente(f: Fattura): string {
  const c = f.cliente;
  return c.azienda
    ? c.denominazione.trim() || "—"
    : `${c.nome} ${c.cognome}`.trim() || f.leadNome || "—";
}

/** ── ⚠️ IL MARCHIO STA SU UNA FASCIA SCURA, E NON È UNA SCELTA DI GUSTO ────
 *  Il logo caricato nelle impostazioni è la versione BIANCA del marchio
 *  (`Logo-PNG-WHITE`): sulla carta bianca della fattura non si vedeva — non
 *  «si vedeva male», proprio non c'era. La fascia scura in cima è il posto in
 *  cui quel file si legge, ed è anche ciò che dà alla fattura la sua unica
 *  nota di colore: sotto resta tutto bianco, righe sottili e niente altro.
 *  ⚠️ Chi caricasse un logo NERO deve saperlo: qui sparirebbe, e il posto da
 *   cambiare è questo. Il ripiego col nome scritto regge comunque.
 *  Stessa scelta, stesso motivo, del certificato di copertura (crm/ricevuta). */
export function costruisciDocumento(f: Fattura, a: DatiAzienda, logo = ""): string {
  const c = f.cliente;
  const indirizzo = (s: {
    indirizzo: string;
    civico: string;
    cap: string;
    comune: string;
    provincia: string;
  }) =>
    [
      [s.indirizzo, s.civico].filter(Boolean).join(" "),
      [s.cap, s.comune, s.provincia ? `(${s.provincia})` : ""].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join("<br>");

  const righe = f.righe
    .map((r) => {
      const tot = (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0);
      return `<tr>
        <td class="d">${esc(r.descrizione)}</td>
        <td class="n">${esc(String(r.quantita))}</td>
        <td class="n">${esc(euro(r.prezzoUnitario))}</td>
        <td class="n">${esc(String(r.aliquota))}%</td>
        <td class="n f">${esc(euro(tot))}</td>
      </tr>`;
    })
    .join("");

  //  ⚠️ «BOZZA» IN CHIARO E IN GRANDE. Un foglio senza numero che sembra una
  //   fattura è la cosa più pericolosa che questa cartella possa produrre: si
  //   manda al cliente per sbaglio, e lui crede di avere una fattura. La
  //   filigrana attraversa la pagina e resta anche in stampa.
  const bozza = f.stato !== "emessa";

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>${bozza ? "BOZZA" : "Fattura"} ${esc(etichettaNumero(f))} — ${esc(nomeCliente(f))}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:#111827;background:#f4f5f7;padding:28px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .foglio{position:relative;max-width:800px;margin:0 auto;background:#fff;border:1px solid #e8eaed;
    border-radius:16px;overflow:hidden}

  /* ── ⚠️ LA FASCIA È IL FONDO DEL SITO, COPIATO RIGA PER RIGA ────────────
     Non un grigio scuro qualunque: è la ricetta di .bg-blueprint in
     styles.css — navy #0a1a3a, alone azzurro in alto, blu profondo in basso,
     griglia bianca al 5% ogni 72px. È lo sfondo del preventivo e di Meetly,
     cioè quello che il cliente ha già visto due volte prima di ricevere la
     fattura; un grigio diverso la fa sembrare emessa da un altro.
     ⚠️ Scritto per esteso e non con la classe: questo foglio esce in una
      finestra sua e non eredita CSS dall'applicazione, per scelta. Se cambia
      il fondo del sito, cambia QUI e in crm/ricevuta.tsx. */
  .testa{position:relative;display:flex;align-items:center;justify-content:space-between;
    gap:24px;padding:26px 30px;color:#fff;
    background-color:#0a1a3a;
    background-image:
      linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px),
      radial-gradient(ellipse 80% 90% at 50% 0%,rgba(56,110,220,.28),transparent 70%),
      radial-gradient(ellipse 60% 70% at 50% 100%,rgba(20,50,120,.35),transparent 70%),
      linear-gradient(180deg,#0c1f44 0%,#081634 60%,#0a1a3a 100%);
    background-size:72px 72px,72px 72px,auto,auto,auto}
  .testa .logo{height:26px;width:auto;object-fit:contain;display:block}
  .testa .logo-testo{font-size:17px;font-weight:800;letter-spacing:-.2px}
  .doc{text-align:right;flex-shrink:0}
  .doc .tag{font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
    color:#77bcff}
  .doc .num{margin-top:3px;font-size:21px;font-weight:800;letter-spacing:-.4px;line-height:1.1}
  .doc .data{margin-top:3px;font-size:12px;color:rgba(255,255,255,.55)}

  /* ── chi emette e chi riceve, affiancati: si confrontano, non si inseguono ── */
  .parti{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .parti>div{padding:20px 30px}
  .parti>div+div{border-left:1px solid #f0f1f3}
  h2{margin:0 0 7px;font-size:9.5px;font-weight:800;letter-spacing:.16em;
    text-transform:uppercase;color:#9aa1ab}
  .parti .nome{font-size:14.5px;font-weight:700;letter-spacing:-.2px}
  .parti .righe{margin-top:4px;font-size:12px;line-height:1.65;color:#5b6472}

  /* i dati dell'ordine: griglia, non prosa — si leggono a colpo d'occhio */
  .ordine{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 24px;
    border-top:1px solid #f0f1f3;padding:18px 30px;background:#fafbfc}
  .ordine>div{min-width:0}
  .ordine .largo{grid-column:1/-1}
  .ordine .et{display:block;font-size:9.5px;font-weight:800;letter-spacing:.14em;
    text-transform:uppercase;color:#9aa1ab}
  .ordine .va{display:block;margin-top:3px;font-size:13px;font-weight:600;word-break:break-word}
  .ordine .va.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
  /* «non ancora ricevuto» non e' un dato, e' un'assenza: si sbiadisce */
  .ordine .va.attesa{color:#b45309}
  .bollo{display:inline-block;margin-top:4px;padding:3px 10px;border-radius:999px;
    font-size:11.5px;font-weight:700}
  .bollo.ok{background:#eefaf4;color:#0b7a53}
  .bollo.attesa{background:#fdf3e3;color:#92600a}

  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;padding:12px 30px 8px;border-top:1px solid #f0f1f3;
    border-bottom:1px solid #e8eaed;font-size:9.5px;font-weight:800;letter-spacing:.14em;
    text-transform:uppercase;color:#9aa1ab}
  thead th.n,tbody td.n{text-align:right}
  tbody td{padding:13px 30px;border-bottom:1px solid #f4f5f7;vertical-align:top;
    font-variant-numeric:tabular-nums}
  tbody td.d{font-weight:600;font-variant-numeric:normal}
  tbody td.f{font-weight:700}

  .totali{display:flex;justify-content:flex-end;padding:18px 30px 6px}
  .totali table{width:auto;min-width:270px}
  .totali td{padding:5px 0;font-size:13px;color:#5b6472}
  .totali td.v{text-align:right;padding-left:32px;font-weight:600;color:#111827;
    font-variant-numeric:tabular-nums}
  .totali tr.tot td{padding-top:12px;border-top:1px solid #e8eaed;font-size:18px;
    font-weight:800;color:#111827}
  .totali tr.tot td.v{color:#0b57a4}

  .piede{margin-top:10px;border-top:1px solid #f0f1f3;padding:16px 30px 24px;font-size:11.5px;
    line-height:1.75;color:#7a828e}
  .piede b{color:#111827;font-weight:700}

  /* la filigrana della bozza: attraversa tutto e non si puo' non vederla */
  .filigrana{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    pointer-events:none;z-index:5}
  .filigrana span{transform:rotate(-24deg);font-size:96px;font-weight:900;letter-spacing:.12em;
    color:rgba(190,18,60,.12);border:6px solid rgba(190,18,60,.12);padding:8px 30px;border-radius:16px}

  @media print{
    body{background:#fff;padding:12mm}
    .foglio{border:0;border-radius:0;max-width:none}
    /* ── ⚠️ MARGINE ZERO, E LO SPAZIO SE LO PRENDE IL FOGLIO ────────────
       Con un margine di pagina diverso da zero Chrome ci scrive dentro la
       sua intestazione: in alto la data, in basso a sinistra «about:blank»
       e a destra «1/1». Su un documento che si manda al cliente è una
       scritta che non c'entra niente e che sembra un errore.
       Non è un'opzione da spegnere nel codice: si toglie soltanto
       lasciando i margini a zero, cioè togliendo lo spazio in cui verrebbe
       scritta. Il bianco attorno al foglio non si perde — se lo prende il
       corpo con il suo padding, che è la stessa distanza di prima.
       ⚠️ Resta una casella «Intestazioni e piè di pagina» sotto «Altre
        impostazioni» nella finestra di stampa: se qualcuno la accende a
        mano, Chrome le rimette. Da qui non si può impedire. */
    @page{margin:0}
  }
  /* su carta stretta le due parti si impilano invece di schiacciarsi */
  @media (max-width:560px){.parti{grid-template-columns:1fr}
    .parti>div+div{border-left:0;border-top:1px solid #f0f1f3}}
</style></head><body>
  <div class="foglio">
    ${bozza ? '<div class="filigrana"><span>BOZZA</span></div>' : ""}

    <div class="testa">
      ${
        logo
          ? `<img class="logo" src="${esc(logo)}" alt="${esc(a.denominazione || "")}">`
          : `<div class="logo-testo">${esc(a.denominazione || "—")}</div>`
      }
      <div class="doc">
        <div class="tag">${bozza ? "Bozza di fattura" : "Fattura"}</div>
        <div class="num">${bozza ? "senza numero" : esc(etichettaNumero(f))}</div>
        <div class="data">${f.data ? esc(dataLunga(f.data)) : "data non ancora assegnata"}</div>
      </div>
    </div>

    <div class="parti">
      <div>
        <h2>Emessa da</h2>
        <div class="nome">${esc(a.denominazione || "—")}</div>
        <div class="righe">
          ${indirizzo(a)}<br>
          P.IVA ${esc(a.partitaIva || "—")}${a.codiceFiscale && a.codiceFiscale !== a.partitaIva ? ` · C.F. ${esc(a.codiceFiscale)}` : ""}
          ${a.reaUfficio && a.reaNumero ? `<br>REA ${esc(a.reaUfficio)}-${esc(a.reaNumero)}` : ""}
          ${a.pec ? `<br>PEC ${esc(a.pec)}` : ""}
        </div>
      </div>
      <div>
        <h2>Intestata a</h2>
        <div class="nome">${esc(nomeCliente(f))}</div>
        <div class="righe">
          ${indirizzo(c)}
          ${c.partitaIva ? `<br>P.IVA ${esc(c.partitaIva)}` : ""}
          ${c.codiceFiscale ? `<br>C.F. ${esc(c.codiceFiscale.toUpperCase())}` : ""}
        </div>
      </div>
    </div>

    ${
      //  ── ⚠️ I CINQUE DATI CHE IL CLIENTE CERCA ────────────────────────
      //   Erano sparsi: la data in cima, il pagamento in fondo, l'ordine
      //   dentro la causale, e lo stato da nessuna parte — si deduceva
      //   dall'assenza di una riga. Chi riceve una fattura di acconto
      //   guarda tre cose in quest'ordine: «l'ho pagata?», «di che ordine
      //   è?», «cosa scrivo nel bonifico?». Adesso stanno insieme, in una
      //   griglia, sopra le righe.
      //   ⚠️ LA CAUSALE È SCRITTA PER ESTESO E IDENTICA a quella del
      //    preventivo: è la stringa che il cliente COPIA nel bonifico, e se
      //    qui comparisse anche solo con un trattino diverso il versamento
      //    arriverebbe con una causale che non lega a niente.
      //   ⚠️ E C'È ANCHE SULLE BOZZE, dove prima non compariva: una bozza si
      //    manda al cliente per chiedergli il bonifico, ed è proprio lì che la
      //    causale gli serve. Sulla bozza il numero non c'è e la data nemmeno:
      //    si dice, invece di lasciare due caselle vuote.
      `
    <div class="ordine">
      <div>
        <span class="et">Data fattura</span>
        <span class="va${f.data ? "" : " attesa"}">${
          f.data ? esc(dataLunga(f.data)) : "non ancora assegnata"
        }</span>
      </div>
      <div>
        <span class="et">Data pagamento</span>
        <span class="va${f.dataPagamento ? "" : " attesa"}">${
          f.dataPagamento ? esc(dataLunga(f.dataPagamento)) : "non ancora ricevuto"
        }</span>
      </div>
      <div>
        <span class="et">Stato</span>
        <span class="bollo ${f.dataPagamento ? "ok" : "attesa"}">${
          f.dataPagamento ? "Pagata" : bozza ? "In attesa di pagamento" : "Da saldare"
        }</span>
      </div>
      ${
        f.preventivoRef
          ? `<div><span class="et">ID ordine</span><span class="va mono">${esc(f.preventivoRef)}</span></div>`
          : ""
      }
      ${
        /*  ── ⚠️ «CAUSALE DEL BONIFICO» SOLO SE È UN BONIFICO ──────────────
            Segnalazione del committente: pagando con il POS il programma
            chiedeva lo stesso la «causale», che è la parola del bonifico — la
            frase che il cliente copia nel pagamento. Al POS quella frase non
            esiste. L'etichetta adesso la dà il modo di incasso
            (fatture/modi-di-incasso), e sul foglio il cliente non si vede più
            chiesta una cosa che ha già fatto in un altro modo. */
        f.causale
          ? `<div class="largo">
              <span class="et">${esc(modoDi(f.metodoPagamento).etichettaCausale)}</span>
              <span class="va mono">${esc(f.causale)}</span>
            </div>`
          : ""
      }
      ${
        //  Come ha pagato, con il riferimento dell'incasso: è la riga che
        //  lega questa fattura a quel movimento, e che prima non c'era.
        f.metodoPagamento || f.riferimentoPagamento
          ? `<div class="largo">
              <span class="et">Pagamento</span>
              <span class="va">${esc(pagamentoInChiaro({ metodo: f.metodoPagamento, riferimento: f.riferimentoPagamento }))}</span>
            </div>`
          : ""
      }
    </div>`
    }

    <table>
      <thead><tr>
        <th>Descrizione</th><th class="n">Q.tà</th><th class="n">Prezzo</th>
        <th class="n">IVA</th><th class="n">Importo</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>

    ${
      //  ⚠️ LA CAUSALE NON SI RIPETE QUI, MAI. Sta nella griglia in alto — su
      //   ogni foglio, bozza compresa — dove il cliente la cerca per copiarla
      //   nel bonifico. Scritta anche sotto le righe compariva due volte nello
      //   stesso foglio a mezzo palmo di distanza.
      ""
    }

    <div class="totali"><table>
      <tr><td>Imponibile</td><td class="v">${esc(euro(f.imponibile))}</td></tr>
      <tr><td>IVA</td><td class="v">${esc(euro(f.imposta))}</td></tr>
      <tr class="tot"><td>Totale</td><td class="v">${esc(euro(f.totale))}</td></tr>
    </table></div>

    <div class="piede">
      ${
        //  ⚠️ IL PAGAMENTO NON SI RIPETE PIÙ QUI: sta nella griglia in alto,
        //   insieme allo stato e alla causale. Ripeterlo in fondo faceva
        //   leggere due volte la stessa cosa e, quando le due righe erano
        //   scritte in modi diversi, sembrava che dicessero cose diverse.
        /*  ── ⚠️ L'IBAN SOLO A CHI DEVE FARE UN BONIFICO ──────────────────
            Qui c'era «Pagamento con bonifico bancario · IBAN …» su OGNI
            fattura: su un incasso al POS è una riga falsa dentro un documento
            fiscale, e per il cliente è l'invito a pagare una seconda volta
            qualcosa che ha già pagato. */
        a.iban && (!f.metodoPagamento || f.metodoPagamento === "bonifico")
          ? `Pagamento con bonifico bancario · <b>IBAN ${esc(a.iban)}</b><br>`
          : ""
      }
      ${
        bozza
          ? "Questo foglio è una <b>bozza</b>: non ha numero né data e non è stato emesso."
          : "Documento emesso in formato elettronico."
      }
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}${"<" + "/script>"}
</body></html>`;
}
