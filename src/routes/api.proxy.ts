/** PONTE PER I SITI ESTERNI ────────────────────────────────────────────────
 *  Un sito di terzi mostrato in una cornice appartiene a un ALTRO dominio, e il
 *  browser vieta per sicurezza sia di leggerne la posizione di scorrimento sia
 *  di muoverla. È il motivo per cui lo scorrimento del sito non poteva essere
 *  rispecchiato sul cliente.
 *  Qui il sito viene scaricato dal NOSTRO server e riservito dal nostro dominio:
 *  a quel punto la cornice non è più "di un altro" e possiamo misurarne e
 *  pilotarne lo scorrimento, esattamente come si fa con le slide.
 *
 *  Cosa fa la pagina servita:
 *   · `<base>` verso l'indirizzo originale → immagini, fogli di stile e script
 *     continuano a caricarsi dal sito vero;
 *   · un piccolo script comunica alla pagina che la contiene la posizione di
 *     scorrimento e accetta il comando per spostarla.
 *
 *  LIMITI ONESTI: alcuni siti non funzioneranno comunque (login, contenuti che
 *  si caricano da soli via chiamate al proprio dominio, protezioni anti-bot).
 *  In quei casi resta valida la condivisione schermo.
 *
 *  SICUREZZA: si accettano solo indirizzi http/https pubblici. Indirizzi di rete
 *  interna e nomi non pubblici sono rifiutati, così questo ponte non può essere
 *  usato per raggiungere macchine private.
 */
import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8 * 1024 * 1024;

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.local|.*\.internal)$/i;

function allowed(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname;
  if (!h || PRIVATE_HOST.test(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && PRIVATE_HOST.test(h + ".")) return false;
  return true;
}

/** Script iniettato: dialoga con la pagina che contiene la cornice. */
const BRIDGE = `<script>(function(){
  try {
    // ── PONTE ────────────────────────────────────────────────────────────────
    //  Serve a due cose: comunicare la posizione di scorrimento e rispecchiare le
    //  INTERAZIONI. Un clic del presentatore (un video che parte, una scheda che
    //  si apre) viene descritto con un percorso stabile dell'elemento e ripetuto
    //  sul dispositivo del cliente, così vede accadere la stessa cosa.
    var last = -1, applying = 0;
    function maxY(){ var d=document.documentElement, b=document.body;
      return Math.max(0,(d&&d.scrollHeight||0)-(window.innerHeight||0),(b&&b.scrollHeight||0)-(window.innerHeight||0)); }
    function report(){
      var m = maxY(), y = window.scrollY || document.documentElement.scrollTop || 0;
      var r = m > 0 ? y / m : 0;
      if (Math.abs(r - last) < 0.0005) return;
      last = r;
      try { parent.postMessage({ hg: "sitescroll", r: r, y: y, max: m }, "*"); } catch(e){}
    }
    var t = 0;
    window.addEventListener("scroll", function(){ if (t) return; t = setTimeout(function(){ t=0; report(); }, 60); }, { passive: true });

    // percorso stabile di un elemento (indice fra i fratelli, dal corpo in giù)
    function pathOf(el){
      var p = [];
      while (el && el.nodeType === 1 && el !== document.body && p.length < 40) {
        var par = el.parentNode; if (!par) break;
        var i = 0, n = par.firstElementChild;
        while (n && n !== el) { i++; n = n.nextElementSibling; }
        p.unshift(i); el = par;
      }
      return p;
    }
    function fromPath(p){
      var el = document.body;
      for (var i = 0; i < p.length && el; i++) {
        var n = el.firstElementChild, k = 0;
        while (n && k < p[i]) { n = n.nextElementSibling; k++; }
        el = n;
      }
      return el;
    }
    document.addEventListener("click", function(e){
      if (applying) return;
      try { parent.postMessage({ hg: "siteclick", p: pathOf(e.target) }, "*"); } catch(err){}
    }, true);
    // stato dei video INTERNI al sito (play/pausa/posizione)
    document.addEventListener("play", function(e){
      if (applying) return;
      var v = e.target; if (!v || !v.tagName || v.tagName !== "VIDEO") return;
      try { parent.postMessage({ hg: "sitemedia", p: pathOf(v), play: true, t: v.currentTime }, "*"); } catch(err){}
    }, true);
    document.addEventListener("pause", function(e){
      if (applying) return;
      var v = e.target; if (!v || !v.tagName || v.tagName !== "VIDEO") return;
      try { parent.postMessage({ hg: "sitemedia", p: pathOf(v), play: false, t: v.currentTime }, "*"); } catch(err){}
    }, true);

    window.addEventListener("message", function(e){
      var d = e && e.data; if (!d) return;
      if (d.hg === "sitescrollto") {
        var m = maxY();
        var y = typeof d.r === "number" ? d.r * m : d.y;
        if (typeof y !== "number") return;
        last = m > 0 ? y / m : 0;
        window.scrollTo({ top: y, behavior: "auto" });
        return;
      }
      if (d.hg === "siteclickto" && d.p) {
        var el = fromPath(d.p); if (!el) return;
        applying = 1;
        try { el.click(); } catch(err){}
        setTimeout(function(){ applying = 0; }, 120);
        return;
      }
      if (d.hg === "siteunmute") {
        var vids = document.getElementsByTagName("video");
        for (var i = 0; i < vids.length; i++) {
          try { vids[i].muted = false; if (vids[i].paused) vids[i].play().catch(function(){}); } catch(e3){}
        }
        return;
      }
      if (d.hg === "sitemediato" && d.p) {
        var v = fromPath(d.p); if (!v || v.tagName !== "VIDEO") return;
        applying = 1;
        try {
          if (typeof d.t === "number" && Math.abs(v.currentTime - d.t) > 1.2) v.currentTime = d.t;
          if (d.play) {
            v.muted = !!d.mute;
            v.play().catch(function(){
              // Il browser rifiuta di partire con l'audio finché non c'è stato
              // un tocco: si parte muti (l'immagine c'è) e si chiede alla pagina
              // che ci contiene di mostrare "Tocca per l'audio".
              v.muted = true;
              v.play().catch(function(){});
              try { parent.postMessage({ hg: "siteneedtap" }, "*"); } catch(e2){}
            });
          }
          else v.pause();
        } catch(err){}
        setTimeout(function(){ applying = 0; }, 200);
      }
    });
    setTimeout(report, 300); setTimeout(report, 1200);
    try { parent.postMessage({ hg: "siteready" }, "*"); } catch(e){}
  } catch(e){}
})();</script>`;

export const Route = createFileRoute("/api/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("u") || "";
        let u: URL;
        try { u = new URL(target); } catch { return new Response("Indirizzo non valido", { status: 400 }); }
        if (!allowed(u)) return new Response("Indirizzo non consentito", { status: 400 });

        let res: Response;
        try {
          res = await fetch(u.toString(), {
            redirect: "follow",
            headers: {
              // ci si presenta come un browser normale: molti siti rifiutano il resto
              "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0",
              "Accept": request.headers.get("accept") || "text/html,application/xhtml+xml,*/*",
              "Accept-Language": request.headers.get("accept-language") || "it-IT,it;q=0.9",
            },
          });
        } catch {
          return new Response(page("Il sito non risponde", u.toString()), { status: 200, headers: htmlHeaders() });
        }

        const ct = res.headers.get("content-type") || "";
        // non-HTML (immagini, PDF, fogli di stile…): si inoltra così com'è
        if (!/text\/html/i.test(ct)) {
          const buf = await res.arrayBuffer();
          return new Response(buf, {
            status: res.status,
            headers: {
              "Content-Type": ct || "application/octet-stream",
              "Cache-Control": "public, max-age=300",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        let html = await res.text();
        if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);

        // via le difese anti-incorporamento espresse DENTRO la pagina
        html = html.replace(/<meta[^>]+http-equiv=["']?(X-Frame-Options|Content-Security-Policy)["']?[^>]*>/gi, "");

        const base = `<base href="${res.url || u.toString()}">`;
        html = /<head[^>]*>/i.test(html)
          ? html.replace(/<head([^>]*)>/i, `<head$1>${base}`)
          : `${base}${html}`;
        html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${BRIDGE}</body>`) : html + BRIDGE;

        return new Response(html, { status: 200, headers: htmlHeaders() });
      },
    },
  },
});

function htmlHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    // il sito riservito da noi DEVE poter stare in una cornice della nostra app
    "X-Frame-Options": "SAMEORIGIN",
  };
}

function page(title: string, url: string) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#081634;color:#fff;font:15px system-ui,sans-serif;text-align:center">
  <div><p style="font-weight:600">${title}</p><p style="opacity:.6;font-size:13px">${url}</p>
  <p style="opacity:.5;font-size:12px;max-width:32ch;margin:12px auto 0">Alcuni siti non consentono di essere mostrati così: in questi casi usa la condivisione schermo.</p></div></body>`;
}
