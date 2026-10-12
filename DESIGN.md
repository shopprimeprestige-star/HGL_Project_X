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
