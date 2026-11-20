/** ── SHOP R1 · T31 · TESTI LEGALI VERITIERI E NIENTE INDIRIZZO DELLA SEDE ─────────────────
 *  Prove sul TESTO dei file (nessun browser): `cookie-policy.tsx`, `Footer.tsx`, `nuova.tsx`.
 *   · «Scipioni» non compare nei tre file toccati (decisione del titolare del 20/11: la sede solo nelle Condizioni di vendita);
 *   · la cookie policy dice cosa fa DAVVERO il codice: le tre categorie, i tre fornitori, niente prima del sì, TikTok solo dal server,
 *     `click_canale` in sessione, come si revoca con «Gestisci cookie»; e non promette quello che il codice non fa;
 *   · i nomi dei cookie scritti nella policy sono quelli che la revoca cancella davvero (`carica.ts`);
 *   · restano ragione sociale, P.IVA, email e telefono; `privacy-policy.tsx` e `termini-e-condizioni.tsx` non si toccano (qui solo letti). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T31 · TESTI LEGALI VERITIERI, NIENTE INDIRIZZO DELLA SEDE (20/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const policy = leggi("src/routes/cookie-policy.tsx");
  const footer = leggi("src/components/landing/Footer.tsx");
  const nuova = leggi("src/routes/nuova.tsx");
  const carica = leggi("src/lib/tracciamento/carica.ts");
  const api = leggi("src/lib/tracciamento/api.ts");
  const piatto = (t) => t.replace(/\s+/g, " ");
  const testoPolicy = piatto(policy);

  c("nessun «Scipioni» nei tre file toccati", [false, false, false], [/Scipioni/.test(policy), /Scipioni/.test(footer), /Scipioni/.test(nuova)]);
  c("nessun CAP né via della sede nei tre file (00192, «Via degli»)", [false, false, false], [/00192/.test(policy + footer + nuova), /Via degli/.test(policy + footer + nuova), /Roma \(RM\)/.test(policy + footer)]);

  /* ── Footer ── */
  c("`Footer.tsx`: il link `GestisciCookie` c'è, importato dal componente di T27", [true, true], [/<GestisciCookie\b/.test(footer), /from "@\/components\/tracciamento\/GestisciCookie"/.test(footer)]);
  c("`Footer.tsx`: restano ragione sociale, P.IVA, email, telefono e i tre link legali", [true, true, true, true, true, true, true], [/HAIR GENIUS LABS SRLS/.test(footer), /18486531009/.test(footer), /hairgeniuslabs@gmail\.com/.test(footer), /\+39 379 311 3802/.test(footer), /\/privacy-policy/.test(footer), /\/cookie-policy/.test(footer), /\/termini-e-condizioni/.test(footer)]);
  c("`Footer.tsx`: l'esportazione `Footer` c'è ancora", true, /export function Footer\(/.test(footer));

  /* ── nuova.tsx: due righe e basta ── */
  c("`nuova.tsx`: il badge dice «Studio a Roma» e il piè di pagina tiene email e telefono", [true, true, true], [/> Studio a Roma\s*\n/.test(nuova), /hairgeniuslabs@gmail\.com/.test(nuova), /\+39 379 324 4356/.test(nuova)]);
  c("`nuova.tsx`: il piè di pagina è «Studio a Roma · email · telefono»", true, /Studio a Roma · hairgeniuslabs@gmail\.com · \+39 379 324 4356/.test(nuova));

  c("`nuova.tsx`: il piè di pagina ha `<GestisciCookie />` e il link alla cookie policy (chi accetta lì deve poter revocare, come promette la policy)", [true, true, true], [/<GestisciCookie\b/.test(nuova), /from "@\/components\/tracciamento\/GestisciCookie"/.test(nuova), /<Link\b[^>]*to="\/cookie-policy"/.test(nuova)]);
  c("`nuova.tsx`: `<GestisciCookie />` sta DENTRO il `<footer>`", true, /<footer\b[\s\S]*<GestisciCookie\b[\s\S]*<\/footer>/.test(nuova));

  /* ── cookie policy: le tre categorie e i fornitori veri ── */
  c("cookie policy: le tre categorie — Necessari, Statistiche, Marketing", [true, true, true], [/Necessari/.test(policy), /Statistiche/.test(policy), /Marketing/.test(policy)]);
  c("cookie policy: nomina Meta, TikTok e Google", [true, true, true], [/Meta/.test(policy), /TikTok/.test(policy), /Google/.test(policy)]);
  c("cookie policy: nessuno script prima del sì (dice «solo dopo» il consenso, e che senza scelta non si carica niente)", [true, true], [/solo dopo/i.test(testoPolicy), /nessuno script|non (carichiamo|viene caricato) (nessuno|niente)|prima della (tua )?scelta/i.test(testoPolicy)]);
  c("cookie policy: TikTok arriva dal server, non dal tuo browser", true, /TikTok[^.]*(server|nostri server)/i.test(testoPolicy) && /non[^.]*(browser|dispositivo)/i.test(testoPolicy));
  c("cookie policy: dice che `click_canale` sta nella sessione del browser", [true, true], [/click_canale/.test(policy), /sessione/i.test(testoPolicy)]);
  c("cookie policy: Google con le sole statistiche non attiva i segnali pubblicitari", true, /segnali pubblicitari|personalizzazione/i.test(testoPolicy));
  c("cookie policy: come si cambia o si revoca — «Gestisci cookie» è un vero link/bottone (`GestisciCookie`) e il testo dice cosa succede (cookie cancellati, pagina ricaricata)", [true, true, true], [/<GestisciCookie\b/.test(policy), /Gestisci cookie/.test(policy), /ricaric/i.test(testoPolicy) && /cancell/i.test(testoPolicy)]);
  c("cookie policy: chi aveva scelto con il vecchio banner lo rivede se aveva accettato (D10)", true, /vecchio|precedente/i.test(testoPolicy) && /una volta|di nuovo|nuovamente/i.test(testoPolicy));
  c("cookie policy: ricorda che la revoca non cancella ciò che le piattaforme hanno già ricevuto", true, /già ricevut|già raccolt|già inviat/i.test(testoPolicy));

  /* ── la policy non promette quello che il codice non fa ── */
  c("cookie policy: niente «anonimizzati» (le statistiche di Google non lo sono per noi)", false, /anonimizz/i.test(policy));
  c("cookie policy: la data dell'aggiornamento è scritta, non la data di oggi calcolata ad ogni apertura", [false, true], [/new Date\(\)/.test(policy), /Ultimo aggiornamento:\s*\d|aggiornamento[^<]{0,40}\d{1,2}\s+\w+\s+20\d\d|20\/11\/2026/.test(policy)]);
  c("cookie policy: ragione sociale, P.IVA ed email restano; nessun indirizzo", [true, true, true, false], [/HAIR GENIUS LABS SRLS/.test(policy), /18486531009/.test(policy), /hairgeniuslabs@gmail\.com/.test(policy), /\b00\d{3}\b/.test(policy)]);

  /* ── ciò che la policy dice è ciò che il codice fa ── */
  c("vero: il pixel di TikTok nel browser è spento (nessun `tiktokNelBrowser: true` nel caricatore vero)", [true, false], [/tiktokNelBrowser\?:\s*boolean/.test(carica), /tiktokNelBrowser:\s*true/.test(api)]);
  const noti = [...(carica.match(/const COOKIE_NOTI = \[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const scritti = [...policy.matchAll(/`?(_(?:fbp|fbc|ga|gid|gcl_[a-z]+|ttp))`?\b/g)].map((m) => m[1]);
  c("vero: ogni cookie con nome fisso scritto nella policy è fra quelli che la revoca cancella (`COOKIE_NOTI`)", true, scritti.length > 0 && scritti.every((n) => noti.includes(n)));
  c("vero: la policy non nomina `_ttp` (il pixel di TikTok nel browser non c'è)", false, /_ttp/.test(policy));
  c("vero: la revoca cancella anche `_ga_*`, `_gcl_*`, `_gac_*` e la policy li chiama per nome", [true, true], [/_gac_/.test(carica), /_ga_\*/.test(policy) && /_gcl_\*/.test(policy) && /_gac_\*/.test(policy)]);
}
