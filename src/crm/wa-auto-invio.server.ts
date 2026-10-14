/** ─────────────────────────────────────────────────────────────────────────
 *  wa-auto-invio.server.ts — IL MOTORE DEL WHATSAPP AUTOMATICO AI LEAD
 *
 *  Un giro: lo chiama `/hooks/wa-auto` ogni minuto (pg_cron). Tutte le regole
 *  che decidono SE mandare stanno in `wa-auto-regole.ts` (pure, provate una per
 *  una); qui c'è solo la colla: leggere, prenotare, mandare, scrivere l'esito.
 *
 *  ⚠️ L'ORDINE È IL PUNTO
 *   1. Il lucchetto del giro (`wa_auto_prendi_giro`): se un altro giro è in
 *      corso si risponde «occupato» e basta.
 *   2. Si prenota la riga nel registro PRIMA di scrivere a WhatsApp. L'indice
 *      unico (lead, regola, scadenza) fa perdere la corsa al secondo giro:
 *      23505, e non manda. Un invio fallito non si ritenta da solo.
 *   3. L'esito si scrive DOPO. Se il giro muore a metà resta una riga
 *      «prenotato» e il messaggio non viene rimandato: meglio uno in meno
 *      che uno doppio, su un numero che si può bannare.
 *
 *  ⚠️ IL CONSENSO SI LEGGE SOLO PER ID
 *   `public_leads` si legge UNA volta, `.in("id", [publicLeadId dei candidati])`,
 *   e il consenso vale solo se è la riga da cui è nato il lead. Mai cercando
 *   per telefono: un altro modulo con lo stesso numero non dà il permesso.
 *
 *  ⚠️ NIENTE TOKEN DA NESSUNA PARTE tranne che nell'intestazione verso Meta:
 *   non nel registro, non nei log, non nell'esito.
 *
 *  Il database e il `fetch` arrivano da fuori (`db`, `fetchFn`): le prove ci
 *  mettono uno finto, e non parte mai niente verso WhatsApp.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  FINESTRA_MS,
  MAX_PER_GIRO,
  SILENZIO_MS,
  TETTO_GIORNALIERO,
  consensoValido,
  daMandare,
  inizioGiornoRoma,
  oraRoma,
  parametriTemplate,
  regoleEffettive,
  scadenzePer,
  telefonoE164,
  type Candidato,
  type LeadWa,
  type ModuloWa,
  type Saltato,
} from "./wa-auto-regole";
import {
  chiamaGraph,
  classificaErrore,
  costruisciPayload,
  erroreModoNonCoerente,
  isMetaTestNumber,
  leggiNumero,
  type FetchGraph,
} from "./wa-graph.server";

/** Il pezzo di Supabase che serve (il client vero o uno finto). I tipi generati non conoscono le tabelle nuove, quindi niente tipi stretti. */
export interface DbWa {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabella: string) => any;
  rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: ErroreDb | null }>;
}
interface ErroreDb {
  code?: string;
  message?: string;
}

export interface EsitoUtente {
  user_id: string;
  esito: "occupato" | "rifiutato" | "saltato" | "errore" | "ok";
  motivo?: string;
  /** Righe prenotate in questo giro (inviate, simulate o fallite). */
  mandati: number;
  simulati: number;
  falliti: number;
  /** Righe «saltato» scritte nel registro (STOP, fuori fascia, dati mancanti). */
  saltati: number;
}
export interface EsitoGiro {
  ok: boolean;
  adesso: string;
  avviso?: string;
  utenti: EsitoUtente[];
}

interface Impostazioni {
  user_id: string;
  phone_number_id: string | null;
  access_token: string | null;
  app_secret: string | null;
  mode: string | null;
  auto_simulato: boolean | null;
  auto_tetto_giorno: number | null;
  auto_qualita: string | null;
  auto_sospeso_motivo: string | null;
}

interface RigaRegistro {
  lead_id: string;
  regola: string;
  scadenza: string;
  telefono_e164: string;
  stato: string;
  prenotato_il: string;
}

const STATI_DI_INTERESSE = ["da_ricontattare", "appuntamento_fissato", "appuntamento_rifissato"];

/** Tabella o colonna che non c'è (codice online prima della migrazione): non è un guasto, il giro salta. */
function eMancante(e: ErroreDb | null | undefined): boolean {
  if (!e) return false;
  return (
    ["42P01", "42703", "PGRST204", "PGRST205", "PGRST202", "PGRST200"].includes(String(e.code)) ||
    /does not exist|schema cache|could not find/i.test(String(e.message ?? ""))
  );
}

const vuoto = (user_id: string, esito: EsitoUtente["esito"], motivo?: string): EsitoUtente => ({
  user_id, esito, motivo, mandati: 0, simulati: 0, falliti: 0, saltati: 0,
});

export async function eseguiGiro(o: { db: DbWa; fetchFn: FetchGraph; adesso: Date }): Promise<EsitoGiro> {
  const { db, adesso } = o;
  const base: EsitoGiro = { ok: true, adesso: adesso.toISOString(), utenti: [] };

  const { data: attivi, error: errAttivi } = await db
    .from("whatsapp_settings")
    .select("user_id, phone_number_id, access_token, app_secret, mode, auto_simulato, auto_tetto_giorno, auto_qualita, auto_sospeso_motivo")
    .eq("auto_attivo", true);
  if (errAttivi) {
    if (eMancante(errAttivi)) return { ...base, avviso: "migrazione non applicata (colonne auto_* mancanti)" };
    return { ...base, ok: false, avviso: "lettura delle impostazioni fallita" };
  }
  for (const imp of (attivi ?? []) as Impostazioni[]) {
    try {
      base.utenti.push(await giroDiUnUtente(o, imp));
    } catch (e) {
      //  Mai il messaggio intero: potrebbe portarsi dietro un pezzo di richiesta.
      console.error("[wa-auto] giro fallito", { user_id: imp.user_id, errore: e instanceof Error ? e.name : "sconosciuto" });
      base.utenti.push(vuoto(imp.user_id, "errore", "giro interrotto"));
    }
  }
  return base;
}

async function giroDiUnUtente(
  o: { db: DbWa; fetchFn: FetchGraph; adesso: Date },
  imp: Impostazioni,
): Promise<EsitoUtente> {
  const { db, fetchFn, adesso } = o;
  const user = imp.user_id;
  const esito = vuoto(user, "ok");
  const simulato = imp.auto_simulato !== false;

  /* ── 1. Il live ha condizioni in più, e si controllano PRIMA di toccare qualunque cosa ── */
  if (!simulato) {
    let rifiuto: string | null = null;
    if (!imp.phone_number_id || !imp.access_token) rifiuto = "manca il Phone Number ID o il token";
    else if (!imp.app_secret) rifiuto = "manca l'app_secret: senza firma verificata STOP e qualità non contano, il live non si accende";
    else if (imp.auto_qualita && imp.auto_qualita.toUpperCase() !== "GREEN") rifiuto = `qualità del numero ${imp.auto_qualita}: invii fermi`;
    if (rifiuto) {
      if (imp.auto_sospeso_motivo !== rifiuto) {
        await db.from("whatsapp_settings").update({ auto_sospeso_motivo: rifiuto, auto_sospeso_il: adesso.toISOString() }).eq("user_id", user);
      }
      return { ...esito, esito: "rifiutato", motivo: rifiuto };
    }
  }

  /* ── 2. Il lucchetto ── */
  const lock = await db.rpc("wa_auto_prendi_giro", { p_user: user });
  if (lock.error) return eMancante(lock.error) ? { ...esito, esito: "saltato", motivo: "lucchetto non disponibile (migrazione)" } : { ...esito, esito: "errore", motivo: "lucchetto" };
  if (lock.data !== true) return { ...esito, esito: "occupato" };

  /* ── 3. Cosa c'è da guardare ── */
  const oggi = oraRoma(adesso).data;
  const ieri = new Date(adesso.getTime() - 86400000);
  const { data: righeRegole, error: errRegole } = await db.from("wa_auto_regole").select("*").eq("user_id", user);
  if (errRegole) return eMancante(errRegole) ? { ...esito, esito: "saltato", motivo: "tabella delle regole mancante" } : { ...esito, esito: "errore", motivo: "regole" };
  const regole = regoleEffettive(righeRegole);

  const { data: righeLead, error: errLead } = await db
    .from("crm_leads")
    .select("id, data")
    .eq("user_id", user)
    .in("data->>stato", STATI_DI_INTERESSE)
    //  Solo chi ha una data da ieri in poi: i lead vecchi non hanno niente da dire.
    .or(`data->>dataMeeting.gte.${oraRoma(ieri).data},data->>dataRicontatto.gte.${oraRoma(ieri).data}`);
  if (errLead) return { ...esito, esito: "errore", motivo: "lead" };

  const { data: righeOggi, error: errOggi } = await db
    .from("wa_auto_invii")
    .select("lead_id, regola, scadenza, telefono_e164, stato, prenotato_il")
    .eq("user_id", user)
    .gte("prenotato_il", inizioGiornoRoma(adesso).toISOString());
  if (errOggi) return eMancante(errOggi) ? { ...esito, esito: "saltato", motivo: "registro mancante" } : { ...esito, esito: "errore", motivo: "registro" };
  const registro = (righeOggi ?? []) as RigaRegistro[];
  const chiave = (lead: string, regola: string, scad: Date | string) => `${lead}|${regola}|${new Date(scad).getTime()}`;
  const gia = new Set(registro.map((r) => chiave(r.lead_id, r.regola, r.scadenza)));
  const prenotatiOggi = registro.filter((r) => r.stato !== "saltato").length;
  const recenti = registro
    .filter((r) => r.stato !== "saltato" && adesso.getTime() - new Date(r.prenotato_il).getTime() < SILENZIO_MS)
    .map((r) => ({ telefono: r.telefono_e164, quando: new Date(r.prenotato_il) }));

  /* ── 4. Le scadenze in finestra, non ancora nel registro ── */
  const inFinestra: Array<{ lead: LeadWa; s: ReturnType<typeof scadenzePer>[number] }> = [];
  for (const riga of (righeLead ?? []) as Array<{ id: string; data: LeadWa["data"] }>) {
    const lead: LeadWa = { id: riga.id, data: riga.data ?? {} };
    for (const s of scadenzePer(lead, regole)) {
      const eta = adesso.getTime() - s.scadenza.getTime();
      if (eta < 0 || eta > FINESTRA_MS) continue;
      if (gia.has(chiave(lead.id, s.regola, s.scadenza))) continue;
      inFinestra.push({ lead, s });
    }
  }
  if (inFinestra.length === 0) return esito;

  /* ── 5. Il consenso: UNA lettura, per id ── */
  const idModuli = [...new Set(inFinestra.map((x) => x.lead.data.publicLeadId).filter((x): x is string => !!x))];
  const moduli = new Map<string, ModuloWa>();
  if (idModuli.length > 0) {
    const { data: righeModuli, error: errModuli } = await db
      .from("public_leads")
      .select("id, telefono, consenso_whatsapp, consenso_whatsapp_il, consenso_whatsapp_versione")
      .in("id", idModuli);
    if (errModuli) return eMancante(errModuli) ? { ...esito, esito: "saltato", motivo: "consenso non disponibile (migrazione)" } : { ...esito, esito: "errore", motivo: "consenso" };
    for (const m of (righeModuli ?? []) as ModuloWa[]) moduli.set(m.id, m);
  }

  const idConsulenti = [...new Set(inFinestra.map((x) => x.lead.data.consulenteId).filter((x): x is string => !!x))];
  const nomiConsulenti = new Map<string, string>();
  if (idConsulenti.length > 0) {
    const { data: consulenti } = await db.from("crm_consultants").select("id, data").in("id", idConsulenti);
    for (const c of (consulenti ?? []) as Array<{ id: string; data?: { nome?: string } }>) nomiConsulenti.set(c.id, c.data?.nome ?? "");
  }

  const { data: righeEsclusi, error: errEsclusi } = await db.from("wa_auto_esclusi").select("telefono_e164").eq("user_id", user);
  if (errEsclusi) return eMancante(errEsclusi) ? { ...esito, esito: "saltato", motivo: "tabella degli esclusi mancante" } : { ...esito, esito: "errore", motivo: "esclusi" };
  const esclusi = ((righeEsclusi ?? []) as Array<{ telefono_e164: string }>).map((x) => x.telefono_e164);

  /* ── 6. Chi ha il consenso, e ha tutti i dati ── */
  const parametri = new Map<Candidato, string[]>();
  const candidati: Candidato[] = [];
  for (const { lead, s } of inFinestra) {
    if (!consensoValido(lead, moduli.get(lead.data.publicLeadId ?? ""))) continue;
    const telefono = telefonoE164(lead.data.telefono);
    if (!telefono) continue;
    const c: Candidato = { leadId: lead.id, regola: s.regola, scadenza: s.scadenza, telefono, template: s.template, ora_da: s.ora_da, ora_a: s.ora_a };
    const p = parametriTemplate(s.template, lead, nomiConsulenti.get(lead.data.consulenteId ?? "") ?? "");
    if (!p.ok) {
      //  Un dato che manca non si inventa: si registra e basta.
      if (await scrivi(db, user, c, "saltato", p.motivo, simulato)) esito.saltati++;
      continue;
    }
    parametri.set(c, p.params);
    candidati.push(c);
  }

  const { mandare, saltati } = daMandare(candidati, prenotatiOggi, recenti, esclusi, adesso, {
    tetto: Number.isFinite(imp.auto_tetto_giorno) && imp.auto_tetto_giorno! > 0 ? imp.auto_tetto_giorno! : TETTO_GIORNALIERO,
    maxGiro: MAX_PER_GIRO,
  });
  for (const sal of saltati as Saltato[]) {
    if (sal.definitivo && (await scrivi(db, user, sal.candidato, "saltato", sal.motivo, simulato))) esito.saltati++;
  }
  if (mandare.length === 0) return esito;

  /* ── 7. Il live: il numero deve essere quello vero, prima di prenotare qualunque cosa ── */
  let numero: { ok: boolean; meta: Awaited<ReturnType<typeof leggiNumero>>["meta"] } | null = null;
  if (!simulato) {
    numero = await leggiNumero(fetchFn, imp.phone_number_id!, imp.access_token!);
    const blocco = erroreModoNonCoerente(imp.mode === "sandbox" ? "sandbox" : "live", numero.ok && isMetaTestNumber(numero.meta), numero.meta, imp.phone_number_id!);
    if (blocco) return { ...esito, esito: "rifiutato", motivo: "modalità live con il numero di prova di Meta" };
  }

  /* ── 8. Prenota, manda, scrivi l'esito ── */
  for (const c of mandare) {
    const prenotata = await db
      .from("wa_auto_invii")
      .insert({
        user_id: user, lead_id: c.leadId, regola: c.regola, scadenza: c.scadenza.toISOString(),
        telefono_e164: c.telefono, template: c.template, stato: "prenotato", simulato,
      })
      .select("id")
      .maybeSingle();
    //  23505 = un altro giro ha prenotato la stessa cosa un attimo prima: non si manda.
    if (prenotata.error || !prenotata.data) continue;
    const id = (prenotata.data as { id: string }).id;
    const esitoRiga = (v: Record<string, unknown>) =>
      db.from("wa_auto_invii").update({ ...v, esito_il: new Date().toISOString() }).eq("id", id);
    esito.mandati++;

    if (simulato) {
      await esitoRiga({ stato: "simulato" });
      esito.simulati++;
      continue;
    }

    const params = parametri.get(c) ?? [];
    const payload = costruisciPayload(c.telefono, { templateName: c.template, templateParams: params });
    let risposta: Awaited<ReturnType<typeof chiamaGraph>>;
    try {
      risposta = await chiamaGraph(fetchFn, imp.phone_number_id!, imp.access_token!, payload);
    } catch (e) {
      await esitoRiga({ stato: "fallito", motivo: `rete: ${e instanceof Error ? e.message : "errore sconosciuto"}`.slice(0, 300) });
      await scriviChat(db, user, c, imp, { status: "failed", errore: "rete" });
      esito.falliti++;
      break;
    }
    if (!risposta.ok) {
      const err = classificaErrore(risposta.json, risposta.status, !!numero && numero.ok && isMetaTestNumber(numero.meta));
      console.error("[wa-auto] Meta error", { category: err.category, code: err.code, error_subcode: err.sub, fbtrace_id: risposta.json.error?.fbtrace_id });
      await esitoRiga({ stato: "fallito", motivo: `${err.category}: ${err.fullMsg}`.slice(0, 500) });
      await scriviChat(db, user, c, imp, { status: "failed", errore: err.fullMsg, raw: risposta.json });
      esito.falliti++;
      //  Un rifiuto di Meta non si insegue: il giro si ferma, il prossimo guarda da capo.
      break;
    }
    const waId = risposta.json.messages?.[0]?.id ?? null;
    await esitoRiga({ stato: "inviato", wa_message_id: waId });
    await scriviChat(db, user, c, imp, { status: "sent", waId, raw: risposta.json });
  }
  return esito;
}

/** Scrive una riga «saltato»: vale una volta sola, l'indice unico fa il resto. true se l'ha scritta. */
async function scrivi(db: DbWa, user: string, c: Candidato, stato: "saltato", motivo: string, simulato: boolean): Promise<boolean> {
  const { error } = await db.from("wa_auto_invii").insert({
    user_id: user, lead_id: c.leadId, regola: c.regola, scadenza: c.scadenza.toISOString(),
    telefono_e164: c.telefono, template: c.template, stato, motivo, simulato, esito_il: new Date().toISOString(),
  });
  return !error;
}

/** Come l'invio a mano: il messaggio compare nella chat del lead, e gli stati del webhook si agganciano a `wa_message_id`. */
async function scriviChat(
  db: DbWa,
  user: string,
  c: Candidato,
  imp: Impostazioni,
  r: { status: "sent" | "failed"; waId?: string | null; errore?: string; raw?: unknown },
): Promise<void> {
  await db.from("whatsapp_messages").insert({
    user_id: user,
    lead_id: c.leadId,
    direction: "outbound",
    from_number: imp.phone_number_id,
    to_number: c.telefono,
    body: `[template:${c.template}]`,
    status: r.status,
    ...(r.status === "sent" ? { wa_message_id: r.waId ?? null } : { error_message: r.errore }),
    raw_payload: (r.raw ?? null) as Record<string, unknown> | null,
  });
  if (r.status === "sent") {
    await db.from("whatsapp_contacts").upsert(
      { user_id: user, phone_e164: c.telefono, lead_id: c.leadId, last_message_at: new Date().toISOString() },
      { onConflict: "user_id,phone_e164" },
    );
  }
}
