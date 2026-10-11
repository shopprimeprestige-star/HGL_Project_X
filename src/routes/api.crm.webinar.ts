/** ── WEBINAR — IL LATO PRESENTATORE ─────────────────────────────────────────
 *
 *  Qui passa tutto quello che solo chi presenta può fare: salvare le
 *  credenziali Cloudflare, creare una stanza, mandare in onda il proprio video.
 *  Gli spettatori hanno una porta separata e più stretta
 *  (`api.public.webinar`), da cui si può solo GUARDARE una diretta già viva.
 *
 *  ── PERCHÉ LA PUBBLICAZIONE PASSA DAL SERVER ──────────────────────────────
 *  L'SFU di Cloudflare si comanda con `appId` + `appSecret`. Il secondo è una
 *  chiave di spesa: chi ce l'ha apre sessioni sul tuo account finché il tuo
 *  traffico è finito. In un'applicazione che gira nel browser non esiste posto
 *  sicuro dove metterla — nemmeno una variabile d'ambiente, che finisce nel
 *  pacchetto servito. Quindi il browser parla con noi, e siamo noi a parlare
 *  con Cloudflare.
 *
 *  Effetto collaterale utile: **solo un utente autenticato può trasmettere**.
 *  Uno che si trovasse il codice di una stanza può guardare, mai andare in onda.
 *
 *  ── DOVE STANNO LE COSE ───────────────────────────────────────────────────
 *  `app_config.key = 'webinar_config'`  → credenziali e interruttore trasporto
 *  `app_config.key = 'webinar:<codice>'` → la singola stanza e la sua diretta
 *  Nessuna tabella nuova, nessuna migrazione: è lo stesso posto in cui vivono
 *  la configurazione TURN e le sessioni di Meetly.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiamanteCRM, nonAutenticatoCRM, vietatoCRM } from "./api.crm.accesso";
import { sessioneDaRichiesta } from "./api.presenter.consultant";
import {
  BATTITO_MS,
  CONFIG_PREDEFINITA,
  percorsoWebinar,
  type ConfigWebinar,
  type RelatoreInOnda,
  type StanzaWebinar,
  type TrasportoWebinar,
} from "@/webinar/tipi";
import { urlPubblico } from "@/lib/sito";
import { mandaPromemoria } from "@/webinar/promemoria.server";
import * as sala from "@/webinar/sala.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token, x-presenter-token",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const API = "https://rtc.live.cloudflare.com/v1";

// ══════════════════════════════════════════════════════════════════════════
//  CONFIGURAZIONE
// ══════════════════════════════════════════════════════════════════════════

export async function leggiConfig(): Promise<ConfigWebinar> {
  const { data } = await supabaseAdmin
    .from("app_config").select("value").eq("key", "webinar_config").maybeSingle();
  let salvata: Partial<ConfigWebinar> = {};
  try { salvata = JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {}; } catch { /* vuota */ }
  const appId = String(salvata.appId || "").trim();
  const appSecret = String(salvata.appSecret || "").trim();
  return {
    //  ⚠️ Un valore sconosciuto ricade su Meetly, non sull'SFU: se qualcuno
    //  scrive a mano una parola sbagliata nella configurazione, il webinar
    //  parte con la tecnologia che sappiamo funzionare invece che con quella
    //  che potrebbe non essere nemmeno configurata.
    trasporto: salvata.trasporto === "sfu" ? "sfu" : salvata.trasporto === "meetly" ? "meetly" : "meetly",
    simulcast: salvata.simulcast !== false,
    appId,
    appSecret,
    pronto: !!(appId && appSecret),
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  STANZE
// ══════════════════════════════════════════════════════════════════════════

const chiave = (codice: string) => `webinar:${codice.trim().slice(0, 64)}`;

/** Stesso alfabeto dei codici di Meetly: niente vocali, niente lettere che si
 *  confondono a voce. Un codice di webinar si detta in diretta e si legge da
 *  una slide, quindi vale ancora di più. */
const ALFABETO = "bcdfghjkmnpqrstvwxyz";
function gruppo(n: number): string {
  const r = new Uint32Array(n);
  crypto.getRandomValues(r);
  let s = "";
  for (let i = 0; i < n; i++) s += ALFABETO[r[i] % ALFABETO.length];
  return s;
}
const nuovoCodice = () => `${gruppo(3)}-${gruppo(4)}-${gruppo(3)}`;

async function leggiStanza(codice: string): Promise<StanzaWebinar | null> {
  const { data } = await supabaseAdmin
    .from("app_config").select("value").eq("key", chiave(codice)).maybeSingle();
  const grezzo = (data as { value?: string } | null)?.value;
  if (!grezzo) return null;
  try { return JSON.parse(grezzo) as StanzaWebinar; } catch { return null; }
}

async function scriviStanza(s: StanzaWebinar): Promise<void> {
  await supabaseAdmin.from("app_config").upsert(
    { key: chiave(s.codice), value: JSON.stringify(s), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  CLOUDFLARE
// ══════════════════════════════════════════════════════════════════════════

/** Una chiamata all'SFU. Ritorna il corpo già interpretato, oppure alza con il
 *  testo grezzo: quando l'API risponde male serve VEDERE cosa ha detto, non un
 *  «errore» generico che costringe a indovinare. */
async function cf(cfg: ConfigWebinar, percorso: string, metodo: "POST" | "PUT" | "GET", corpo?: unknown) {
  const r = await fetch(`${API}/apps/${cfg.appId}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${cfg.appSecret}`, "Content-Type": "application/json" },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${testo.slice(0, 500)}`);
  try { return JSON.parse(testo); } catch { throw new Error(`Cloudflare ha risposto qualcosa che non è JSON: ${testo.slice(0, 300)}`); }
}

// ══════════════════════════════════════════════════════════════════════════

/** `null` = si passa. Altrimenti è già la risposta da restituire.
 *
 *  ── DUE PORTE, E NON SONO LA STESSA ───────────────────────────────────────
 *  Il webinar si conduce da DENTRO Meetly, e chi sta lì dentro non ha un
 *  accesso al gestionale: ha una sessione da presentatore, nata dal PIN. Senza
 *  riconoscerla, il presentatore non potrebbe nemmeno vedere l'elenco delle
 *  sale che deve trasmettere.
 *
 *  ⚠️ MA SOLO PER IL MESTIERE, NON PER LE CHIAVI. La sessione da presentatore
 *   apre le sale, la regia, la chat e la diretta — cioè quello che serve a
 *   condurre. Le credenziali Cloudflare no: quelle restano al permesso
 *   «consulenti» del gestionale, perché sono una chiave di spesa e chi
 *   presenta non ha motivo di toccarla. Per questo `permesso` decide anche
 *   quale porta vale. */
async function guardia(request: Request, permesso: "agenda" | "consulenti", token?: unknown): Promise<Response | null> {
  if (permesso === "agenda" && (await sessioneDaRichiesta(request))) return null;
  const chi = await chiamanteCRM(request, token);
  if (!chi) return nonAutenticatoCRM(cors);
  if (!chi.accesso.puo(permesso)) return vietatoCRM(cors, permesso);
  return null;
}

interface Corpo {
  azione?: string;
  token?: unknown;
  codice?: string;
  titolo?: string;
  trasporto?: TrasportoWebinar;
  appId?: string;
  appSecret?: string;
  /** stato della camera del relatore, al battito: vedi RelatoreInOnda.camera */
  camera?: boolean;
  simulcast?: boolean;
  offerSdp?: string;
  /** quale mid porta quale traccia, letto dal browser dopo setLocalDescription */
  midAudio?: string;
  midVideo?: string;
  sessionId?: string;
  soglia?: number;
  nome?: string;
  testo?: string;
  fissa?: boolean;
  acceso?: boolean;
  id?: string;
  spettatore?: string;
  modo?: "audio" | "video";
  minuto?: number;
  presentatori?: string[];
  parla?: boolean;
  stato?: Record<string, unknown>;
  vista?: string;
  percorso?: string;
  primoPiano?: string;
  soloChiParla?: boolean;
  /** apre o chiude la possibilità di chiedere la parola: vedi RegiaPalco */
  maniAperte?: boolean;
  /** chi mettere alla pari con chi conduce; stringa vuota = nessuno */
  facciaAFaccia?: string;
  /** quale promemoria mandare: «manca-poco» o «in-diretta» */
  tipo?: string;
  /** il nome del template WhatsApp con cui spedirlo */
  template?: string;
  /** chi si vede; `null` = tornano tutti, array vuoto = nessuno */
  mostrati?: string[] | null;
  /** il numero a cui scrivere dopo la diretta: vedi StanzaWebinar.whatsapp */
  numero?: string;
  /** quando è previsto l'inizio: vedi StanzaWebinar.inizioPrevisto */
  inizioPrevisto?: string;
  /** che numero vede la sala: vedi StanzaWebinar.contatore */
  contatore?: string;
  /** quanti si sono iscritti: vedi StanzaWebinar.iscritti */
  iscritti?: number;
}

/** Dove sta il numero di CHI STA CHIEDENDO. Un presentatore che entra col suo
 *  accesso ha la sua riga; chi arriva dal gestionale usa quella del centro.
 *  ⚠️ Non è un dettaglio: due consulenti che conducono due dirette diverse non
 *   devono mandare i clienti allo stesso telefono. */
async function chiaveWhatsapp(request: Request): Promise<string> {
  const chi = await sessioneDaRichiesta(request);
  return chi?.id ? `webinar:whatsapp:${chi.id}` : "webinar:whatsapp";
}

async function leggiWhatsapp(request: Request): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_config").select("value").eq("key", await chiaveWhatsapp(request)).maybeSingle();
  return String((data as { value?: string } | null)?.value || "").trim();
}

export const Route = createFileRoute("/api/crm/webinar")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const azione = url.searchParams.get("azione") || "config";
        const token = url.searchParams.get("token") || undefined;

        if (azione === "config") {
          const stop = await guardia(request, "agenda", token);
          if (stop) return stop;
          const c = await leggiConfig();
          //  ⚠️ Si restituiscono TRE campi, non l'oggetto: `appSecret` non deve
          //  uscire di qui nemmeno per sbaglio, e l'unico modo sicuro di
          //  garantirlo è non scriverlo mai in una risposta.
          return json({ trasporto: c.trasporto, pronto: c.pronto, simulcast: c.simulcast, appId: c.appId });
        }

        //  ── I DIARI DI CHI HA GUARDATO ─────────────────────────────────
        //   Li scrive la sala (api.public.webinar, azione «diario») e li legge
        //   solo chi conduce: dentro c'è cosa è andato storto e su che
        //   apparecchio, ed è l'unico modo per rispondere a «si vede nero»
        //   con un fatto invece che con un'ipotesi.
        //  ── IL NUMERO A CUI SCRIVERE DOPO LA DIRETTA ───────────────────
        //   Sta per PRESENTATORE e non per sala: chi conduce lo scrive una
        //   volta e vale per tutte le sue dirette, che è esattamente quello
        //   che è stato chiesto. La sala se ne prende una copia quando si va
        //   in onda (vedi «pubblica»).
        if (azione === "whatsapp") {
          const stop = await guardia(request, "agenda", token);
          if (stop) return stop;
          return json({ ok: true, numero: await leggiWhatsapp(request) });
        }

        //  ── ⚠️ COM'È ANDATA ───────────────────────────────────────────
        //   I dati grezzi escono da qui, il CONTO lo fa la sala che li mostra
        //   (`webinar/misura-diretta`, provato). Farlo qui vorrebbe dire una
        //   regola che si può leggere solo in produzione, e che nessuno può
        //   provare senza una diretta vera.
        if (azione === "misura") {
          const codice = String(url.searchParams.get("codice") || "").trim();
          if (!codice) return json({ ok: false, error: "manca il codice" }, 400);
          const stanza = await leggiStanza(codice);
          const dati = await sala.perLaMisura(codice);
          return json({
            ok: true,
            //  ⚠️ L'inizio è quello della diretta, non della sala: la curva dei
            //   minuti si conta da quando si è andati in onda, altrimenti i
            //   primi venti minuti sono quelli in cui la sala esisteva e basta.
            inizio: stanza?.diretta?.iniziataIl ?? null,
            titolo: stanza?.titolo ?? "",
            ...dati,
          });
        }

        if (azione === "diagnostica") {
          const stop = await guardia(request, "agenda", token);
          if (stop) return stop;
          const codice = String(url.searchParams.get("codice") || "").trim().slice(0, 64);
          if (!codice) return json({ error: "manca il codice della sala" }, 400);
          const { data } = await supabaseAdmin
            .from("app_config").select("value").eq("key", `webinar:diario:${codice}`).maybeSingle();
          let diari: unknown[] = [];
          try { diari = JSON.parse((data as { value?: string } | null)?.value || "[]") as unknown[]; } catch { diari = []; }
          return json({ ok: true, diari: Array.isArray(diari) ? diari : [] });
        }

        if (azione === "elenco") {
          const stop = await guardia(request, "agenda", token);
          if (stop) return stop;
          const { data } = await supabaseAdmin
            .from("app_config").select("key, value").like("key", "webinar:%");
          const stanze: StanzaWebinar[] = [];
          for (const r of (data as { value?: string }[] | null) ?? []) {
            try { stanze.push(JSON.parse(r.value ?? "") as StanzaWebinar); } catch { /* riga illeggibile: si salta */ }
          }
          stanze.sort((a, b) => String(b.creataIl).localeCompare(String(a.creataIl)));

          //  ── ⚠️ CIASCUNO VEDE SOLO LE SALE CHE PUÒ CONDURRE ────────────
          //   Chi arriva con una sessione da presentatore è una PERSONA
          //   precisa, e vede le sale in cui è stato messo. Chi arriva dal
          //   gestionale le vede tutte: da lì si amministrano, e nascondergliele
          //   vorrebbe dire non poter più cambiare una sala che si è creata.
          const chiPresenta = await sessioneDaRichiesta(request);
          const visibili = chiPresenta
            ? stanze.filter((s) => !s.presentatori?.length || s.presentatori.includes(chiPresenta.id))
            : stanze;
          //  ⚠️ Gli iscritti si contano QUI, in una volta sola per tutte le
          //   sale: chiederli sala per sala dal browser vorrebbe dire dieci
          //   richieste per una pagina che si apre per fare altro.
          const iscritti = await Promise.all(visibili.map((s) => sala.quantiIscritti(s.codice)));
          return json({
            stanze: visibili.map((s, i) => ({
              ...s,
              link: urlPubblico(percorsoWebinar(s.codice)),
              iscritti: iscritti[i],
            })),
          });
        }

        return json({ error: "azione sconosciuta" }, 400);
      },

      POST: async ({ request }) => {
        let b: Corpo = {};
        try { b = (await request.json()) as Corpo; } catch { /* corpo vuoto */ }
        const azione = String(b.azione || "");

        // ── SALVA LA CONFIGURAZIONE ──────────────────────────────────────
        if (azione === "config") {
          const stop = await guardia(request, "consulenti", b.token);
          if (stop) return stop;
          const attuale = await leggiConfig();
          //  Il segreto si riscrive SOLO se ne arriva uno nuovo: la schermata
          //  non lo rilegge mai (non esce di qui), quindi salvare con il campo
          //  vuoto significa «non l'ho toccato», non «cancellalo».
          const value = JSON.stringify({
            trasporto: b.trasporto === "sfu" ? "sfu" : "meetly",
            simulcast: b.simulcast !== false,
            appId: String(b.appId ?? attuale.appId).trim(),
            appSecret: String(b.appSecret || "").trim() || attuale.appSecret,
          });
          await supabaseAdmin.from("app_config").upsert(
            { key: "webinar_config", value, updated_at: new Date().toISOString() } as never,
            { onConflict: "key" },
          );
          const c = await leggiConfig();
          return json({ ok: true, trasporto: c.trasporto, pronto: c.pronto, simulcast: c.simulcast });
        }

        const stop = await guardia(request, "agenda", b.token);
        if (stop) return stop;

        // ── CREA UNA STANZA ──────────────────────────────────────────────
        if (azione === "crea") {
          const stanza: StanzaWebinar = {
            codice: nuovoCodice(),
            titolo: String(b.titolo || "").trim().slice(0, 120) || "Webinar",
            creataIl: new Date().toISOString(),
            //  Zero = il numero si mostra sempre. Vedi `numeroDaMostrare`: la
            //  soglia serve a non far vedere «2 spettatori» a chi è arrivato
            //  per primo, non a raccontare numeri che non ci sono.
            sogliaVisibile: 0,
            //  Chi la può condurre. Vuoto = tutti; vedi la nota sul campo.
            presentatori: Array.isArray(b.presentatori) ? b.presentatori.map(String).slice(0, 12) : [],
            //  ⚠️ Si accetta solo una data che il server riesce a LEGGERE: una
            //   stringa qualsiasi finirebbe dritta nel conto alla rovescia
            //   della sala, e lì un orario illeggibile non è un campo vuoto —
            //   è un numero storto davanti a duecento persone.
            ...(Number.isFinite(Date.parse(String(b.inizioPrevisto || "")))
              ? { inizioPrevisto: new Date(String(b.inizioPrevisto)).toISOString() }
              : {}),
            diretta: null,
          };
          await scriviStanza(stanza);
          return json({ ok: true, stanza, link: urlPubblico(percorsoWebinar(stanza.codice)) });
        }

        const codice = String(b.codice || "").trim();
        if (!codice) return json({ error: "codice mancante" }, 400);
        const stanza = await leggiStanza(codice);
        if (!stanza) return json({ error: "stanza inesistente" }, 404);

        // ── VAI IN ONDA ──────────────────────────────────────────────────
        //  Il browser ha già creato la sua connessione con le tracce in uscita
        //  e ci manda l'offerta. Noi apriamo la sessione sull'SFU, ci
        //  attacchiamo le due tracce e restituiamo la risposta da applicare.
        if (azione === "pubblica") {
          const cfg = await leggiConfig();
          if (!cfg.pronto) return json({ error: "Cloudflare non è configurato" }, 400);
          if (!b.offerSdp) return json({ error: "offerta mancante" }, 400);
          try {
            const sess = await cf(cfg, "/sessions/new", "POST");
            const sessionId = String(sess?.sessionId || "");
            if (!sessionId) throw new Error("l'SFU non ha restituito un sessionId");

            //  ⚠️ LA COPIA SI PRENDE ADESSO, non quando la diretta finisce: a
            //   quel punto non c'è più nessuno collegato che possa chiederla, e
            //   la schermata di chiusura resterebbe senza numero proprio nel
            //   momento in cui è tutto quello che c'è a schermo.
            const numero = await leggiWhatsapp(request);
            if (numero) stanza.whatsapp = numero;

            //  I nomi delle tracce sono nostri e restano stabili: gli
            //  spettatori li usano per agganciarsi, e devono poter arrivare
            //  anche a diretta già cominciata senza chiedere niente a nessuno.
            //  (Il blocco che li decide sta qui sotto, prima della pubblicazione.)
            //  ── ⚠️ PIÙ VOCI SULLA STESSA SALA ────────────────────────
            //   Le tracce portano dentro l'identificativo di chi le manda: in
            //   due, «audio» e «audio» sarebbero la stessa traccia e il secondo
            //   coprirebbe il primo. Il PRIMO però resta «audio»/«video» senza
            //   suffisso, perché le sale già aperte e le schede già collegate
            //   quei due nomi li stanno chiedendo adesso: cambiarli avrebbe
            //   fatto sparire il video a chi sta guardando, nell'istante del
            //   rilascio.
            const chi = await sessioneDaRichiesta(request);
            const mioId = chi?.id || "principale";
            const mioNome = chi?.nome || "Presentatore";
            const gia = stanza.diretta?.relatori ?? [];
            const primo = gia.length === 0;
            const suffisso = primo ? "" : `-${mioId}`;
            const mio: RelatoreInOnda = {
              id: mioId,
              nome: mioNome,
              sessionId,
              tracciaAudio: `audio${suffisso}`,
              tracciaVideo: `video${suffisso}`,
              battitoIl: new Date().toISOString(),
            };
            //  Rientrando dopo una caduta si SOSTITUISCE la propria riga, non
            //  se ne aggiunge una seconda: la chiave è la persona, non la
            //  sessione.
            const relatori = [...gia.filter((r) => r.id !== mioId), mio];

            const tracks = [
              ...(b.midAudio ? [{ location: "local", mid: b.midAudio, trackName: mio.tracciaAudio }] : []),
              ...(b.midVideo ? [{ location: "local", mid: b.midVideo, trackName: mio.tracciaVideo }] : []),
            ];
            const r = await cf(cfg, `/sessions/${sessionId}/tracks/new`, "POST", {
              sessionDescription: { type: "offer", sdp: b.offerSdp },
              tracks,
            });

            stanza.diretta = {
              ...(stanza.diretta ?? {}),
              relatori,
              sessionId: relatori[0].sessionId,
              tracciaAudio: relatori[0].tracciaAudio,
              tracciaVideo: relatori[0].tracciaVideo,
              iniziataIl: stanza.diretta?.iniziataIl ?? new Date().toISOString(),
              //  Si parte da «camera»: la sala vede una faccia che saluta, non
              //  una schermata di cui non sa ancora niente.
              vista: stanza.diretta?.vista ?? "camera",
              battitoIl: new Date().toISOString(),
            };
            await scriviStanza(stanza);
            //  ⚠️ SI RICOMINCIA DA CAPO: via presenze, chat e palco della volta
            //   scorsa, e i messaggi programmati tornano da spedire. Senza,
            //   una replica dello stesso webinar partirebbe con la chat piena
            //   di ieri e con tutti gli automatismi già considerati partiti.
            await sala.rifai(codice);

            /** ── ⚠️ «SIAMO IN DIRETTA» PARTE DA SOLO, ADESSO ────────────
             *  È il messaggio che porta più gente di tutti, e ha una finestra
             *  di pochi minuti: chi lo riceve mezz'ora dopo l'inizio non entra
             *  più. Lasciarlo a un tasto da premere vuol dire che a volte non
             *  si preme — e proprio nelle sere in cui si è di corsa, che sono
             *  quelle in cui serve.
             *  ⚠️ NON si aspetta che finisca: chi conduce sta andando in onda,
             *   e duecento messaggi non possono stare fra lui e la diretta. Se
             *   qualcosa va storto lo si vede dal numero di avvisati, non da
             *   una diretta che non parte.
             *  ⚠️ E chi ha già ricevuto un promemoria da poco viene saltato:
             *   il silenzio lo garantisce `mandaPromemoria`. */
            void mandaPromemoria({
              codice,
              titolo: stanza.titolo || "",
              link: urlPubblico(percorsoWebinar(codice)),
              tipo: "in-diretta",
              template: stanza.templatePromemoria || "",
              origine: new URL(request.url).origin,
              intestazioni: { authorization: request.headers.get("authorization") || "" },
            }).catch(() => { /* la diretta non si ferma per un promemoria */ });

            return json({ ok: true, sessionId, answerSdp: r?.sessionDescription?.sdp || "" });
          } catch (e) {
            return json({ error: String((e as Error).message || e) }, 502);
          }
        }

        // ── SONO ANCORA QUI ──────────────────────────────────────────────
        //  Senza questo, una scheda chiusa di colpo lascerebbe la stanza
        //  «in onda» per sempre, e chi arriva dopo aspetterebbe un video che
        //  non arriva mai.
        if (azione === "battito") {
          if (stanza.diretta) {
            stanza.diretta.battitoIl = new Date().toISOString();
            //  Ognuno tiene viva la PROPRIA riga: così, se uno si scollega e
            //  non torna, sparisce lui e non la diretta.
            const chi = await sessioneDaRichiesta(request);
            const mioId = chi?.id || "principale";
            const r = stanza.diretta.relatori?.find((x) => x.id === mioId);
            if (r) {
              r.battitoIl = new Date().toISOString();
              if (typeof b.parla === "boolean") r.parla = b.parla;
              //  ⚠️ Solo se arriva: il battito lo manda anche chi non lo sa
              //   ancora dire (una scheda aperta prima del rilascio), e un
              //   `undefined` scritto qui spegnerebbe la camera a tutti.
              if (typeof b.camera === "boolean") r.camera = b.camera;
            }
            await scriviStanza(stanza);
          }
          return json({ ok: true, ogni: BATTITO_MS });
        }

        //  ── COSA VEDONO ─────────────────────────────────────────────────
        //   Il presentatore cambia quello che c'è sullo schermo della sala. La
        //   pagina la si registra INSIEME alla modalità: cambiando pagina
        //   mentre si è in «contenuti», la sala deve seguirti senza che tu
        //   debba ripremere niente.
        if (azione === "vista") {
          if (stanza.diretta) {
            const v = b.vista;
            stanza.diretta.vista = v === "camera" || v === "salotto" ? v : "contenuti";
            if (typeof b.percorso === "string" && b.percorso.startsWith("/")) {
              stanza.diretta.percorso = b.percorso.slice(0, 300);
            }
            await scriviStanza(stanza);
          }
          return json({ ok: true });
        }

        //  ── LA REGIA DEL PALCO ──────────────────────────────────────────
        //  ── CHE NUMERO VEDE LA SALA ────────────────────────────────────
        if (azione === "contatore") {
          const v = String(b.contatore || "");
          if (v !== "adesso" && v !== "totale" && v !== "iscritti" && v !== "niente") {
            return json({ error: "valore non valido" }, 400);
          }
          stanza.contatore = v;
          if (typeof b.iscritti === "number" && Number.isFinite(b.iscritti)) {
            //  Un tetto c'è, e non è morale: è che un numero a sei cifre in una
            //  pastiglia larga due dita esce dal bordo.
            stanza.iscritti = Math.max(0, Math.min(99_999, Math.round(b.iscritti)));
          }
          await scriviStanza(stanza);
          return json({ ok: true, contatore: v, iscritti: stanza.iscritti ?? 0 });
        }

        if (azione === "whatsapp") {
          //  ⚠️ NIENTE GUARDIA QUI: la POST ne ha già una sola, più in alto,
          //   che vale per tutte le azioni da qui in giù. Rimetterla avrebbe
          //   voluto dire un secondo controllo che il giorno che cambia cambia
          //   in un posto solo — cioè due porte con due chiavi diverse.
          //  ⚠️ Si accettano solo cifre, «+» e spazi: qui dentro finisce un
          //   link `wa.me`, e lasciar passare qualunque testo vorrebbe dire
          //   costruire un indirizzo con dentro roba altrui.
          const numero = String(b.numero || "").replace(/[^\d+ ]/g, "").trim().slice(0, 24);
          await supabaseAdmin.from("app_config").upsert(
            { key: await chiaveWhatsapp(request), value: numero } as never,
            { onConflict: "key" },
          );
          return json({ ok: true, numero });
        }

        //  ── ⚠️ AVVISA GLI ISCRITTI ────────────────────────────────────
        //   A mano e non a tempo, e per una ragione che va detta: qui non c'è
        //   nessun pianificatore. Un promemoria «un'ora prima» richiede
        //   qualcosa che si svegli da solo, e oggi non esiste. Quello che si
        //   può fare — e vale già la maggior parte del risultato — è: un tasto
        //   per mandarlo quando vuoi, e l'invio automatico nell'istante in cui
        //   vai in onda, che è il messaggio che porta più gente di tutti.
        if (azione === "promemoria") {
          const codice = String(b.codice || "").trim();
          const stanza = codice ? await leggiStanza(codice) : null;
          if (!stanza) return json({ ok: false, error: "sala non trovata" }, 404);
          const esito = await mandaPromemoria({
            codice,
            titolo: stanza.titolo || "",
            link: urlPubblico(percorsoWebinar(codice)),
            tipo: b.tipo === "in-diretta" ? "in-diretta" : "manca-poco",
            template: stanza.templatePromemoria || "",
            origine: new URL(request.url).origin,
            //  ⚠️ Si ripassa la stessa autorizzazione con cui è arrivata questa
            //   richiesta: la porta che spedisce vuole il permesso di chi
            //   conduce, e inventarne uno qui vorrebbe dire una seconda strada
            //   per mandare messaggi a nome dello studio. Una sola porta, un
            //   solo permesso.
            intestazioni: { authorization: request.headers.get("authorization") || "" },
          });
          return json({ ok: true, ...esito });
        }

        if (azione === "palcoscenico") {
          if (stanza.diretta) {
            stanza.diretta.regia = {
              //  Si conserva quello che c'era: i tre comandi della regia si
              //  premono uno alla volta, e ognuno non deve azzerare gli altri.
              ...(stanza.diretta.regia ?? {}),
              ...(typeof b.soloChiParla === "boolean" ? { soloChiParla: b.soloChiParla } : {}),
              //  ⚠️ La stringa vuota SPEGNE il primo piano. Prima la condizione
              //   era `&& b.primoPiano`, cioè il vuoto veniva scartato insieme
              //   al campo assente: non c'era modo di togliere il primo piano
              //   se non facendo scendere la persona.
              ...(typeof b.primoPiano === "string"
                ? b.primoPiano
                  ? { primoPiano: b.primoPiano }
                  : { primoPiano: undefined }
                : {}),
              //  ── ⚠️ `null` VUOL DIRE «TORNA A MOSTRARLI TUTTI» ────────────
              //   Il commento lo diceva già, il codice no: `Array.isArray(null)`
              //   è FALSO, quindi il ramo non scattava mai e il campo restava
              //   quello di prima. Il tasto «Tutti» mandava `null`, il server lo
              //   buttava via, e la lista non si toglieva più — l'unico modo di
              //   uscirne era rimettere dentro le persone una per una. È il
              //   difetto segnalato con «questi comandi non funzionano».
              //  ⚠️ Un array VUOTO resta una cosa diversa: vuol dire «nessuno»,
              //   ed è una scelta legittima. Il vuoto e l'assenza non si
              //   confondono.
              ...(b.mostrati === null
                ? { mostrati: undefined }
                : Array.isArray(b.mostrati)
                  ? { mostrati: b.mostrati.slice(0, 24).map(String) }
                  : {}),
              ...(typeof b.maniAperte === "boolean" ? { maniAperte: b.maniAperte } : {}),
              //  ⚠️ La stringa vuota SPEGNE il faccia a faccia, e serve: senza
              //   un modo di dire «nessuno», l'unica strada per uscire dal
              //   dibattito sarebbe far scendere la persona dal palco.
              ...(typeof b.facciaAFaccia === "string"
                ? b.facciaAFaccia
                  ? { facciaAFaccia: String(b.facciaAFaccia).slice(0, 64) }
                  : { facciaAFaccia: undefined }
                : {}),
            };
            await scriviStanza(stanza);
          }
          return json({ ok: true });
        }

        //  ── LO STATO DEI CONTENUTI ──────────────────────────────────────
        //   Quale slide, quale foto, dove si è scorso. Si FONDE con quello che
        //   c'è: ogni pacchetto porta solo quello che è cambiato, e
        //   sovrascrivere tutto azzererebbe la slide ogni volta che si muove il
        //   cursore di uno zoom.
        if (azione === "contenuti") {
          if (stanza.diretta && b.stato && typeof b.stato === "object") {
            stanza.diretta.contenuti = { ...(stanza.diretta.contenuti ?? {}), ...b.stato };
            await scriviStanza(stanza);
          }
          return json({ ok: true });
        }

        if (azione === "registrando") {
          if (stanza.diretta) {
            stanza.diretta.registrando = b.acceso !== false;
            await scriviStanza(stanza);
          }
          return json({ ok: true });
        }

        if (azione === "termina") {
          //  ⚠️ TERMINA CHI PREME, NON LA SALA. In due, chi chiude per primo
          //   spegneva la diretta anche all'altro — che restava a parlare a
          //   una stanza vuota senza capire perché. La diretta finisce quando
          //   esce l'ultimo.
          const chi = await sessioneDaRichiesta(request);
          const mioId = chi?.id || "principale";
          const restano = (stanza.diretta?.relatori ?? []).filter((r) => r.id !== mioId);
          if (stanza.diretta && restano.length > 0) {
            stanza.diretta.relatori = restano;
            stanza.diretta.sessionId = restano[0].sessionId;
            stanza.diretta.tracciaAudio = restano[0].tracciaAudio;
            stanza.diretta.tracciaVideo = restano[0].tracciaVideo;
          } else {
            stanza.diretta = null;
          }
          await scriviStanza(stanza);
          return json({ ok: true, ancoraInOnda: restano.length });
        }

        if (azione === "elimina") {
          await supabaseAdmin.from("app_config").delete().eq("key", chiave(codice));
          //  Senza questo, presenze e messaggi di webinar cancellati
          //  resterebbero nel database per sempre.
          await sala.sgombera(codice);
          return json({ ok: true });
        }

        // ══════════════════════════════════════════════════════════════════
        //  LA SALA, DAL LATO DI CHI CONDUCE
        // ══════════════════════════════════════════════════════════════════

        //  Il numero VERO, con i nomi. È il quadro di regia, e non passa dalla
        //  cache: chi conduce deve vedere la sala adesso, non tre secondi fa.
        if (azione === "sala") {
          const [n, chi, chat, chiSulPalco, prog, sch] = await Promise.all([
            sala.conta(codice), sala.presenti(codice), sala.messaggi(codice),
            sala.palco(codice), sala.programmati(codice), sala.schermi(codice),
          ]);
          return json({
            ok: true,
            presenti: n.presenti,
            passate: n.passate,
            sogliaVisibile: Number(stanza.sogliaVisibile ?? 0),
            elenco: chi,
            messaggi: chat.elenco,
            fissato: chat.fissato,
            palco: chiSulPalco,
            programmati: prog,
            iniziataIl: stanza.diretta?.iniziataIl ?? null,
            //  Se le quattro tabelle della sala non ci sono ancora, la diretta
            //  funziona lo stesso ma chat, presenze e palco restano vuoti per
            //  sempre. Meglio dirlo che lasciare chi conduce a chiedersi
            //  perché non scrive nessuno.
            tabelleMancanti: sala.tabelleMancanti(),
            schermi: sch,
            banditi: stanza.banditi ?? [],
          });
        }

        //  Il nome del template approvato su Meta con cui parte il promemoria.
        //  Vuoto lo toglie e si torna al messaggio scritto a mano.
        if (azione === "template-promemoria") {
          stanza.templatePromemoria = String(b.template || "").trim().slice(0, 80);
          await scriviStanza(stanza);
          return json({ ok: true, templatePromemoria: stanza.templatePromemoria });
        }

        if (azione === "soglia") {
          stanza.sogliaVisibile = Math.max(0, Math.round(Number(b.soglia) || 0));
          await scriviStanza(stanza);
          return json({ ok: true, sogliaVisibile: stanza.sogliaVisibile });
        }

        //  Chi conduce scrive col proprio nome e col proprio distintivo, ed è
        //  l'unico che può: il ruolo lo mette il server, non arriva da fuori.
        if (azione === "scrivi") {
          /** ── ⚠️ IL NOME LO SA IL SERVER, NON LO MANDA IL BROWSER ────────
           *  In chat compariva «Presentatore»: la console non spediva nessun
           *  nome e qui si finiva sul ripiego. Chiederlo al browser sarebbe
           *  stato peggio che inutile — un nome che arriva da fuori è un nome
           *  che si può scrivere a mano, e questo porta il distintivo RELATORE
           *  accanto. La sessione dice già chi sta conducendo, ed è la stessa
           *  fonte da cui esce il nome mostrato sopra il video: due strade per
           *  lo stesso nome vuol dire, il giorno che una cambia, un nome sul
           *  video e un altro in chat. */
          const chiScrive = await sessioneDaRichiesta(request);
          const m = await sala.scrivi(codice, {
            autore: (chiScrive?.nome || "").trim().slice(0, 60) || "Presentatore",
            ruolo: "presentatore",
            testo: String(b.testo || ""),
            fissa: !!b.fissa,
          });
          return json({ ok: true, messaggio: m });
        }

        if (azione === "fissa") {
          await sala.fissa(codice, String(b.id || ""), b.acceso !== false);
          return json({ ok: true });
        }

        if (azione === "cancella-messaggio") {
          await sala.cancellaMessaggio(codice, String(b.id || ""));
          return json({ ok: true });
        }

        // ── IL PALCO ────────────────────────────────────────────────────
        if (azione === "fai-salire") {
          const modo = b.modo === "video" ? "video" : "audio";
          //  Il nome viaggia insieme: di uno che non ha mai alzato la mano il
          //  palco non sa niente, e senza si ritroverebbe in onda un «Ospite»
          //  anonimo al posto della persona che ha appena fatto la domanda.
          const pass = await sala.faiSalire(codice, String(b.spettatore || ""), modo, String(b.nome || ""));
          //  Il lasciapassare NON torna qui: se lo restituissimo al
          //  presentatore non servirebbe a niente, perché deve arrivare al
          //  browser di CHI SALE. Ci arriva da solo, alla sua prossima
          //  chiamata di battito.
          return json({ ok: true, coniato: !!pass });
        }

        if (azione === "fai-scendere") {
          await sala.faiScendere(codice, String(b.spettatore || ""));
          return json({ ok: true });
        }

        if (azione === "microfono") {
          await sala.microfono(codice, String(b.spettatore || ""), b.acceso !== false);
          return json({ ok: true });
        }

        if (azione === "camera-ospite") {
          await sala.cameraOspite(codice, String(b.spettatore || ""), b.acceso !== false);
          return json({ ok: true });
        }

        //  ── ALLA PORTA ──────────────────────────────────────────────────
        //   Bandire è diverso da «fai scendere»: scendere è tornare fra il
        //   pubblico, bandire è non poter più entrare. Serve raramente e
        //   quando serve serve subito — un webinar aperto a chiunque abbia il
        //   link è un webinar in cui prima o poi entra qualcuno che disturba.
        if (azione === "bandisci" || azione === "riammetti") {
          const chi = String(b.spettatore || "");
          const elenco = new Set(stanza.banditi ?? []);
          if (azione === "bandisci") { elenco.add(chi); await sala.faiScendere(codice, chi); }
          else elenco.delete(chi);
          stanza.banditi = [...elenco].slice(0, 500);
          await scriviStanza(stanza);
          return json({ ok: true, banditi: stanza.banditi });
        }

        // ── I MESSAGGI PROGRAMMATI ──────────────────────────────────────
        if (azione === "programma") {
          await sala.creaProgrammato(codice, Number(b.minuto) || 0, String(b.testo || ""), !!b.fissa);
          return json({ ok: true, programmati: await sala.programmati(codice) });
        }

        if (azione === "sprograma") {
          await sala.eliminaProgrammato(codice, String(b.id || ""));
          return json({ ok: true, programmati: await sala.programmati(codice) });
        }

        //  ── È ORA? ──────────────────────────────────────────────────────
        //   Chiamata a ciclo dalla console mentre si è in onda. I minuti li
        //   conta il SERVER dall'orologio della diretta, non il browser: due
        //   schede aperte darebbero due conteggi diversi, e il messaggio
        //   uscirebbe due volte o mai.
        if (azione === "spedisci-dovuti") {
          const iniziata = Date.parse(String(stanza.diretta?.iniziataIl || "")) || 0;
          if (!iniziata) return json({ ok: true, usciti: 0 });
          const minuti = (Date.now() - iniziata) / 60000;
          const dovuti = await sala.daSpedire(codice, minuti);
          for (const d of dovuti) {
            await sala.scrivi(codice, {
              //  ⚠️ L'AUTORE È SEMPRE CHI CONDUCE. Vedi la nota su
              //   MessaggioProgrammato in webinar/tipi: un messaggio automatico
              //   firmato da uno spettatore inventato è una testimonianza
              //   falsa, e non è una cosa che questo programma sa fare.
              autore: String(b.nome || "").trim().slice(0, 60) || "Presentatore",
              ruolo: "presentatore",
              testo: d.testo,
              fissa: d.fissa,
            });
          }
          return json({ ok: true, usciti: dovuti.length });
        }

        return json({ error: "azione sconosciuta" }, 400);
      },
    },
  },
});

export const _perLeProve = { nuovoCodice, chiave };
export { CONFIG_PREDEFINITA };
