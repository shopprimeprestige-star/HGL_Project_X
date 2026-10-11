/** ── CHI È ATTESO IN QUESTA CONSULENZA ─────────────────────────────────────
 *
 *  Richieste del committente: «nome e cognome si mettono in automatico se
 *  l'utente è registrato in quel link» e «gli slot con più persone generano un
 *  link uguale per tutti e 3».
 *
 *  GET ?sess=CODICE -> { ok, gruppo, attesi: [{ gettone, nome }] }
 *
 *  La pagina del cliente la chiede all'apertura e decide come farlo entrare:
 *   · una persona sola  → entra con il suo nome, senza chiedere niente;
 *   · due o più         → «chi sei?», con i nomi già scritti: un tocco;
 *   · nessuna           → scrive il nome, come si è sempre fatto.
 *
 *  ── ⚠️ QUANTO POCO SI PUÒ DIRE ───────────────────────────────────────────
 *  Questa rotta è pubblica per forza: chi bussa ha solo il link della stanza.
 *  Quindi esce il MINIMO che serva a riconoscersi:
 *   · il nome di battesimo e l'iniziale del cognome, non il cognome intero —
 *     i tre nomi li leggono tutte e tre le persone, e il cognome di un cliente
 *     non si consegna a chi gli sta seduto accanto;
 *   · un GETTONE al posto dell'id della scheda: quello finirebbe nella memoria
 *     del browser di un cliente, ed è la chiave con cui nel CRM si aprono le
 *     sue cose. Il gettone vale solo dentro questa stanza e fuori non apre
 *     niente (vedi `gettoneDi` in crm/fascia-consulenza).
 *  Niente telefono, niente email, niente stato della trattativa: quelli sono
 *  del consulente, e stanno dietro alla sua sessione.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chiaveAttesi,
  consulenzaDiGruppo,
  gettoneDi,
  leggiAttesi,
  nomeBreve,
  scriviAttesi,
  unisciAttesi,
  type PersonaAttesa,
} from "@/crm/fascia-consulenza";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** ── CHI È ATTESO, ANCHE NELLE STANZE NATE PRIMA ──────────────────────────
 *
 *  Misurato in archivio il 27/09/2026, subito dopo la pubblicazione: 201
 *  stanze di appuntamento, e righe `attesi:` DUE — le mie, di prova. Ovvio col
 *  senno di poi: quella riga la scrive il salvataggio dell'appuntamento, e
 *  nessuno ha motivo di risalvare gli appuntamenti già presi. Risultato: la
 *  plancia del gruppo non compariva mai, il cliente non aveva nessun gettone,
 *  e tutto il lavoro sui preventivi individuali era invisibile. Il committente
 *  l'ha detto in tre parole: «non funziona».
 *
 *  Il dato però c'è già, da un'altra parte: ogni appuntamento ha la sua riga
 *  `meet:<scheda>:<consulente>` con dentro il codice della stanza. Da lì si
 *  ricava chi è atteso, e lo si scrive dove serve — così la stanza si ripara
 *  da sola alla prima lettura e la volta dopo costa una riga sola (è lo stesso
 *  modo con cui le consulenze dimenticate si chiudono da sole).
 *
 *  ⚠️ NON È UNA MIGRAZIONE, ED È VOLUTO: una migrazione tocca tutto in una
 *   volta su un archivio di produzione, questa tocca una stanza quando
 *   qualcuno la apre davvero.
 *  ⚠️ L'ORDINE È QUELLO DI PRENOTAZIONE (`updated_at` crescente): è l'ordine
 *   in cui il cliente vedrà i nomi da scegliere, e non deve ballare a ogni
 *   lettura. */
async function dalleRigheDegliAppuntamenti(code: string): Promise<PersonaAttesa[]> {
  //  Il codice è già ripulito da chi chiama; qui si ripulisce comunque, perché
  //  finisce dentro un confronto di testo su una colonna.
  const c = code.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!c) return [];
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("key,value,updated_at")
    .like("key", "meet:%")
    .like("value", `%"code":"${c}"%`)
    .order("updated_at", { ascending: true });
  const idsInOrdine: string[] = [];
  for (const r of (data ?? []) as { key: string; value: string | null }[]) {
    let v: { code?: string; leadId?: string } = {};
    try { v = JSON.parse(String(r.value || "{}")) as typeof v; } catch { continue; }
    //  Il `like` è un filtro grossolano: qui si controlla il codice davvero.
    if (String(v.code || "").toLowerCase() !== c) continue;
    const id = String(v.leadId || "").trim();
    if (id && !idsInOrdine.includes(id)) idsInOrdine.push(id);
  }
  if (!idsInOrdine.length) return [];
  const { data: schede } = await supabaseAdmin
    .from("crm_leads")
    .select("id,nome:data->>nome,cognome:data->>cognome")
    .in("id", idsInOrdine);
  const perId = new Map(
    ((schede ?? []) as unknown as { id: string; nome: string | null; cognome: string | null }[])
      .map((l) => [l.id, l]),
  );
  let fuori: PersonaAttesa[] = [];
  for (const id of idsInOrdine) {
    const l = perId.get(id);
    if (!l) continue;
    /*  ⚠️ IL NOME PUÒ ESSERE TUTTO IN UN CAMPO SOLO. Nelle schede vere
        `nome` contiene spesso «Anna Verdi» e `cognome` è vuoto: se non si
        spezza, al cliente comparirebbe «Anna Verdi» senza iniziale e al
        consulente un cognome mancante. Si spezza solo quando serve. */
    const nome = String(l.nome ?? "").trim();
    const cognome = String(l.cognome ?? "").trim();
    const spazio = !cognome && nome.includes(" ") ? nome.lastIndexOf(" ") : -1;
    fuori = unisciAttesi(fuori, {
      leadId: id,
      nome: spazio > 0 ? nome.slice(0, spazio) : nome,
      ...(cognome ? { cognome } : spazio > 0 ? { cognome: nome.slice(spazio + 1) } : {}),
    });
  }
  return fuori;
}

/*  ── ⚠️ LE STANZE SENZA NESSUN ATTESO NON SI RICERCANO OGNI VOLTA ─────────
    Una consulenza aperta al volo non ha appuntamenti, quindi la ricerca qui
    sopra non troverà mai niente e non scriverà mai niente — e verrebbe
    rifatta a ogni lettura, cioè ogni quattro secondi per tutta la durata
    della consulenza (è il ritmo con cui il consulente rilegge la sala
    d'attesa). Quelle stanze si segnano qui e non si cercano più.
    ⚠️ IN MEMORIA, non in archivio: vale per questa istanza del server, che
     Cloudflare ricicla di continuo. È esattamente quello che serve — togliere
     la ricerca ripetuta dentro una consulenza — senza ricordarsi per sempre
     un «no» che domani potrebbe essere un «sì» (l'appuntamento si può
     prendere mentre la stanza è aperta). */
const senzaAppuntamenti = new Set<string>();

/** L'elenco degli attesi di una stanza. Vuoto quando non c'è: una consulenza
 *  aperta al volo non ha nessuno «in elenco», e va benissimo così. */
export async function attesiDellaStanza(code: string) {
  const c = String(code || "").trim();
  if (!c) return [];
  try {
    const { data } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", chiaveAttesi(c))
      .maybeSingle();
    const scritti = leggiAttesi((data as { value?: string | null } | null)?.value ?? null);
    if (scritti.length) return scritti;
    if (senzaAppuntamenti.has(c)) return [];
    const derivati = await dalleRigheDegliAppuntamenti(c);
    if (!derivati.length) senzaAppuntamenti.add(c);
    if (derivati.length) {
      //  ⚠️ La riparazione non deve mai far fallire la lettura: se la
      //   scrittura non riesce, l'elenco si ricava di nuovo al giro dopo.
      try {
        await supabaseAdmin.from("app_config").upsert(
          { key: chiaveAttesi(c), value: scriviAttesi(derivati), updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
        console.log(`[ATTESI] ${c}: elenco ricavato dagli appuntamenti (${derivati.length})`);
      } catch { /* si rifà */ }
    }
    return derivati;
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/public/attesi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const sess = String(new URL(request.url).searchParams.get("sess") || "").trim();
        if (!sess) return json({ ok: false, reason: "manca la stanza" }, 400);
        const attesi = await attesiDellaStanza(sess);
        return json({
          ok: true,
          gruppo: consulenzaDiGruppo(attesi),
          attesi: attesi.map((p) => ({ gettone: gettoneDi(p), nome: nomeBreve(p) })),
        });
      },
    },
  },
});
