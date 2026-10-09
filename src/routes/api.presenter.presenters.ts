/** ELENCO PRESENTATORI — E LA PORTA DA CUI SI ENTRA OGNI GIORNO ─────────────
 *  GET                                  -> { presenters: [{id,name}] }   (PIN mai esposti)
 *  POST {action:"create", name, pin}    -> crea            (serve l'accesso)
 *  POST {action:"update", id, name?, pin?}                 (serve l'accesso)
 *  POST {action:"delete", id}                              (serve l'accesso)
 *  POST {action:"login", id, pin}       -> { ok, presenter:{id,name} } + COOKIE di sessione
 *  Salvati in app_config.key = 'presenters' via service role.
 *
 *  ── PERCHÉ QUESTO FILE È CAMBIATO ─────────────────────────────────────────
 *  Erano due buchi, uno dentro l'altro.
 *
 *  1) CHIUNQUE poteva creare un presentatore scegliendosi il PIN. Siccome un PIN
 *     valido apre l'accesso da presentatore, questa era la scorciatoia per
 *     leggere l'archivio dei preventivi — nome, cognome, telefono ed email di
 *     clienti veri — senza sapere nulla. Proteggere /api/presenter/quotes e
 *     lasciare aperta questa rotta sarebbe stato mettere la serratura alla porta
 *     e lasciare la finestra spalancata. Ora creare, modificare e cancellare
 *     richiedono di essere già entrati.
 *
 *  2) `login` verificava il PIN e non rilasciava NIENTE: il browser si segnava
 *     il presentatore in localStorage e le rotte con i dati non avevano modo di
 *     sapere chi stesse chiamando. È la via con cui i consulenti entrano tutti i
 *     giorni (/presentatore e PresenterGate), quindi senza questo pezzo le
 *     pagine protette avrebbero risposto 401 a chi aveva appena digitato il PIN
 *     giusto. Adesso un login riuscito apre una vera sessione di server e
 *     restituisce il cookie: il browser lo rimanda da solo e le pagine
 *     continuano a funzionare senza cambiare una riga.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mestieriDi } from "@/crm/kpi-setter";
import {
  INTESTAZIONI_CONSENTITE,
  attesaLeggibile,
  chiaviUguali,
  creaSessione,
  frenoAttesa,
  frenoOk,
  frenoSbagliato,
  guardiaP,
  intestazioneSessione,
} from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

interface Presenter { id: string; name: string; pin: string }

async function readList(): Promise<Presenter[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenters").maybeSingle();
  try { return (JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Presenter[]) || []; } catch { return []; }
}
async function writeList(list: Presenter[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: "presenters", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}
// mai restituire i PIN al client
const strip = (l: Presenter[]) => l.map((p) => ({ id: p.id, name: p.name }));

/** ── IN MEETLY ENTRA CHI FA LE CONSULENZE, NON TUTTA LA SQUADRA ────────────
 *  L'elenco dei presentatori è uno specchio: il CRM ci riversa dentro CHIUNQUE
 *  riceva un PIN (api.crm.consulente-pin), e i PIN li ricevono anche setter,
 *  driver, installatori e manutentori — gente che in una consulenza non ci
 *  entra mai. Il risultato era una schermata d'accesso lunga il doppio del
 *  necessario, con dentro nomi che non devono nemmeno poter entrare.
 *
 *  Il mestiere non sta qui: `app_config.presenters` conserva solo id, nome e
 *  PIN. Sta in `crm_consultants.data`, e si legge con `mestieriDi` — la stessa
 *  funzione del CRM, per non avere due idee diverse di chi è consulente.
 *
 *  ⚠️ CHI NON HA MAI COMPILATO LA SCHEDA RESTA DENTRO, e non è una svista:
 *   `mestieriDi` risponde «consulente sì» a chi non ha mai scelto niente. Se
 *   filtrasse anche loro, il giorno del rilascio si troverebbe fuori mezza
 *   squadra senza che nessuno abbia cambiato una spunta. Esce solo chi è stato
 *   segnato ESPLICITAMENTE come non-consulente.
 *
 *  ⚠️ I PRESENTATORI FATTI A MANO (PresenterSettingsHub) RESTANO DENTRO: il
 *   loro id non è un id di consulente e in `crm_consultants` non esistono.
 *   Sono presentatori per definizione — è l'unico motivo per cui esistono.
 *
 *  ⚠️ SE LA LETTURA FALLISCE NON SI FILTRA NIENTE. Sbarrare tutti perché una
 *   query è andata storta vuol dire che nessuno lavora fino al giorno dopo:
 *   qui davanti c'è comunque il PIN, e un elenco troppo lungo è un fastidio,
 *   una porta chiusa a tutti è un'azienda ferma. */
const PARE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function soloConsulenti(list: Presenter[]): Promise<Presenter[]> {
  //  Solo gli id che possono davvero stare in `crm_consultants.id`: passarci
  //  un id inventato a mano fa fallire l'intera query (la colonna è uuid), e
  //  il filtro salterebbe per tutti.
  const ids = list.map((p) => p.id).filter((id) => PARE_UUID.test(id));
  if (ids.length === 0) return list;

  const { data, error } = await supabaseAdmin
    .from("crm_consultants")
    .select("id,data")
    .in("id", ids);
  if (error || !data) return list;

  const fuori = new Set<string>();
  for (const riga of data as { id: string; data: unknown }[]) {
    if (!mestieriDi(riga.data as never).faConsulente) fuori.add(riga.id);
  }
  return list.filter((p) => !fuori.has(p.id));
}

export const Route = createFileRoute("/api/presenter/presenters")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  L'elenco resta leggibile senza accesso, ed è voluto: è la schermata da
      //  cui si sceglie il proprio nome PRIMA di digitare il PIN. Escono solo
      //  id e nome — il PIN non passa mai di qui (vedi `strip`).
      GET: async () => json({ presenters: strip(await soloConsulenti(await readList())) }),

      POST: async ({ request }) => {
        let body: { action?: string; id?: string; name?: string; pin?: string } = {};
        try { body = (await request.json()) as typeof body; } catch { /* corpo illeggibile = azione mancante */ }
        const list = await readList();

        // ── ENTRARE ────────────────────────────────────────────────────────
        //  L'unica azione che si può fare da fuori: è il login stesso.
        if (body.action === "login") {
          //  Stesso freno dell'accesso al CRM: quattro cifre sono diecimila
          //  combinazioni, e un login riuscito qui apre l'archivio dei clienti.
          const attesa = await frenoAttesa(request);
          if (attesa) {
            return json({ ok: false, reason: `troppi tentativi: riprova fra ${attesaLeggibile(attesa)}` }, 429);
          }
          //  ⚠️ SI CERCA NELL'ELENCO FILTRATO, non in quello intero: togliere
          //   un nome dalla schermata e continuare ad accettarne il PIN
          //   sarebbe un ritocco all'interfaccia, non una porta chiusa. Chi
          //   non fa consulenze non entra nemmeno digitando il PIN giusto.
          const p = (await soloConsulenti(list)).find((x) => x.id === body.id);
          //  Confronto a tempo costante: la durata della risposta non deve
          //  raccontare quante cifre iniziali erano giuste.
          if (!p || !chiaviUguali(String(p.pin ?? ""), String(body.pin ?? ""))) {
            await frenoSbagliato(request);
            return json({ ok: false, reason: "bad_pin" });
          }
          await frenoOk(request);
          //  LA PARTE NUOVA: il PIN giusto vale una sessione vera, non solo una
          //  spunta nell'interfaccia. Il cookie è HttpOnly e il browser lo
          //  rimanda da solo a ogni chiamata.
          const token = await creaSessione({ id: p.id, nome: p.name, via: "pin" });
          return json(
            { ok: true, presenter: { id: p.id, name: p.name } },
            200,
            { "Set-Cookie": intestazioneSessione(request, token) },
          );
        }

        // ── DA QUI IN POI SI TOCCA CHI PUÒ ENTRARE ─────────────────────────
        //  Creare o modificare un presentatore significa creare o modificare un
        //  PIN, cioè una chiave dell'archivio clienti. Non basta essere dentro:
        //  chi entra col PIN di consulente NON deve poter fabbricare la chiave
        //  di un collega — o la sua, con permessi diversi. Serve `consulenti`,
        //  lo stesso permesso che nel CRM assegna i PIN.
        const no = await guardiaP(request, cors, "consulenti");
        if (no) return no;

        if (body.action === "create") {
          const name = (body.name || "").trim();
          const pin = (body.pin || "").trim();
          if (!name || !/^\d{4}$/.test(pin)) return json({ ok: false, reason: "invalid" }, 400);
          list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, pin });
          await writeList(list);
          return json({ ok: true, presenters: strip(list) });
        }
        if (body.action === "update") {
          const p = list.find((x) => x.id === body.id);
          if (!p) return json({ ok: false, reason: "not_found" }, 404);
          if (body.name != null && body.name.trim()) p.name = body.name.trim();
          if (body.pin != null && body.pin.trim()) {
            if (!/^\d{4}$/.test(body.pin.trim())) return json({ ok: false, reason: "invalid_pin" }, 400);
            p.pin = body.pin.trim();
          }
          await writeList(list);
          return json({ ok: true, presenters: strip(list) });
        }
        if (body.action === "delete") {
          const out = list.filter((x) => x.id !== body.id);
          await writeList(out);
          return json({ ok: true, presenters: strip(out) });
        }
        return json({ ok: false, reason: "bad_action" }, 400);
      },
    },
  },
});
