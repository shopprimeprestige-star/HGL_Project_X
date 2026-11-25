/** ── SHOP R1 · T02 · LA MIGRAZIONE S1 DEL CATALOGO (TESTO SQL) ────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261120120000_shop_catalogo.sql`, i COMMENTI SI
 *  TOLGONO prima (una parola vietata nei commenti non conta, una nel codice sì) e i corpi delle funzioni
 *  ($$ … $$) si separano dal resto, perché lì dentro i `;` e gli UPDATE sulle tabelle NUOVE sono leciti.
 *  Il comportamento vero (doppia applicazione, giacenza con due sessioni, trigger di pubblicazione, viste
 *  che non fanno uscire bozze né foto di bozze, `anon` che non legge niente) è `prove/sql/shop-catalogo.sql`
 *  su un Postgres usa-e-getta: mai sul database di produzione. Dati: nessuno. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { delNegozio } from "../_migrazioni-negozio.mjs";

const S1 = "20261120120000_shop_catalogo.sql";
const TABELLE = [
  "shop_impostazioni",
  "shop_categorie",
  "shop_prodotti",
  "shop_prodotti_categorie",
  "shop_varianti",
  "shop_media",
  "shop_giacenza_movimenti",
  "shop_storico",
];
const VISTE = ["shop_v_prodotti", "shop_v_varianti", "shop_v_media", "shop_v_categorie"];
/** Funzioni chiamabili dal server (firma = nome + tipi, come nel REVOKE/GRANT). */
const FUNZIONI = {
  shop_giacenza_muovi: "uuid, integer, text, text, text, text",
  shop_giacenza_imposta: "uuid, integer, text, text",
  shop_impostazione_imposta: "text, jsonb, jsonb, text",
  shop_controlla_pubblicazione: "",
};
/** Gli slot di D30 (PIANO §2). */
const SLOT = ["principale", "foto2", "foto3", "foto4", "foto5", "scala", "video", "confezione", "campione"];
const MOTIVI = ["carico", "rettifica", "reso", "ordine", "annullo_ordine", "migrazione"];
/** Mai nelle viste pubbliche (PIANO §3.1 «Vietati nel contratto» + D1). */
const VIETATE_NELLE_VISTE = [
  "bozza_modifiche",
  "bozza_modificata_il",
  "note_interne",
  "nota_titolare",
  "fornitore",
  "scheda_tecnica_path",
  "origine",
  "id_codice",
  "canali",
  "costo",
  "classe_spedizione",
  "categoria_google",
];

const senzaCommenti = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

/** Separa i corpi tra dollari: `{ fuori, corpi }`, con `$$…$$` al posto dei corpi in `fuori`. */
function dividi(sql) {
  const corpi = [];
  const fuori = sql.replace(/\$(\w*)\$([\s\S]*?)\$\1\$/g, (_m, _tag, corpo) => {
    corpi.push(corpo);
    return "$$…$$";
  });
  return { fuori, corpi };
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T02 · MIGRAZIONE S1 DEL CATALOGO: TESTO SQL (20/11/2026)");
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, S1);
  const precedenti = existsSync(cartella)
    ? readdirSync(cartella).filter((f) => f.endsWith(".sql") && f !== S1 && !delNegozio(f))
    : [];
  c("S1 esiste col nome del piano", true, existsSync(percorso));
  c("S1 viene dopo ogni altra migrazione che esiste già (M1 compresa)", true, precedenti.every((f) => f < S1));
  c("l'impalcatura SQL c'è: collaudo e LEGGIMI", [true, true], [
    existsSync(join(radice, "prove/sql/shop-catalogo.sql")),
    existsSync(join(radice, "prove/sql/LEGGIMI.md")) && /shop-catalogo\.sql/.test(readFileSync(join(radice, "prove/sql/LEGGIMI.md"), "utf8")),
  ]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const { fuori, corpi } = dividi(sql);
  const tutto = piatto(sql);
  const stmt = fuori.split(";").map(piatto).filter(Boolean);
  const ultimo = stmt[stmt.length - 1];

  /* ── solo aggiunte: ogni istruzione fuori dai corpi è tra quelle ammesse ── */
  const ammessa = (s) =>
    /^(BEGIN|COMMIT)$/.test(s) ||
    s === "NOTIFY pgrst, 'reload schema'" ||
    /^CREATE TABLE IF NOT EXISTS public\.shop_\w+ \(/.test(s) ||
    /^CREATE (UNIQUE )?INDEX IF NOT EXISTS \w+ ON public\.shop_\w+ \(/.test(s) ||
    /^ALTER TABLE public\.shop_\w+ ENABLE ROW LEVEL SECURITY$/.test(s) ||
    /^REVOKE ALL ON TABLE public\.shop_\w+ FROM PUBLIC, anon, authenticated$/.test(s) ||
    /^REVOKE ALL ON TABLE public\.shop_(giacenza_movimenti|storico) FROM service_role$/.test(s) ||
    /^GRANT ALL ON TABLE public\.shop_\w+ TO service_role$/.test(s) ||
    /^GRANT SELECT, INSERT ON TABLE public\.shop_(giacenza_movimenti|storico) TO service_role$/.test(s) ||
    /^REVOKE ALL ON FUNCTION public\.shop_\w+\([^)]*\) FROM PUBLIC, anon, authenticated$/.test(s) ||
    /^GRANT EXECUTE ON FUNCTION public\.shop_\w+\([^)]*\) TO service_role$/.test(s) ||
    /^CREATE OR REPLACE FUNCTION public\.shop_\w+\(/.test(s) ||
    /^CREATE OR REPLACE TRIGGER shop_\w+ BEFORE (INSERT|UPDATE OF stato) ON public\.shop_prodotti /.test(s) ||
    /^CREATE OR REPLACE VIEW public\.shop_v_\w+ AS /.test(s) ||
    /^REVOKE ALL ON public\.shop_v_\w+ FROM PUBLIC, anon, authenticated$/.test(s) ||
    /^GRANT SELECT ON public\.shop_v_\w+ TO service_role$/.test(s) ||
    /^INSERT INTO public\.shop_impostazioni \(chiave, valore\) VALUES .* ON CONFLICT \(chiave\) DO NOTHING$/.test(s) ||
    /^INSERT INTO storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\) VALUES .* ON CONFLICT \(id\) DO NOTHING$/.test(s);
  c("ogni istruzione di S1 è tra quelle ammesse (solo aggiunte, nuove tabelle shop_*, viste, funzioni, seme, bucket)", [], stmt.filter((s) => !ammessa(s)));
  c("nessun DROP, TRUNCATE, DELETE, RENAME, ALTER COLUMN, ADD COLUMN in tutto il file (corpi compresi)", [0, 0, 0, 0, 0, 0], [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\b/i,
    /\bRENAME\b/i,
    /ALTER\s+COLUMN/i,
    /ADD\s+COLUMN/i,
  ].map((r) => (r.test(sql) ? 1 : 0)));
  c("nessun UPDATE fuori dai corpi delle funzioni (non nel seme, non nel NOTIFY, non nel bucket)", false, /\bUPDATE\b(?! OF stato)/i.test(fuori));
  const bersagliUpdate = [...corpi.join("\n").matchAll(/\bUPDATE\s+([\w.]+)/gi)].map((m) => m[1]).sort();
  c("gli UPDATE nei corpi toccano solo tabelle NUOVE di S1 (mai shop_orders, crm_*, public_leads…)", [], [...new Set(bersagliUpdate)].filter((t) => !["public.shop_varianti", "public.shop_impostazioni"].includes(t)));
  c("nessun ON CONFLICT … DO UPDATE: un seme già presente non si riscrive", false, /DO UPDATE/i.test(sql));
  c("ogni INSERT fuori dai corpi è ON CONFLICT DO NOTHING; gli INSERT sono solo seme e bucket", [2, 2, true], [
    (fuori.match(/\bINSERT INTO\b/g) ?? []).length,
    (fuori.match(/ON CONFLICT \(\w+\) DO NOTHING/g) ?? []).length,
    [...fuori.matchAll(/INSERT INTO ([\w.]+)/g)].every((m) => ["public.shop_impostazioni", "storage.buckets"].includes(m[1])),
  ]);
  c("ogni CREATE TABLE / INDEX ha IF NOT EXISTS, ogni FUNCTION / VIEW / TRIGGER è OR REPLACE", [0, 0, 0, 0, 0], [
    (tutto.match(/CREATE TABLE (?!IF NOT EXISTS)/g) ?? []).length,
    (tutto.match(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/g) ?? []).length,
    (tutto.match(/CREATE FUNCTION/g) ?? []).length,
    (tutto.match(/CREATE VIEW/g) ?? []).length,
    (tutto.match(/CREATE TRIGGER/g) ?? []).length,
  ]);
  c("nessun ALTER TABLE tranne ENABLE ROW LEVEL SECURITY, e solo su tabelle shop_*", true,
    [...tutto.matchAll(/ALTER TABLE ([\w.]+) (\w+ \w+ \w+ \w+)/g)].every((m) => /^public\.shop_\w+$/.test(m[1]) && m[2] === "ENABLE ROW LEVEL SECURITY"));
  c("ogni oggetto nominato con public.* è shop_* (nessuna tabella esistente: orders, leads, whatsapp, tracking…)", [], [
    ...new Set([...tutto.matchAll(/public\.(\w+)/g)].map((m) => m[1])),
  ].filter((n) => !n.startsWith("shop_")));
  c("nessun riferimento a auth.*, crm_*, public_leads, shop_orders", false, /\bauth\.|crm_|public_leads|shop_orders/i.test(tutto));
  c("nessuna chiave, nessun indirizzo, nessun segreto nel testo", false, /https?:\/\/|eyJ|sbp_|sk_(live|test)|whsec_/i.test(grezzo));
  c("un solo BEGIN e un solo COMMIT, NOTIFY pgrst per ultimo e dopo il COMMIT", [1, 1, true, true], [
    (fuori.match(/\bBEGIN\b/g) ?? []).length,
    (tutto.match(/\bCOMMIT\b/g) ?? []).length,
    stmt[0] === "BEGIN",
    ultimo === "NOTIFY pgrst, 'reload schema'" && stmt.indexOf("COMMIT") < stmt.length - 1,
  ]);

  /* ── le tabelle: esattamente queste otto, protezione accesa, NESSUNA policy ── */
  c("le tabelle create sono esattamente le otto del piano §3.5", [...TABELLE].sort(),
    [...tutto.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map((m) => m[1]).sort());
  c("nessuna CREATE/ALTER/DROP POLICY nel file, e nessuna parola «policy» fuori dai commenti", 0, (tutto.match(/\bPOLICY\b/gi) ?? []).length);
  c("nessuna scrittura su storage.objects (nessuna policy: si carica solo con permesso firmato dal server)", false, /storage\.objects/.test(tutto));
  const REGISTRI = ["shop_giacenza_movimenti", "shop_storico"];
  for (const t of TABELLE) {
    const permessi = REGISTRI.includes(t) ? "SELECT, INSERT" : "ALL";
    c(`${t}: ENABLE ROW LEVEL SECURITY, REVOKE ALL a PUBLIC/anon/authenticated, GRANT ${permessi} a service_role`, [true, true, true], [
      new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`).test(tutto),
      new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM PUBLIC, anon, authenticated`).test(tutto),
      new RegExp(`GRANT ${permessi} ON TABLE public\\.${t} TO service_role`).test(tutto),
    ]);
  }
  c("i registri: prima si toglie ogni permesso a service_role (Supabase glieli dà tutti di default), poi si rida SELECT e INSERT", [true, true], REGISTRI.map((r) =>
    tutto.indexOf(`REVOKE ALL ON TABLE public.${r} FROM service_role`) > 0 && tutto.indexOf(`REVOKE ALL ON TABLE public.${r} FROM service_role`) < tutto.indexOf(`GRANT SELECT, INSERT ON TABLE public.${r} TO service_role`)));
  c("i registri (movimenti, storico): al server solo SELECT e INSERT, mai ALL/UPDATE/DELETE/TRUNCATE (nessuna cancellazione, garantita dal database)", [], stmt.filter((s) => /^GRANT .* ON TABLE public\.(shop_giacenza_movimenti|shop_storico) /.test(s)).filter((s) => !/^GRANT SELECT, INSERT ON TABLE /.test(s)));
  c("ogni GRANT (tabella, vista, funzione) è a service_role e a nessun altro", [], stmt.filter((s) => s.startsWith("GRANT ")).filter((s) => !/ TO service_role$/.test(s)));
  /* ── i vincoli che le regole richiedono al database ── */
  const tabella = (nome) => stmt.find((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS public.${nome} (`)) ?? "";
  const prodotti = tabella("shop_prodotti");
  const varianti = tabella("shop_varianti");
  const media = tabella("shop_media");
  const movimenti = tabella("shop_giacenza_movimenti");
  c("giacenza: intera, non nulla, CHECK >= 0", true, /giacenza integer NOT NULL DEFAULT 0 CHECK \(giacenza >= 0\)/.test(varianti));
  c("prezzo_cent: intero con CHECK >= 0 nel prodotto; nella variante può mancare (= quello del prodotto) e se c'è è >= 0", [true, true], [
    /prezzo_cent integer NOT NULL DEFAULT 0 CHECK \(prezzo_cent >= 0\)/.test(prodotti),
    /prezzo_cent integer CHECK \(prezzo_cent IS NULL OR prezzo_cent >= 0\)/.test(varianti),
  ]);
  c("nessun prezzo o importo in numeric/float/real/decimal/money: solo interi (D2)", false, /\b(numeric|float|double precision|real|decimal|money)\b/i.test(tutto));
  c("stato del prodotto: bozza|pubblicato|archiviato, di partenza bozza", [true, true], [
    /stato text NOT NULL DEFAULT 'bozza' CHECK \(stato IN \('bozza', 'pubblicato', 'archiviato'\)\)/.test(prodotti),
    /origine text CHECK \(origine IS NULL OR origine = 'codice'\)/.test(prodotti),
  ]);
  c("sku e slug del prodotto unici, sku della variante unico, id_codice unico", [true, true, true, true], [
    /\bsku text NOT NULL UNIQUE/.test(prodotti),
    /\bslug text NOT NULL UNIQUE/.test(prodotti),
    /\bsku text NOT NULL UNIQUE/.test(varianti),
    /\bid_codice text UNIQUE/.test(prodotti),
  ]);
  c("shop_media: slot con gli stessi valori di D30", SLOT, ((media.match(/slot text NOT NULL CHECK \(slot IN \(([^)]*)\)\)/) ?? [, ""])[1].match(/'(\w+)'/g) ?? []).map((s) => s.replace(/'/g, "")));
  c("shop_media: o prodotto o categoria (uno solo), variante solo per i campioni, liberatoria e persone di partenza falsi", [true, true, true], [
    /CHECK \(\(prodotto_id IS NOT NULL\) <> \(categoria_id IS NOT NULL\)\)/.test(media),
    /CHECK \(variante_id IS NULL OR slot = 'campione'\)/.test(media),
    /ritrae_persone boolean NOT NULL DEFAULT false/.test(media) && /liberatoria_ok boolean NOT NULL DEFAULT false/.test(media),
  ]);
  c("shop_media: nessun media si cancella, si segna rimosso_il (D5)", true, /\brimosso_il timestamptz\b/.test(media));
  c("movimenti di giacenza: i sei motivi del piano e giacenza_dopo >= 0", [MOTIVI, true], [
    ((movimenti.match(/motivo text NOT NULL CHECK \(motivo IN \(([^)]*)\)\)/) ?? [, ""])[1].match(/'(\w+)'/g) ?? []).map((s) => s.replace(/'/g, "")),
    /giacenza_dopo integer NOT NULL CHECK \(giacenza_dopo >= 0\)/.test(movimenti),
  ]);
  c("chiavi esterne: varianti e media → prodotto, movimenti → variante; nessun ON DELETE CASCADE (non si cancella mai)", [true, true, true, false], [
    /prodotto_id uuid NOT NULL REFERENCES public\.shop_prodotti \(id\)/.test(varianti),
    /REFERENCES public\.shop_prodotti \(id\)/.test(media),
    /variante_id uuid NOT NULL REFERENCES public\.shop_varianti \(id\)/.test(movimenti),
    /ON DELETE CASCADE/i.test(tutto),
  ]);
  c("indici: stato+slug, prodotto_id su varianti e media, storico (entita, entita_id, creato_il desc)", [true, true, true, true], [
    /ON public\.shop_prodotti \(stato, slug\)/.test(tutto),
    /ON public\.shop_varianti \(prodotto_id\)/.test(tutto),
    /ON public\.shop_media \(prodotto_id\)/.test(tutto),
    /ON public\.shop_storico \(entita, entita_id, creato_il DESC\)/.test(tutto),
  ]);

  /* ── le funzioni ── */
  for (const [nome, firma] of Object.entries(FUNZIONI)) {
    const def = stmt.find((s) => s.startsWith(`CREATE OR REPLACE FUNCTION public.${nome}(`)) ?? "";
    c(`${nome}: SECURITY DEFINER con search_path = public, in plpgsql`, true, /LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$…\$\$$/.test(def));
    // la funzione del trigger la esegue il database da sé: REVOKE sì, GRANT no; le altre tre sono del server
    const delTrigger = nome === "shop_controlla_pubblicazione";
    c(`${nome}: REVOKE … FROM PUBLIC, anon, authenticated${delTrigger ? " e NESSUN GRANT" : " e GRANT EXECUTE … TO service_role"}`, [true, !delTrigger], [
      tutto.includes(`REVOKE ALL ON FUNCTION public.${nome}(${firma}) FROM PUBLIC, anon, authenticated`),
      tutto.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${firma}) TO service_role`),
    ]);
  }
  const muovi = corpi.find((b) => /INSERT INTO public\.shop_giacenza_movimenti/.test(b)) ?? "";
  const imposta = corpi.find((b) => /public\.shop_giacenza_muovi\(/.test(b)) ?? "";
  c("la giacenza si muove con blocco di riga (FOR UPDATE) e l'errore giacenza_negativa", [true, true, true, true], [
    /FOR UPDATE/.test(muovi),
    /giacenza_negativa/.test(muovi),
    /FOR UPDATE/.test(imposta),
    /giacenza_negativa/.test(imposta),
  ]);
  c("il movimento si scrive nella stessa funzione del cambio (stessa transazione); l'imposta calcola il delta sotto blocco e passa dalla stessa strada", [true, true], [
    /UPDATE public\.shop_varianti SET giacenza = v_dopo/.test(muovi) && muovi.indexOf("UPDATE") < muovi.indexOf("INSERT INTO"),
    /p_nuovo - v_prima/.test(imposta) && imposta.indexOf("FOR UPDATE") < imposta.indexOf("p_nuovo - v_prima"),
  ]);
  c("l'interruttore è un confronto-e-scambio: UPDATE … WHERE valore = p_atteso, e lascia la riga nello storico", [true, true], [
    /WHERE chiave = p_chiave\s+AND valore = p_atteso/.test(corpi.find((b) => /shop_impostazioni/.test(b)) ?? ""),
    /INSERT INTO public\.shop_storico/.test(corpi.find((b) => /shop_impostazioni/.test(b)) ?? ""),
  ]);

  /* ── il trigger di pubblicazione (D7) ── */
  const trig = corpi.find((b) => /shop_pubblicazione_negata/.test(b)) ?? "";
  c("il trigger parte quando stato è (o diventa) «pubblicato», in inserimento e in aggiornamento di stato", [true, true], [
    /BEFORE INSERT ON public\.shop_prodotti FOR EACH ROW WHEN \(NEW\.stato = 'pubblicato'\)/.test(tutto),
    /BEFORE UPDATE OF stato ON public\.shop_prodotti FOR EACH ROW WHEN \(NEW\.stato = 'pubblicato' AND OLD\.stato IS DISTINCT FROM 'pubblicato'\)/.test(tutto),
  ]);
  c("il trigger controlla: descrizione breve, una categoria, foto principale non rimossa con alt (e con liberatoria se ritrae persone), variante attiva con SKU e prezzo effettivo > 0", [true, true, true, true, true, true], [
    /btrim\(COALESCE\(NEW\.descrizione_breve, ''\)\) = ''/.test(trig),
    /shop_prodotti_categorie pc WHERE pc\.prodotto_id = NEW\.id/.test(trig),
    /m\.slot = 'principale'[\s\S]*m\.rimosso_il IS NULL[\s\S]*btrim\(COALESCE\(m\.alt, ''\)\) <> ''/.test(trig),
    /m\.slot = 'principale'[\s\S]*NOT m\.ritrae_persone OR m\.liberatoria_ok/.test(trig),
    /v\.attiva/.test(trig) && /btrim\(COALESCE\(v\.sku, ''\)\) <> ''/.test(trig),
    /COALESCE\(v\.prezzo_cent, NEW\.prezzo_cent\) > 0/.test(trig),
  ]);
  c("il trigger rifiuta con un errore dal codice stabile (check_violation) e una frase che inizia con shop_pubblicazione_negata", [true, true], [
    /ERRCODE = 'check_violation'/.test(trig),
    /shop_pubblicazione_negata/.test(trig),
  ]);

  /* ── le viste pubbliche (D1, nota C del revisore) ── */
  c("le quattro viste del piano, né più né meno", [...VISTE].sort(), [...tutto.matchAll(/CREATE OR REPLACE VIEW public\.(\w+)/g)].map((m) => m[1]).sort());
  const vista = (nome) => stmt.find((s) => s.startsWith(`CREATE OR REPLACE VIEW public.${nome} AS `)) ?? "";
  for (const v of VISTE) {
    c(`${v}: REVOKE ALL a PUBLIC/anon/authenticated e GRANT SELECT solo a service_role`, [true, true], [
      tutto.includes(`REVOKE ALL ON public.${v} FROM PUBLIC, anon, authenticated`),
      tutto.includes(`GRANT SELECT ON public.${v} TO service_role`),
    ]);
    const t = vista(v);
    c(`${v}: nessuna colonna riservata (bozza, note, fornitore, canali, origine…)`, [], VIETATE_NELLE_VISTE.filter((k) => new RegExp(`\\b${k}\\b`).test(t)));
    c(`${v}: la giacenza non esce mai come colonna (c'è solo nel confronto che dà «disponibile»)`, true,
      [...t.matchAll(/\bgiacenza\b/g)].every((m) => /^giacenza > 0/.test(t.slice(m.index))));
  }
  c("shop_v_prodotti: solo stato = 'pubblicato'; il correlato solo se anche lui è pubblicato; le caratteristiche solo «confermato»", [true, true, true], [
    /WHERE p\.stato = 'pubblicato'/.test(vista("shop_v_prodotti")),
    /c2\.stato = 'pubblicato'/.test(vista("shop_v_prodotti")),
    /x ->> 'stato' = 'confermato'/.test(vista("shop_v_prodotti")),
  ]);
  c("shop_v_varianti: unita al prodotto PUBBLICATO, con «disponibile» e senza giacenza", [true, true], [
    /JOIN public\.shop_prodotti p ON p\.id = v\.prodotto_id WHERE p\.stato = 'pubblicato'/.test(vista("shop_v_varianti")),
    /\bAS disponibile\b/.test(vista("shop_v_varianti")),
  ]);
  const vm = vista("shop_v_media");
  c("shop_v_media: non rimossi, senza persone prive di liberatoria, e uniti a un prodotto PUBBLICATO (o a una categoria visibile con pubblicati)", [true, true, true, true], [
    /m\.rimosso_il IS NULL/.test(vm),
    /NOT m\.ritrae_persone OR m\.liberatoria_ok/.test(vm),
    /p\.id = m\.prodotto_id AND p\.stato = 'pubblicato'/.test(vm),
    /c\.id = m\.categoria_id AND c\.visibile/.test(vm),
  ]);
  c("shop_v_categorie: solo visibili e con almeno un prodotto pubblicato", [true, true], [
    /WHERE c\.visibile/.test(vista("shop_v_categorie")),
    /q\.quanti > 0/.test(vista("shop_v_categorie")),
  ]);
  c("le viste non usano security_invoker (girano con i diritti del proprietario, così la RLS delle tabelle non le blocca per service_role)", false, /security_invoker/i.test(tutto));

  /* ── il seme e il bucket ── */
  c("seme: catalogo_sito = \"codice\" e giacenza_bassa = 3, ON CONFLICT DO NOTHING", [true, true, true], [
    /INSERT INTO public\.shop_impostazioni \(chiave, valore\) VALUES \('catalogo_sito', '"codice"'::jsonb\), \('giacenza_bassa', '3'::jsonb\) ON CONFLICT \(chiave\) DO NOTHING/.test(tutto),
    !/'cms'/.test(tutto),
    (tutto.match(/INSERT INTO public\.shop_impostazioni/g) ?? []).length === 1,
  ]);
  c("bucket shop-media: pubblico, 25 MB, solo jpeg/png/webp/avif/mp4/quicktime, ON CONFLICT (id) DO NOTHING (uno già presente non si cambia)", [true, true], [
    /INSERT INTO storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\) VALUES \('shop-media', 'shop-media', true, 26214400, ARRAY\['image\/jpeg', 'image\/png', 'image\/webp', 'image\/avif', 'video\/mp4', 'video\/quicktime'\]\) ON CONFLICT \(id\) DO NOTHING/.test(tutto),
    26214400 === 25 * 1024 * 1024,
  ]);

  /* ── la spiegazione in testa, per chi la applica ── */
  c("l'intestazione dice cosa fa, cosa non fa, che si rilancia senza danni, come si annulla e come si ritira una foto", [true, true, true, true, true], [
    /COSA FA/.test(grezzo),
    /COSA NON FA/.test(grezzo),
    /DUE VOLTE NON FA DANNI/i.test(grezzo),
    /COME SI ANNULLA/.test(grezzo),
    /RITIRARE UNA FOTO/i.test(grezzo) && /Storage/.test(grezzo),
  ]);
  c("l'intestazione ricorda che la applica il titolare dal SQL Editor e che la squadra non la lancia", true, /TITOLARE/.test(grezzo) && /SQL Editor/.test(grezzo));

  /* ── il collaudo su Postgres vero esiste e fa quello che il piano chiede (lettura del testo) ── */
  const prova = readFileSync(join(radice, "prove/sql/shop-catalogo.sql"), "utf8");
  c("il collaudo SQL si ferma se il database non si chiama «prova» e applica S1 due volte", [true, true], [
    /current_database\(\) NOT ILIKE '%prova%'/.test(prova),
    (prova.match(/^\\i :s1$/gm) ?? []).length >= 2,
  ]);
  c("il collaudo SQL prova: giacenza con due sessioni, trigger, delta sotto blocco, bucket già presente, anon/authenticated sulle quattro viste, foto di una bozza fuori dalla vista", [true, true, true, true, true, true, true], [
    /dblink/.test(prova),
    /shop_controlla_pubblicazione|shop_pubblicazione_negata/.test(prova),
    /shop_giacenza_imposta/.test(prova),
    /shop-media/.test(prova) && /file_size_limit/.test(prova),
    VISTE.every((v) => prova.includes(v)) && /'anon'/.test(prova) && /'authenticated'/.test(prova),
    /shop_v_media/.test(prova) && /bozza/.test(prova),
    /TUTTI I CONTROLLI DI S1 PASSANO/.test(prova),
  ]);
}
