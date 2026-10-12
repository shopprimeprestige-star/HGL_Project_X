# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primario: il consulente in videochiamata.** Fa la consulenza gratuita al potenziale cliente su
  Meetly (la videochiamata dell'hub), mostra slide, casi e preventivo in tempo reale, e chiude o
  fissa il passo successivo. Lavora al computer, con il cliente che guarda lo stesso schermo.
- **Il titolare** (Hair Genius Labs, Roma): gestisce lead, trattative, agenda, installazioni,
  consulenti e permessi, KPI, campagne, contabilità e fatture. Al computer per il lavoro lungo,
  dall'iPhone per controlli veloci, agenda e risposte.
- **Setter e collaboratori** (mestieri e permessi diversi): lavorano i propri lead e fissano gli
  appuntamenti. **Tecnici delle installazioni**: pose, manutenzioni, spedizioni.
- **Il cliente e il visitatore** (pagine pubbliche): homepage e prenotazione della consulenza, invito
  all'appuntamento, preventivo condiviso, media, shop, blog. Soprattutto da telefono.

## Product Purpose

L'hub è il gestionale e il sito di Hair Genius Labs, che installa sistemi capillari non chirurgici
(Invisible Derm), con patch cutanee classiche e trapianto in alternativa. Porta un lead dalla
pubblicità alla consulenza gratuita, alla videochiamata con preventivo, all'installazione e alla
manutenzione. Successo: più consulenze che si chiudono, consulenti che in chiamata trovano tutto
subito, titolare che vede i numeri veri senza cercarli.

## Positioning

Un CRM costruito attorno alla **consulenza in videochiamata con preventivo in tempo reale**:
presentazione, casi, prova dei capelli e preventivo stanno dentro la chiamata, non in strumenti
separati. Il posizionamento commerciale è la trasparenza: si spiega anche quando la nostra soluzione
non è la scelta giusta.

## Operating Context

- Consulenze da computer con il cliente collegato: lo schermo è condiviso, quindi ciò che compare
  deve essere comprensibile e mai imbarazzante (niente dati di altri clienti, niente note interne).
- Gestione quotidiana da computer; controllo rapido, agenda e notifiche da iPhone.
- Le pagine pubbliche arrivano da Instagram, TikTok, ads e Google: prima schermata da telefono.
- Pubblicazione da GitHub su Cloudflare Workers; può avvenire mentre qualcuno ha l'app aperta.

## Capabilities and Constraints

- Stack esistente: TanStack Start (React 19, SSR) su Cloudflare Workers, Supabase, Tailwind e
  componenti Radix/shadcn. Tema scuro «Blueprint» per il pubblico, tema chiaro `.crm-theme` per il CRM.
- **Dati dei clienti protetti:** ogni schermata rispetta permessi e ruoli (admin, consulente, setter,
  mestieri); in chiamata il cliente vede solo ciò che gli serve. Dati sanitari e personali sotto GDPR.
- **Velocità in chiamata:** durante la consulenza niente schermate che si bloccano, ricaricano o
  fanno aspettare; gli stati di caricamento non coprono il lavoro in corso.
- **Leggibilità sul telefono:** testo mai sotto gli 11 px (regola già nel codice).
- Lingua: italiano. Terminologia del CRM: lead, trattative, consulenza, preventivo, posa,
  installazione, manutenzione, consulenti, mestieri.

## Brand Commitments

- Nome: Hair Genius Labs. Prodotto: Invisible Derm (sul sito compare anche «Bio-Mimetic™»: il nome
  definitivo è ancora da decidere).
- **Stile del marchio da mantenere:** il look attuale (blu «Blueprint», navy, logo Hair Genius) si
  migliora, non si stravolge.
- Voce: diretta, onesta, concreta; niente promesse mediche né paure esagerate.

## Evidence on Hand

- Logo: `src/assets/logo-hair-genius.png`, `src/assets/logo-hair-genius-dark.png`.
- Contenuti della landing modificabili dal CRM (LandingContentEditor) e video recensioni nella homepage.
- **Da non inventare:** il punteggio Trustpilot sul sito non è verificato (sospeso dal titolare);
  niente numeri, recensioni, casi o prezzi che non vengano dal titolare. Nei contenuti pubblici il
  prezzo non si scrive mai (il preventivo in chiamata è un'altra cosa).

## Product Principles

1. La chiamata prima di tutto: ciò che serve al consulente davanti al cliente vince su tutto il resto.
2. Un numero che non si capisce in un colpo d'occhio non serve: meno KPI, più chiari.
3. Mai un dato al posto sbagliato: permessi e privacy sono parte del design, non un controllo dopo.
4. Migliorare senza togliere: nessuna funzione e nessun dato sparisce senza una decisione del titolare.
5. Onestà anche nell'interfaccia: niente urgenze finte, niente prove inventate.

## Accessibility & Inclusion

Testo minimo 11 px sul telefono, contrasto leggibile in luce forte, aree di tocco comode su iPhone,
tutto usabile con la tastiera al computer durante la chiamata.
