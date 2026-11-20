-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S2 · I 33 ARTICOLI DEL VECCHIO CATALOGO (IMPORTAZIONE FACOLTATIVA)
--
-- FILE GENERATO da strumenti/genera-import-catalogo.mjs a partire da src/shop/catalog.ts:
-- NON si modifica a mano (una prova controlla che sia uguale a ciò che lo strumento rigenera).
-- Commessa 2026-11-20-shop-completo (PIANO.md §4 «S2», compito T04, D3 e D28).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase, DOPO S1 (20261120120000_shop_catalogo.sql).
-- La squadra non la lancia mai. È FACOLTATIVA: se non la applichi, il resto funziona.
--
-- COSA FA (solo INSERT, tutti con ON CONFLICT DO NOTHING)
--   1. Crea 9 categorie (le chiavi del vecchio catalogo), tutte NON visibili.
--   2. Crea 33 prodotti, TUTTI in «bozza», con origine = 'codice' (stanno nel segmento
--      «Vecchio catalogo» del pannello, non in «Tutti»), stesso slug, SKU = «HG-» + id maiuscolo,
--      prezzo in centesimi, descrizione breve e lunga del codice, e una nota per il titolare.
--      Tipo: protesi (toupee) = patch; kit = kit; tutto il resto (shampoo, balsami, districanti,
--      solventi, adesivi, spazzole, accessori) = cura.
--   3. Le caratteristiche (dati tecnici e punti di forza) sono TUTTE «da_confermare»: non escono
--      sul sito finché il titolare non le conferma. Le combinazioni colore × lunghezza × misura
--      NON diventano varianti: restano scritte in una riga «Opzioni del vecchio catalogo».
--   4. Crea UNA variante «Unica» per prodotto: SKU uguale a quello del prodotto, prezzo vuoto (vale
--      quello del prodotto), giacenza 0, attiva; e un movimento «migrazione» a giacenza 0.
--   5. Lega ogni prodotto alla sua categoria.
--
-- COSA NON FA
--   Nessun UPDATE, DELETE o TRUNCATE. Non porta voti, recensioni, prezzi barrati, etichette
--   «Best seller», disegni né la giacenza finta del codice. Non pubblica niente: i prodotti
--   restano bozze, e le giacenze vere le scrive il titolare con la merce vera.
--
-- LANCIARLA DUE VOLTE NON FA DANNI: i prodotti si riconoscono dalla chiave id_codice; ciò che il
-- titolare ha già modificato non si riscrive; la variante, il legame con la categoria e il
-- movimento si aggiungono solo se il prodotto non li ha già (se hai cambiato lo SKU della
-- variante o la categoria, non tornano quelli di prima). Se S1 manca, si ferma con un errore e
-- non scrive niente (è una sola transazione).
--
-- COME SI ANNULLA: non serve. I prodotti sono bozze invisibili al pubblico; si archiviano dal
-- pannello (non esiste «elimina»).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Le categorie (non visibili) ───────────────────────────────────────────
INSERT INTO public.shop_categorie (slug, nome, tipo, frase, ordine, visibile) VALUES
  ('toupee', 'Protesi & Toupee', 'categoria', 'Basi lace, skin, mono e silk top', 0, false),
  ('shampoo', 'Shampoo', 'categoria', 'Detergenti delicati per protesi e lace', 1, false),
  ('balsamo', 'Balsami', 'categoria', 'Idratazione e morbidezza dei capelli', 2, false),
  ('districanti', 'Districanti', 'categoria', 'Spray leave-in anti-nodo', 3, false),
  ('solventi', 'Solventi & Remover', 'categoria', 'Rimozione sicura di colla e nastro', 4, false),
  ('adesivi', 'Adesivi & Nastri', 'categoria', 'Colle e tape a tenuta prolungata', 5, false),
  ('spazzole', 'Spazzole & Pettini', 'categoria', 'Loop brush e pettini anti-strappo', 6, false),
  ('kit', 'Kit Completi', 'categoria', 'Tutto l''occorrente in un set', 7, false),
  ('accessori', 'Accessori', 'categoria', 'Sealer, protezioni e cura', 8, false)
ON CONFLICT DO NOTHING;

-- ── 2. I prodotti: tutti in bozza, origine «codice» ──────────────────────────
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T01', 'lace-front-swiss-pu', 'Lace Front Swiss + PU', 'patch', 'bozza', 'codice', 28900, 'Fronte in Swiss lace invisibile, retro e perimetro in poliuretano.', 'La costruzione più venduta: attaccatura frontale in Swiss lace ultrasottile per un''attaccatura invisibile, corpo e perimetro in poliuretano sottile per una tenuta salda e una pulizia facilissima. L''equilibrio perfetto tra realismo e durata.',
  '[{"etichetta":"Base","valore":"Swiss lace front + PU 0,08 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy cuticola integra","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-110% (media)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Onda","valore":"Liscio naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Fronte Swiss lace invisibile","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Perimetro PU per la tenuta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli veri Remy cuticola integra","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Densità media 100-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't01')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T02', 'french-lace-front-comfort', 'French Lace Front Comfort', 'patch', 'bozza', 'codice', 26900, 'French lace resistente e traspirante con attaccatura naturale.', 'French lace leggermente più robusto dello Swiss: ottimo compromesso tra invisibilità dell''attaccatura e durata. Traspirante e confortevole per tutto il giorno, ideale per chi cerca leggerezza senza rinunciare alla resistenza.',
  '[{"etichetta":"Base","valore":"Full French lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-120%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Traspirabilità","valore":"Alta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"French lace traspirante","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Attaccatura naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Più resistente dello Swiss","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Nodi frontali sbiancati","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't02')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T03', 'hd-lace-ultrafine-full', 'HD Lace Ultra-fine Full', 'patch', 'bozza', 'codice', 34900, 'Full HD lace che scompare sulla pelle: massimo realismo dell''attaccatura.', 'La base full HD lace è la più sottile in assoluto: il lace ad alta definizione si fonde con qualsiasi tono di pelle rendendo l''attaccatura letteralmente invisibile anche da vicino. Per chi vuole il risultato più realistico possibile.',
  '[{"etichetta":"Base","valore":"Full HD Swiss lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy premium","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"90-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Attaccatura","valore":"Irregolare a mano","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"HD lace ultra-fine","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Attaccatura invisibile da vicino","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Full lace traspirante","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Nodi singoli fatti a mano","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't03')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T04', 'thin-skin-003-vlooped', 'Thin Skin 0.03mm V-looped', 'patch', 'bozza', 'codice', 25900, 'Pelle ultra-sottile 0,03 mm con capelli V-looped, effetto seconda pelle.', 'La base skin più sottile: 0,03 mm di poliuretano con capelli inseriti in V-loop (senza nodi) che simulano la crescita diretta dalla pelle. Realismo estremo del punto di uscita, ma delicata: pensata per chi cambia spesso la protesi.',
  '[{"etichetta":"Base","valore":"Poliuretano 0,03 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Inserimento","valore":"V-loop (no nodi)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Breve (3-6 mesi)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Thin skin 0,03 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli V-looped senza nodi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Punto di uscita realistico","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Effetto seconda pelle","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't04')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T05', 'thin-skin-006-natural', 'Thin Skin 0.06mm Natural', 'patch', 'bozza', 'codice', 23900, 'Skin 0,06 mm: il miglior equilibrio tra realismo e durata.', 'Poliuretano da 0,06 mm, lo spessore più popolare: pelle realistica, facile da pulire e con una durata ragionevole. Perfetta per l''uso quotidiano con colla o nastro. La scelta ideale per la maggior parte degli utenti skin.',
  '[{"etichetta":"Base","valore":"Poliuretano 0,06 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Media (6-9 mesi)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Thin skin 0,06 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Realismo + durata bilanciati","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Facile da pulire","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Colla o nastro","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't05')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T06', 'injected-skin-010', 'Injected Skin 0.10mm', 'patch', 'bozza', 'codice', 24900, 'Skin injected 0,10 mm: capelli iniettati con angolo di crescita realistico.', 'Base skin da 0,10 mm con capelli iniettati (injected) che replicano l''angolazione naturale di crescita e permettono di pettinare in ogni direzione. Più spessa e quindi più resistente delle skin sottili.',
  '[{"etichetta":"Base","valore":"Poliuretano injected 0,10 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Inserimento","valore":"Injected","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Media-alta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Poliuretano 0,10 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli iniettati multi-direzione","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Angolo di crescita realistico","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Buona durata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't06')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T07', 'super-skin-012-durable', 'Super Skin 0.12mm Durable', 'patch', 'bozza', 'codice', 22900, 'La skin più resistente: 0,12 mm per la massima longevità.', 'Poliuretano da 0,12 mm pensato per durare: la base skin più robusta, ideale per chi vuole longevità e facilità di manutenzione. Ottima per i principianti che imparano ad applicare la protesi.',
  '[{"etichetta":"Base","valore":"Poliuretano 0,12 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"110-120%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Alta (9-12 mesi)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Poliuretano 0,12 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Massima durata skin","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Facile da gestire","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ideale principianti","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't07')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T08', 'mono-durable-poly', 'Mono Durable + Poly', 'patch', 'bozza', 'codice', 21900, 'Mono top resistente con perimetro in poly: durata e movimento.', 'Base monofilamento nella zona superiore per un movimento naturale del capello e una lunga durata, con perimetro in poliuretano per un fissaggio saldo. La costruzione più longeva per l''uso quotidiano intenso.',
  '[{"etichetta":"Base","valore":"Fine mono + PU perimetro","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"110-130%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Alta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Mono top resistente","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Perimetro poly per la tenuta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Movimento naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Durata elevata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't08')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T09', 'silk-top-invisible-knots', 'Silk Top Invisible Knots', 'patch', 'bozza', 'codice', 32900, 'Silk top: i capelli sembrano crescere dalla pelle, nodi invisibili.', 'La costruzione silk top nasconde i nodi tra due strati, creando l''illusione che i capelli crescano direttamente da un cuoio capelluto realistico. Il massimo per la zona della riga e del vertice. Molto durevole.',
  '[{"etichetta":"Base","valore":"Silk top + lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-120%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Alta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Nodi completamente invisibili","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Aspetto cuoio capelluto realistico","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Perfetta per la riga","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Molto durevole","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't09')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T10', 'full-swiss-lace-breathe', 'Full Swiss Lace Breathe', 'patch', 'bozza', 'codice', 30900, 'Full Swiss lace: leggerezza e ventilazione totali per i climi caldi.', 'Costruzione integralmente in Swiss lace per la massima traspirabilità: quasi impercettibile da indossare, ideale nei climi caldi e per chi tiene la protesi tutto il giorno. Delicata, va trattata con cura.',
  '[{"etichetta":"Base","valore":"Full Swiss lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"90-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Traspirabilità","valore":"Massima","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Full Swiss lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Massima traspirabilità","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ultra leggera","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ideale climi caldi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't10')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T11', 'wave-mediterraneo-lace', 'Wave Mediterraneo Lace', 'patch', 'bozza', 'codice', 31900, 'Onda mediterranea pre-impostata su base lace front + poly.', 'Per chi ha i capelli mossi: texture ondulata realistica che mantiene la forma nel tempo, su base lace front con perimetro poly. Look mediterraneo autentico senza bisogno di piastra o styling quotidiano.',
  '[{"etichetta":"Base","valore":"Lace front + PU","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Onda","valore":"Mossa mediterranea","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"110-120%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Onda naturale pre-impostata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Base lace front + poly","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Mantiene la forma","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli veri","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1B Nero naturale, 2 Castano scuro, 4 Castano; Onda: Leggera, Media; Lunghezza: 8\", 10\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't11')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T12', 'curly-afro-mono', 'Curly Afro Mono', 'patch', 'bozza', 'codice', 33900, 'Ricci definiti su base mono resistente, texture afro naturale.', 'Riccio definito e voluminoso su base monofilamento robusta: la scelta per chi ha capelli afro o molto ricci. Texture realistica e duratura, movimento del capello naturale grazie al mono top.',
  '[{"etichetta":"Base","valore":"Fine mono + PU","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Onda","valore":"Riccio afro","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"120-140%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ricci afro definiti","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Base mono resistente","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Volume naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Lunga durata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro; Lunghezza: 6\", 8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't12')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T13', 'graystyle-sale-pepe-hd', 'GrayStyle Sale & Pepe HD', 'patch', 'bozza', 'codice', 29900, 'Percentuali di grigio calibrate a mano su base HD lace front.', 'Protesi con grigio miscelato a mano (20-60%) per un look maturo e credibile, su base HD lace front per un''attaccatura invisibile anche sui toni sale e pepe. Il realismo che serve per un risultato naturale.',
  '[{"etichetta":"Base","valore":"HD lace front + PU","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Grigio","valore":"20-60% (a scelta)","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Grigio 20-60% a scelta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"HD lace front","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Miscela fatta a mano","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli veri","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Grigio: 20%, 40%, 60%; Lunghezza: 6\", 8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't13')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T14', 'skin-lace-front-hybrid', 'Skin + Lace Front Hybrid', 'patch', 'bozza', 'codice', 27900, 'Corpo in thin skin con attaccatura in lace: realismo e pulizia.', 'Il meglio dei due mondi: corpo in thin skin 0,08 mm per una pulizia facile e una tenuta salda, con attaccatura frontale in lace per un''attaccatura invisibile. Molto scelta da chi passa dalla lace alla skin.',
  '[{"etichetta":"Base","valore":"Thin skin 0,08 mm + lace front","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"100-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Durata","valore":"Media","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Corpo thin skin 0,08 mm","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Attaccatura in lace invisibile","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Pulizia facile","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Tenuta salda","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't14')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T15', 'european-remy-premium-lace', 'European Remy Premium Lace', 'patch', 'bozza', 'codice', 44900, 'Capelli europei Remy di alta gamma su full French lace.', 'La nostra protesi premium: capelli europei Remy selezionati, più fini e naturali, su base full French lace. Texture, luce e caduta di altissimo livello per chi non vuole compromessi.',
  '[{"etichetta":"Base","valore":"Full French lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Europei Remy premium","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"90-110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Onda","valore":"Leggera onda naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Capelli europei Remy premium","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Full French lace","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Texture ultra-naturale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Selezione top di gamma","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1 Nero, 1B Nero naturale, 2 Castano scuro, 4 Castano, 6 Castano chiaro, Sale e pepe; Lunghezza: 6\", 8\", 10\"; Misura base: 8\"x10\", 7\"x9\", 6\"x8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't15')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-T16', 'stock-express-lace-front', 'Stock Express Lace Front', 'patch', 'bozza', 'codice', 17900, 'Pronta consegna: lace front + poly, spedizione in 24/48h.', 'Modello a stock pronto alla spedizione (24/48h) con base lace front e perimetro poly: qualità solida a un prezzo accessibile, senza attese di produzione. Ideale come prima protesi o di scorta.',
  '[{"etichetta":"Base","valore":"Lace front + PU","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Capelli","valore":"Umani Remy","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Densità","valore":"110%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Spedizione","valore":"24/48h","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Pronta consegna 24/48h","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Lace front + poly","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ottimo rapporto qualità-prezzo","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ideale come scorta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Colore: 1B Nero naturale, 2 Castano scuro, 4 Castano; Lunghezza: 6\", 8\"","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 't16')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-S1', 'shampoo-delicato-lace', 'Shampoo Delicato Lace-Safe', 'cura', 'bozza', 'codice', 2400, 'Solfati-free, deterge senza intaccare nodi e base.', 'Formula priva di solfati per protesi e lace: pulisce sebo e residui di adesivo senza allentare i nodi né seccare i capelli. pH bilanciato, profumo tenue.',
  '[{"etichetta":"In breve","valore":"Senza solfati","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Sicuro su lace e nodi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"pH bilanciato","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"500 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 's1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-S2', 'shampoo-idratante-remy', 'Shampoo Idratante Remy', 'cura', 'bozza', 'codice', 2200, 'Nutre i capelli veri Remy mantenendo lucentezza e morbidezza.', 'Con cheratina e olio di argan, ridona idratazione ai capelli veri che, non ricevendo sebo, tendono a seccarsi. Uso regolare per protesi luminose e morbide.',
  '[{"etichetta":"In breve","valore":"Cheratina + argan","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Anti-secchezza","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Per capelli veri","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"500 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 's2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-B1', 'balsamo-nutriente-argan', 'Balsamo Nutriente Argan', 'cura', 'bozza', 'codice', 2300, 'Ammorbidisce e ripristina la fibra dopo ogni lavaggio.', 'Balsamo ricco all''olio di argan e pantenolo: ripara le lunghezze, riduce l''effetto crespo e facilita la pettinatura senza appesantire né lasciare residui sulla base.',
  '[{"etichetta":"In breve","valore":"Argan + pantenolo","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Anti-crespo","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Non appesantisce","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"300 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'b1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-B2', 'maschera-riparatrice', 'Maschera Riparatrice Intensiva', 'cura', 'bozza', 'codice', 2900, 'Trattamento profondo settimanale per capelli stressati.', 'Con cheratina idrolizzata e burro di karité: ricostruisce la fibra dei capelli sottoposti a styling e agenti esterni. Un utilizzo a settimana per protesi come nuove.',
  '[{"etichetta":"In breve","valore":"Cheratina idrolizzata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Burro di karité","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Uso settimanale","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"200 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'b2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-D1', 'spray-districante-leave-in', 'Spray Districante Leave-in', 'cura', 'bozza', 'codice', 1900, 'Scioglie i nodi all''istante senza strappare i nodi della base.', 'Spray leave-in che lubrifica la fibra e scioglie i nodi con una passata, riducendo la caduta durante la pettinatura. Con protezione termica.',
  '[{"etichetta":"In breve","valore":"Anti-nodo immediato","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Riduce la caduta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Protezione termica","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"200 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'd1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-D2', 'olio-districante-lucidante', 'Olio Districante Lucidante', 'cura', 'bozza', 'codice', 2100, 'Poche gocce per districare e donare lucentezza specchio.', 'Olio secco a rapido assorbimento che districa le lunghezze e sigilla le punte donando lucentezza intensa. Ideale sui capelli veri opachi. Non unge la base.',
  '[{"etichetta":"In breve","valore":"Olio secco","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Lucentezza specchio","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Sigilla le punte","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"100 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'd2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-R1', 'solvente-remover-citrus', 'Solvente Remover Citrus', 'cura', 'bozza', 'codice', 1800, 'A base di agrumi, scioglie colla e nastro in pochi secondi.', 'Remover a base di oli di agrumi che dissolve rapidamente adesivi liquidi e residui di tape senza aggredire base skin o lace. Delicato sulla pelle, profumo fresco.',
  '[{"etichetta":"In breve","valore":"Base agrumi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Scioglie colla e tape","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Delicato su pelle e base","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Spray 118 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'r1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-R2', 'remover-gel-pro', 'Remover Gel Professionale', 'cura', 'bozza', 'codice', 2400, 'Gel che aderisce e agisce anche sugli adesivi più tenaci.', 'Formula in gel che resta dove serve e penetra gli adesivi a lunga tenuta senza colare. Perfetto per basi skin con colla forte. Risciacquo facile.',
  '[{"etichetta":"In breve","valore":"Formula gel no-drip","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Adesivi a lunga tenuta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Per basi skin","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"150 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'r2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-A1', 'colla-liquida-waterproof', 'Colla Liquida Waterproof', 'cura', 'bozza', 'codice', 2700, 'Tenuta fino a 3 settimane, resistente a sudore e acqua.', 'Adesivo liquido waterproof (2-3 settimane) che regge sudore, doccia e sport. Finitura opaca naturale. Da applicare a strati sottili.',
  '[{"etichetta":"In breve","valore":"Tenuta 2-3 settimane","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Waterproof","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Finitura opaca","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"15 ml con pennello","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Tenuta: Soft (1 sett.), Strong (2-3 sett.)","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'a1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-A2', 'nastro-biadesivo-contour', 'Nastro Biadesivo Contour', 'cura', 'bozza', 'codice', 1500, 'Strisce sagomate pronte, pulizia rapida e tenuta sicura.', 'Nastro biadesivo pre-tagliato in strisce sagomate per il contorno base: applicazione veloce, tenuta 1-2 settimane e rimozione pulita. 36 strisce.',
  '[{"etichetta":"In breve","valore":"36 strisce sagomate","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Tenuta 1-2 settimane","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Rimozione pulita","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Contour ready","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"Opzioni del vecchio catalogo","valore":"Formato: Dritte, Sagomate contour, Protruder","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'a2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-P1', 'loop-brush-anti-strappo', 'Loop Brush Anti-strappo', 'cura', 'bozza', 'codice', 1200, 'Setole a occhiello: pettina senza agganciare i nodi.', 'Le setole a occhiello (loop) scivolano tra i capelli senza agganciare i nodi della base, riducendo drasticamente la perdita di capelli. Indispensabile.',
  '[{"etichetta":"In breve","valore":"Setole a occhiello","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Non aggancia i nodi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Riduce la caduta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Manico ergonomico","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'p1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-P2', 'pettine-coda-acciaio', 'Pettine Coda in Acciaio', 'cura', 'bozza', 'codice', 900, 'Denti larghi antistatici per separare e sistemare la riga.', 'Pettine a denti larghi con codino in acciaio per definire la riga e separare le ciocche senza elettricità statica. Delicato su lace e skin.',
  '[{"etichetta":"In breve","valore":"Denti larghi","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Antistatico","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Codino in acciaio","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Delicato su base","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'p2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-K1', 'kit-starter-completo', 'Kit Starter Completo', 'kit', 'bozza', 'codice', 7900, 'Colla, remover, shampoo, balsamo e loop brush in un set.', 'Il set perfetto per iniziare: colla waterproof, solvente remover, shampoo lace-safe, balsamo argan e loop brush. Tutto per applicare e curare la protesi, con il 25% di risparmio.',
  '[{"etichetta":"In breve","valore":"5 prodotti essenziali","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Risparmio 25%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Guida all''uso inclusa","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Ideale principianti","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'k1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-K2', 'kit-manutenzione-mensile', 'Kit Manutenzione Mensile', 'kit', 'bozza', 'codice', 5900, 'Shampoo, balsamo, districante e nastri: la scorta mensile.', 'Per mantenere la protesi al top ogni mese: shampoo idratante, balsamo, spray districante e nastri biadesivi. Praticità e risparmio in un set.',
  '[{"etichetta":"In breve","valore":"4 prodotti","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Scorta mensile","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Risparmio 20%","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Uso quotidiano","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'k2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-X1', 'scalp-protector-primer', 'Scalp Protector Primer', 'cura', 'bozza', 'codice', 1600, 'Barriera protettiva tra pelle e adesivo, migliora la tenuta.', 'Crea una barriera protettiva sul cuoio capelluto: protegge la pelle sensibile dall''adesivo e ne aumenta la durata. Applicare prima della colla.',
  '[{"etichetta":"In breve","valore":"Protegge la pelle","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Aumenta la tenuta","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Per pelli sensibili","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"60 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'x1')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-X2', 'sealer-protettivo-base', 'Sealer Protettivo Base', 'cura', 'bozza', 'codice', 2000, 'Sigilla i nodi della base skin per una durata maggiore.', 'Sigilla nodi e poly della base skin proteggendola dall''olio della pelle e dagli agenti esterni. Prolunga la vita della protesi e mantiene i capelli ancorati.',
  '[{"etichetta":"In breve","valore":"Sigilla nodi e poly","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Prolunga la durata","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Protegge dagli oli","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"120 ml","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'x2')
ON CONFLICT DO NOTHING;
INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES ('HG-X3', 'spazzola-pulizia-base', 'Spazzola Pulizia Base', 'cura', 'bozza', 'codice', 800, 'Setole rigide per rimuovere residui di colla dalla base.', 'Spazzolino a setole rigide per rimuovere i residui secchi di adesivo dalla base skin e dal lace durante la pulizia col remover. Doppia estremità.',
  '[{"etichetta":"In breve","valore":"Setole rigide","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Rimuove residui colla","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Doppia estremità","stato":"da_confermare","fonte":"catalogo del codice"},{"etichetta":"In breve","valore":"Per pulizia base","stato":"da_confermare","fonte":"catalogo del codice"}]'::jsonb,
  'Importato dal catalogo nel codice: testo e prezzo da verificare.', 'x3')
ON CONFLICT DO NOTHING;

-- ── 3. La categoria di ogni prodotto (solo se non ne ha già una) ─────────────
INSERT INTO public.shop_prodotti_categorie (prodotto_id, categoria_id)
SELECT p.id, c.id
FROM (VALUES
  ('t01', 'toupee'),
  ('t02', 'toupee'),
  ('t03', 'toupee'),
  ('t04', 'toupee'),
  ('t05', 'toupee'),
  ('t06', 'toupee'),
  ('t07', 'toupee'),
  ('t08', 'toupee'),
  ('t09', 'toupee'),
  ('t10', 'toupee'),
  ('t11', 'toupee'),
  ('t12', 'toupee'),
  ('t13', 'toupee'),
  ('t14', 'toupee'),
  ('t15', 'toupee'),
  ('t16', 'toupee'),
  ('s1', 'shampoo'),
  ('s2', 'shampoo'),
  ('b1', 'balsamo'),
  ('b2', 'balsamo'),
  ('d1', 'districanti'),
  ('d2', 'districanti'),
  ('r1', 'solventi'),
  ('r2', 'solventi'),
  ('a1', 'adesivi'),
  ('a2', 'adesivi'),
  ('p1', 'spazzole'),
  ('p2', 'spazzole'),
  ('k1', 'kit'),
  ('k2', 'kit'),
  ('x1', 'accessori'),
  ('x2', 'accessori'),
  ('x3', 'accessori')
) AS m (cod, cat)
JOIN public.shop_prodotti p ON p.id_codice = m.cod
JOIN public.shop_categorie c ON c.slug = m.cat
WHERE NOT EXISTS (SELECT 1 FROM public.shop_prodotti_categorie x WHERE x.prodotto_id = p.id)
ON CONFLICT DO NOTHING;

-- ── 4. Una variante «Unica» per prodotto: SKU del prodotto, prezzo vuoto, giacenza 0 ──
INSERT INTO public.shop_varianti (prodotto_id, sku, nome, opzioni, prezzo_cent, giacenza, attiva)
SELECT p.id, p.sku, 'Unica', '{}'::jsonb, NULL, 0, true FROM public.shop_prodotti p WHERE p.id_codice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_varianti v WHERE v.prodotto_id = p.id)
ON CONFLICT DO NOTHING;

-- ── 5. Il movimento «migrazione» a giacenza 0 (una volta sola per variante) ──
INSERT INTO public.shop_giacenza_movimenti (variante_id, delta, giacenza_dopo, motivo, nota, chi)
SELECT v.id, 0, 0, 'migrazione', 'Importato dal catalogo nel codice: giacenza 0, da contare', 'importazione'
FROM public.shop_varianti v
JOIN public.shop_prodotti p ON p.id = v.prodotto_id
WHERE p.id_codice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_giacenza_movimenti m WHERE m.variante_id = v.id)
ON CONFLICT DO NOTHING;

COMMIT;
