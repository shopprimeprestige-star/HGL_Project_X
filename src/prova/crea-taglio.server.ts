/** ── CREARE UN TAGLIO DA UNA FOTOGRAFIA ────────────────────────────────────
 *
 *  Legge il taglio, gli dà un nome italiano, lo riproduce sul nostro modello e
 *  lo mette in vetrina. Vive qui e non dentro una delle due porte perché lo
 *  chiamano in DUE: la pagina pubblica (con un codice admin) e il gestionale.
 *  ⚠️ Due copie della stessa procedura divergono al primo ritocco, e la prima
 *   volta che divergono lo si scopre da un taglio che sulla pagina esce bene e
 *   dal gestionale esce storto — senza che nessuno capisca perché.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aggiungiTaglio, chiaveLibera, salvaImmagine, type TaglioExtra } from "./catalogo.server";
import { costruisciPrompt, type ChiaveFamiglia } from "./tagli";

const FAMIGLIE_VERE = ["sfumati", "classici", "mossi", "ricci", "lunghi"];

/** ⚠️ Una domanda sola e non tre: tre chiamate costano tre volte e possono
 *  contraddirsi — un nome che dice «riccio» accanto a una descrizione che
 *  parla di capelli lisci. */
const DOMANDA = `You are a master barber. Look ONLY at the haircut in this photo and reply with this JSON and nothing else:
{
 "nome_it": "<the haircut's name in Italian, two or three words, the way a barber would say it to a client — e.g. 'Sfumato con ciuffo', 'Riccio alto', 'Lungo mosso'. No brand names, no English words.>",
 "famiglia": "sfumati | classici | mossi | ricci | lunghi",
 "descrizione_it": "<one short Italian sentence, max 90 characters, saying who this cut suits>",
 "descrizione_en": "<one dense English sentence, max 60 words, specifying the cut to another barber AS IT WOULD BE SEEN FROM THE FRONT, even if this photo is a side or three-quarter view: sides and back first (fade, undercut, tapered, left long), then top length and volume, styling direction, parting, texture, fringe. No face, no colour, no lighting, no background.>"
}`;

/** ⚠️ LA FOTO DI RIFERIMENTO PUÒ ESSERE DI PROFILO, e quasi sempre lo è: le
 *  foto dei tagli si fanno di tre quarti, perché è di lato che si vede la
 *  sfumatura. Il modello, vedendola, tende a girare anche la nostra testa — e
 *  un riquadro girato in mezzo a trenta frontali si legge come «un altro».
 *  Va detto due volte e in due modi: la posa è quella dell'immagine 1, e del
 *  riferimento si prende il TAGLIO immaginandolo visto di fronte. */
const POSA = `
The haircut reference may be a side or three-quarter photograph. Work out how that same haircut looks FROM THE FRONT and render it that way: do not copy the reference's camera angle.
Keep the pose EXACTLY as in image 1: perfectly frontal, head facing the camera straight on, both ears equally visible, eyes looking into the lens, shoulders square. Do not rotate, tilt or turn the head. Same framing, same background, same lighting as image 1.`;

async function chiaveAI(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_config").select("value").eq("key", "ai_config").maybeSingle();
    const v = JSON.parse((data as { value?: string } | null)?.value ?? "{}");
    return String(v.apiKey || "") || String(process.env.OPENROUTER_API_KEY || "");
  } catch {
    return String(process.env.OPENROUTER_API_KEY || "");
  }
}

async function aOpenRouter(chiave: string, modello: string, testo: string, immagini: string[], tetto: number) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chiave}` },
    body: JSON.stringify({
      model: modello,
      ...(modello.includes("image") ? { modalities: ["image", "text"] } : {}),
      max_tokens: tetto,
      messages: [{
        role: "user",
        content: [{ type: "text", text: testo }, ...immagini.map((u) => ({ type: "image_url", image_url: { url: u } }))],
      }],
    }),
  });
  const b = (await r.json()) as {
    choices?: { message?: { content?: unknown; images?: { image_url?: { url?: string } }[] } }[];
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(String(b.error?.message || `il modello ha risposto ${r.status}`));
  if (modello.includes("image")) {
    const url = b.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("il modello non ha restituito nessuna immagine");
    return url;
  }
  const c = b.choices?.[0]?.message?.content;
  return (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p as { text?: string })?.text || "").join("") : "").trim();
}

export async function creaTaglioDaFoto(o: {
  foto: string;
  origine: string;
  daChi: string;
}): Promise<TaglioExtra> {
  const chiave = await chiaveAI();
  if (!chiave) throw new Error("Manca la chiave per generare le immagini.");

  //  1. Si legge il taglio, e nella stessa risposta arriva anche il nome.
  const grezzo = await aOpenRouter(chiave, "google/gemini-2.5-flash", DOMANDA, [o.foto], 500);
  const pulito = grezzo.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const letto = JSON.parse(pulito) as {
    nome_it?: string; famiglia?: string; descrizione_it?: string; descrizione_en?: string;
  };
  const nome = String(letto.nome_it || "").trim().slice(0, 40) || "Taglio nuovo";
  const famiglia = (FAMIGLIE_VERE.includes(String(letto.famiglia)) ? letto.famiglia : "classici") as ChiaveFamiglia;
  const inglese = String(letto.descrizione_en || "").trim();
  if (!inglese) throw new Error("non sono riuscito a leggere il taglio da questa foto");

  //  2. Si riproduce sul NOSTRO modello, con lo stesso castano scuro di tutti
  //     gli altri: in una griglia il colore è la prima cosa che l'occhio
  //     confronta, e un riquadro biondo fra trenta castani sembra un errore.
  const nostroVolto = new URL("/tagli/_persona.jpg", o.origine).toString();
  const testo = costruisciPrompt({
    taglio: "", taglioDaFoto: true, descrizioneTaglio: inglese,
    colore: "castano_scuro", calvo: true,
  }) + POSA;
  const immagine = await aOpenRouter(chiave, "google/gemini-3.1-flash-image", testo, [nostroVolto, o.foto], 8000);

  const ch = await chiaveLibera(nome);
  return aggiungiTaglio({
    chiave: ch as never,
    famiglia,
    nome,
    descrizione: String(letto.descrizione_it || "").trim().slice(0, 120) || "Aggiunto al catalogo.",
    inglese,
    immagine: await salvaImmagine(ch, immagine),
    creatoIl: new Date().toISOString(),
    daCodice: o.daChi,
    //  ⚠️ Nasce NUOVO: lo vede solo chi amministra finché non lo conferma.
    //   Una generazione su cinque esce storta, e quella storta non deve
    //   scoprirla un cliente al posto nostro.
    stato: "nuovo",
  });
}
