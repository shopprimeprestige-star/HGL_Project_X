---
name: Hair Genius Labs Hub
description: Sito pubblico «Blueprint» e CRM chiaro per la consulenza in videochiamata
colors:
  blueprint-navy: "oklch(0.21 0.05 255)"
  blueprint-navy-deep: "oklch(0.15 0.045 258)"
  blueprint-navy-light: "oklch(0.28 0.055 255)"
  signal-blue: "oklch(0.65 0.19 252)"
  crm-blue: "oklch(0.55 0.16 252)"
  crm-paper: "oklch(0.995 0.002 250)"
  crm-sidebar: "oklch(0.975 0.003 250)"
  crm-quiet: "oklch(0.965 0.003 250)"
  crm-line: "oklch(0.9 0.005 250)"
  ink: "oklch(0.18 0.015 255)"
  ink-muted: "oklch(0.48 0.012 255)"
  danger: "oklch(0.58 0.21 27)"
  success: "oklch(0.62 0.17 152)"
  warning: "oklch(0.78 0.15 78)"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    lineHeight: 1.2
    fontWeight: 600
  row:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    lineHeight: 1.4
  note:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    lineHeight: 1.35
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: 1.3
  quote-display-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27.2px"
    lineHeight: 1.05
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-display-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    lineHeight: 1.05
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-display-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "46.4px"
    lineHeight: 1.05
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-doc-title-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    lineHeight: 1.25
    fontWeight: 700
    letterSpacing: "-0.025em"
  quote-doc-title-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    lineHeight: 1.25
    fontWeight: 700
    letterSpacing: "-0.025em"
  quote-section:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    lineHeight: 1.4
    fontWeight: 600
  quote-phase-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.25
    fontWeight: 600
  quote-phase-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    lineHeight: 1.25
    fontWeight: 600
  quote-body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  quote-field:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.4
  quote-desc:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.4
  quote-note:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    lineHeight: 1.35
  quote-label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: 1.3
    fontWeight: 600
    letterSpacing: "0.08em"
  quote-price-hero-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "44px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-hero-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-guarantee-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-guarantee-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "46px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-second-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "42px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-second-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "48px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-total-sheet:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-total:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    lineHeight: 1
    fontWeight: 800
    letterSpacing: "-0.025em"
  quote-price-cell:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    lineHeight: 1
    fontWeight: 700
  quote-price-card:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    lineHeight: 1.2
    fontWeight: 700
rounded:
  md: "0.5rem"
  lg: "0.75rem"
  full: "9999px"
spacing:
  page-mobile: "16px"
  page-desktop: "24px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.crm-blue}"
    textColor: "{colors.crm-paper}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.crm-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.crm-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  public-cta:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.crm-paper}"
    rounded: "{rounded.full}"
---

# Design System: Hair Genius Labs Hub

## Overview

**Creative North Star: «Il tavolo del consulente»**
*(proposta di Claude dal codice e dalle risposte del titolare del 12/10/2026: da confermare)*

Due mondi con un solo marchio. Il **pubblico** (homepage, prenotazione, preventivo, blog) è scuro,
tecnico e preciso: navy profondo con griglia sottile («Blueprint»), un blu acceso solo dove si agisce.
Il **CRM** è chiaro, calmo e denso: carta quasi bianca, bordi sottili, l'accento blu ridotto ai soli
pulsanti principali e allo stato attivo, perché un consulente in chiamata deve trovare le cose senza
che lo schermo gridi. Si migliora questo sistema, non lo si sostituisce.

**Key Characteristics:**
- Un solo accento per schermata, usato poco: è un segnale, non una decorazione.
- Densità da strumento di lavoro nel CRM, respiro nelle pagine pubbliche.
- Testo leggibile prima di tutto (mai sotto 11 px sul telefono).
- Niente ornamenti «da AI»: niente testo sfumato, niente neon, niente schede tutte uguali per riempire.

## Colors

Navy e blu dello stesso tono (hue 252-258) per il pubblico; neutri freddi quasi bianchi per il CRM.

### Primary
- **Blu segnale** (`oklch(0.65 0.19 252)`): pulsanti e link d'azione sulle pagine pubbliche scure.
- **Blu del CRM** (`oklch(0.55 0.16 252)`): solo il pulsante principale e lo stato attivo nel CRM.

### Neutral
- **Navy Blueprint** (`oklch(0.21 0.05 255)`), **profondo** (`oklch(0.15 0.045 258)`), **chiaro**
  (`oklch(0.28 0.055 255)`): fondi, schede e sidebar delle pagine pubbliche.
- **Carta del CRM** (`oklch(0.995 0.002 250)`): fondo del CRM. **Sidebar** (`oklch(0.975 0.003 250)`),
  **quieto** (`oklch(0.965 0.003 250)`) per aree secondarie, **linea** (`oklch(0.9 0.005 250)`) per i bordi.
- **Inchiostro** (`oklch(0.18 0.015 255)`) e **inchiostro tenue** (`oklch(0.48 0.012 255)`): testo.
- Stati: **pericolo** `oklch(0.58 0.21 27)`, **successo** `oklch(0.62 0.17 152)`, **attenzione**
  `oklch(0.78 0.15 78)`; colori delle fasi dei lead come già definiti in `src/crm/ui.tsx`.

### Named Rules
**La regola dell'accento raro.** Nel CRM il blu compare solo sull'azione principale e su ciò che è
attivo. Se tutto è blu, niente lo è.
**La regola dello schermo condiviso.** Nelle schermate che il cliente vede in chiamata, nessun colore
d'allarme per informazioni interne e nessun dato di altri clienti.

## Typography

**Font:** Inter (con ui-sans-serif, system-ui) per tutto. **Carattere:** neutro e preciso; la gerarchia
si fa con dimensione, peso e spazio, non con caratteri diversi.

### Hierarchy (classi già nel codice, `.crm-theme .t-*`)
- **Titolo** (20px, 1.2): intestazione di pagina e di finestra.
- **Riga** (15px, 1.25): nome del lead, voce principale di una lista.
- **Corpo** (13.5px, 1.4): testo normale del CRM.
- **Nota** (12.5px, 1.35): informazioni di contorno.
- **Etichetta** (11px, 1.3): il minimo assoluto, solo per etichette brevi.

### Named Rules
**La regola degli 11 pixel.** Sotto gli 11 px non si scende: sul telefono, al sole, non si legge.

## Pagina scura del preventivo

La pagina `/preventivo` (configuratore e preventivo creato) è il mondo pubblico scuro: fondo navy, testo
bianco a più livelli, una sola voce di accento. Ha una scala sua, con i token `quote-*` qui sopra; i
token del CRM (`title`, `row`, `body`, `note`, `label`) non si usano su questa pagina. In YAML ogni
gradino è un token con un solo valore. Dove la misura cresce con lo schermo, ogni misura ha il suo
token, con il suffisso `-sm` (telefono), `-md` (da `sm`, 640px) o `-lg` (computer): le classi
`sm:`/`md:` passano dall'uno all'altro. Se il codice cambia, si allinea questo elenco, non il contrario.

### Scala

| Ruolo | Token | Dove si usa |
|---|---|---|
| Titolo del configuratore | `quote-display-sm` 27.2px, poi `-md` 36px, poi `-lg` 46.4px (peso 800) | Apertura della pagina. |
| Nome della soluzione | `quote-doc-title-sm` 22px, poi `-lg` 26px (peso 700) | Preventivo già creato. |
| Titolo di sezione | `quote-section` 18px (peso 600) | I titoli di sezione del configuratore. |
| Titolo di fase | `quote-phase-sm` 16px, poi `-lg` 17px (peso 600) | `FaseTitolo`. |
| Testo descrittivo | `quote-body` 14px (interlinea 1.6) | Spiegazioni e paragrafi. |
| Testo nei campi | `quote-field` 15px | Campi, righe da scegliere. |
| Descrizione di scheda | `quote-desc` 13px | Descrizioni delle schede e note. |
| Rassicurazione | `quote-note` 12.5px | Frasi sotto i pulsanti. |
| Etichetta | `quote-label` 11px (peso 600, maiuscolo, spaziatura da 0.08 a 0.14em) | Il minimo assoluto. |
| Totale del preventivo creato | `quote-price-hero-sm` 44px, poi `-lg` 52px (peso 800) | Totale in evidenza. |
| Totale della garanzia | `quote-price-guarantee-sm` 40px, poi `-lg` 46px | Della stessa famiglia del totale. |
| Secondo impianto | `quote-price-second-sm` 42px, poi `-lg` 48px | Della stessa famiglia del totale. |
| Totale del riepilogo | `quote-price-total-sheet` 36px (riepilogo a tutto schermo sul telefono) · `quote-price-total` 30px (riepilogo sul computer e barra del telefono) | Il totale non si rimpicciolisce mai. |
| Cella «Ora / Alla consegna» | `quote-price-cell` 24px (peso 700) | Celle a due prezzi. |
| Prezzo nella scheda di una strada | `quote-price-card` 18px (peso 700, cifre tabellari) | Schede delle strade. |

Il prezzo barrato resta a 15px (`BARRATO_CLASSI`). Sulle etichette maiuscole la spaziatura non supera 0.14em.

### Contrasto

Il testo bianco si regola con l'opacità sul navy; i rapporti sono calcolati sul navy della pagina
(`blueprint-navy`) e sul suo tono più chiaro (`blueprint-navy-light`).
- **100%** titoli e cifre; **80-85%** testo forte; **65-70%** testo secondario consigliato (da 7 a 9:1).
- **Minimo 50% per qualunque testo informativo** (circa 4,8:1 sul tono più chiaro, 5,2:1 sul navy; al 45% scende
  a 4,1:1 e non passa il 4,5:1). Vale anche per i segnaposto dei campi, tutti allo stesso valore.
- Solo le icone decorative possono stare al 40%.
- Non si scende sotto 50% per «attenuare» una frase: se è meno importante si rimpicciolisce o si sposta, non si sbiadisce.

### Named Rules
**La regola dell'effetto unico.** Effetti animati: al massimo uno per sezione, e solo con un perché
(entrata `hg-rise`, cambio prezzo `hg-price-pop`, segnale dal vivo `hg-pulse-ring`). Niente animazioni
infinite decorative (aurora, luccichio, bagliore), niente vetro sfocato sopra il testo che scorre. Ogni
animazione rispetta `prefers-reduced-motion`: chi aggiunge una classe animata in `styles.css` le dà la
sua regola `@media (prefers-reduced-motion: reduce)`.
**La regola dei colori della pagina scura.** Il blu segnale sull'azione e sullo stato attivo; l'ambra
solo per i prezzi scontati; il verde per gratis e risparmio.

## Layout

Pagina del CRM con padding 16px su telefono e 24px da desktop (`p-4 md:p-6`, componente `Pagina`),
larghezza massima 1400px (tabelle e calendari possono andare a tutta larghezza), sezioni impilate
con 16px di spazio. Le pagine pubbliche partono dal telefono (prima schermata da Instagram e ads).

## Elevation & Depth

Il CRM è quasi piatto: profondità data da bordi sottili e da piccoli cambi di fondo (carta, sidebar,
quieto). Ombre leggere solo su schede e pulsanti principali, più marcate solo per finestre e menu
sopra il contenuto. Le pagine pubbliche usano la sovrapposizione di navy di toni diversi.

## Shapes

Raggio base 0.5rem per pulsanti e campi, 0.75rem per le schede, pillole complete per badge, chip e
CTA pubbliche. Bordi da 1px nel colore linea.

## Components

### Buttons
- **Forma:** raggio 0.5rem, altezza 36px (32px nella versione piccola).
- **Principale:** blu del CRM su testo chiaro; al passaggio leggermente più scuro.
- **Contorno e fantasma:** per le azioni secondarie; il fantasma si colora solo al passaggio.
- **Pericolo:** solo per azioni irreversibili, sempre con conferma.

### Cards / Containers
- Raggio 0.75rem, fondo carta, bordo linea, ombra leggera; componente `Scheda` con titolo, nota e azioni.

### Chips e Badge
- Pillole con il colore della fase del lead (`src/crm/ui.tsx`): il colore dice lo stato, il testo lo conferma.

### Inputs / Fields
- Bordo linea, fondo carta, raggio 0.5rem; focus con l'anello blu tenue; errore con testo e colore pericolo.
