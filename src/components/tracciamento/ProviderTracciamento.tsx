/*  ── IL PROVIDER DEL TRACCIAMENTO: BANNER, SCELTA, SCRIPT ──────────────────────────
    Shop R1 · T27 · PIANO D10, D12, D14, D15, §3.4. Montato una volta sola, come PRIMO elemento della radice (in testa al
    DOM), fuori dal cancello dell'ospite. Non disegna niente finché non ha letto la scelta e saputo chi è il visitatore:
    sul server e al primo disegno è vuoto, quindi non c'è lampo né differenza fra server e browser.
    Le decisioni stanno in `controllo.ts` (provate senza browser): qui si collegano alla pagina e al banner.
    ⚠️ Gli script li inserisce SOLO il caricatore unico (`daiCaricatore`, T26): da qui non entra nessun indirizzo esterno. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { EVENTO_CONSENSO, leggiConsenso, scriviConsenso, type Consenso } from "@/lib/consenso";
import { bannerAmmesso } from "@/lib/tracciamento/ammesse";
import { daiCaricatore, emettiEvento } from "@/lib/tracciamento/api";
import type { ConfigPubblica } from "@/lib/tracciamento/carica";
import { BannerCookie, type SceltaBanner } from "./BannerCookie";
import { creaControllo, EVENTO_APRI_COOKIE, mostraBanner, ridaiIlFuoco } from "./controllo";

/** `localStorage` o niente: con i cookie bloccati anche solo toccarlo può lanciare. */
function magazzino(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function configPubblica(): Promise<ConfigPubblica | null> {
  const r = await fetch("/api/public/tracking-config", { credentials: "omit" });
  if (!r.ok) return null;
  const j = (await r.json()) as ConfigPubblica | null;
  return j && typeof j === "object" ? j : null;
}

export function ProviderTracciamento() {
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const ricerca = useRouterState({ select: (s) => s.location.searchStr });
  const [consenso, setConsenso] = useState<Consenso | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [inCornice, setInCornice] = useState(false);
  const [riaperto, setRiaperto] = useState(false);
  const [daUtente, setDaUtente] = useState(false);
  const [esito, setEsito] = useState<"ok" | "errore" | null>(null);
  const controllo = useRef<ReturnType<typeof creaControllo> | null>(null);
  // dove stava il fuoco quando l'utente ha aperto il banner dal link, e se alla chiusura il fuoco va ridato
  const fuocoPrima = useRef<HTMLElement | null>(null);
  const ridaiFuoco = useRef(false);

  // una volta, nel browser: il controllo, la scelta di adesso e i due eventi (scelta cambiata, «Gestisci cookie»)
  useEffect(() => {
    const caricatore = daiCaricatore();
    if (!caricatore) return;
    const c = creaControllo({
      caricatore,
      leggi: () => leggiConsenso(magazzino()),
      pagina: () => ({ percorso: window.location.pathname, ricerca: window.location.search, inCornice: window.self !== window.top }),
      // il controllo vero, a parte: porta con sé il client del database, che nel pezzo d'avvio non deve pesare
      admin: () => import("@/landing/booking/tracking").then((m) => m.initAdminCheck()),
      config: configPubblica,
      pageView: () => emettiEvento("PageView"),
    });
    controllo.current = c;
    setInCornice(window.self !== window.top);
    setConsenso(leggiConsenso(magazzino()));
    const suScelta = (e: Event) => {
      const nuova = (e as CustomEvent<Consenso>).detail;
      setConsenso(nuova);
      void c.consensoCambiato(nuova);
    };
    const suApri = () => {
      fuocoPrima.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDaUtente(true);
      setEsito(null);
      setRiaperto(true);
    };
    window.addEventListener(EVENTO_CONSENSO, suScelta);
    window.addEventListener(EVENTO_APRI_COOKIE, suApri);
    return () => {
      window.removeEventListener(EVENTO_CONSENSO, suScelta);
      window.removeEventListener(EVENTO_APRI_COOKIE, suApri);
      controllo.current = null;
    };
  }, []);

  // a OGNI cambio di pagina: si rivaluta (script, PageView, meta del referrer) e, dove il banner può comparire (anche su ricerca e filtri, dove i pixel no), si sa se è un amministratore
  useEffect(() => {
    const c = controllo.current;
    if (!c) return;
    void c.valuta();
    if (bannerAmmesso(percorso, ricerca, window.self !== window.top, false)) void c.verificaAdmin().then(setAdmin);
  }, [percorso, ricerca]);

  const salva = useCallback((s: SceltaBanner) => {
    setDaUtente(false);
    setEsito(scriviConsenso(magazzino(), s, Date.now()).scelto ? "ok" : "errore");
  }, []);
  const chiudi = useCallback(() => {
    ridaiFuoco.current = true;
    setRiaperto(false);
    setEsito(null);
    setDaUtente(false);
  }, []);

  const visibile = mostraBanner({ percorso, ricerca, inCornice, admin, consenso, riaperto: riaperto || esito === "ok" });
  // il banner se n'è andato (conferma finita o Esc): il fuoco non resta sulla pagina vuota. Torna al link che l'aveva aperto, o al primo
  // «Gestisci cookie»; se nel frattempo l'utente l'ha già portato altrove non si tocca.
  useEffect(() => {
    if (visibile || !ridaiFuoco.current) return;
    ridaiFuoco.current = false;
    ridaiIlFuoco(document, fuocoPrima.current, document.querySelector<HTMLElement>("[data-gestisci-cookie]"));
    fuocoPrima.current = null;
  }, [visibile]);
  if (!visibile) return null;
  return (
    <BannerCookie
      // si rimonta se cambia il modo di aprirlo: così le caselle partono dalla scelta di adesso
      key={riaperto ? "riaperto" : "primo"}
      attuale={consenso?.scelto ? { statistiche: consenso.statistiche, marketing: consenso.marketing } : null}
      vistaIniziale={riaperto ? "scelte" : "domanda"}
      daUtente={daUtente}
      esito={esito}
      onScelta={salva}
      onChiudi={chiudi}
    />
  );
}
