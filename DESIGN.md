---
name: Hair Genius Labs CRM e sito
description: Due superfici su un solo marchio: sito e pagine cliente in blueprint navy con blu brand, CRM chiaro, denso e quasi senza decorazione.
colors:
  navy: "oklch(0.21 0.05 255)"
  navy-deep: "oklch(0.15 0.045 258)"
  navy-light: "oklch(0.28 0.055 255)"
  brand: "oklch(0.65 0.19 252)"
  brand-foreground: "oklch(0.99 0 0)"
  light-panel: "oklch(0.96 0.005 250)"
  ink: "oklch(0.18 0.02 255)"
  ink-muted: "oklch(0.5 0.02 255)"
  foreground-on-navy: "oklch(0.98 0 0)"
  destructive: "oklch(0.6 0.22 27)"
  success: "oklch(0.62 0.17 152)"
  warning: "oklch(0.78 0.15 78)"
  info: "oklch(0.65 0.14 230)"
  cta-warm: "oklch(0.72 0.18 45)"
  cta-warm-deep: "oklch(0.62 0.2 30)"
  crm-background: "oklch(0.995 0.002 250)"
  crm-foreground: "oklch(0.18 0.015 255)"
  crm-primary: "oklch(0.55 0.16 252)"
  crm-secondary: "oklch(0.965 0.003 250)"
  crm-muted-foreground: "oklch(0.48 0.012 255)"
  crm-accent: "oklch(0.95 0.005 250)"
  crm-border: "oklch(0.9 0.005 250)"
  crm-sidebar: "oklch(0.975 0.003 250)"
  crm-destructive: "oklch(0.58 0.21 27)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  note:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
  eyebrow:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.22em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  card-x: "16px"
  card-y: "10px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-primary-crm:
    backgroundColor: "{colors.crm-primary}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.crm-secondary}"
    textColor: "{colors.crm-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-cta-warm:
    backgroundColor: "{colors.cta-warm}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-destructive:
    backgroundColor: "{colors.crm-destructive}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  card-crm:
    backgroundColor: "#ffffff"
    textColor: "{colors.crm-foreground}"
    rounded: "{rounded.xl}"
  card-navy:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.foreground-on-navy}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.crm-foreground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "4px 12px"
  chip-stato:
    backgroundColor: "{colors.crm-secondary}"
    textColor: "{colors.crm-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge:
    backgroundColor: "{colors.crm-primary}"
    textColor: "{colors.brand-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  sidebar-crm:
    backgroundColor: "{colors.crm-sidebar}"
    textColor: "{colors.crm-foreground}"
---

# Design System: Hair Genius Labs CRM e sito

## Overview

> Estratto dal codice (`src/styles.css`, `src/components/ui/*`, `src/crm/ui.tsx` e pagine). **North Star confermato dal titolare il 12/10/2026.** I punti ancora marcati "(da confermare)" sono decisioni aperte: dove il codice si contraddice lo dice la sezione Do's and Don'ts.

**Creative North Star: "Il Tavolo Tecnico"**

Un tavolo da disegno di precisione: griglia blueprint, linee sottili, numeri allineati, un solo blu che indica dove agire. È già il linguaggio del sito (griglia 72px, angoli a parentesi, navy profondo) e regge anche il CRM chiaro, dove la griglia sparisce ma restano righe fini e numeri tabulari. Unifica le due superfici senza stravolgere il marchio.

Scartate: "La Sala Consulenza" (calma e leggibile, ma poca identità per il sito pubblico) e "Il Laboratorio Pulito" (rinnega il navy, contro il vincolo "migliorare senza stravolgere"). Dalla prima resta un principio: le schermate usate in chiamata privilegiano la leggibilità del numero su ogni effetto.

**Cosa descrive il codice oggi.** Il prodotto ha due facce. Il sito pubblico, la sala del webinar, il preventivo e le pagine per il cliente usano un tema scuro "blueprint": navy profondo, griglia sottile, blu brand come unico accento, vetro semitrasparente sulle schede. Il CRM (`.crm-theme`) e un'altra cosa: fondo quasi bianco, bordi sottili, ombre eliminate, testo da 13px, colore solo per lo stato delle trattative. Il comune e Inter, il blu di tinta 252, e un linguaggio di linee fini.

**Uso reale.** Il consulente usa il programma durante la videochiamata con il cliente (Meetly, preventivo in tempo reale), poi il titolare che gestisce tutto, poi setter e tecnici. Computer e iPhone; le pagine per i clienti soprattutto da telefono. Dati dei clienti protetti, velocita in chiamata. Per questo il CRM e denso di proposito ("ottocento righe si leggono perche sono strette") e il telefono ha una scala di testo propria.

**Key Characteristics:**
- Due temi, un solo blu: brand 252 su navy (sito) e 252 piu scuro e sobrio sul CRM chiaro.
- Linee fini al posto delle ombre nel CRM; vetro, aloni e riflessi sul sito scuro.
- Il colore del CRM porta solo stato (cinque toni con significato fisso).
- Numeri tabulari ovunque ci siano importi.
- Molta decorazione animata sul sito e sul preventivo (riflessi, aurore, anelli) che il CRM spegne.

## Colors

Palette a due registri: navy profondo con un blu elettrico per le superfici pubbliche, quasi-bianco freddo con un blu piu scuro per il CRM. Il blu brand e quasi l'unico colore con tinta; gli altri sono semantici.

### Primary
- **Blu Brand** (oklch(0.65 0.19 252), token `brand`): accento unico del sito: eyebrow, parentesi d'angolo, focus ring, link, pulsanti principali sul navy. Anche `--primary`, `--accent` e `--ring` del tema base.
- **Blu CRM** (oklch(0.55 0.16 252), `crm-primary`): lo stesso blu piu scuro e meno saturo per il fondo chiaro del CRM; solo CTA principali, voce attiva, focus.

### Secondary
- **Arancio CTA caldo** (oklch(0.72 0.18 45) fino a oklch(0.62 0.2 30), `cta-warm`): sfumatura usata solo dal pulsante d'intestazione del sito (`.ng-header-cta`). E il solo colore caldo del sistema: o diventa un accento dichiarato oppure va riportato sul blu (da confermare).

### Neutral
- **Navy Profondo** (oklch(0.15 0.045 258), `navy-deep`): sfondo base del tema pubblico (`--background`).
- **Navy** (oklch(0.21 0.05 255), `navy`): schede e sidebar del tema base.
- **Navy Chiaro** (oklch(0.28 0.055 255), `navy-light`): voce di sidebar attiva e stati rialzati.
- **Pannello Chiaro** (oklch(0.96 0.005 250), `light-panel`): sezioni chiare della landing, con trama di griglia.
- **Inchiostro** (oklch(0.18 0.02 255), `ink`) e **Inchiostro Spento** (oklch(0.5 0.02 255), `ink-muted`): testo su fondi chiari del sito e articoli del blog.
- **Carta CRM** (oklch(0.995 0.002 250), `crm-background`) con schede bianche; **Grigio Sidebar** (oklch(0.975 0.003 250), `crm-sidebar`); **Bordo CRM** (oklch(0.9 0.005 250), `crm-border`); **Testo Secondario CRM** (oklch(0.48 0.012 255), `crm-muted-foreground`).

### Semantici
- **Rosso** destructive oklch(0.6 0.22 27) (CRM oklch(0.58 0.21 27)), **Verde** success oklch(0.62 0.17 152), **Ambra** warning oklch(0.78 0.15 78), **Azzurro** info oklch(0.65 0.14 230).
- Stato delle trattative nel CRM, da `types.ts` (`LEAD_PHASE_COLOR`): sky "da lavorare", indigo "in corso", ambra "in sospeso", emerald "vinta", rose "persa", slate "chiusa", tutti come tinta al 15% con testo 700 e bordo al 30%.

### Named Rules
**The Un-Solo-Blu Rule.** Tutto il sistema ruota sulla tinta 252. Un secondo accento (oggi l'arancio del pulsante di intestazione) deve avere un ruolo scritto, non essere un'eccezione.

**The Colore-e-Informazione Rule.** Nel CRM il colore dice lo stato di una trattativa e basta. Un tono, un significato; niente colore decorativo. (confermato nel codice di `src/crm/ui.tsx`)

**The Nessun-Testo-Sfumato Rule.** Il testo con sfumatura (`bg-clip-text` + gradiente) e un anti-pattern da togliere. Il rilevatore di Impeccable lo trova in `src/routes/preventivo.tsx` riga 5565 (`bg-gradient-to-r from-brand via-sky-300 to-brand bg-clip-text text-transparent`); lo stesso effetto esiste come classi riusabili `.hl-nextgen` e `.text-aurora` in `src/styles.css` (animate), usate in `src/routes/index.tsx` e nel funnel di prenotazione. Un solo colore pieno (brand) al loro posto.

**La regola dell'accento raro.** Nel CRM il blu compare solo sull'azione principale e su ciò che è attivo. Se tutto è blu, niente lo è.
**La regola dello schermo condiviso.** Nelle schermate che il cliente vede in chiamata, nessun colore d'allarme per informazioni interne e nessun dato di altri clienti.


## Typography

**Display Font:** Inter (con ui-sans-serif, system-ui, sans-serif)
**Body Font:** Inter (stesso stack)
**Label/Mono Font:** nessun mono dichiarato nel tema; `font-mono` di Tailwind compare 81 volte nelle pagine

**Character:** una sola famiglia sans neutra, dichiarata in `--font-sans` e `--font-display`. La gerarchia la fanno peso, misura e spaziatura, non il carattere. Nota: nel codice non ho trovato nessun caricamento di Inter (niente `@font-face`, niente link ai font), quindi di fatto si vede il carattere di sistema (San Francisco su Apple).

### Hierarchy
La scala del CRM ha cinque passi con classi `t-*` (`src/styles.css`); sotto i 1024px sono piu grandi per leggere meglio da telefono, da 1024 in su tornano ai valori densi da monitor.
- **Titolo pagina** (600, 20px, 1.2, tracking -0.02em): `t-titolo`, `h1` del CRM (1.25rem).
- **Riga** (15px mobile / 13px desktop, 1.25): `t-riga`, quello per cui si guarda la riga: nome, importo.
- **Corpo** (13.5px mobile / 12.5px desktop, 1.4): `t-corpo`, valori e testo normale. Base del CRM 14px, interlinea 1.45, tracking -0.005em.
- **Nota** (12.5px mobile / 11.5px desktop, 1.35): `t-nota`, stato, quando, note di riga.
- **Etichetta** (11px, 1.3, maiuscoletto con tracking 0.08em nella sala webinar `.sala-etichetta`, peso 700): minuzie.
- **Eyebrow del sito** (600, 0.72rem, tracking 0.22em, maiuscolo, colore brand): sopra i titoli della landing.
- **Cifre grandi** (700, 24px, tabular-nums): importi del preventivo; nel CRM numero grande 19px/600 tabular-nums.

### Named Rules
**The Cinque-Passi Rule.** Il CRM ha cinque misure di testo, non sedici. Le pagine vecchie usano ancora circa 2.260 misure scritte a mano (`text-[11.5px]` e simili) che una media query rimappa solo su telefono; le pagine nuove usano le classi `t-*`. Mai sotto 11px sul telefono.

**The Importi-Allineati Rule.** Ogni importo e ogni totale usa cifre tabulari, perche in chiamata il cliente confronta numeri.

**La regola degli 11 pixel.** Sotto gli 11 px non si scende: sul telefono, al sole, non si legge.


## Layout

CRM: pagina `p-4 md:p-6`, contenuto centrato fino a 1400px (`Pagina`, `larga` per tabelle e calendari), blocchi separati da 16px. Dentro le schede `px-4 py-2.5` per l'intestazione e `p-4` per il corpo. Sidebar a sinistra con gruppi e scorciatoia di ricerca; tabelle a filo bordo dentro la scheda. Densita alta di proposito sul monitor.

Sito e preventivo: contenitore `max-w-7xl` con margini `px-4 sm:px-6 lg:px-10`, intestazione fissa alta 64px (`h-16`), sezioni alternate scure e chiare con trama di griglia (24, 32, 56, 64 o 72px a seconda della sezione). Sulle pagine ospite i campi partono da 16px per evitare lo zoom di iOS. Punti di rottura: quelli di Tailwind piu `sala` (900px, solo per affiancare palco e chat nel webinar). Il CRM cambia scala di testo a 768/1024px.

Scala di spaziatura osservata (da confermare, non c'e un token): 4, 8, 16, 24; gap fra blocchi 16px.

## Elevation & Depth

Sistema ibrido, diverso per superficie. Il CRM e piatto: le schede hanno solo un bordo da 1px e `box-shadow: none` (regola in `.crm-theme`, che pero colpisce solo gli elementi con `data-slot="card"`, mai assegnato: vedi coerenza). Il sito scuro costruisce profondita con vetro (sfondo bianco al 2-8% con `backdrop-filter: blur(10-14px)`), riflessi interni sul bordo alto e aloni blu sotto gli elementi da decidere.

### Shadow Vocabulary
- **Alone** (`box-shadow: 0 12px 40px -12px rgba(59, 130, 246, 0.45)`, `.hg-alone`): sotto l'elemento su cui si sta decidendo.
- **Vetro** (`.hg-vetro`: gradiente bianco 5.5% a 2%, bordo `rgba(255,255,255,0.09)`, blur 10px; `.hg-vetro-forte`: 8.5% a 3%, bordo 0.14, blur 14px): superfici sul navy.
- **Pulsante premium** (`0 10px 30px -10px rgba(20, 48, 107, 0.55)` piu riflesso interno): `.btn-premium`.
- **Barra del totale** (`inset 0 1px 0 rgba(255,255,255,.07), 0 -10px 44px rgba(0,0,0,.5)`, `.hg-glass`): barra fissa del preventivo su telefono.
- **Tailwind generico**: `shadow-2xl` (65 usi), `shadow-lg` (64), `shadow-sm` (37), `shadow-md` (12), `shadow-xl` (11).

### Named Rules
**The Piatto-Nel-CRM Rule.** Nel CRM niente ombre e niente aloni: profondita solo con bordi da 1px e due livelli di grigio.

**The Tre-Mattoni Rule.** Sul fondo scuro le superfici usano `hg-vetro`, `hg-lucido`, `hg-alone` e nient'altro (sono state create proprio per fermare la proliferazione di sfumature). (confermato dal commento nel codice)

## Shapes

Raggio base `--radius: 0.5rem` (8px); scala derivata `sm` 4px, `md` 6px, `lg` 8px, `xl` 12px. Uso reale (conteggi nelle pagine): `rounded-lg` 670, `rounded-full` 479, `rounded-xl` 392, `rounded-md` 342, `rounded-2xl` 212, `rounded-sm` 52, `rounded-3xl` 15. Regola scritta in `src/crm/ui.tsx`: schede e riquadri numerici `rounded-xl`, pastiglie di stato `rounded-full`, controlli `rounded-md`, filtri a segmento `rounded-lg`. Il sito aggiunge 2xl e 3xl (16 e 24px) per le schede grandi del preventivo. Bordi sottili di 1px sempre; motivo ricorrente del sito: parentesi d'angolo da 14px in blu brand (`.brackets`) sopra una griglia a linee fini.

## Components

### Buttons
- **Shape:** angoli morbidi (6px, `rounded-md`), altezza 36px (`h-9`), piccolo 32px, grande 40px, icona 36x36. Testo `text-sm` peso 500.
- **Primary:** fondo `primary` (blu brand sul sito, blu CRM piu scuro nel CRM), testo bianco, `shadow` leggera. Hover al 90%.
- **Secondary / Outline / Ghost / Link:** grigio chiaro, bordo `input`, trasparente con fondo accent in hover, testo sottolineato.
- **Destructive:** rosso con testo bianco.
- **Focus:** nel componente `ring-1` sul colore ring; nel CRM un anello pieno da 2px a 40% (`box-shadow: 0 0 0 2px var(--ring)`).
- **Pulsanti speciali del sito:** `.btn-premium` (gradiente navy con riflesso che scorre in loop, 3.2s) per il funnel di prenotazione; `.ng-header-cta` (gradiente arancio) per l'intestazione. Entrambi sono fuori dal componente `Button`.

### Chips
- **Stato (CRM):** `Chip` in `src/crm/ui.tsx`: pillola (`rounded-full`), 11px peso 500, bordo 1px, tinta di fondo al 15% con testo 700; pallino pieno facoltativo da 6px.
- **Badge (libreria UI):** `rounded-md`, 12px peso 600, varianti default / secondary / destructive / outline. Nel CRM `[data-slot="badge"]` a 0.7rem; ma il componente non emette `data-slot`.

### Cards / Containers
- **CRM, `Scheda`:** `rounded-xl`, bordo 1px, fondo bianco, intestazione con titolo 13px/600 e nota 11px, bordo inferiore, azioni a destra.
- **Libreria UI, `Card`:** `rounded-xl border bg-card shadow`, padding 24px (`p-6`).
- **Sito scuro:** vetro (`hg-vetro`), `glass-card` (gradiente + riflesso + alone blu), `rounded-3xl` per le schede del preventivo.
- **Riquadri numerici (`Kpi`, `KpiPill`):** numero 19px o 12px bold tabular-nums con etichetta 10-11px maiuscola.

### Inputs / Fields
- **Style:** altezza 36px, `rounded-md`, bordo 1px `input`, fondo trasparente, padding 4px 12px, testo base 16px che scende a `text-sm` da md in su.
- **Focus:** anello `ring-1`; nel CRM anello pieno da 2px.
- **Error / Disabled:** disabled al 50% di opacita, cursore bloccato. Stato errore dei campi non standardizzato (da confermare); nel preventivo esiste un bordo che pulsa per "campo da compilare" (`.hg-pulse-border`).

### Navigation
- **Sidebar CRM:** fondo grigio chiarissimo, gruppi con titolo 10px maiuscolo, voci con icona da 16px, indicatore verticale `sky-500` di 3px sulla voce attiva (non e il blu `primary`), ricerca con scorciatoia da tastiera, pie di pagina con email e ruolo. Si comprime a sole icone.
- **Intestazione sito:** `bg-blueprint` fissa, 64px, logo 32-36px, un solo pulsante in maiuscolo con tracking 0.2em.
- **Tab, segmenti:** `Segmento` rounded-lg per i filtri del CRM.

### Dialog e finestre
- `Finestra` (`src/crm/ui/Finestra.tsx`) avvolge i dialog nel tema CRM, perche i portali di Radix finiscono fuori dal contenitore `.crm-theme` e perderebbero i token. Pulsante di chiusura 16px in alto a destra.

### Tabelle
- Testo 0.8125rem, intestazioni 0.75rem peso 500 in grigio, senza maiuscolo; righe con bordo inferiore; la tabella confronto del sito (`ComparisonTable`) e un'altra cosa, sul navy.

### Preventivo in tempo reale (componente firma)
Schermata scura a piena pagina con vetro, cifre grandi tabulari, prezzo che "scatta" quando cambia (`.hg-price-pop`), barra del totale fissa su telefono con vetro e ombra verso l'alto, importi barrati in rosso per gli sconti. E il componente piu importante per il consulente in chiamata e il piu carico di effetti.

## Do's and Don'ts

### Do:
- **Do** usare `brand` (oklch(0.65 0.19 252)) sul fondo scuro e `crm-primary` (oklch(0.55 0.16 252)) sul fondo chiaro: stessa tinta, due luminosita.
- **Do** usare le classi della scala del CRM (`t-titolo`, `t-riga`, `t-corpo`, `t-nota`, `t-etichetta`) nelle pagine nuove e le cifre tabulari per gli importi.
- **Do** usare i toni di `src/crm/ui.tsx` (`Chip`, `CLASSI_TONO`) per ogni stato: una fonte sola dei colori di stato.
- **Do** tenere bordi da 1px e raggi dalla scala (md 6px, lg 8px, xl 12px) nel CRM.
- **Do** riservare l'effetto (riflesso, alone) a un solo elemento per schermata sul sito scuro. (da confermare)

### Don't:
- **Don't** usare testo con sfumatura (`bg-clip-text` con gradiente): `preventivo.tsx` riga 5565 e le classi `.hl-nextgen` / `.text-aurora` vanno sostituite con colore pieno.
- **Don't** aggiungere ombre alle schede del CRM ne decorazioni da landing (le griglie sono spente apposta dal tema).
- **Don't** inventare un secondo accento: l'arancio di `.ng-header-cta` e l'eccezione da risolvere, non un modello.
- **Don't** scrivere misure di testo a mano tipo `text-[11.5px]` nelle pagine nuove.
- **Don't** mettere animazioni in loop (riflessi, anelli, aurore) su schermate usate in chiamata, dove distraggono dal numero. (da confermare)
- **Don't** dipendere da classi Tailwind arbitrarie con `min-[900px]:` (nel commento del codice risultano non generate); si usa il breakpoint `sala`.

## Incoerenze di coerenza visiva trovate (per la revisione)
1. **Due sistemi di colore.** Il tema base (`:root`) e scuro e il suo `--popover`, `--secondary`, `--muted` sono pero chiari (testo scuro su fondo bianco) mentre `--background` e navy: i componenti shadcn sono pensati per un solo tema e restano a meta. Il CRM ridefinisce quasi tutto in `.crm-theme`.
2. **Regole del CRM che non si applicano.** `.crm-theme [data-slot="card"]` (niente ombra, raggio 0.5rem) e `[data-slot="badge"]` non colpiscono nulla: `Card` e `Badge` della libreria non hanno `data-slot`. Il risultato e che `Card` ha ombra e raggio 12px nel CRM, mentre `Scheda` ha 12px senza ombra: due modelli di scheda.
3. **Inter dichiarato ma non caricato.** Di fatto si vede il font di sistema, quindi cambia da Mac a Windows a Android.
4. **Troppi raggi e ombre.** Sette raggi in uso e cinque livelli di ombra Tailwind piu quattro ombre proprie; `shadow-2xl` e `shadow-lg` compaiono oltre 60 volte ciascuno.
5. **Colori scritti a mano.** Esadecimali ripetuti nelle pagine del sito (`#050f24` 28 volte, `#0b1730` 19, `#081634` 18, `#0b1224`, `#081226`, `#0b1a38`) invece dei token `navy`: almeno sei navy quasi uguali. Sidebar CRM con indicatore `sky-500` invece del primary.
6. **Arancio CTA isolato** e testo con sfumatura animata in piu punti.
