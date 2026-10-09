/** ── LE FATTURE DI QUESTO LEAD, DENTRO LA SUA SCHEDA ───────────────────────
 *
 *  Gemello di `crm/preventivi/DelLead`, e per la stessa ragione: per ritrovare
 *  la fattura di un cliente bisognava uscire dalla trattativa e cercarla
 *  nell'archivio per cognome. Qui ci sono le sue, e basta.
 *
 *  ── ⚠️ COSA C'È DENTRO, E COSA NO ────────────────────────────────────────
 *  Emesse E bozze, con le emesse prima: una bozza dimenticata su un cliente
 *  già saldato è il motivo per cui in contabilità si ritrovano documenti che
 *  nessuno ha mandato, e nasconderla qui vorrebbe dire scoprirla a fine anno.
 *  Ma si vede che è una bozza, con una parola sua.
 *
 *  ── ⚠️ QUI NON SI EMETTE ─────────────────────────────────────────────────
 *  Si guarda, si apre, si scarica. Emettere una fattura assegna un numero
 *  progressivo e definitivo — un gesto che dall'elenco di un pannello laterale
 *  non si fa per sbaglio: si passa da `TastoFattura`, che apre la composizione
 *  vera con tutti i controlli. Questo pannello lo offre in fondo, quando serve.
 *
 *  ── ⚠️ L'XML NON PARTE SE VERREBBE SCARTATO ──────────────────────────────
 *  Stessa guardia della pagina Fatture (`scaricaXmlDi`): `problemiXml` dice
 *  cosa manca PRIMA di produrre il file. Scaricare un XML che lo SdI rifiuta
 *  vuol dire scoprirlo giorni dopo, da una ricevuta di scarto, e nel frattempo
 *  la fattura risulta emessa e non consegnata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { FileDown, FileText, Plus, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Finestra, SezioneFinestra, VoceScelta, VuotoFinestra } from "@/crm/ui/Finestra";
import { dataBreve, eur } from "@/crm/ui";
import type { Lead } from "@/crm/types";
import { etichettaNumero, leggiAzienda, leggiBozze, leggiEmesse } from "./archivio";
import { costruisciDocumento } from "./documento";
import { scaricaXml } from "./scarica";
import { AZIENDA_VUOTA, type DatiAzienda, type Fattura } from "./tipi";
import { costruisciXml, nomeFileXml, problemiXml } from "./xml";
import { FinestraFattura } from "./FinestraFattura";

/** ⚠️ Emesse prima, e ognuno dei due gruppi dalla più recente: chi apre questo
 *  pannello cerca quasi sempre l'ultima cosa mandata al cliente. */
function ordina(f: Fattura[]): Fattura[] {
  return [...f].sort((a, b) => {
    const ea = a.stato === "emessa" ? 0 : 1;
    const eb = b.stato === "emessa" ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return String(b.data ?? "").localeCompare(String(a.data ?? ""));
  });
}

export function FinestraFattureLead({
  lead,
  aperta,
  onCambio,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
}) {
  const [righe, setRighe] = useState<Fattura[] | null>(null);
  const [azienda, setAzienda] = useState<DatiAzienda>(AZIENDA_VUOTA);
  const [logo, setLogo] = useState("");
  const [errore, setErrore] = useState("");
  const [componi, setComponi] = useState(false);

  useEffect(() => {
    if (!aperta) return;
    let annullato = false;
    setErrore("");
    void (async () => {
      const [emesse, bozze, a] = await Promise.all([leggiEmesse(), leggiBozze(), leggiAzienda()]);
      if (annullato) return;
      //  ⚠️ Si DICE quando la lettura è fallita: un elenco vuoto per un guasto
      //   di rete e un elenco vuoto perché fatture non ce ne sono si leggono
      //   uguali, e il primo fa dire al cliente «non le abbiamo mai fatturato».
      if (!emesse.ok || !bozze.ok) {
        setErrore("Non è stato possibile leggere l'archivio. Riprova fra un momento.");
      }
      setAzienda(a);
      setRighe(ordina([...emesse.lista, ...bozze.lista].filter((f) => f.leadId === lead.id)));
    })();
    return () => {
      annullato = true;
    };
  }, [aperta, lead.id]);

  //  Stessa fonte del logo dell'app e del riepilogo di consegna.
  useEffect(() => {
    if (!aperta) return;
    void fetch("/api/presenter/brand")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setLogo(String(j?.logoUrl || "")))
      .catch(() => setLogo(""));
  }, [aperta]);

  const apriDocumento = (f: Fattura) => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Il browser ha bloccato la finestra di stampa", {
        description: "Consenti le finestre a comparsa per questo sito e riprova.",
      });
      return;
    }
    w.document.write(costruisciDocumento(f, azienda, logo));
    w.document.close();
  };

  const scarica = (f: Fattura) => {
    const { bloccanti, avvisi } = problemiXml(f, azienda);
    if (bloccanti.length > 0) {
      toast.error(
        `Questa fattura verrebbe scartata: ${
          bloccanti.length === 1 ? "manca un dato" : `mancano ${bloccanti.length} dati`
        }`,
        { description: bloccanti.join(" · "), duration: 12000 },
      );
      return;
    }
    if (avvisi.length > 0) toast.warning(avvisi.join(" · "), { duration: 9000 });
    scaricaXml(nomeFileXml(f, azienda), costruisciXml(f, azienda));
  };

  const nome = `${lead.data?.nome ?? ""} ${lead.data?.cognome ?? ""}`.trim();

  return (
    <>
      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        icona={Receipt}
        titolo="Le fatture del cliente"
        contesto={nome || "Scheda senza nome"}
        larghezza="md"
        classeCorpo="space-y-3"
      >
        {righe === null ? (
          <p className="px-1 py-6 text-center text-[12.5px] text-muted-foreground">Sto leggendo…</p>
        ) : (
          <>
            {righe.length === 0 ? (
              <VuotoFinestra
                icona={FileText}
                testo={errore || "Per questo cliente non è stata ancora preparata nessuna fattura."}
              />
            ) : (
              righe.map((f) => {
                const bozza = f.stato !== "emessa";
                return (
                  <SezioneFinestra
                    key={f.id ?? `${f.leadId}-${f.anno}-${f.numero}-${f.stato}`}
                    titolo={bozza ? "Bozza" : `Fattura ${etichettaNumero(f)}`}
                    nota={
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{dataBreve(f.data)}</span>
                        <span className="opacity-40">·</span>
                        <span className="font-semibold text-slate-700">{eur(f.totale)}</span>
                      </span>
                    }
                    classeCorpo="p-3 space-y-1.5"
                  >
                    {/*  ⚠️ L'avviso sta SOPRA i comandi, non sotto: sotto lo
                        legge chi ha già premuto «scarica l'XML» su un documento
                        che non è ancora una fattura. */}
                    {bozza && (
                      <p className="mb-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-800">
                        Non è ancora una fattura: non ha numero e non è stata emessa. Aprila dalla
                        composizione per completarla.
                      </p>
                    )}
                    <VoceScelta
                      icona={Printer}
                      titolo="Apri il documento"
                      nota="Da lì «Salva come PDF» per mandarlo"
                      onClick={() => apriDocumento(f)}
                    />
                    {!bozza && (
                      <VoceScelta
                        icona={FileDown}
                        titolo="Scarica l'XML"
                        nota="Il file da trasmettere allo SdI"
                        onClick={() => scarica(f)}
                      />
                    )}
                  </SezioneFinestra>
                );
              })
            )}

            {/*  ⚠️ In fondo e non in cima: chi apre questo pannello quasi
                sempre cerca una fattura che esiste già. Il gesto che ne crea
                una nuova non deve stare sulla strada di quello. */}
            <Button variant="outline" className="w-full" onClick={() => setComponi(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {righe.length === 0 ? "Prepara la prima fattura" : "Prepara una nuova fattura"}
            </Button>
          </>
        )}
      </Finestra>

      {/*  La composizione vera, con tutti i controlli: qui non si duplica
          niente di quello che sa fare lei. */}
      {componi && <FinestraFattura lead={lead} aperta={componi} onCambio={setComponi} />}
    </>
  );
}

export function PulsanteFatture({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setAperta(true)}>
        <Receipt className="mr-1 h-3.5 w-3.5" /> Fatture
      </Button>
      {aperta && <FinestraFattureLead lead={lead} aperta={aperta} onCambio={setAperta} />}
    </>
  );
}
