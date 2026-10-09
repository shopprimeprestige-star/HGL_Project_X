/** ── I TAGLI AGGIUNTI DOPO ─────────────────────────────────────────────────
 *
 *  Il catalogo è fatto di due pezzi che il sito somma senza distinguerli:
 *   · quelli SCRITTI NEL CODICE (`prova/tagli`), con la fotografia dentro il
 *     sito, che ci sono da sempre e non si possono togliere per sbaglio;
 *   · quelli AGGIUNTI DA CHI VENDE, da una fotografia caricata sul momento.
 *
 *  ── ⚠️ PERCHÉ NON FINISCONO NEL CODICE ANCH'ESSI ─────────────────────────
 *  Aggiungere un taglio non deve richiedere un rilascio. Chi vende vede una
 *  foto su Instagram alle nove di sera e la vuole in vetrina alle nove e
 *  cinque: se per farlo serve qualcuno che scriva una riga e pubblichi, quel
 *  taglio non entra mai. Il testo sta in `app_config`, la fotografia su
 *  Storage, e la pagina li trova insieme agli altri.
 *
 *  ── ⚠️ E LI PUÒ AGGIUNGERE SOLO UN CODICE ADMIN ─────────────────────────
 *  Ogni taglio nuovo costa due generazioni vere (leggere la foto e creare
 *  l'esempio). Se lo potesse fare chiunque abbia un codice, la prima persona
 *  annoiata svuoterebbe il credito in una sera — e la vetrina si riempirebbe
 *  di tagli che non abbiamo scelto noi.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TAGLI, type Taglio } from "./tagli";

export const CHIAVE_EXTRA = "prova_capelli_tagli_extra";
export const CONTENITORE = "clienti-media";

export interface TaglioExtra extends Taglio {
  /** l'indirizzo pubblico della fotografia d'esempio */
  immagine: string;
  creatoIl: string;
  /** il codice admin che l'ha aggiunto: serve a sapere di chi è la scelta */
  daCodice?: string;
  /** ── ⚠️ NASCE «NUOVO», NON PUBBLICATO ─────────────────────────────────
   *  Una generazione su cinque esce storta: il ciuffo dalla parte sbagliata,
   *  i lati che non sfumano, una faccia girata. Se il taglio finisse in
   *  vetrina appena creato, quella storta la vedrebbero i clienti prima di
   *  noi — e ce ne accorgeremmo dal fatto che nessuno la sceglie mai.
   *  Finché è «nuovo» lo vede solo chi ha un codice admin, che può
   *  confermarlo, rifarlo o buttarlo. */
  stato?: "nuovo" | "pubblicato";
}

/** I tagli spenti a mano, per chiave. ⚠️ Vale anche per quelli scritti nel
 *  codice: un taglio che non si vende più deve poter sparire dalla vetrina
 *  senza aspettare un rilascio, e senza cancellare niente. */
export const CHIAVE_NASCOSTI = "prova_capelli_nascosti";

export async function nascosti(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_NASCOSTI).maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export async function nascondi(chiave: string, spento: boolean): Promise<string[]> {
  const ora = new Set(await nascosti());
  if (spento) ora.add(chiave); else ora.delete(chiave);
  const lista = [...ora];
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_NASCOSTI, value: JSON.stringify(lista), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
  return lista;
}

export async function tagliExtra(): Promise<TaglioExtra[]> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", CHIAVE_EXTRA).maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "[]");
    return Array.isArray(v) ? (v as TaglioExtra[]) : [];
  } catch {
    return [];
  }
}

async function scriviExtra(lista: TaglioExtra[]): Promise<void> {
  await supabaseAdmin.from("app_config").upsert(
    { key: CHIAVE_EXTRA, value: JSON.stringify(lista), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

/** Il catalogo intero, come lo vede chi prova.
 *  ⚠️ I nuovi vanno in CIMA alla loro famiglia? No: vanno in FONDO. Un taglio
 *   aggiunto ieri non è più importante di quelli che vendono da sempre, e
 *   spostare l'ordine sotto gli occhi di chi torna è il modo di fargli
 *   perdere quello che stava cercando. */
export async function catalogoIntero(
  /** con `tutto` si vedono anche i nuovi e i nascosti: è la vista di chi
   *  amministra, non quella del cliente. */
  tutto = false,
): Promise<Array<Taglio & { immagine?: string; stato?: string; nascosto?: boolean }>> {
  const [extra, spenti] = await Promise.all([tagliExtra(), nascosti()]);
  const spento = new Set(spenti);
  const tutti = [
    ...TAGLI.map((t) => ({ ...t, immagine: `/tagli/${t.chiave}.jpg`, stato: "pubblicato" as const })),
    ...extra.map((t) => ({ ...t, stato: t.stato ?? ("pubblicato" as const) })),
  ].map((t) => ({ ...t, nascosto: spento.has(String(t.chiave)) }));
  if (tutto) return tutti;
  //  ⚠️ Al cliente arrivano SOLO quelli pubblicati e non nascosti: un taglio
  //   ancora da confermare in vetrina è una figura che si fa una volta sola.
  return tutti.filter((t) => t.stato === "pubblicato" && !t.nascosto);
}

/** Un taglio, da qualunque parte venga. È quello che serve alla generazione:
 *  senza, un taglio aggiunto si vedrebbe nella griglia e poi non funzionerebbe
 *  — il difetto peggiore, perché si scopre dopo aver caricato la foto. */
export async function tagliaOvunque(chiave: string): Promise<Taglio | undefined> {
  const c = String(chiave || "");
  const dentro = TAGLI.find((t) => t.chiave === c);
  if (dentro) return dentro;
  return (await tagliExtra()).find((t) => t.chiave === c);
}

/** Una chiave libera a partire dal nome, senza accenti e senza doppioni. */
export async function chiaveLibera(nome: string): Promise<string> {
  const base = String(nome || "taglio")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28) || "taglio";
  //  ⚠️ `Set<string>` dichiarato: senza, TypeScript lo deduce come insieme di
  //   chiavi ESISTENTI e poi rifiuta di cercarci dentro una chiave nuova — che
  //   è esattamente il mestiere di questa funzione.
  const presi = new Set<string>([
    ...TAGLI.map((t) => String(t.chiave)),
    ...(await tagliExtra()).map((t) => String(t.chiave)),
  ]);
  if (!presi.has(base)) return base;
  for (let i = 2; i < 99; i += 1) if (!presi.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now().toString(36)}`;
}

/** Mette la fotografia su Storage e restituisce l'indirizzo pubblico.
 *  ⚠️ Non si tiene in `app_config` come base64: sarebbero due megabyte di
 *   testo dentro un documento che si rilegge a ogni apertura della pagina. */
export async function salvaImmagine(chiave: string, dataUrl: string): Promise<string> {
  const b64 = String(dataUrl).split(",")[1] ?? "";
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const percorso = `tagli/${chiave}-${Date.now().toString(36)}.jpg`;
  const { error } = await supabaseAdmin.storage.from(CONTENITORE)
    .upload(percorso, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`non riesco a salvare l'immagine: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(CONTENITORE).getPublicUrl(percorso);
  return data.publicUrl;
}

export async function aggiungiTaglio(t: TaglioExtra): Promise<TaglioExtra> {
  const tutti = await tagliExtra();
  await scriviExtra([...tutti, t]);
  return t;
}

/** Conferma un taglio nuovo: da qui in poi lo vedono i clienti. */
export async function confermaTaglio(chiave: string): Promise<TaglioExtra | null> {
  const tutti = await tagliExtra();
  let fatto: TaglioExtra | null = null;
  const dopo = tutti.map((t) => {
    if (t.chiave !== chiave) return t;
    fatto = { ...t, stato: "pubblicato" as const };
    return fatto;
  });
  if (fatto) await scriviExtra(dopo);
  return fatto;
}

export async function togliTaglio(chiave: string): Promise<void> {
  const tutti = await tagliExtra();
  await scriviExtra(tutti.filter((t) => t.chiave !== chiave));
}
