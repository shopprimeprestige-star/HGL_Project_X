/** I due caratteri della pagina `/soluzioni`, precaricati nella testa della rotta.
 *  Solo i due file che servono alla prima schermata: Anton 400 (titolo e nomi) e Inter Tight (tutto il resto),
 *  entrambi `latin` (tutte le lettere italiane). I `latin-ext` partono da soli, solo se un segno li chiede.
 *  Gli indirizzi sono quelli dei `@font-face` di `styles.css`: se cambiano là, cambiano qui (la prova li confronta). */
export const PRECARICA_FONT_SOLUZIONI = [
  { rel: "preload", href: "/fonts/anton/5.3.0/anton-latin-400-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/inter-tight/5.3.0/inter-tight-latin-wght-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
] as const;
