/** ── RACCOGLIERE I COSTI DI UN PERIODO ─────────────────────────────────────
 *
 *  I costi di questa azienda stanno in tre posti, e ognuno ha una buona
 *  ragione per starci:
 *   · sulle PRATICHE — impianto, installatore, parrucchiere, viaggi, e tutto
 *     quello che è stato scritto a mano su un cliente (crm/costi-pratica);
 *   · sul MESE — affitto, luce, abbonamenti: quello che si paga per tenere
 *     aperto e non appartiene a nessun cliente (crm/costi-mese);
 *   · sulle FATTURE DEI FORNITORI caricate (crm/contabilita-fornitori).
 *
 *  Questo file li mette in fila con la stessa forma, e soprattutto CON LA LORO
 *  DATA — che è la cosa senza cui la deducibilità non può cambiare nel tempo.
 *
 *  ── ⚠️ CHE DATA HA UN COSTO ───────────────────────────────────────────────
 *  Non è una domanda oziosa, perché è quella che decide quale regola gli si
 *  applica (vedi crm/contabilita-regole).
 *   · fattura fornitore → la data della fattura. È scritta nel documento, non
 *     si discute;
 *   · spesa fissa del mese → il primo del mese a cui appartiene;
 *   · costo di una pratica → la data di INGRESSO del lead, che è la stessa a
 *     cui tutto il CRM aggancia quella pratica (kpi-calcoli). Prendere la data
 *     della posa sarebbe più esatto sul piano contabile, ma farebbe cadere lo
 *     stesso costo in un mese diverso da quello in cui la pagina dei numeri lo
 *     conta — e due pagine dello stesso programma che mettono lo stesso euro
 *     in due mesi diversi sono peggio di un'approssimazione dichiarata.
 *
 *  ── ⚠️ SOLO LE PRATICHE CHE HANNO COMPRATO ────────────────────────────────
 *  In archivio i costi stanno scritti su quasi TUTTE le schede: sono i valori
 *  di partenza che si scrivono compilandone una, anche di chi non ha comprato
 *  niente. Su 844 schede, 843 avevano un costo e 25 un incasso. Sommandoli
 *  tutti la contabilità mostrava 139.000 € di costi contro il fatturato di chi
 *  aveva davvero pagato. Il filtro è `eConversione`, lo stesso della pagina dei
 *  margini: due idee diverse di «cliente» producono due conti che non si
 *  possono confrontare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { vociCostoDi } from "./costi-pratica";
import { meseLeggibile, type VoceMese } from "./costi-mese";
import { eConversione } from "./kpi-calcoli";
import type { CostoDatato } from "./contabilita";
import { effettiContabili, type FatturaFornitore } from "./contabilita-fornitori";
import type { Lead, VoceCosto } from "./types";

/** I costi scritti sulle pratiche che hanno comprato, con la data della scheda. */
export function costiDallePratiche(
  leads: Lead[],
  dentro: (d?: string | null) => boolean,
): CostoDatato[] {
  return leads
    .filter((l) => l?.data && dentro(l.data.createdAt) && eConversione(l))
    .flatMap((l) =>
      vociCostoDi(l).map((v) => ({
        ...v,
        data: String(l.data.createdAt ?? "").slice(0, 10),
        origine: "pratica" as const,
        //  Il cliente: è la risposta alla domanda «di chi è questo costo»,
        //  che è l'unica per cui si apre il dettaglio di una voce.
        dettaglio: `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "Senza nome",
        leadId: l.id,
      })),
    );
}

/** Le spese fisse, una per mese. La data è il primo del mese: è il mese che
 *  conta, e un giorno preciso lo farebbe sembrare un pagamento avvenuto. */
export function costiDaiMesi(perMese: Record<string, VoceMese[]>): CostoDatato[] {
  return Object.entries(perMese).flatMap(([mese, voci]) =>
    voci.map((v) => ({
      ...v,
      data: `${mese}-01`,
      origine: "mese" as const,
      //  ⚠️ «In automatico» si dice: quella voce è comparsa perché segnata
      //   fissa, e per QUEL mese nessuno l'ha confermata. È un costo vero — è
      //   il motivo per cui esistono le fisse — ma chi apre la voce deve poter
      //   distinguere un numero confermato da uno riportato.
      dettaglio: v.automatica
        ? `${meseLeggibile(mese)} · in automatico, da confermare`
        : meseLeggibile(mese),
    })),
  );
}

/** Le fatture ricevute. ⚠️ Il TITOLO è il nome del fornitore: è su quel nome
 *  che si mette la spunta «si scarica», ed è giusto — la deducibilità di una
 *  fornitura dipende da chi la emette e da come, non da cosa c'è scritto nelle
 *  righe.
 *  ⚠️ E l'IVA viaggia col documento (`ivaDelDocumento`): non si scorpora con
 *   un'aliquota supposta una fattura che l'imposta ce l'ha scritta dentro. */
export function costiDaiFornitori(
  fatture: FatturaFornitore[],
  dentro: (d?: string | null) => boolean,
): CostoDatato[] {
  return fatture
    .filter((f) => dentro(f.data))
    .map((f) => {
      //  ⚠️ COSA PORTA IN CONTABILITÀ LO DECIDE IL REGIME, e la regola sta in
      //   un posto solo (`effettiContabili`): una fattura cinese non fa
      //   detrarre niente, una UE si autoliquida, una italiana porta la sua
      //   imposta. Ricopiare qui quel ragionamento vorrebbe dire due idee di
      //   come si tratta un acquisto estero.
      const e = effettiContabili(f);
      return {
        id: f.id,
        titolo: f.fornitore,
        importo: e.costo,
        data: f.data,
        origine: "fornitore" as const,
        dettaglio: [
          f.notaDiCredito ? "nota di credito" : null,
          //  Cosa è stato comprato, quando il documento lo dice: aprendo la
          //  voce «Shenzhen Hair Co.» si vuole sapere cosa c'era dentro, non
          //  rileggere il nome che si è appena cliccato.
          f.righe
            .map((x) => x.descrizione)
            .filter(Boolean)
            .join(", ") || null,
          f.numero && `n. ${f.numero}`,
          f.paese,
          f.aMano ? "scritta a mano" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        ivaDelDocumento: e.ivaDetraibile,
        daAutoliquidare: e.ivaAutoliquidata,
        //  Il divieto di legge lo decide `effettiContabili`, che è l'unico
        //  posto in cui si guarda come è stata pagata: qui si porta e basta.
        ...(e.bloccato ? { bloccoDiLegge: e.bloccato } : {}),
        //  Il segno l'ha già girato `effettiContabili`: qui si dice solo che
        //  quei numeri possono essere negativi, o le reti di sicurezza del
        //  conto li azzererebbero.
        ...(f.notaDiCredito ? { notaDiCredito: true } : {}),
        //  Il documento è in archivio: di questo costo si sa tutto. Vedi
        //  `conDocumento` in crm/contabilita.
        conDocumento: true,
        //  ⚠️ Ristoranti al 75, auto al 20: la percentuale viaggia col costo
        //   fino al conto, che la applica. Assente = 100, cioe' com'era prima.
        ...(f.percentualeDeducibile != null
          ? { percentualeDeducibile: f.percentualeDeducibile }
          : {}),
        ...(f.percentualeIva != null ? { percentualeIva: f.percentualeIva } : {}),
      };
    });
}
