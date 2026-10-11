/** ── LA FATTURA DELL'ACCONTO, DAL PREVENTIVO ───────────────────────────────
 *
 *  Un pulsante sotto il preventivo appena emesso: si apre, si scrivono le tre o
 *  quattro cose che il preventivo non chiede — codice fiscale e residenza — e
 *  la fattura dell'acconto esce subito, con numero e data.
 *
 *  ── ⚠️ SI EMETTE PRIMA DELL'INCASSO, ED È UNA SCELTA DEL COMMITTENTE ──────
 *  Avevo costruito il contrario — una bozza qui, il numero all'arrivo dei soldi
 *  — e la ragione era che numero e data di una fattura sono un fatto fiscale.
 *  Il committente ha scelto diversamente, sapendolo. La conseguenza, scritta
 *  qui perché fra un anno non si debba ricostruirla: l'IVA di questa fattura è
 *  dovuta anche se il cliente non paga, e in quel caso si storna con una nota
 *  di credito.
 *  ⚠️ Quello che NON si scrive è di aver incassato: `dataPagamento` resta vuota
 *   finché i soldi non arrivano, e il foglio non stampa nessuna quietanza. La
 *   data dell'incasso si registra dopo, dalla pagina «Fatture».
 *
 *  ── ⚠️ SOLO L'ACCONTO, NON IL TOTALE ──────────────────────────────────────
 *  La cifra è quella che il cliente sta per versare adesso, non quella del
 *  preventivo: è una fattura di acconto, e fatturare il totale a fronte di
 *  cento euro incassati vorrebbe dire mettere a debito un'IVA su soldi che non
 *  sono arrivati. Il resto si fattura a saldo, quando arriva.
 *
 *  ── ⚠️ È UNA BOZZA: NIENTE NUMERO, NIENTE DATA ────────────────────────────
 *  Non tocca la numerazione e non entra in nessun registro. Numero e data
 *  nascono con l'incasso, dalla pagina «Fatture» del CRM — il perché per esteso
 *  sta in cima a crm/fatture/tipi.ts.
 *
 *  ── PERCHÉ QUI E NON SOLO NEL CRM ─────────────────────────────────────────
 *  Perché questo è l'unico momento in cui il cliente è raggiungibile: si sta
 *  intestando il preventivo, ha il telefono in mano, e chiedergli il codice
 *  fiscale costa dieci secondi. Chiederglielo tre settimane dopo per email
 *  costa due solleciti — e nel frattempo la fattura non si può fare.
 *
 *  ⚠️ NON SCRIVE DAL BROWSER. `app_config` è protetta da RLS e la chiave
 *   pubblica non ci può scrivere (provato: «new row violates row-level security
 *   policy»). Si passa da /api/presenter/fattura-bozza, dietro la stessa
 *   guardia delle altre azioni del presentatore.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Loader2, Receipt } from "lucide-react";

export interface ProfiloBozza {
  nome: string;
  cognome: string;
  email: string;
}

const CAMPI = [
  {
    k: "codiceFiscale",
    etichetta: "Codice fiscale",
    segno: "RSSMRA80A01F205X",
    largo: true,
    su: true,
  },
  { k: "indirizzo", etichetta: "Indirizzo", segno: "Via Verdi", largo: true, su: false },
  { k: "civico", etichetta: "Civico", segno: "3", largo: false, su: false },
  { k: "cap", etichetta: "CAP", segno: "20121", largo: false, su: false },
  { k: "comune", etichetta: "Comune", segno: "Milano", largo: false, su: false },
  { k: "provincia", etichetta: "Prov.", segno: "MI", largo: false, su: true },
] as const;

type Chiave = (typeof CAMPI)[number]["k"];

export function BozzaFattura({
  profilo,
  acconto,
  ref: rif,
  causale,
  formatPrice,
  inputCls,
  iniziali,
}: {
  profilo: ProfiloBozza;
  /** ⚠️ LA CIFRA CHE FINISCE IN FATTURA, ed è il TOTALE della pratica, non
   *  l'acconto: il nome del campo è rimasto quello di prima perché lo legge
   *  tutta questa schermata, ma la scelta è cambiata — la bozza copre l'intero
   *  preventivo, e quanto abbia versato davvero si dice emettendola. */
  acconto: number;
  /** La causale che il cliente si è trovato scritta sul preventivo. Arriva da
   *  fuori perché è UNA frase sola per tutta l'applicazione (shop/causale-
   *  bonifico): riscriverla qui vorrebbe dire dire al cliente, sulla stessa
   *  schermata, due cose diverse da copiare nel bonifico. */
  causale?: string;
  /** il numero dell'ordine: finisce nella causale, ed è lo stesso che il
   *  cliente scrive nel bonifico */
  ref: string;
  formatPrice: (n: number) => string;
  /** la classe dei campi della pagina: il pannello deve sembrare parte di lei */
  inputCls: string;
  /** ── QUELLO CHE È GIÀ STATO CHIESTO AL CLIENTE ─────────────────────────
   *  I dati di fatturazione raccolti insieme al preventivo (sezione «Il
   *  preventivo a tuo nome»). Se ci sono, questo pannello si apre già pieno e
   *  resta un tocco: è tutto il motivo per cui quei campi sono stati messi là.
   *  ⚠️ Facoltativo: aprendo un preventivo da un link salvato, di quei campi non
   *   si sa niente — e il pannello deve funzionare lo stesso, chiedendoli. */
  iniziali?: Partial<Record<Chiave, string>>;
}) {
  const [aperto, setAperto] = useState(false);
  const [dati, setDati] = useState<Record<Chiave, string>>({
    codiceFiscale: "",
    indirizzo: "",
    civico: "",
    cap: "",
    comune: "",
    provincia: "",
    ...(iniziali ?? {}),
  });
  //  ⚠️ Il codice si chiede SOLO se la sessione non basta. Chi ha già fatto
  //   l'accesso come presentatore non deve battere un PIN per un gesto di
  //   servizio: si prova, e il campo compare se il server dice di no.
  const [codice, setCodice] = useState("");
  const [serveCodice, setServeCodice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emessa, setEmessa] = useState<{ anno: number; numero: number } | null>(null);
  const [err, setErr] = useState("");

  const scrivi = (k: Chiave, v: string) =>
    setDati((d) => ({
      ...d,
      [k]: k === "codiceFiscale" || k === "provincia" ? v.toUpperCase() : v,
    }));

  const manca = CAMPI.filter((c) => !dati[c.k].trim()).map((c) => c.etichetta.toLowerCase());
  const senzaEmail = !profilo.email.trim();
  /** ⚠️ SENZA IL NUMERO DELL'ORDINE NON SI PREPARA NIENTE, ed è il difetto che
   *  si è visto sulla prima fattura vera: era uscita con causale «Conferma
   *  ordine» e basta, senza il codice. Quella causale è la stringa che il
   *  cliente copia nel bonifico ed è l'unico filo che lega il versamento al
   *  documento: senza il codice non lega a niente, e la riconciliazione si fa a
   *  mano cercando l'importo. Meglio un pulsante spento con scritto perché. */
  const senzaOrdine = !String(rif ?? "").trim();

  const salva = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const risposta = await fetch("/api/presenter/fattura-bozza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codice || undefined,
          ref: rif || undefined,
          //  ⚠️ SI ABBOZZA, NON SI EMETTE — e questo è un ritorno indietro
          //   deciso guardando il risultato. Emettendo qui usciva una fattura
          //   con numero e data mentre il bonifico non era ancora arrivato:
          //   un documento «da saldare» che nasce già in una serie. Il
          //   committente ha visto la prima e ha chiesto il contrario, ed è
          //   anche quello che regge meglio: numero e data arrivano quando si
          //   segna come pagata, dalla pagina «Fatture».
          emetti: false,
          email: profilo.email,
          importo: acconto,
          //  «unica» perché copre l'intera pratica: diventa «acconto» se
          //  emettendola si dichiara che il cliente ha versato solo una parte.
          tipo: "unica",
          cliente: {
            azienda: false,
            nome: profilo.nome,
            cognome: profilo.cognome,
            ...dati,
            nazione: "IT",
            codiceDestinatario: "0000000",
          },
        }),
      });
      const j = (await risposta.json()) as {
        ok?: boolean;
        reason?: string;
        error?: string;
        bozza?: { anno: number };
      };
      if (risposta.status === 401 || j.error === "auth") {
        setServeCodice(true);
        setErr("Serve il PIN o il codice consulente.");
        return;
      }
      if (!j.ok) {
        setErr(j.reason || "Non è stato salvato niente. Riprova.");
        return;
      }
      setEmessa({ anno: j.bozza?.anno ?? new Date().getFullYear(), numero: 0 });
      toast.success("Bozza di fattura pronta", {
        description: `Per l'acconto di ${formatPrice(acconto)}. Diventa una fattura vera quando la segni pagata, da «Fatture».`,
      });
    } catch {
      setErr("Errore di rete: non è stato salvato niente.");
    } finally {
      setBusy(false);
    }
  };

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="mt-3 flex w-full items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.025] px-4 py-2.5 text-left text-[13px] text-white/65 transition hover:border-white/25 hover:text-white print:hidden"
      >
        <Receipt className="h-3.5 w-3.5 text-white/45" />
        <span>
          Prepara la fattura di questo ordine
          {acconto > 0 ? ` · ${formatPrice(acconto)}` : ""}
        </span>
        <span className="ml-auto text-[11px] text-white/30">riservato al consulente</span>
      </button>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.02] print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.07] px-4 py-3">
        <span className="text-[13px] font-semibold text-white">Fattura di questo ordine</span>
        {/*  La cifra sta nell'intestazione e non in fondo: è l'unica cosa che
            distingue questo documento da quello che il cliente crede di
            firmare, e va letta prima di riempire i campi. */}
        <span className="text-[12px] text-white/45">
          solo l&apos;acconto di{" "}
          <b className="font-semibold text-white/80">{formatPrice(acconto)}</b>
          {rif ? ` · rif. ${rif}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="ml-auto text-[12px] text-white/45 underline-offset-2 hover:text-white hover:underline"
        >
          Chiudi
        </button>
      </div>

      {emessa ? (
        <div className="flex items-start gap-2.5 px-4 py-4 text-[13.5px] leading-relaxed text-emerald-100">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
          <span>
            Bozza pronta per <b className="font-semibold text-white">{formatPrice(acconto)}</b>, con
            la causale <b className="font-mono font-semibold text-white">{causale || `Conferma ordine - ${rif}`}</b>
            . La trovi in <b className="font-semibold text-white">Fatture</b>: diventa una fattura
            vera — con numero e data — quando la segni pagata.
          </span>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4">
          <p className="text-[12.5px] leading-relaxed text-white/55">
            Il preventivo chiede nome, email e telefono. Per la fattura servono anche queste, ed è
            adesso che è comodo chiederle — il cliente è ancora al telefono.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CAMPI.map((c) => (
              <label key={c.k} className={`block ${c.largo ? "col-span-2" : ""}`}>
                <span className="mb-1.5 block text-[13px] font-medium text-white/80">
                  {c.etichetta}
                </span>
                <input
                  value={dati[c.k]}
                  onChange={(e) => scrivi(c.k, e.target.value)}
                  placeholder={c.segno}
                  className={`${inputCls} ${c.su ? "uppercase" : ""}`}
                />
              </label>
            ))}
          </div>

          {serveCodice && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-white/80">
                PIN o codice consulente
              </span>
              <input
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void salva()}
              disabled={busy || manca.length > 0 || senzaEmail || senzaOrdine || acconto <= 0}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Prepara la fattura
            </button>
            {/*  Cosa manca si dice PRIMA, non dopo aver premuto: un modulo che
                accetta e poi rifiuta fa ribattere tutto. */}
            {senzaOrdine ? (
              <span className="text-[12.5px] text-amber-300/90">
                Prima va creato il preventivo: senza il suo numero la causale del bonifico non lega
                il versamento a niente.
              </span>
            ) : senzaEmail ? (
              <span className="text-[12.5px] text-amber-300/90">
                Prima serve l&apos;email del cliente, qui sopra.
              </span>
            ) : manca.length > 0 ? (
              <span className="text-[12.5px] text-white/45">Manca ancora: {manca.join(", ")}.</span>
            ) : null}
            {err && <span className="text-[12.5px] font-medium text-destructive">{err}</span>}
          </div>

          {/*  ⚠️ SI DICE PRIMA COSA SUCCEDE. Questo pulsante assegna un numero
              dentro una serie: da lì il documento esiste, e se il cliente non
              paga si storna con una nota di credito — non si cancella. Chi
              preme deve saperlo prima, non scoprirlo dal commercialista. */}
          <p className="text-[11.5px] leading-relaxed text-white/30">
            Non emette niente: nessun numero, nessuna data, nessun registro. Resta pronta in
            «Fatture» e diventa una fattura vera quando la segni{" "}
            <b className="text-white/50">pagata</b>.
          </p>
        </div>
      )}
    </div>
  );
}
