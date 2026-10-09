/** ── QUANTO CI È COSTATO QUESTO CLIENTE ────────────────────────────────────
 *
 *  Richiesta del committente: dal blocco dei soldi di una posa si deve poter
 *  scrivere OGNI costo avuto su quel cliente, con «+» per aggiungerne quanti
 *  se ne vuole, titolo e importo.
 *
 *  ── PERCHÉ TRE VOCI SONO GIÀ LÌ E LE ALTRE NO ─────────────────────────────
 *  Impianto, installatore e parrucchiere ce li ha ogni pratica: sono i tre
 *  campi su cui il CRM calcola il margine da sempre, e restano campi loro —
 *  scritti nello stesso posto di prima, così ogni scheda già compilata continua
 *  a valere. Tutto il resto cambia da cliente a cliente e non sta in un elenco
 *  chiuso: si scrive a mano.
 *  ⚠️ I NOMI A SCHERMO E I CAMPI IN ARCHIVIO SONO DUE COSE DIVERSE.
 *   «Parrucchiere» in archivio si chiama `costoTaglio`: rinominare il campo per
 *   far combaciare le due cose avrebbe azzerato quel costo su ogni scheda
 *   esistente. La corrispondenza sta in VOCI_FISSE (crm/costi-pratica).
 *
 *  ── ⚠️ SI SALVA TUTTO INSIEME, A MANO ─────────────────────────────────────
 *  Non c'è salvataggio automatico mentre si scrive. Qui si registrano dei costi
 *  che entrano nel margine: un salvataggio a ogni tasto vorrebbe dire scrivere
 *  in archivio ogni cifra parziale — «1», «12», «120» — e un ripensamento
 *  lasciato a metà resterebbe dentro il conto senza che nessuno l'abbia
 *  confermato.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCRM } from "./CRMContext";
import {
  VOCI_FISSE,
  altriCosti,
  nuovoIdVoce,
  totaleCostiPratica,
  vociFissePer,
} from "./costi-pratica";
import { daSpedire } from "./spedizione";
import { COSTO_PARRUCCHIERE_PREDEFINITO, COSTO_SPEDIZIONE_PREDEFINITO } from "./types";
import { leggiEuro, scriviEuro } from "./euro";
import type { Lead, VoceCosto } from "./types";
import { eur } from "./ui";
import { CampoFinestra, Finestra, KpiFinestra, NotaFinestra, SezioneFinestra } from "./ui/Finestra";

const nomeDi = (l: Lead) => `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || "Senza nome";

/** Il totale in fondo, per il riquadro che apre la finestra. */
export { totaleCostiPratica };

export function FinestraCosti({
  lead,
  aperta,
  onCambio,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
}) {
  const { updateLead } = useCRM();
  //  Gli importi sono TESTO, come ovunque in questo CRM: `type=number` in
  //  italiano rifiuta la virgola, e chi scrive «120,50» si ritrova il campo
  //  vuoto senza capire perché (vedi leggiEuro).
  const [fissi, setFissi] = useState<Record<string, string>>({});
  const [altri, setAltri] = useState<VoceCosto[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aperta) return;
    //  Si riparte SEMPRE da quello che c'è in archivio: una modifica lasciata a
    //  metà nell'apertura precedente — magari su un altro cliente, sulla stessa
    //  riga riusata — è il modo più silenzioso di scrivere un costo sbagliato.
    const c = lead.data.payment?.costi;
    const pacco = daSpedire(lead);
    const partenza: Record<string, string> = {};
    for (const v of VOCI_FISSE) {
      const n = Number(c?.[v.chiave]) || 0;
      /*  ── I DUE VALORI CHE SI PROPONGONO DA SOLI ─────────────────────────
          Chiesti dal committente: il parrucchiere costa 25 € e la spedizione
          8 €, quasi sempre. Un campo vuoto su un costo che c'è sempre si
          salva vuoto, e quel margine esce più alto del vero.
          ⚠️ SOLO SU UN CAMPO MAI SCRITTO, e solo dove quella voce ha senso:
           un costo già messo a mano — anche a zero, che è una decisione — non
           si tocca. Il numero sta in un posto solo (crm/types), o il giorno
           che cambia il listino cambierebbe qui e non nei pacchi. */
      const proposto =
        v.chiave === "costoTaglio" && !pacco
          ? COSTO_PARRUCCHIERE_PREDEFINITO
          : v.chiave === "costoSpedizione" && pacco
            ? COSTO_SPEDIZIONE_PREDEFINITO
            : 0;
      partenza[v.chiave] =
        n > 0 ? scriviEuro(n) : c?.[v.chiave] == null && proposto > 0 ? scriviEuro(proposto) : "";
    }
    setFissi(partenza);
    setAltri(altriCosti(lead.data));
    setSalvando(false);
  }, [aperta, lead]);

  const trasferta = Number(lead.data.payment?.costi?.costoTrasferta) || 0;
  const totale =
    VOCI_FISSE.reduce((s, v) => s + Math.max(0, leggiEuro(fissi[v.chiave] ?? "")), 0) +
    altri.reduce((s, r) => s + (Number(r.importo) || 0), 0) +
    trasferta;

  const aggiungi = () => setAltri((v) => [...v, { id: nuovoIdVoce(), titolo: "", importo: 0 }]);
  const cambia = (id: string, patch: Partial<VoceCosto>) =>
    setAltri((v) => v.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const togli = (id: string) => setAltri((v) => v.filter((r) => r.id !== id));

  const salva = async () => {
    if (salvando) return;
    setSalvando(true);
    //  ⚠️ Le righe senza titolo E senza importo si buttano: sono i «+» premuti
    //   per sbaglio, e salvate resterebbero in elenco per sempre a chiedersi
    //   cosa sono. Una riga con l'importo e senza titolo invece resta — quei
    //   soldi sono usciti davvero — e prende un nome che dice cos'è.
    const puliti = altri
      .filter((r) => r.titolo.trim() || (Number(r.importo) || 0) > 0)
      .map((r) => ({
        id: r.id,
        titolo: r.titolo.trim() || "Costo senza titolo",
        importo: Math.max(0, Number(r.importo) || 0),
      }));
    const costi = { ...(lead.data.payment?.costi ?? {}) };
    for (const v of VOCI_FISSE) costi[v.chiave] = Math.max(0, leggiEuro(fissi[v.chiave] ?? ""));
    costi.altri = puliti;
    const ok = await updateLead(lead.id, {
      payment: { ...(lead.data.payment ?? {}), costi },
    });
    setSalvando(false);
    if (!ok) {
      toast.error("I costi non sono stati salvati", {
        description: "La scheda in archivio è rimasta com'era: riprova.",
      });
      return;
    }
    toast.success(`Costi salvati · ${eur(totale)} su ${nomeDi(lead)}`);
    onCambio(false);
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="I costi di questo cliente"
      contesto={`${nomeDi(lead)} · ${eur(totale)} in tutto`}
      icona={Wallet}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={() => onCambio(false)}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={salvando}>
            {salvando ? "Salvo…" : "Salva i costi"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <KpiFinestra etichetta="Costi in tutto" valore={eur(totale)} forte />
        <KpiFinestra
          etichetta="Voci scritte"
          valore={String(
            VOCI_FISSE.filter((v) => leggiEuro(fissi[v.chiave] ?? "") > 0).length +
              altri.filter((r) => (Number(r.importo) || 0) > 0).length +
              (trasferta > 0 ? 1 : 0),
          )}
        />
      </div>

      <SezioneFinestra
        titolo="Quello che c'è su ogni pratica"
        nota="Le tre voci su cui il CRM calcola il margine da sempre"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {/*  ⚠️ Solo le voci che hanno senso su questa pratica: su un pacco
              non si chiede il costo dell'installatore, e su una posa non si
              chiede quello del corriere. Un campo che chiede un costo che non
              può esistere si riempie a caso. Vedi `vociFissePer`. */}
          {vociFissePer(daSpedire(lead)).map((v) => (
            <CampoFinestra key={v.chiave} etichetta={v.titolo}>
              <Input
                value={fissi[v.chiave] ?? ""}
                onChange={(e) => setFissi((f) => ({ ...f, [v.chiave]: e.target.value }))}
                inputMode="decimal"
                placeholder="€"
                disabled={salvando}
              />
            </CampoFinestra>
          ))}
        </div>
        {/*  Il viaggio si MOSTRA e non si tocca: lo scrive la posa a domicilio
            (crm/spedizione), e un secondo posto per cambiarlo vorrebbe dire due
            cifre per la stessa benzina. */}
        {trasferta > 0 && (
          <NotaFinestra>
            C&apos;è anche il viaggio della posa a domicilio, {eur(trasferta)}: si scrive dalla
            consegna e conta nel totale qui sopra.
          </NotaFinestra>
        )}
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Tutto il resto"
        nota="Corriere, rimborsi, ritocchi: quello che è successo solo con questo cliente"
      >
        {altri.length === 0 ? (
          <p className="text-[12px] leading-snug text-muted-foreground">
            Ancora niente. Premi «+» per aggiungere una voce.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {altri.map((r) => (
              <div key={r.id} className="flex items-end gap-2">
                <CampoFinestra etichetta="Cosa" className="min-w-0 flex-1">
                  <Input
                    value={r.titolo}
                    onChange={(e) => cambia(r.id, { titolo: e.target.value })}
                    placeholder="Corriere, rimborso, ritocco…"
                    disabled={salvando}
                  />
                </CampoFinestra>
                <CampoFinestra etichetta="Importo" className="w-28 shrink-0">
                  <Input
                    value={r.importo ? scriviEuro(r.importo) : ""}
                    onChange={(e) =>
                      cambia(r.id, { importo: Math.max(0, leggiEuro(e.target.value)) })
                    }
                    inputMode="decimal"
                    placeholder="€"
                    disabled={salvando}
                  />
                </CampoFinestra>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mb-0.5 h-9 shrink-0 px-2 text-muted-foreground hover:text-rose-600"
                  onClick={() => togli(r.id)}
                  disabled={salvando}
                  title={`Togli «${r.titolo || "questa voce"}»`}
                  aria-label="Togli questa voce"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={aggiungi}
          disabled={salvando}
          className={cn("mt-2 w-full border-dashed")}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi una voce
        </Button>
      </SezioneFinestra>
    </Finestra>
  );
}
