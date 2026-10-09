// Accesso "consulente" tramite link magico.
// Il consulente apre  /preventivo?unlock=<chiave>  una volta → il browser resta sbloccato
// (localStorage). Tutti i controlli da presentatore compaiono SOLO se sbloccato.
// Gli utenti normali che aprono il link del preventivo non vedono nulla.
import { useEffect, useState } from "react";

const K = "hg_consultant";
const listeners = new Set<(v: boolean) => void>();
const emit = () => { const v = isConsultant(); listeners.forEach((cb) => cb(v)); };

export function isConsultant(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(K) === "1";
}
export function clearConsultant() { if (typeof window !== "undefined") localStorage.removeItem(K); emit(); }

export function useConsultant(): { consultant: boolean; ready: boolean } {
  const [consultant, setConsultant] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    listeners.add(setConsultant);
    const p = new URLSearchParams(window.location.search);
    const k = p.get("unlock");
    const cleanUrl = () => { p.delete("unlock"); const q = p.toString(); window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : "")); };
    if (k) {
      fetch("/api/presenter/consultant?k=" + encodeURIComponent(k))
        .then((r) => r.json())
        .then((j) => { if (j.ok) localStorage.setItem(K, "1"); })
        .catch(() => {})
        .finally(() => { cleanUrl(); emit(); setConsultant(isConsultant()); setReady(true); });
    } else {
      setConsultant(isConsultant());
      setReady(true);
    }
    return () => { listeners.delete(setConsultant); };
  }, []);
  return { consultant, ready };
}

// ── IL LINK DEL PRESENTATORE, CHIESTO AL SERVER ─────────────────────────────
//  Prima questo link veniva costruito nel browser incollandoci dentro il codice
//  consulente scritto nel sorgente: chiunque aprisse il sito e guardasse il
//  codice della pagina lo leggeva, e con quello entrava come consulente.
//  Adesso il codice nel pacchetto inviato al browser NON C'È: lo consegna il
//  server, e solo a chi ha già una sessione valida — cioè a chi quel link ce
//  l'ha comunque. Chi non è autenticato riceve stringa vuota e non vede il
//  comando "copia il mio link".
export function usePresenterLink(): string {
  const [link, setLink] = useState("");
  useEffect(() => {
    let vivo = true;
    fetch("/api/presenter/consultant", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (vivo && j?.ok && j.link) setLink(String(j.link)); })
      .catch(() => { /* offline: il comando resta nascosto, ed è la scelta giusta */ });
    return () => { vivo = false; };
  }, []);
  return link;
}

// ── LA SESSIONE VERA STA SUL SERVER, NON NEL BROWSER ────────────────────────
//  Il presentatore scelto è ricordato in localStorage, ma quello è solo un
//  promemoria locale: ciò che apre davvero i dati dei clienti è un cookie di
//  sessione, che nasce solo passando dal cancello con il PIN.
//
//  IL GUASTO CHE QUESTO RISOLVE: chi aveva già il presentatore salvato da prima
//  che le rotte fossero protette non vedeva più comparire il cancello — quindi
//  il cookie non nasceva MAI. Tutto sembrava normale, ma ogni chiamata al
//  server veniva respinta: elenco preventivi vuoto, registrazioni che non si
//  archiviavano e ripiegavano sullo scaricamento sul computer. Un guasto
//  silenzioso, del tipo peggiore: nessun errore a schermo, solo cose che non
//  si salvano.
//
//  "sconosciuta" finché non si sa: si evita di far lampeggiare il cancello a
//  chi la sessione ce l'ha eccome.
export type StatoSessione = "sconosciuta" | "valida" | "assente";

export function useSessionePresentatore(): StatoSessione {
  const [stato, setStato] = useState<StatoSessione>("sconosciuta");
  useEffect(() => {
    let vivo = true;
    fetch("/api/presenter/consultant", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (vivo) setStato(j?.ok ? "valida" : "assente"); })
      //  Rete assente: NON si dichiara la sessione mancante, altrimenti un
      //  attimo di linea storta butterebbe fuori chi sta lavorando.
      .catch(() => { if (vivo) setStato("sconosciuta"); });
    return () => { vivo = false; };
  }, []);
  return stato;
}
