/** ── COMPORRE UNA FATTURA ──────────────────────────────────────────────────
 *
 *  Si apre da una scheda cliente, porta dentro tutto quello che il CRM sa già,
 *  e chiede SOLO quello che manca — che per un privato è quasi sempre il
 *  codice fiscale e l'indirizzo di residenza, perché quelli il CRM non li ha
 *  mai chiesti a nessuno.
 *
 *  ── DUE PULSANTI, E LA DIFFERENZA È TUTTA ────────────────────────────────
 *   · «Salva la bozza» — si può premere sempre, anche a metà. Non assegna
 *     niente e si può rifare mille volte.
 *   · «Emetti» — assegna numero e data. Da lì in poi il documento è in una
 *     serie, e da una serie non si toglie un numero senza lasciare un buco che
 *     qualcuno dovrà spiegare.
 *  ⚠️ PER QUESTO «EMETTI» CHIEDE CONFERMA E «SALVA LA BOZZA» NO. Non è
 *   simmetria mancata: è che i due gesti hanno conseguenze incomparabili.
 *
 *  ⚠️ E PER QUESTO IL NUMERO NON NASCE AL PREVENTIVO. La bozza si prepara
 *   quando si vuole — anche mentre si costruisce il preventivo, con il cliente
 *   davanti — e resta lì pronta. Numero e data arrivano quando arrivano i
 *   soldi. Il perché per esteso sta in cima a tipi.ts.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Calculator,
  FileCheck2,
  FileText,
  Info,
  Loader2,
  MessageCircle,
  Receipt,
  ScanLine,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampoIndirizzo } from "@/crm/CampoIndirizzo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "../whatsapp";
import { cosaManca, messaggioDatiFattura } from "./messaggio-dati";
//  Come ha pagato, che cosa chiedere di conseguenza, e dove si trova quel
//  dato: una regola sola, usata anche dal foglio e dall'XML.
import { causaleSuggerita, modoDi, type MetodoPagamento } from "./modi-di-incasso";
//  Il blocco «come ha pagato» è uno solo, per tutte le finestre delle fatture.
import { SceltaModoIncasso } from "./SceltaModoIncasso";
import { innestaDocumento, type DatiDocumento } from "./lettura-documento";
import { intestazioniCRM } from "@/crm/AuthContext";
//  La causale del bonifico: una frase sola per tutta l'applicazione, così
//  l'acconto in fattura combacia con quello che il cliente ha copiato.
import { causaleDi } from "@/shop/causale-bonifico";
//  Quale preventivo cita questa fattura: la regola sta con le altre dei
//  preventivi, ed è la stessa che usa l'elenco (crm/preventivi/dati).
import { leggiPreventiviDelLead, preventivoDaCitare, type RigaPreventivo } from "@/crm/preventivi/dati";
import { leggiCondizioni } from "@/shop/condizioni-preventivo";
import {
  cfValido,
  combaciaConNome,
  datiDaCodiceFiscale,
  normalizzaCF,
} from "@/crm/codice-fiscale";
import { dataInChiaro } from "@/crm/DatiAnagrafici";
import { useCRM } from "../CRMContext";
import { eur } from "../ui";
import {
  CLASSE_CAMPO,
  CampoFinestra,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
} from "../ui/Finestra";
import {
  giaIncassato,
  giornoISO,
  leggiEuro,
  nomeCompleto,
  prezzoVendita,
  saldoAllaConsegna,
  scriviEuro,
} from "../InstallationScheduleDialog";
import type { Lead, LeadData } from "../types";
import {
  emetti as emettiInArchivio,
  eliminaBozza,
  leggiAzienda,
  leggiBozzaDi,
  leggiEmesse,
  mancanzeAzienda,
  prossimoNumero,
  salvaBozza,
} from "./archivio";
import { contoDaLordo, tipoProposto } from "./conti";
import {
  AZIENDA_VUOTA,
  CLIENTE_VUOTO,
  type ClienteFattura,
  type DatiAzienda,
  type Fattura,
} from "./tipi";

/** ── LA CAUSALE ────────────────────────────────────────────────────────────
 *  ⚠️ È COMMERCIALE, NON CONTABILE, ed è una richiesta esplicita del
 *   committente: sul foglio che legge il cliente non si vuole la parola
 *   «acconto», che suona come «hai pagato solo una parte». «Conferma d'ordine»
 *   dice la stessa cosa dal lato che interessa a lui — l'ordine è partito.
 *  ⚠️ MA L'IMPORTO RESTA QUELLO INCASSATO e il tipo resta scritto in archivio
 *   (`tipo: "acconto"`): la causale è come si racconta l'operazione, non cosa
 *   l'operazione è. Serve al saldo, che deve sapere quanto è già stato
 *   fatturato per non fatturarlo una seconda volta. */
/** Il modello della causale nella fotografia di quel preventivo, se c'è. */
function leggiModelloDalleCondizioni(grezzo: unknown): string {
  const c = leggiCondizioni(typeof grezzo === "string" ? grezzo : null);
  return String(c?.listino?.causale ?? "");
}

function causalePredefinita(tipo: Fattura["tipo"], rif: string, delPreventivo?: string): string {
  /*  ── ⚠️ SE QUEL PREVENTIVO HA UNA CAUSALE SUA, COMANDA LEI ────────────
      Richiesta del committente: «fai che posso cambiare la causale del
      preventivo». Da quando si può, la frase che il cliente copia nel bonifico
      non è più per forza «Conferma ordine - IDXXXXX»: può essere quella decisa
      nel listino o quella scritta a mano per quel documento. Se qui restasse
      la frase fissa, l'acconto in fattura non combacerebbe più con il
      versamento — che è esattamente il legame per cui questa funzione esiste.
      Vale solo per l'acconto: il saldo racconta un'altra operazione. */
  if (tipo === "acconto" && String(delPreventivo || "").trim()) return String(delPreventivo).trim();
  //  ⚠️ «Ordine IDXXXXX» E NON «rif. preventivo IDXXXXX»: è la stessa dicitura
  //   che il cliente ha già scritto nella causale del suo bonifico («Conferma
  //   ordine - IDQY6EF»). Le due frasi devono combaciare parola per parola,
  //   perché è così che chi riconcilia l'estratto conto lega il versamento alla
  //   fattura senza doverci pensare.
  //  ⚠️ E il trattino è quello DRITTO, non il lungo: il tracciato della fattura
  //   elettronica non ammette i segni tipografici (vedi `latino` in xml.ts).
  //  Sull'acconto la causale è IDENTICA a quella del bonifico, non una sua
  //  parafrasi: «Conferma ordine - IDQY6EF» di qua e di là. Un «Ordine» in più
  //  la faceva leggere «Conferma ordine - Ordine IDQY6EF», che oltre a essere
  //  ridondante spezza proprio la corrispondenza che serve a riconciliare.
  if (tipo === "acconto") return rif ? `Conferma ordine - ${rif}` : "Conferma ordine";
  const riferimento = rif ? ` - Ordine ${rif}` : "";
  if (tipo === "saldo") return `Saldo fornitura impianto su misura${riferimento}`;
  return `Fornitura impianto su misura${riferimento}`;
}

const dataLunga = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
};

/** ── LE DESCRIZIONI PRONTE ─────────────────────────────────────────────────
 *  La prima è la predefinita: «Fornitura impianto capillare», scelta dal
 *  committente — è come il centro chiama il suo prodotto. Nomina il bene, che è
 *  quello che un commercialista si aspetta di leggere: una descrizione generica
 *  («Prestazione», «Servizio») su una fattura da migliaia di euro è la prima
 *  riga su cui si ferma un controllo.
 *
 *  ⚠️ NON C'È QUELLA DEL TRAPIANTO, e non è una dimenticanza: il trapianto è
 *   un'altra operazione — una prestazione eseguita da una clinica terza — e ha
 *   un trattamento fiscale suo, che non è quello della fornitura di una
 *   protesi. Prepararne una qui vorrebbe dire suggerire una riga che si decide
 *   col commercialista, non che si sceglie da una tendina.
 *  ⚠️ E L'ALIQUOTA VA CON LA DESCRIZIONE: una protesi può ricadere in casi ad
 *   aliquota ridotta. Qui non si tocca niente — l'aliquota sta nelle
 *   impostazioni — ma è il motivo per cui questa riga non si sceglie a caso. */
const DESCRIZIONI = [
  //  ⚠️ «Fornitura impianto capillare», scelta del committente: è come il
  //   centro chiama il suo prodotto, ed è la formula che comparirà su tutte le
  //   fatture. Le altre restano per i casi in cui l'operazione è un'altra.
  "Fornitura impianto capillare",
  "Fornitura e applicazione di impianto capillare",
  "Manutenzione e rigenerazione di impianto capillare",
  //  ⚠️ QUESTA NON È UN SINONIMO DELLE ALTRE, ed è l'unica scelta di questo
  //   elenco che cambia COSA si sta fatturando. Va usata se i cento euro sono
  //   il compenso della consulenza — un servizio che si è già reso, e che
  //   resta dovuto anche se il cliente poi non compra. Se invece sono un
  //   anticipo sull'impianto, l'operazione è la fornitura e la descrizione
  //   giusta è la prima: dirla «consulenza» scriverebbe sul documento
  //   un'operazione diversa da quella avvenuta, e al saldo i conti non
  //   tornerebbero (l'acconto non si scomputerebbe da niente).
  "Prestazione di consulenza",
];

/** Le tre formule, accorciate per stare su una pastiglia. La riga intera si
 *  legge passandoci sopra e si vede nel campo appena si preme. */
const CORTE = ["Fornitura", "Con applicazione", "Manutenzione", "Consulenza"];

/** Quello che il CRM sa già del cliente. Il resto lo chiede la finestra. */
function clienteDalLead(l: Lead): ClienteFattura {
  const d = l.data ?? {};
  const res = d.residenza ?? {};
  return {
    ...CLIENTE_VUOTO,
    nome: String(d.nome ?? "").trim(),
    cognome: String(d.cognome ?? "").trim(),
    /** ── ⚠️ QUELLO CHE LA SCHEDA SA GIÀ NON SI RICHIEDE ──────────────────
     *  Codice fiscale e residenza adesso vivono sul lead (vedi
     *  crm/DatiAnagrafici): se ci sono, la fattura parte compilata. Prima
     *  stavano solo dentro la bozza, e chi fatturava la seconda volta li
     *  ribatteva da capo — guardando la stessa tessera sanitaria. */
    codiceFiscale: String(d.codiceFiscale ?? "").trim().toUpperCase(),
    indirizzo: String(res.indirizzo ?? "").trim(),
    cap: String(res.cap ?? "").trim(),
    //  La residenza vince sulla città del primo contatto: la seconda è un
    //  campo scritto a voce al telefono, la prima è un dato anagrafico.
    comune: String(res.comune ?? "").trim() || String(d.citta ?? "").trim(),
    provincia: String(res.provincia ?? "").trim().toUpperCase(),
  };
}

export function FinestraFattura({
  lead,
  aperta,
  onCambio,
  onFatta,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** chiamata dopo un'emissione riuscita: serve all'elenco per ricaricarsi */
  onFatta?: (f: Fattura) => void;
}) {
  const { updateLead } = useCRM();
  const [azienda, setAzienda] = useState<DatiAzienda>(AZIENDA_VUOTA);
  const [cliente, setCliente] = useState<ClienteFattura>(CLIENTE_VUOTO);
  const [tipo, setTipo] = useState<Fattura["tipo"]>("acconto");
  const [testoImporto, setTestoImporto] = useState("");
  const [causale, setCausale] = useState("");
  /*  ── COME HA PAGATO ─────────────────────────────────────────────────────
      Segnalazione del committente: «se il cliente paga con il POS SumUp e devo
      emettere fattura, mi dice di mettere la causale: cosa ci metto?».
      La «causale» è la parola del BONIFICO — la frase che il cliente copia nel
      pagamento perché la banca ce lo faccia riconoscere — e al POS non esiste.
      Qui si sceglie come ha pagato, e da quella scelta discendono: il dato da
      chiedere (con la guida che dice dove trovarlo), l'etichetta della causale,
      la riga sul foglio e il codice nel file dell'Agenzia. */
  const [metodo, setMetodo] = useState<MetodoPagamento>("bonifico");
  const [riferimento, setRiferimento] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [inCorso, setInCorso] = useState<"bozza" | "emetti" | null>(null);
  const [conferma, setConferma] = useState(false);
  /** ── IL GIORNO IN CUI I SOLDI SONO ARRIVATI ────────────────────────────
   *  Richiesta del committente: emettendo, si dichiara quando il pagamento è
   *  stato ricevuto — e da lì viene la data della fattura.
   *  ⚠️ NON È «OGGI», e non è un dettaglio: la data di una fattura immediata è
   *   quella dell'operazione, e per un acconto l'operazione è l'incasso. Chi
   *   vede il bonifico venerdì e si siede a fatturare lunedì deve poter mettere
   *   venerdì — ha dodici giorni per trasmettere allo SDI, non deve inventare
   *   una data comoda.
   *  Si propone oggi perché nove volte su dieci è oggi, e si corregge. */
  const [dataIncasso, setDataIncasso] = useState(giornoISO());
  const [numeroInAttesa, setNumeroInAttesa] = useState(0);
  const [bozzaEsistente, setBozzaEsistente] = useState<Fattura | null>(null);
  /** ⚠️ A QUESTO CLIENTE È GIÀ STATO FATTURATO UN ACCONTO? Serve a un avviso
   *  solo, ma è l'avviso che evita di far finire lo stesso imponibile due volte
   *  in contabilità — un errore che non si vede a schermo e si scopre a fine
   *  anno. Si legge dalle fatture EMESSE e non da `lead.data.fatture`: là ci
   *  sono i numeri, non i tipi. */
  const [accontoGiaFatturato, setAccontoGiaFatturato] = useState(false);

  const versato = giaIncassato(lead);
  const resta = saldoAllaConsegna(lead);
  //  Il numero del preventivo da cui nasce questa vendita: finisce nella
  //  causale, ed è il filo che lega il documento contabile a quello commerciale.
  /*  ── ⚠️ IL PREVENTIVO NON SI CERCA IN UN CAMPO SOLO ────────────────────
      Qui c'era `lead.data.quoteRef` e basta. Misurato in archivio: su 71
      preventivi solo 19 hanno quel campo, quindi per tre fatture su quattro
      il numero del preventivo non usciva affatto — e senza numero il bonifico
      del cliente non si lega più al documento.
      Adesso si cerca con la stessa regola dell'elenco (riferimento dichiarato,
      poi le ultime nove cifre del telefono), si dice a schermo QUALE si è
      preso, e se ce n'è più d'uno lo si può cambiare: una fattura che cita il
      documento sbagliato è peggio di una senza numero. */
  const [preventivi, setPreventivi] = useState<RigaPreventivo[]>([]);
  const [rifScelto, setRifScelto] = useState("");
  useEffect(() => {
    if (!aperta) return;
    let vivo = true;
    setRifScelto("");
    void leggiPreventiviDelLead(lead).then((righe) => { if (vivo) setPreventivi(righe); });
    return () => { vivo = false; };
  }, [aperta, lead]);
  const citato = useMemo(() => preventivoDaCitare(lead, preventivi), [lead, preventivi]);
  const rif = rifScelto || citato?.q.quote_ref || String(lead.data.quoteRef ?? "");
  /*  La causale del preventivo collegato: quella che il cliente si è trovato
      scritta e che ha copiato nel bonifico. Si chiede quando la finestra si
      apre, e serve a far combaciare l'acconto in fattura col versamento. */
  const [causaleDelPreventivo, setCausaleDelPreventivo] = useState("");
  useEffect(() => {
    if (!aperta || !rif) return;
    let vivo = true;
    fetch(`/api/public/quote?ref=${encodeURIComponent(rif)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo || !j?.ok) return;
        //  Il MODELLO diventa la frase con dentro il numero: è quella che il
        //  cliente ha davvero copiato.
        const q = (j.quote ?? {}) as { nome?: string; cognome?: string; total?: number; quote_ref?: string };
        setCausaleDelPreventivo(
          causaleDi({
            modello: typeof j.causale === "string" ? j.causale : leggiModelloDalleCondizioni(j.condizioni),
            numero: String(q.quote_ref ?? rif),
            nome: [q.nome, q.cognome].filter(Boolean).join(" ").trim(),
            totale: eur(Number(q.total) || 0),
          }),
        );
      })
      .catch(() => { /* resta la frase di sempre */ });
    return () => { vivo = false; };
  }, [aperta, rif]);

  // ── COSA MANCA, E COME CHIEDERLO ────────────────────────────────────────
  //  Si guarda `cliente`, cioè quello che c'è nel modulo ADESSO: se il
  //  presentatore sta scrivendo il codice fiscale mentre la finestra è aperta,
  //  l'avviso deve sparire mentre lo scrive, non al prossimo salvataggio.
  const mancanzeCliente = useMemo(() => cosaManca(cliente), [cliente]);
  const telefonoCliente = String(lead.data.telefono ?? "").trim();

  /** ── ⚠️ LA FOTOGRAFIA DEL DOCUMENTO RIEMPIE I CAMPI ───────────────────
   *  Richiesta del committente. Il codice fiscale battuto a mano è il campo
   *  che si sbaglia più spesso di tutto il gestionale — sedici caratteri senza
   *  senso, letti da una tessera storta, ricopiati mentre si è al telefono — e
   *  una fattura con un codice fiscale sbagliato la scarta lo SDI giorni dopo,
   *  quando quella persona non risponde più.
   *  ⚠️ La fotografia NON si salva da nessuna parte: è un documento
   *   d'identità. Arriva, si legge, si butta (vedi routes/api.crm.documento).
   *  ⚠️ E si riduce PRIMA di partire: l'originale a piena risoluzione non
   *   lascia il telefono, e su una rete di casa quella differenza è fra due
   *   secondi e venti.
   */
  const inputDocumento = useRef<HTMLInputElement | null>(null);
  const [leggoDocumento, setLeggoDocumento] = useState(false);

  const leggiComeDataUrl = (file: File): Promise<string> =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result || ""));
      r.onerror = () => no(new Error("Non riesco a leggere il file"));
      r.readAsDataURL(file);
    });

  const rimpicciolisci = async (file: File, lato = 1400, gradi = 0): Promise<string> => {
    /** ⚠️ `imageOrientation: "from-image"` — una foto scattata col telefono
     *  di lato porta l'orientamento in un'etichetta EXIF, non nei pixel:
     *  senza questa riga finisce nella tela girata di novanta gradi, e il
     *  modello si trova a leggere un codice fiscale in verticale. */
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scala = Math.min(1, lato / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scala);
    const h = Math.round(bitmap.height * scala);
    const tela = document.createElement("canvas");
    //  Girata di un quarto, la tela scambia i lati: disegnarla con le misure
    //  di prima taglierebbe il documento invece di raddrizzarlo.
    const quarto = gradi === 90 || gradi === 270;
    tela.width = quarto ? h : w;
    tela.height = quarto ? w : h;
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("Il browser non riesce a leggere la foto");
    if (gradi) {
      ctx.translate(tela.width / 2, tela.height / 2);
      ctx.rotate((gradi * Math.PI) / 180);
      ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(bitmap, 0, 0, w, h);
    }
    bitmap.close?.();
    //  Qualità alta: qui si deve leggere un codice fiscale, non riconoscere una
    //  faccia. Comprimendo come una foto qualunque, «8» e «B» diventano la
    //  stessa macchia.
    return tela.toDataURL("image/jpeg", 0.92);
  };

  /** Un tentativo: manda quello che c'è e torna quello che ha letto. */
  const provaLettura = async (
    file: string[],
  ): Promise<{ ok?: boolean; errore?: string; dati?: DatiDocumento }> => {
    const r = await fetch("/api/crm/documento", {
      method: "POST",
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file }),
    });
    return (await r.json()) as { ok?: boolean; errore?: string; dati?: DatiDocumento };
  };

  const leggiDocumento = async (scelti?: FileList | null) => {
    const files = Array.from(scelti ?? []).slice(0, 6);
    if (files.length === 0) return;
    setLeggoDocumento(true);
    try {
      /** ⚠️ I PDF si mandano COM'È: una tela non li sa disegnare, e provarci
       *  darebbe un rettangolo bianco. Le immagini invece si riducono qui —
       *  l'originale a piena risoluzione non lascia il telefono. */
      const pronti = await Promise.all(
        files.map((f) =>
          f.type === "application/pdf" ? leggiComeDataUrl(f) : rimpicciolisci(f),
        ),
      );
      let j = await provaLettura(pronti);
      /** ── ⚠️ SE NON HA LETTO NIENTE, SI RIPROVA GIRANDO ─────────────────
       *  Una tessera fotografata di traverso è il caso normale, non
       *  l'eccezione: si appoggia sul tavolo e si scatta da sopra, e quale sia
       *  l'alto lo decide come si teneva il telefono. Il modello legge bene in
       *  orizzontale e in verticale, ma su un documento girato di novanta
       *  gradi a volte non trova niente. Un secondo tentativo con l'immagine
       *  raddrizzata costa una chiamata e salva la lettura.
       *  ⚠️ Solo per le immagini e solo se il primo giro è tornato a mani
       *   vuote: girare un PDF non si può, e ripetere una lettura riuscita
       *   sarebbe credito speso per niente. */
      const soloImmagini = files.every((f) => f.type !== "application/pdf");
      if ((!j?.ok || !j.dati) && soloImmagini) {
        for (const gradi of [90, 270]) {
          const girati = await Promise.all(files.map((f) => rimpicciolisci(f, 1400, gradi)));
          j = await provaLettura(girati);
          if (j?.ok && j.dati) break;
        }
      }
      if (!j?.ok || !j.dati) {
        toast.error("Non ho letto il documento", { description: j?.errore });
        return;
      }
      //  ⚠️ Si riempie solo quello che è VUOTO, mai sopra a quello che c'è già:
      //   vedi `innestaDocumento`, con le sue prove. Chi ha scritto un dato può
      //   averlo corretto apposta, e vederselo riscrivere da una fotografia è
      //   il modo più veloce per smettere di fidarsi del pulsante.
      const esito = innestaDocumento(cliente, j.dati);
      setCliente((c) => ({ ...c, ...esito.dati }));
      if (esito.riempiti.length === 0 && esito.giaPresenti.length === 0) {
        toast.info("Dal documento non è arrivato niente di nuovo");
      } else {
        const da = j.dati.documenti?.length ? ` (da ${j.dati.documenti.join(" e ")})` : "";
        toast.success(
          esito.riempiti.length
            ? `Ho riempito ${esito.riempiti.join(", ")}${da}`
            : `I campi erano già compilati${da}`,
          {
            //  Quello che NON è entrato si dice: un dato letto e scartato in
            //  silenzio è una discrepanza che si scopre dal commercialista.
            description: esito.giaPresenti.length
              ? `Sul documento risulta un altro ${esito.giaPresenti.join(", ")}: controlla tu.`
              : undefined,
          },
        );
      }
    } catch (e) {
      toast.error("Lettura interrotta", { description: String((e as Error).message || e) });
    } finally {
      setLeggoDocumento(false);
      //  ⚠️ Si azzera il campo del file: senza, ricaricando LA STESSA
      //   fotografia il browser non scatta nessun evento e il tasto sembra
      //   rotto.
      if (inputDocumento.current) inputDocumento.current.value = "";
    }
  };

  /** Il tasto che apre la fotocamera (o la galleria) e legge il documento.
   *  ⚠️ `capture` NON è impostato: su un telefono aprirebbe la fotocamera
   *   saltando la galleria, e nove volte su dieci la tessera è già una foto
   *   ricevuta in chat. Il telefono offre da sé «Fotocamera» come prima voce. */
  const TastoDocumento = ({ compatto }: { compatto?: boolean }) => (
    <>
      <input
        ref={inputDocumento}
        type="file"
        //  ⚠️ Anche i PDF e anche HEIC: la tessera fotografata col telefono
        //   arriva come immagine, quella mandata dal commercialista o
        //   scaricata dallo SPID arriva come PDF, e un iPhone di serie salva
        //   in HEIC. Chiedere di convertire vuol dire non usare il tasto.
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => void leggiDocumento(e.target.files)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={leggoDocumento}
        onClick={() => inputDocumento.current?.click()}
        title="Tessera sanitaria, carta d'identità, patente o passaporto — foto o PDF, anche più file insieme. Capisce da sé cos'è e riempie i campi"
        className={compatto ? "h-7 px-2 text-[11.5px]" : undefined}
      >
        {leggoDocumento ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanLine className="mr-1 h-3.5 w-3.5" />
        )}
        {leggoDocumento ? "Leggo…" : compatto ? "Da documento" : "Leggi dal documento"}
      </Button>
    </>
  );

  /** ── ⚠️ «CALCOLA» LEGGE IL CODICE E AGGIORNA LA SCHEDA ────────────────
   *  Richiesta del committente. Fa tre cose, e vale la pena dire quale NON fa:
   *   · tira fuori dal codice quello che ci sta dentro per intero — nascita,
   *     età, sesso;
   *   · CONTROLLA nome e cognome (dal codice non si ricavano: porta solo tre
   *     consonanti per uno, e da «RSS» si torna a Rossi come a Russo), e se
   *     non combaciano lo dice PRIMA che la fattura parta intestata male;
   *   · riporta tutto sulla scheda del cliente, residenza compresa: così la
   *     prossima fattura parte già compilata, e chi apre la scheda per
   *     telefonare vede l'età di chi ha davanti.
   *  ⚠️ Non tocca nome e cognome: se il codice dice un'altra cosa, quale dei
   *   due sia sbagliato lo decide chi guarda. */
  const [esitoCF, setEsitoCF] = useState<{ tono: "ok" | "avviso"; testo: string } | null>(null);

  /** ── ⚠️ QUELLO CHE SI SCRIVE QUI FINISCE SULLA SCHEDA DEL CLIENTE ─────
   *  Richiesta del committente: l'indirizzo (e il resto) battuto mentre si
   *  prepara la fattura deve tornare sul LEAD, non restare chiuso dentro la
   *  bozza. Chi apre la scheda per telefonare, o chi rifattura fra due mesi,
   *  deve trovarlo lì.
   *
   *  ⚠️ NON SI AZZERA NIENTE. Un campo vuoto in questa finestra vuol dire «non
   *   l'ho scritto», non «cancellalo dalla scheda»: scrivere il vuoto sopra un
   *   indirizzo già noto lo farebbe sparire senza che nessuno se ne accorga.
   *  ⚠️ NOME E COGNOME SOLO SE MANCANO sulla scheda. Sono l'identità del lead,
   *   e in fattura possono essere scritti diversamente (un secondo nome, un
   *   cognome da coniugata): riscriverli sopra vorrebbe dire far cambiare nome
   *   a una persona da una finestra che parla di soldi.
   *  ⚠️ E SI SCRIVE SOLO SE È CAMBIATO QUALCOSA rispetto all'ultima volta: una
   *   scrittura per battuta riempirebbe il diario della scheda di modifiche
   *   che nessuno ha fatto.
   */
  const ultimoRiporto = useRef("");

  const datiPerLaScheda = (): Partial<LeadData> => {
    const d = lead.data ?? {};
    const res = d.residenza ?? {};
    const residenza = {
      ...res,
      ...(cliente.indirizzo?.trim() ? { indirizzo: cliente.indirizzo.trim() } : {}),
      ...(cliente.cap?.trim() ? { cap: cliente.cap.trim() } : {}),
      ...(cliente.comune?.trim() ? { comune: cliente.comune.trim() } : {}),
      ...(cliente.provincia?.trim() ? { provincia: cliente.provincia.trim().toUpperCase() } : {}),
    };
    const cf = normalizzaCF(cliente.codiceFiscale || "");
    const anagrafe = cfValido(cf) ? datiDaCodiceFiscale(cf) : null;
    return {
      ...(cf ? { codiceFiscale: cf } : {}),
      ...(anagrafe?.dataNascita ? { dataNascita: anagrafe.dataNascita } : {}),
      ...(typeof anagrafe?.eta === "number" ? { eta: anagrafe.eta } : {}),
      ...(anagrafe?.sesso ? { sesso: anagrafe.sesso } : {}),
      ...(Object.keys(residenza).length ? { residenza } : {}),
      //  La città del primo contatto si riempie solo se era vuota: è un campo
      //  scritto a voce al telefono, e non deve contraddire la residenza.
      ...(!String(d.citta ?? "").trim() && cliente.comune?.trim()
        ? { citta: cliente.comune.trim() }
        : {}),
      ...(!String(d.nome ?? "").trim() && cliente.nome?.trim() ? { nome: cliente.nome.trim() } : {}),
      ...(!String(d.cognome ?? "").trim() && cliente.cognome?.trim()
        ? { cognome: cliente.cognome.trim() }
        : {}),
    };
  };

  const riportaSullaScheda = () => {
    //  Su una fattura a un'azienda non c'è niente di anagrafico da riportare:
    //  la ragione sociale e la partita IVA sono dell'azienda, non della persona
    //  che sta nella scheda.
    if (cliente.azienda) return;
    const dati = datiPerLaScheda();
    if (Object.keys(dati).length === 0) return;
    const firma = JSON.stringify(dati);
    if (firma === ultimoRiporto.current) return;
    ultimoRiporto.current = firma;
    void updateLead(lead.id, dati);
  };

  const calcolaDalCodice = () => {
    const cf = normalizzaCF(cliente.codiceFiscale || "");
    const d = datiDaCodiceFiscale(cf);
    if (!d.valido) {
      setEsitoCF({
        tono: "avviso",
        testo:
          cf.length === 16
            ? "Questo codice fiscale non torna: di solito è un carattere letto male (0 e O, 1 e I)."
            : "Un codice fiscale è di sedici caratteri.",
      });
      return;
    }
    setCliente((c) => ({ ...c, codiceFiscale: cf }));
    const combacia = combaciaConNome(cf, cliente.nome || "", cliente.cognome || "");
    const nato = d.dataNascita
      ? `Nato${d.sesso === "F" ? "a" : ""} il ${dataInChiaro(d.dataNascita)}`
      : "";
    const riga = [nato, typeof d.eta === "number" ? `${d.eta} anni` : ""].filter(Boolean).join(" · ");
    setEsitoCF(
      combacia === "no"
        ? {
            tono: "avviso",
            testo: `${riga}. ⚠️ Il codice NON corrisponde a ${cliente.nome} ${cliente.cognome}: controlla quale dei due è sbagliato.`,
          }
        : {
            tono: "ok",
            testo: `${riga}${combacia === "si" ? " · il codice corrisponde al nome" : ""} · riportato sulla scheda`,
          },
    );
    //  Il riporto sulla scheda è quello di sempre (vedi `riportaSullaScheda`):
    //  una seconda versione qui vorrebbe dire due idee di cosa si scrive sul
    //  lead, e la differenza si scoprirebbe su un indirizzo sbagliato.
    riportaSullaScheda();
  };

  const chiediSuWhatsApp = () => {
    /** ⚠️ Il messaggio dice DI CHE FATTURA si tratta, e lo dice dai numeri di
     *  questa finestra: il tipo scelto qui accanto, l'importo che si sta per
     *  fatturare e il prezzo pieno della pratica. «Sto preparando la tua
     *  fattura» scritto a chi ha versato un acconto fa una promessa che il
     *  documento non mantiene — quando arriva, l'importo non è quello della
     *  pratica e il cliente chiama per chiedere se c'è un errore. */
    const testo = messaggioDatiFattura(cliente, azienda.denominazione || undefined, {
      tipo,
      importo: leggiEuro(testoImporto),
      prezzo: prezzoVendita(lead),
    });
    //  ⚠️ `buildWhatsAppLink` e non un indirizzo scritto a mano: è la stessa
    //   funzione di tutti gli altri tasti WhatsApp del gestionale, e sa già
    //   che wa.me vuole il numero senza «+» né spazi. Due idee diverse di
    //   cos'è un numero valido vorrebbero dire un tasto che a volte apre la
    //   chat sbagliata.
    const url = telefonoCliente
      ? buildWhatsAppLink(telefonoCliente, testo)
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  //  ── ALL'APERTURA ────────────────────────────────────────────────────────
  //   Si legge chi emette, si riprende la bozza se c'era, e si propone tutto il
  //   resto. ⚠️ La bozza VINCE sulle proposte: se qualcuno ha già scritto il
  //   codice fiscale di questa persona, riproporre i campi vuoti glielo farebbe
  //   riscrivere — e la seconda volta lo si copia peggio.
  useEffect(() => {
    if (!aperta) return;
    let vivo = true;
    setInCorso(null);
    setConferma(false);
    setDataIncasso(giornoISO());
    void (async () => {
      const [a, bozza] = await Promise.all([leggiAzienda(), leggiBozzaDi(lead.id)]);
      if (!vivo) return;
      setAzienda(a);
      setBozzaEsistente(bozza);
      if (bozza) {
        setCliente(bozza.cliente);
        setTipo(bozza.tipo);
        setTestoImporto(scriviEuro(bozza.totale));
        setCausale(bozza.causale);
        setMetodo(bozza.metodoPagamento ?? "bonifico");
        setRiferimento(bozza.riferimentoPagamento ?? "");
        setDescrizione(bozza.righe[0]?.descrizione ?? "");
      } else {
        setCliente(clienteDalLead(lead));
        //  ⚠️ La proposta la fa `tipoProposto` (crm/fatture/conti), con le sue
        //   prove: la vecchia riga guardava solo quanto restava da incassare, e
        //   su una pratica senza prezzo scritto quel numero è zero — quindi
        //   proponeva «saldo» a chi aveva versato soltanto l'acconto.
        setTipo(tipoProposto({ versato, prezzo: prezzoVendita(lead) }));
        setTestoImporto(scriviEuro(versato > 0 ? versato : prezzoVendita(lead)));
        setCausale("");
        setMetodo("bonifico");
        setRiferimento("");
        setDescrizione("");
      }
      const [n, gia] = await Promise.all([
        prossimoNumero(a, new Date().getFullYear()),
        leggiEmesse(),
      ]);
      if (!vivo) return;
      if (n.ok) setNumeroInAttesa(n.numero);
      if (gia.ok) {
        const giaFatturato = gia.lista.some((f) => f.leadId === lead.id && f.tipo === "acconto");
        setAccontoGiaFatturato(giaFatturato);
        /** ⚠️ La risposta arriva DOPO la proposta di sopra, e cambia la
         *  risposta giusta: «saldo» ha senso solo dopo una fattura di acconto.
         *  Si corregge solo se non c'era una bozza — quella l'ha scritta una
         *  persona — e solo verso «saldo», cioè quando si è scoperto qualcosa
         *  che prima non si sapeva. */
        if (!bozza && giaFatturato) {
          setTipo("saldo");
          const resto = saldoAllaConsegna(lead);
          if (resto > 0) setTestoImporto(scriviEuro(resto));
        }
      }
    })();
    //  ⚠️ La fotografia di com'era all'apertura si azzera QUI e si riprende al
    //   primo disegno con i campi pieni (vedi l'effetto qui sotto): presa
    //   adesso fotograferebbe lo stato vuoto, e qualunque cosa arrivasse dopo
    //   — comprese le proposte che mette il programma da solo — sembrerebbe
    //   una modifica di chi guarda.
    partenza.current = "";
    return () => {
      vivo = false;
    };
  }, [aperta, lead, versato, resta]);

  //  La causale si propone in base al tipo, ma NON si riscrive sopra a quella
  //  battuta a mano: chi l'ha corretta l'ha corretta apposta.
  /*  ⚠️ LA PROPOSTA CAMBIA CON IL MODO DI INCASSO, quello che si è scritto a
      mano no: sul bonifico resta la frase che il cliente ha copiato nel
      pagamento (toccarla romperebbe il filo con l'accredito in banca), al POS
      e in contanti diventa la descrizione dell'operazione — che è quello che
      la causale è davvero quando non c'è nessun bonifico da riconoscere. */
  const modoScelto = modoDi(metodo);
  const causaleProposta = causaleSuggerita({
    metodo,
    base: causalePredefinita(tipo, rif, causaleDelPreventivo),
    riferimento,
  });
  const causaleFinale = causale.trim() || causaleProposta;
  /** ── COSA C'È SCRITTO SULLA FATTURA ────────────────────────────────────
   *  ⚠️ QUI IL RIPIEGO ERA `payment.prodotto`, ED ERA UNA BOMBA A OROLOGERIA.
   *   Sulla carta quel campo è «il prodotto»; nei dati veri di questo CRM
   *   contiene gli appunti della consulenza. Uno dei due valori presenti in
   *   archivio, parola per parola: «53 anni marittimo 16 x 26 x 19 90% densità
   *   … ha malattia a lavoro per il video … 2 IMPIANTI». Quella riga sarebbe
   *   finita pari pari sulla fattura del cliente e dentro l'XML del
   *   commercialista: età, mestiere, misure della testa e uno stato di salute.
   *   Non è un difetto di forma, è un dato personale su un documento che gira.
   *   Il campo resta dov'è per chi lo usa come promemoria; su un documento
   *   fiscale non entra più. */
  const descrizioneFinale = descrizione.trim() || DESCRIZIONI[0];

  /** ── IL TIPO PROPONE L'IMPORTO ────────────────────────────────────────
   *  Richiesta del committente: «posso selezionare se acconto o importo
   *  intero». Le due cose non sono separate — scegliere «acconto» e POI dover
   *  cercare a mano quanto era l'acconto è il passaggio in cui si sbaglia
   *  cifra, perché la si copia da un'altra schermata.
   *   · acconto        → quello che ha già versato
   *   · saldo          → quello che resta da incassare
   *   · importo intero → il prezzo pieno della pratica
   *  ⚠️ L'IMPORTO RESTA MODIFICABILE: questa è una proposta, non un vincolo. Un
   *   acconto concordato a voce e diverso da quello che risulta in cassa
   *   esiste, e va potuto scrivere.
   *  ⚠️ E NON SI RISCRIVE SE LA PROPOSTA È ZERO: su una pratica senza incassi
   *   «acconto» azzererebbe una cifra appena battuta a mano. */
  const importoPerTipo = (t: Fattura["tipo"]): number =>
    t === "acconto" ? versato : t === "saldo" ? resta : prezzoVendita(lead);

  const scegliTipo = (t: Fattura["tipo"]) => {
    setTipo(t);
    const proposto = importoPerTipo(t);
    if (proposto > 0) setTestoImporto(scriviEuro(proposto));
  };

  const conto = useMemo(
    () => contoDaLordo(leggiEuro(testoImporto), azienda.aliquotaPredefinita),
    [testoImporto, azienda.aliquotaPredefinita],
  );

  /** ── COSA MANCA PER EMETTERE ──────────────────────────────────────────────
   *  Due elenchi in uno: i buchi nei dati del centro e quelli nei dati del
   *  cliente. Si mostrano PRIMA, non dopo aver premuto: un modulo che accetta e
   *  poi rifiuta fa ribattere tutto.
   *  ⚠️ Il codice fiscale di un privato è obbligatorio: senza, lo SDI scarta e
   *   la fattura non esiste. È anche l'unico dato che questo CRM non ha mai
   *   chiesto a nessuno, quindi è il campo che si compilerà ogni volta. */
  const mancanze = useMemo(() => {
    const out = mancanzeAzienda(azienda).map((m) => `${m} del centro`);
    if (cliente.azienda) {
      if (!cliente.denominazione.trim()) out.push("la ragione sociale del cliente");
      if (!cliente.partitaIva.trim()) out.push("la partita IVA del cliente");
    } else {
      if (!cliente.nome.trim() && !cliente.cognome.trim()) out.push("il nome del cliente");
      if (!cliente.codiceFiscale.trim()) out.push("il codice fiscale del cliente");
    }
    if (!cliente.indirizzo.trim()) out.push("l'indirizzo del cliente");
    if (!cliente.cap.trim()) out.push("il CAP del cliente");
    if (!cliente.comune.trim()) out.push("il comune del cliente");
    if (!cliente.provincia.trim()) out.push("la provincia del cliente");
    if (conto.totale <= 0) out.push("l'importo");
    return out;
  }, [azienda, cliente, conto.totale]);

  const componi = (stato: Fattura["stato"]): Fattura => ({
    id: bozzaEsistente?.id ?? `bozza:${lead.id}`,
    stato,
    numero: 0,
    anno: new Date().getFullYear(),
    serie: azienda.serie || "",
    data: "",
    //  Una bozza non ha ancora incassato niente: la data si dichiara al momento
    //  di emettere, ed è quella che diventa la data del documento.
    dataPagamento: "",
    tipo,
    leadId: lead.id,
    leadNome: nomeCompleto(lead),
    preventivoRef: rif,
    cliente,
    righe: [
      {
        descrizione: descrizioneFinale,
        quantita: 1,
        prezzoUnitario: conto.imponibile,
        aliquota: conto.aliquota,
      },
    ],
    causale: causaleFinale,
    metodoPagamento: metodo,
    riferimentoPagamento: riferimento.trim(),
    imponibile: conto.imponibile,
    imposta: conto.imposta,
    totale: conto.totale,
    creataIl: bozzaEsistente?.creataIl ?? new Date().toISOString(),
    emessaIl: "",
  });

  /** ── ⚠️ QUELLO CHE SI È SCRITTO NON SI PERDE CHIUDENDO ─────────────────
   *  Segnalazione del committente: si compilavano codice fiscale, indirizzo e
   *  CAP del cliente, si usciva dalla pagina, si rientrava e i campi erano
   *  tornati vuoti. Non era un difetto di lettura — la bozza si RILEGGE
   *  benissimo — era che non era mai stata scritta: si salvava solo premendo
   *  «Salva la bozza», e chiudere con la X buttava via tutto.
   *  Copiare un codice fiscale da un documento è lavoro, e un programma che lo
   *  fa rifare due volte lo fa rifare male la seconda.
   *
   *  ⚠️ SI SALVA ALLA CHIUSURA, NON A OGNI TASTO. Il resto di questo CRM
   *   scrive a mano apposta — un salvataggio per battuta manderebbe in archivio
   *   ogni cifra parziale. Ma qui si tratta di una BOZZA: non ha numero, non è
   *   un documento, e non produce niente finché non la si emette. Salvarla
   *   uscendo non ha nessuno degli effetti che quella regola evita.
   *
   *  ⚠️ E SOLO SE È CAMBIATO QUALCOSA rispetto a com'era all'apertura: chi apre
   *   la finestra per guardare e la richiude non deve trovarsi una bozza in
   *   «Fatture» che non ha mai voluto. */
  const partenza = useRef("");
  const daSalvare = () => JSON.stringify(componi("bozza"));
  /** Quello che è già stato messo da parte: serve a non riscrivere due volte
   *  la stessa cosa e a non annunciare un salvataggio che non è servito. */
  const ultimoSalvato = useRef("");
  /** L'ultima versione scritta a schermo, letta dal salvataggio d'emergenza
   *  qui sotto: una funzione dentro una chiusura vedrebbe i valori di quando
   *  è stata creata, cioè quelli vuoti dell'apertura. */
  const ultimaVersione = useRef<Fattura | null>(null);
  const restaDaSalvare = useRef(false);

  /** ── ⚠️ SI TIENE DA PARTE MENTRE SI SCRIVE, NON SOLO ALLA CHIUSURA ─────
   *  Segnalato di nuovo dal committente: compilati i campi, usciti dalla
   *  schermata e tornati, era sparito tutto. Il salvataggio alla chiusura
   *  c'era già, ma copre una sola delle uscite: quella in cui si preme la X.
   *  Uscire dalla SCHERMATA — chiudere la scheda del cliente che contiene
   *  questa finestra, cambiare pagina, ricaricare — smonta tutto senza
   *  passare di lì, e quello che si era scritto non lo salvava nessuno.
   *  ⚠️ Un secondo di pausa, non ogni tasto: un salvataggio per battuta
   *   scriverebbe in archivio ogni cifra parziale di un codice fiscale. Un
   *   secondo è il tempo che passa fra un campo e l'altro.
   *  ⚠️ E solo DOPO che qualcosa è cambiato rispetto all'apertura: chi apre la
   *   finestra per guardare e la richiude non deve trovarsi una bozza in
   *   «Fatture» che non ha mai voluto. */
  useEffect(() => {
    if (!aperta || inCorso || !partenza.current) return;
    const adesso = daSalvare();
    restaDaSalvare.current = adesso !== partenza.current && adesso !== ultimoSalvato.current;
    ultimaVersione.current = componi("bozza");
    if (!restaDaSalvare.current) return;
    const t = window.setTimeout(() => {
      const bozza = componi("bozza");
      ultimoSalvato.current = JSON.stringify(bozza);
      restaDaSalvare.current = false;
      //  ⚠️ Insieme alla bozza: è il momento in cui si è smesso di scrivere, ed
      //   è quello giusto anche per la scheda. Scrivere a ogni battuta
      //   riempirebbe il diario del lead di modifiche che nessuno ha fatto.
      riportaSullaScheda();
      void salvaBozza(bozza).then((errore) => {
        if (!errore) return;
        //  ⚠️ Un salvataggio automatico fallito NON si tace: chi sta
        //   compilando crede di essere al sicuro, e scoprirebbe il contrario
        //   solo riaprendo.
        ultimoSalvato.current = "";
        toast.error("Non riesco a tenere da parte quello che scrivi", { description: errore });
      });
    }, 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    //  ⚠️ Anche il modo di incasso e il suo riferimento: sono dati della
    //   bozza come gli altri, e chiudendo non si devono perdere.
  }, [aperta, inCorso, cliente, tipo, testoImporto, causale, descrizione, dataIncasso, metodo, riferimento]);

  /** ⚠️ L'ULTIMA RETE: la finestra sparisce senza che nessuno chiuda niente —
   *  si chiude la scheda del cliente, si cambia pagina, si torna indietro col
   *  browser. Qui non si può aspettare una risposta (il componente non c'è
   *  più): si manda e basta, ed è comunque meglio di perdere il lavoro. */
  useEffect(
    () => () => {
      if (restaDaSalvare.current && ultimaVersione.current) {
        void salvaBozza(ultimaVersione.current);
      }
    },
    [],
  );

  const chiudi = (v: boolean) => {
    //  ⚠️ Non quando si è appena salvato o emesso: quelle strade chiudono da
    //   sé, e dopo un'emissione la bozza è stata CANCELLATA — riscriverla qui
    //   la farebbe tornare in vita accanto alla fattura vera.
    if (
      !v
      && !inCorso
      && partenza.current
      && daSalvare() !== partenza.current
      //  Già messo da parte dal salvataggio automatico: un secondo annuncio
      //  per la stessa cosa è rumore.
      && daSalvare() !== ultimoSalvato.current
    ) {
      riportaSullaScheda();
      void salvaBozza(componi("bozza")).then((errore) => {
        if (errore) {
          toast.error("Non ho potuto tenere da parte quello che avevi scritto", {
            description: errore,
          });
          return;
        }
        toast.success("Tenuto da parte", {
          description: "Riaprendo trovi tutto com'era. Il numero si assegna quando emetti.",
        });
      });
    }
    onCambio(v);
  };

  /*  Appena i campi sono pieni — la lettura è finita e il disegno successivo
      li porta — si fotografa lo stato. Da lì in poi ogni differenza è farina
      di chi sta compilando. */
  useEffect(() => {
    if (!aperta) return;
    if (partenza.current) return;
    if (!azienda.denominazione && !cliente.nome && !cliente.cognome && !cliente.denominazione)
      return;
    partenza.current = daSalvare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta, azienda, cliente, tipo, testoImporto, causale, descrizione, metodo, riferimento]);

  const salva = async () => {
    if (inCorso) return;
    setInCorso("bozza");
    //  ⚠️ Anche salvando a mano: chi preme «Salva la bozza» ha appena scritto
    //   l'indirizzo, e quello deve stare sulla scheda tanto quanto nella bozza.
    riportaSullaScheda();
    const errore = await salvaBozza(componi("bozza"));
    setInCorso(null);
    if (errore) {
      toast.error("Bozza NON salvata", { description: errore });
      return;
    }
    toast.success("Bozza salvata", {
      description: "La trovi in «Fatture». Numero e data si assegnano quando incassi.",
    });
    onCambio(false);
  };

  const emetti = async () => {
    if (inCorso || mancanze.length > 0) return;
    setInCorso("emetti");
    //  ⚠️ E soprattutto emettendo: i dati con cui è stata fatta una fattura
    //   VERA sono i più affidabili che questa scheda avrà mai — sono quelli
    //   che il cliente ha confermato pagando.
    riportaSullaScheda();
    const esito = await emettiInArchivio(componi("bozza"), azienda, dataIncasso);
    setInCorso(null);
    setConferma(false);
    if (!esito.ok || !esito.fattura) {
      toast.error("Fattura NON emessa", {
        description: esito.errore ?? "Riprova: non è stato assegnato nessun numero.",
      });
      return;
    }
    //  ⚠️ Il collegamento si scrive sulla scheda del cliente, e se non riesce
    //   NON si disfa la fattura: il documento c'è, e cancellarlo per un campo
    //   di comodo lascerebbe un buco nella serie. Si dice e basta.
    const ok = await updateLead(lead.id, {
      fatture: [...(lead.data.fatture ?? []), esito.fattura.id],
    });
    if (!ok) {
      toast.warning("Fattura emessa, ma non collegata alla scheda", {
        description: "La trovi in «Fatture». Il collegamento sulla scheda si può rifare.",
      });
    }
    toast.success(`Fattura ${esito.fattura.anno}/${esito.fattura.numero} emessa`, {
      description: "Scaricala da «Fatture»: l'XML è quello da dare al commercialista.",
    });
    onFatta?.(esito.fattura);
    onCambio(false);
  };

  const buttaBozza = async () => {
    await eliminaBozza(lead.id);
    setBozzaEsistente(null);
    toast.success("Bozza eliminata");
    onCambio(false);
  };

  const campo = (
    etichetta: string,
    valore: string,
    scrivi: (v: string) => void,
    opzioni?: { nota?: string; larghezza?: string; maiuscolo?: boolean },
  ) => (
    <CampoFinestra etichetta={etichetta} nota={opzioni?.nota} className={opzioni?.larghezza}>
      <Input
        value={valore}
        onChange={(e) => scrivi(opzioni?.maiuscolo ? e.target.value.toUpperCase() : e.target.value)}
        className={CLASSE_CAMPO}
      />
    </CampoFinestra>
  );

  return (
    <Finestra
      aperta={aperta}
      onCambio={chiudi}
      larghezza="md"
      icona={Receipt}
      titolo={bozzaEsistente ? "Riprendi la fattura" : "Prepara la fattura"}
      contesto={`${nomeCompleto(lead)}${rif ? ` · preventivo ${rif}` : ""}`}
      classeCorpo="space-y-3"
      azioni={
        <>
          {bozzaEsistente && (
            <Button
              variant="ghost"
              onClick={() => void buttaBozza()}
              disabled={!!inCorso}
              className="text-slate-600"
            >
              Butta la bozza
            </Button>
          )}
          <Button variant="outline" onClick={() => void salva()} disabled={!!inCorso}>
            {inCorso === "bozza" ? "Salvo…" : "Salva la bozza"}
          </Button>
          <Button
            onClick={() => (conferma ? void emetti() : setConferma(true))}
            disabled={!!inCorso || mancanze.length > 0}
            className={cn("sm:min-w-40", conferma && "bg-rose-600 hover:bg-rose-700")}
          >
            <FileCheck2 className="mr-1.5 h-4 w-4" />
            {inCorso === "emetti"
              ? "Emetto…"
              : conferma
                ? `Confermi il n. ${numeroInAttesa}?`
                : "Emetti la fattura"}
          </Button>
        </>
      }
    >
      {/* ── ⚠️ «CHIEDIGLIELO SU WHATSAPP» STA IN CIMA, E CI STA APPOSTA ────
          Il momento in cui ci si accorge che manca il codice fiscale è QUESTO:
          si apre la finestra per fatturare e non si può. Prima, da qui, non
          c'era niente da fare se non chiudere e ricordarsi di scrivere al
          cliente — e «ricordarsi» è il punto in cui la fattura resta ferma
          tre settimane.
          Compare solo se manca qualcosa: a dati completi sarebbe un pulsante
          che invita a disturbare un cliente per niente. */}
      {mancanzeCliente.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-50 p-2.5 dark:bg-amber-500/10">
          <MessageCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-amber-800 dark:text-amber-300">
            Per emettere manca <b>{mancanzeCliente.join(", ")}</b>.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={chiediSuWhatsApp}
            //  Senza numero il pulsante resta, ma apre WhatsApp sull'elenco
            //  delle chat col messaggio già scritto: un tocco in più, e il
            //  testo non si perde.
            title={telefonoCliente
              ? "Apre WhatsApp con il messaggio già scritto"
              : "Questo lead non ha un numero: si apre WhatsApp col messaggio da incollare"}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chiedili su WhatsApp
          </Button>
          {/*  ── ⚠️ OPPURE SI FOTOGRAFA IL DOCUMENTO ──────────────────────
              Sta ACCANTO a «chiedili su WhatsApp» e non al suo posto: sono le
              due strade vere: o il cliente è al telefono e i dati te li detta,
              o la tessera ce l'hai già in mano (l'ha mandata in chat, l'ha
              lasciata in studio). Chiedere di scrivere sedici caratteri a mano
              quando c'è una fotografia è il passaggio in cui si sbaglia. */}
          <TastoDocumento />
        </div>
      )}

      {/* ── QUANTO SI FATTURA ────────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Cosa si fattura"
        nota="L'importo è quello incassato: l'imponibile si ricava da lì"
        classeCorpo="p-3 space-y-2.5"
      >
        <div className="flex flex-wrap gap-1.5">
          {/*  ⚠️ «Acconto» NON è una parola che finisce sul documento: è come
              l'archivio sa che al saldo quell'imponibile è già stato
              fatturato. Sul foglio si legge la causale, che dice «Conferma
              d'ordine».
              Ogni pastiglia porta la sua cifra: si sceglie guardando il numero
              che si sta per fatturare, non il nome dell'opzione. */}
          <Pillola
            attiva={tipo === "acconto"}
            onClick={() => scegliTipo("acconto")}
            titolo="Solo la parte già incassata: al saldo si fattura il resto"
          >
            Acconto{versato > 0 ? ` · ${eur(versato)}` : ""}
          </Pillola>
          <Pillola
            attiva={tipo === "saldo"}
            onClick={() => scegliTipo("saldo")}
            titolo="Il resto, dopo un acconto già fatturato"
          >
            Saldo{resta > 0 ? ` · ${eur(resta)}` : ""}
          </Pillola>
          <Pillola
            attiva={tipo === "unica"}
            onClick={() => scegliTipo("unica")}
            titolo="Tutto in una volta: solo se non è già stato fatturato un acconto"
          >
            Importo intero{prezzoVendita(lead) > 0 ? ` · ${eur(prezzoVendita(lead))}` : ""}
          </Pillola>
        </div>

        {/*  ⚠️ L'AVVISO CHE EVITA DI FATTURARE DUE VOLTE LA STESSA COSA. Se a
            questo cliente è già stata emessa una fattura di acconto, «importo
            intero» rifattura anche quella parte: lo stesso imponibile finisce
            in contabilità due volte, e non è un errore che si vede — si scopre
            a fine anno, dal commercialista. In quel caso la voce giusta è il
            saldo. */}
        {tipo === "unica" && accontoGiaFatturato && (
          <p className="text-[11.5px] leading-snug text-amber-700">
            A questo cliente è già stata emessa una fattura di acconto: con l&apos;importo intero
            quella parte viene fatturata una seconda volta. Se vuoi solo la differenza, scegli{" "}
            <strong>Saldo</strong>.
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-500">€</span>
          <Input
            value={testoImporto}
            onChange={(e) => setTestoImporto(e.target.value)}
            inputMode="decimal"
            aria-label="Importo da fatturare"
            placeholder="0,00"
            className={cn(CLASSE_CAMPO, "h-10 flex-1 text-[16px] font-semibold tabular-nums")}
          />
          {versato > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestoImporto(scriviEuro(versato))}
              className="h-9 shrink-0 border-slate-200 bg-white text-[12px] text-slate-700"
              title="Quanto ha già versato"
            >
              Versato {eur(versato)}
            </Button>
          )}
          {resta > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestoImporto(scriviEuro(resta))}
              className="h-9 shrink-0 border-slate-200 bg-white text-[12px] text-slate-700"
              title="Quanto resta da incassare"
            >
              Resta {eur(resta)}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <KpiFinestra etichetta="Imponibile" valore={eur(conto.imponibile)} />
          <KpiFinestra etichetta={`IVA ${conto.aliquota}%`} valore={eur(conto.imposta)} />
          <KpiFinestra etichetta="Totale" valore={eur(conto.totale)} forte />
        </div>

        {campo("Descrizione in fattura", descrizione, setDescrizione, {
          nota: `Se lasci vuoto: «${DESCRIZIONI[0]}»`,
        })}
        {/*  Tre formule pronte, e si scrive comunque sopra: la riga giusta
            cambia se l'impianto si applica, se si spedisce e basta, o se è una
            manutenzione — e sono tre casi che questo centro fa tutti. */}
        <div className="flex flex-wrap gap-1.5">
          {DESCRIZIONI.map((d, i) => (
            <Pillola
              key={d}
              attiva={descrizioneFinale === d}
              onClick={() => setDescrizione(d)}
              titolo={d}
            >
              {CORTE[i]}
            </Pillola>
          ))}
        </div>
        {/* ── COME HA PAGATO, E IL DATO CHE SERVE ─────────────────────────
            Segnalazione del committente: «se paga con il POS SumUp, cosa metto
            al posto della causale? Metti l'opzione POS, bonifico, contanti, e
            in base a quella i dati da inserire, con una guida che dice dove
            trovarli».
            L'icona ℹ si apre col mouse sopra (il titolo) E premendola: su un
            telefono il mouse non c'è, e una guida che si vede solo passandoci
            sopra lì non esiste. */}
        <SceltaModoIncasso
          metodo={metodo}
          onMetodo={setMetodo}
          riferimento={riferimento}
          onRiferimento={setRiferimento}
          className="sm:col-span-2"
        />
        {campo(modoScelto.etichettaCausale, causale, setCausale, {
          nota: `Se lasci vuoto: «${causaleProposta}»`,
        })}

        {/* ── A QUALE PREVENTIVO SI RIFERISCE ─────────────────────────────
            Il numero che finisce nella causale e sul documento. Si dice
            sempre quale si è preso e COME lo si è trovato: se l'aggancio è
            venuto dal numero di telefono è un'ipotesi — giusta quasi sempre,
            ma su un numero di famiglia può essere il preventivo del figlio.
            Con più preventivi della stessa persona si sceglie. */}
        {(citato || rif) && (
          <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-2 text-[12px] leading-snug text-white/55">
            <span>
              Riferita al preventivo <b className="font-mono font-semibold text-white/85">{rif || "—"}</b>
              {citato?.via === "telefono" && (
                <span className="text-amber-200/80"> · agganciato dal numero di telefono, non dalla scheda</span>
              )}
            </span>
            {preventivi.length > 1 && (
              <select
                value={rif}
                onChange={(e) => setRifScelto(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-[12px] text-white outline-none focus:border-brand"
              >
                {preventivi.map((q) => (
                  <option key={q.quote_ref} value={q.quote_ref}>
                    {q.quote_ref} · {new Date(String(q.created_at)).toLocaleDateString("it-IT")}
                    {String(q.status ?? "") === "sostituito" ? " (sostituito)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* ── QUANDO SONO ARRIVATI I SOLDI ────────────────────────────────
            ⚠️ È ANCHE LA DATA DELLA FATTURA, e la riga sotto lo dice: chi
             scrive una data qui deve sapere che sta datando un documento
             fiscale, non compilando un promemoria. Per una fattura immediata la
             data è quella dell'operazione — e per un acconto l'operazione è
             l'incasso, non il momento in cui ci si siede a compilarla. */}
        <label className="block space-y-1">
          <span className="block text-[12px] font-medium text-slate-900">
            Pagamento ricevuto il
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="date"
              value={dataIncasso}
              max={giornoISO()}
              onChange={(e) => setDataIncasso(e.target.value)}
              className="w-full bg-transparent text-[13px] tabular-nums text-slate-900 outline-none"
            />
          </span>
          <span className="block text-[11px] leading-snug text-slate-500">
            {dataIncasso === giornoISO()
              ? "È anche la data della fattura. Se il bonifico è arrivato prima, mettici quel giorno."
              : `È anche la data della fattura: sarà emessa in data ${dataLunga(dataIncasso)}, non oggi.`}
          </span>
        </label>
      </SezioneFinestra>

      {/* ── A CHI ────────────────────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Intestazione"
        nota="Quello che il CRM sapeva è già scritto: manca il resto"
        classeCorpo="p-3 space-y-2.5"
        //  ⚠️ Il tasto sta ANCHE qui, e non solo nella fascia gialla: quella
        //   compare soltanto quando manca qualcosa, mentre una tessera si
        //   fotografa anche per CONTROLLARE un dato che c'è già — ed è il
        //   posto in cui si sta guardando l'intestazione.
        azioni={<TastoDocumento compatto />}
      >
        <div className="flex flex-wrap gap-1.5">
          <Pillola
            attiva={!cliente.azienda}
            onClick={() => setCliente((c) => ({ ...c, azienda: false }))}
          >
            <User className="mr-1 inline h-3.5 w-3.5" /> Privato
          </Pillola>
          <Pillola
            attiva={cliente.azienda}
            onClick={() => setCliente((c) => ({ ...c, azienda: true }))}
          >
            <Building2 className="mr-1 inline h-3.5 w-3.5" /> Azienda
          </Pillola>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cliente.azienda ? (
            <>
              {campo("Ragione sociale", cliente.denominazione, (v) =>
                setCliente((c) => ({ ...c, denominazione: v })),
              )}
              {campo("Partita IVA", cliente.partitaIva, (v) =>
                setCliente((c) => ({ ...c, partitaIva: v })),
              )}
              {campo(
                "Codice destinatario / SDI",
                cliente.codiceDestinatario,
                (v) => setCliente((c) => ({ ...c, codiceDestinatario: v })),
                {
                  nota: "7 caratteri. Se non l'hai, lascia 0000000 e scrivi la PEC",
                  maiuscolo: true,
                },
              )}
              {campo("PEC", cliente.pec, (v) => setCliente((c) => ({ ...c, pec: v })))}
            </>
          ) : (
            <>
              {campo("Nome", cliente.nome, (v) => setCliente((c) => ({ ...c, nome: v })))}
              {campo("Cognome", cliente.cognome, (v) => setCliente((c) => ({ ...c, cognome: v })))}
              {campo(
                "Codice fiscale",
                cliente.codiceFiscale,
                (v) => setCliente((c) => ({ ...c, codiceFiscale: v })),
                {
                  nota: "Obbligatorio: senza, la fattura viene scartata",
                  maiuscolo: true,
                },
              )}
              {campo("PEC", cliente.pec, (v) => setCliente((c) => ({ ...c, pec: v })), {
                nota: "Facoltativa: se non c'è, resta nel cassetto fiscale",
              })}
              {/*  ── ⚠️ «CALCOLA» STA SOTTO IL CODICE, NON IN FONDO ─────────
                  È la cosa da fare subito dopo averlo scritto (o dopo che l'ha
                  scritto la fotografia del documento): a cinque campi di
                  distanza non la preme nessuno.
                  Occupa tutta la riga perché quello che risponde — nascita,
                  età, e se il codice corrisponde al nome — è una frase, non
                  una spunta. */}
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!String(cliente.codiceFiscale || "").trim()}
                  onClick={calcolaDalCodice}
                  title="Ricava nascita ed età dal codice fiscale, controlla che corrisponda al nome e riporta tutto sulla scheda del cliente"
                >
                  <Calculator className="mr-1 h-3.5 w-3.5" /> Calcola dal codice fiscale
                </Button>
                {!!esitoCF && (
                  <p
                    className={cn(
                      "mt-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
                      esitoCF.tono === "ok"
                        ? "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
                    )}
                  >
                    {esitoCF.testo}
                  </p>
                )}
              </div>
            </>
          )}
          {/*  ── ⚠️ SCEGLIENDO UN SUGGERIMENTO SI RIEMPIE TUTTO ────────────
              Via, civico, CAP, comune e provincia insieme. Su una fattura
              elettronica un CAP sbagliato la fa scartare dallo SDI, e il CAP è
              esattamente il campo che si tira a indovinare quando si ha il
              cliente al telefono. */}
          <CampoFinestra
            etichetta="Indirizzo"
            nota="Scrivi e scegli: riempio CAP, comune e provincia"
          >
            <CampoIndirizzo
              valore={cliente.indirizzo}
              comune={cliente.comune}
              onTesto={(v) => setCliente((c) => ({ ...c, indirizzo: v }))}
              onScelto={(i) =>
                setCliente((c) => ({
                  ...c,
                  indirizzo: i.indirizzo,
                  //  ⚠️ Il civico si sovrascrive solo se il suggerimento ne
                  //   porta uno: certi risultati danno la via e basta, e
                  //   svuotare un civico già scritto a mano sarebbe un
                  //   peggioramento silenzioso.
                  civico: i.civico || c.civico,
                  cap: i.cap || c.cap,
                  comune: i.comune || c.comune,
                  provincia: i.provincia || c.provincia,
                  nazione: i.nazione || c.nazione,
                }))
              }
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
          {campo("Numero civico", cliente.civico, (v) => setCliente((c) => ({ ...c, civico: v })))}
          {campo("CAP", cliente.cap, (v) => setCliente((c) => ({ ...c, cap: v })))}
          {campo("Comune", cliente.comune, (v) => setCliente((c) => ({ ...c, comune: v })))}
          {campo(
            "Provincia",
            cliente.provincia,
            (v) => setCliente((c) => ({ ...c, provincia: v })),
            {
              nota: "Sigla, es. MI",
              maiuscolo: true,
            },
          )}
        </div>
      </SezioneFinestra>

      {/*  ⚠️ SENZA IL NUMERO DELL'ORDINE LA CAUSALE NON LEGA NIENTE, ed è il
          difetto visto sulla prima fattura vera: era uscita con causale
          «Conferma ordine» e basta. Quella stringa è l'unico filo fra il
          bonifico che arriva e questo documento — senza il codice, la
          riconciliazione si fa a mano cercando l'importo.
          ⚠️ NON blocca però: una fattura può nascere da un cliente che un
           preventivo non ce l'ha (una manutenzione, un acquisto a parte). Si
           dice, e chi emette decide. */}
      {!rif && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Questo cliente non ha un preventivo collegato, quindi la causale non porterà nessun numero
          d&apos;ordine: il bonifico che arriva andrà riconosciuto a mano. Se il preventivo
          c&apos;è, aprilo e fai la fattura da lì.
        </NotaFinestra>
      )}

      {/* ── COSA MANCA, PRIMA DI PREMERE ─────────────────────────────────── */}
      {mancanze.length > 0 && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Per emettere manca ancora: {mancanze.join(", ")}.
          {mancanze.some((m) => m.endsWith("del centro")) && (
            <>
              {" "}
              I dati del centro si scrivono una volta sola, in{" "}
              <strong>Fatture → Dati dell&apos;azienda</strong>.
            </>
          )}
        </NotaFinestra>
      )}

      <NotaFinestra icona={FileText}>
        <strong>La bozza si può salvare sempre.</strong> «Emetti» invece assegna il numero{" "}
        {numeroInAttesa > 0 ? <strong>{numeroInAttesa}</strong> : null} e la data del{" "}
        <strong>{dataLunga(dataIncasso)}</strong>: da lì il documento è in una serie, e un numero
        tolto da una serie lascia un buco da spiegare.
      </NotaFinestra>
    </Finestra>
  );
}
