/** ── QUELLO CHE NON VA, PRIMA DI GIRARLO AL COMMERCIALISTA ─────────────────
 *
 *  Nasce da un difetto che avevo lasciato aperto io: il pacchetto per il
 *  commercialista scrive nel LEGGIMI «riapri e precisa le fatture registrate
 *  con il vecchio inversione contabile», e nella pagina non c'era NESSUN modo
 *  di trovarle. Un programma che dice cosa fare e non dice dove farlo manda a
 *  scorrere un elenco di cento righe cercando una parola.
 *
 *  ── ⚠️ SOLO QUELLO SU CUI SI PUÒ FARE QUALCOSA ────────────────────────────
 *  Non è un pannello di avvisi. Ogni riga qui dentro è una cosa che una
 *  persona può sistemare in un clic, e sparisce quando l'ha sistemata. Le
 *  osservazioni che non si possono chiudere — «ricordati che l'IVA
 *  sull'auto…» — stanno da un'altra parte: qui diventerebbero rumore
 *  permanente, e il giorno che compare un problema vero nessuno lo vedrebbe.
 *
 *  ── ⚠️ E NIENTE QUANDO NON C'È NIENTE ─────────────────────────────────────
 *  A posto, la scheda non si disegna proprio. Una striscia verde con scritto
 *  «tutto ok» occupa lo spazio della cosa che conta e insegna a saltare quella
 *  posizione con gli occhi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "./ui";
import { regimeDi, type FatturaFornitore } from "./contabilita-fornitori";
import { problemiXml } from "./fatture/xml";
import { problemiAutofattura } from "./contabilita-autofattura";
import { SOGLIA_INTRASTAT_BENI, SOGLIA_INTRASTAT_SERVIZI } from "./contabilita-regimi";
import type { DatiAzienda, Fattura } from "./fatture/tipi";
import type { CostoContabile } from "./contabilita";

export interface Problema {
  chiave: string;
  /** Quanto è grave: `alta` è denaro o una sanzione, `media` è un documento
   *  che manca, `bassa` è una cosa da controllare. */
  peso: "alta" | "media" | "bassa";
  titolo: string;
  spiega: string;
  /** Le fatture da aprire per sistemarlo, quando ce ne sono. */
  fatture: FatturaFornitore[];
  /** Le NOSTRE fatture che non passerebbero: si aprono da «Fatture», non da
   *  qui, e quindi si mostrano solo come nomi. */
  emesse?: { chi: string; perche: string }[];
}

/** ⚠️ PURA, e separata dal disegno: così si può controllare senza un browser,
 *  ed è l'unica ragione per cui una regola del genere resta giusta nel tempo. */
export function problemiDelPeriodo(
  fornitori: FatturaFornitore[],
  righe: CostoContabile[],
  /** Le nostre fatture del periodo e i dati del centro: senza, il controllo
   *  sull'XML non si fa e basta — è la stessa prudenza del resto del file. */
  nostre?: { fatture: Fattura[]; azienda: DatiAzienda },
): Problema[] {
  const fuori: Problema[] = [];

  /*  ── ⚠️ LE NOSTRE FATTURE CHE LO SDI RIFIUTEREBBE ────────────────────
      «Scarica gli XML» diceva già «2 restano indietro: manca un dato
      obbligatorio», e si fermava lì: quali fossero e cosa mancasse andava
      indovinato riaprendo le fatture una per una. Un programma che dice cosa
      fare deve dire anche dove — è lo stesso motivo per cui esiste questa
      scheda.
      ⚠️ Si guarda SOLO chi ha dei bloccanti: gli avvisi (un codice
       destinatario strano, un totale che non torna al centesimo) non
       impediscono la consegna, e metterli qui riempirebbe la scheda di righe
       su cui non c'è niente da fare. */
  if (nostre && nostre.fatture.length > 0) {
    const rotte = nostre.fatture
      .map((f) => ({ f, esame: problemiXml(f, nostre.azienda) }))
      .filter((x) => x.esame.bloccanti.length > 0);
    if (rotte.length > 0) {
      fuori.push({
        chiave: "emesse",
        peso: "alta",
        titolo:
          rotte.length === 1
            ? "Una tua fattura non si può consegnare allo SDI"
            : `${rotte.length} tue fatture non si possono consegnare allo SDI`,
        spiega:
          "Manca un dato che il tracciato pretende, quindi restano fuori dal pacchetto per il commercialista e dallo scarico degli XML. Si correggono da «Fatture», aprendo la fattura e rimettendo il dato.",
        fatture: [],
        emesse: rotte.map((x) => ({
          chi: `n. ${x.f.numero}${x.f.serie ? `/${x.f.serie}` : ""} · ${
            x.f.cliente.azienda
              ? x.f.cliente.denominazione
              : `${x.f.cliente.nome} ${x.f.cliente.cognome}`.trim()
          }`,
          perche: x.esame.bloccanti.join(" · "),
        })),
      });
    }
  }

  const precisare = fornitori.filter((f) => regimeDi(f.regime ?? "italiana").daPrecisare);
  if (precisare.length > 0) {
    fuori.push({
      chiave: "precisare",
      peso: "alta",
      titolo: `${precisare.length === 1 ? "Una fattura estera è registrata" : `${precisare.length} fatture estere sono registrate`} in modo generico`,
      spiega:
        "Erano salvate come «inversione contabile» e basta, prima che si distinguesse fra merce e servizi. L'IVA torna, ma non si sa quale documento vada mandato allo SDI — TD17 o TD18 — quindi restano fuori dal foglio degli esteri. Aprile e scegli la riga giusta.",
      fatture: precisare,
    });
  }

  /*  ── ⚠️ LE AUTOFATTURE CHE NON SI POSSONO COSTRUIRE ──────────────────
      Su ogni acquisto estero va trasmesso allo SDI un TD17/TD18/TD19, e la
      sanzione e' PER DOCUMENTO: cento euro a fattura, non una volta sola. Se
      manca la partita IVA del fornitore il file non si costruisce — e a
      scoprirlo il 15 del mese, con l'elenco davanti e il fornitore in un altro
      fuso orario, non si rimedia.
      ⚠️ Sta qui e non fra gli avvisi: si sistema in un clic (si apre la
       fattura e si scrive la partita IVA, che sul documento c'e' sempre). */
  if (nostre?.azienda) {
    const senzaAutofattura = fornitori.filter(
      (f) =>
        regimeDi(f.regime ?? "italiana").tipoDocumento &&
        problemiAutofattura(f, nostre.azienda).length > 0,
    );
    if (senzaAutofattura.length > 0) {
      fuori.push({
        chiave: "autofattura",
        peso: "alta",
        titolo:
          senzaAutofattura.length === 1
            ? "Un acquisto estero non si può trasmettere allo SDI"
            : `${senzaAutofattura.length} acquisti esteri non si possono trasmettere allo SDI`,
        spiega:
          "Manca un dato che il tracciato pretende — quasi sempre la partita IVA del fornitore, che sul suo documento c'è sempre. Senza, l'autofattura non si costruisce e non entra nel pacchetto: la sanzione per la mancata trasmissione è per ogni documento.",
        fatture: senzaAutofattura,
      });
    }
  }

  /*  ── ⚠️ LE SOGLIE INTRASTAT, CONTATE ─────────────────────────────────
      Finora la pagina diceva «serve sopra le soglie» e lasciava a chi legge
      il compito di sommare. Le soglie sono trimestrali — 350.000 € di beni,
      100.000 € di servizi — e sopra scatta l'obbligo di presentare gli
      elenchi, con periodicita' mensile.
      ⚠️ QUESTO È UN CONTO DEL PERIODO GUARDATO, non dei quattro trimestri
       precedenti come vuole la norma: il CRM non tiene la serie storica degli
       acquisti UE. Quindi la scheda dice «potresti aver superato», non «hai
       superato» — un obbligo dichiarato con certezza sbagliata fa fare un
       adempimento inutile, o fa saltare quello vero. */
  const perZona = { beni: 0, servizi: 0 };
  for (const f of fornitori) {
    const r = regimeDi(f.regime ?? "italiana");
    if (r.intrastat === "beni") perZona.beni += Math.max(0, f.imponibile || f.totale);
    if (r.intrastat === "servizi") perZona.servizi += Math.max(0, f.imponibile || f.totale);
  }
  const sopra = [
    perZona.beni > SOGLIA_INTRASTAT_BENI ? ("beni" as const) : null,
    perZona.servizi > SOGLIA_INTRASTAT_SERVIZI ? ("servizi" as const) : null,
  ].filter(Boolean);
  if (sopra.length > 0) {
    fuori.push({
      chiave: "intrastat",
      peso: "media",
      titolo: `Potresti dover presentare gli elenchi INTRASTAT ${sopra.join(" e ")}`,
      spiega: `In questo periodo hai acquistato dall'Unione ${sopra
        .map((x) =>
          x === "beni"
            ? `${Math.round(perZona.beni).toLocaleString("it-IT")} € di merce (soglia 350.000)`
            : `${Math.round(perZona.servizi).toLocaleString("it-IT")} € di servizi (soglia 100.000)`,
        )
        .join(
          " e ",
        )}. La soglia si guarda sui quattro trimestri precedenti, che questo programma non tiene: dillo al commercialista, è lui a sapere se l'obbligo è scattato e da quando.`,
      fatture: [],
    });
  }

  const bloccate = righe.filter((r) => r.bloccoDiLegge);
  if (bloccate.length > 0) {
    const quanto = bloccate.reduce((s, r) => s + r.importo, 0);
    fuori.push({
      chiave: "bloccate",
      peso: "alta",
      titolo: `${eur(quanto)} di spese che la legge non fa dedurre`,
      spiega: `${bloccate.map((r) => r.titolo).join(", ")}: risultano pagate in contanti, e su carburante e trasferte questo fa perdere sia la deduzione sia la detrazione. Se in realtà le hai pagate con carta o bonifico, correggi il metodo sulla fattura: sono soldi.`,
      fatture: [],
    });
  }

  const senzaDocumento = fornitori.filter((f) => !f.originale && !f.conAllegato);
  if (senzaDocumento.length > 0) {
    fuori.push({
      chiave: "documento",
      peso: "media",
      titolo: `${senzaDocumento.length === 1 ? "Una riga non ha" : `${senzaDocumento.length} righe non hanno`} il documento allegato`,
      spiega:
        "Il costo c'è in contabilità ma il file no. In una verifica un costo senza documento non si dimostra, e si perde insieme alla sua IVA. Aprile e allega il PDF o l'XML.",
      fatture: senzaDocumento,
    });
  }

  /*  ── ⚠️ L'IMPORTAZIONE SENZA IL SUO DOCUMENTO DOGANALE ────────────────
      Qui il programma NON sa quale riga sia la bolletta: non c'è un campo che
      lo dica, e inventarsi un abbinamento fra una fattura cinese e un
      documento doganale in base alle date sarebbe un accostamento sbagliato
      presentato come un fatto. Si guarda solo se in tutto il periodo c'è
      almeno una riga che parli di dogana, e si CHIEDE. */
  const importazioni = fornitori.filter((f) => regimeDi(f.regime ?? "italiana").inDogana);
  const pareDogana = /dogan|bolletta|adm\b|spedizioniere|customs/i;
  const c1 = fornitori.some((f) => pareDogana.test(`${f.fornitore} ${f.note ?? ""}`));
  if (importazioni.length > 0 && !c1) {
    fuori.push({
      chiave: "dogana",
      peso: "media",
      titolo: `${importazioni.length === 1 ? "C'è un'importazione" : `Ci sono ${importazioni.length} importazioni`} e nessun documento doganale`,
      spiega:
        "Sulla merce da fuori dall'Unione l'IVA si paga in dogana, e si detrae SOLO con il documento doganale — non con la fattura del fornitore. Se ce l'hai, caricalo come una fattura a parte con «IVA italiana in fattura»: è imposta che stai lasciando lì.",
      fatture: importazioni,
    });
  }

  //  Prima quello che vale soldi, poi quello che vale un documento.
  const peso = { alta: 3, media: 2, bassa: 1 };
  return fuori.sort((a, b) => peso[b.peso] - peso[a.peso]);
}

const TINTA: Record<Problema["peso"], string> = {
  alta: "border-rose-200 bg-rose-50/70",
  media: "border-amber-200 bg-amber-50/60",
  bassa: "border-slate-200 bg-slate-50",
};

export function DaSistemare({
  fornitori,
  righe,
  nostre,
  onApri,
}: {
  fornitori: FatturaFornitore[];
  righe: CostoContabile[];
  nostre?: { fatture: Fattura[]; azienda: DatiAzienda };
  /** Aprire la fattura per correggerla. ⚠️ Solo quelle scritte a mano si
   *  correggono: su una letta da un XML il pulsante non compare, come nella
   *  riga dell'elenco e per lo stesso motivo. */
  onApri: (f: FatturaFornitore) => void;
}) {
  //  ⚠️ Una volta sola: dentro ci gira `problemiXml` su tutte le fatture
  //   emesse del periodo, e questa scheda si ridisegna a ogni tasto premuto
  //   nelle finestre che le stanno accanto.
  const problemi = useMemo(
    () => problemiDelPeriodo(fornitori, righe, nostre),
    [fornitori, righe, nostre],
  );
  if (problemi.length === 0) return null;

  return (
    <div className="space-y-2">
      {problemi.map((p) => (
        <div
          key={p.chiave}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed",
            TINTA[p.peso],
          )}
        >
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {p.titolo}
          </p>
          <p className="mt-1 pl-[22px] text-muted-foreground">{p.spiega}</p>
          {p.emesse && p.emesse.length > 0 && (
            <ul className="mt-1.5 space-y-1 pl-[22px] text-[12px]">
              {p.emesse.slice(0, 8).map((e, i) => (
                <li key={i}>
                  <strong>{e.chi}</strong> — {e.perche}
                </li>
              ))}
              {p.emesse.length > 8 && (
                <li className="text-muted-foreground">e altre {p.emesse.length - 8}</li>
              )}
            </ul>
          )}
          {p.fatture.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[22px]">
              {p.fatture.slice(0, 12).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={!f.aMano}
                  onClick={() => onApri(f)}
                  title={
                    f.aMano
                      ? "Aprila e sistemala"
                      : "Questa viene da un XML: si sistema ricaricando il file giusto"
                  }
                  className={cn(
                    "max-w-[240px] truncate rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition",
                    f.aMano
                      ? "border-slate-300 bg-white text-slate-700 hover:border-slate-900"
                      : "cursor-default border-slate-200 bg-white/60 text-slate-400",
                  )}
                >
                  {f.fornitore}
                  {f.numero ? ` · n. ${f.numero}` : ""}
                </button>
              ))}
              {p.fatture.length > 12 && (
                <span className="self-center text-[11.5px] text-muted-foreground">
                  e altre {p.fatture.length - 12}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
