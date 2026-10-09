/** ─────────────────────────────────────────────────────────────────────────
 *  DI CHI È IL LISTINO CHE STO LEGGENDO — la parte che parla col database
 *
 *  Le regole stanno in `shop/ambito-listino.ts` e sono provate lì. Qui c'è
 *  solo il giro sul database, che non si può provare senza database:
 *   · qual è l'id del consulente che sta chiedendo (dal suo accesso);
 *   · qual è l'id del consulente che conduce UNA consulenza (dal codice che il
 *     cliente ha nell'indirizzo);
 *   · leggere la riga giusta, con il ripiego sulla riga di casa.
 *
 *  ⚠️ VIVE IN `crm/` E NON IN `routes/`: dentro `routes` ogni file è una
 *   rotta, e un file di servizio lì in mezzo finirebbe nell'albero delle
 *   pagine. Il suffisso `.server` dice l'altra metà: importa il service role,
 *   e non deve mai finire nel pacchetto del browser.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BASE_LISTINO, BASE_SESSIONE_DI, chiaveAmbito, idAmbito } from "@/shop/ambito-listino";
import { chiaveSessione } from "@/shop/chiave-sessione";
import type { PricingOverrides } from "@/shop/quote-menu";

/** ⚠️ Il solito cast di questo repo: i tipi generati non conoscono
 *  `app_config`. Una porta sola, invece di errori di compilazione sparsi. */
type ErroreDb = { message: string } | null;
const config = () =>
  (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: { value?: string | null } | null }> };
      };
      upsert: (v: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: ErroreDb }>;
    };
  }).from("app_config");

async function leggiRiga(chiave: string): Promise<string | null> {
  const { data } = await config().select("value").eq("key", chiave).maybeSingle();
  return data?.value ?? null;
}

/** ── LA REGOLA DI LETTURA, UNA SOLA PER TUTTE LE RIGHE ────────────────────
 *  La riga tua, se ce l'hai; altrimenti quella di casa. Vale per il listino,
 *  per gli sconti quantità, per le garanzie e per la durata delle promozioni:
 *  scriverla quattro volte vorrebbe dire che il giorno in cui cambia, cambia
 *  in tre posti su quattro.
 *  Torna anche DA DOVE viene, perché chi salva deve sapere se sta per creare
 *  la propria riga partendo da quella di casa. */
export async function grezzoAmbito(
  base: string,
  consulente: unknown,
): Promise<{ valore: string | null; chiave: string; suo: boolean }> {
  const id = idAmbito(consulente);
  const chiave = chiaveAmbito(base, id);
  if (id) {
    const mio = await leggiRiga(chiave);
    if (mio != null) return { valore: mio, chiave, suo: true };
  }
  //  Ripiego sulla riga di casa. ⚠️ La chiave restituita resta la SUA: chi
  //  salva deve scrivere nella propria riga, non tornare a scrivere su quella
  //  di tutti perché è da lì che ha letto.
  return { valore: await leggiRiga(base), chiave, suo: false };
}

export const grezzoListino = (consulente: unknown) => grezzoAmbito(BASE_LISTINO, consulente);

/** Scrive nella riga di chi sta salvando: la sua se è un consulente, quella di
 *  casa se ha le chiavi di casa. */
export async function scriviAmbito(
  base: string,
  consulente: unknown,
  valore: string,
): Promise<ErroreDb> {
  const { error } = await config().upsert(
    { key: chiaveAmbito(base, idAmbito(consulente)), value: valore, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return error;
}

/** Il listino già interpretato. Un valore illeggibile vale come nessun
 *  listino: meglio i prezzi di catalogo che un errore a metà consulenza. */
export async function listinoDi(consulente: unknown): Promise<PricingOverrides> {
  const { valore } = await grezzoListino(consulente);
  try {
    return JSON.parse(valore ?? "{}") as PricingOverrides;
  } catch {
    return {};
  }
}

export const scriviListino = (consulente: unknown, valore: string) =>
  scriviAmbito(BASE_LISTINO, consulente, valore);

/** ── CHI CONDUCE QUESTA CONSULENZA ────────────────────────────────────────
 *  Il cliente non sa chi è il suo consulente — sa il codice della sua stanza,
 *  che ha nell'indirizzo. La riga della sessione (`session_live:<codice>`)
 *  porta l'id di chi l'ha avviata: è la traduzione da codice a consulente, e
 *  si fa QUI, sul server, perché l'id del consulente al cliente non si manda.
 *
 *  ⚠️ Torna stringa vuota quando non lo sa: link aperto prima che la
 *   consulenza sia avviata, o sessione mai partita. Vuol dire «listino di
 *   casa», e la pagina del cliente richiede i prezzi quando il consulente
 *   entra — vedi il ricarico periodico in routes/preventivo. */
export async function consulenteDellaSessione(codice: unknown): Promise<string> {
  //  1. Chi sta conducendo ADESSO, se la consulenza è viva. Comanda lei: un
  //     codice può essere ripreso da un collega, e chi conduce in questo
  //     momento conta più di chi l'ha aperto ieri.
  const grezzo = await leggiRiga(chiaveSessione("session_live", codice));
  if (grezzo) {
    try {
      const o = JSON.parse(grezzo) as { presenterId?: string };
      const vivo = idAmbito(o.presenterId);
      if (vivo) return vivo;
    } catch {
      /* riga illeggibile: si prova con quella che non muore */
    }
  }
  /*  2. ── ⚠️ E SE LA CONSULENZA NON È VIVA ───────────────────────────────
      Segnalazione del committente: «a me mostra il prezzo nuovo e al cliente
      ne mostra un altro».
      La riga della sessione viva non c'è quando il consulente ha mandato il
      solo link del preventivo (senza videochiamata: è il modo normale di
      lavorare), e viene azzerata quando la consulenza si chiude — quindi il
      cliente che tiene la pagina aperta si vedeva cambiare le cifre sotto gli
      occhi appena il consulente chiudeva. Questa riga invece resta, ed è
      scritta quando il codice nasce (vedi `ricordaConsulenteDellaSessione`). */
  return idAmbito(await leggiRiga(chiaveAmbito(BASE_SESSIONE_DI, codice)));
}

/** ── SI SEGNA QUANDO IL CODICE NASCE ──────────────────────────────────────
 *  La chiamano le due rotte da cui un codice di consulenza viene alla luce:
 *  l'avvio della diretta e la registrazione del link «solo preventivo».
 *  ⚠️ Non scrive niente senza tutti e due i pezzi: un codice senza consulente
 *   è il caso normale di chi entra con le chiavi di casa, e scriverci sopra
 *   una riga vuota vorrebbe dire cancellare quella buona di un collega che
 *   aveva aperto lo stesso codice.
 *  ⚠️ È una traduzione, non una cronologia: si sovrascrive, perché quello che
 *   serve sapere è di chi è QUESTO codice adesso. */
export async function ricordaConsulenteDellaSessione(
  codice: unknown,
  consulente: unknown,
): Promise<void> {
  const id = idAmbito(consulente);
  const cod = idAmbito(codice);
  if (!id || !cod) return;
  await config().upsert(
    {
      key: chiaveAmbito(BASE_SESSIONE_DI, cod),
      value: id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}
