/** Banco del pannello «Oggi» (31/10/2026): lo stesso PannelloOggi della chat, con dati finti.
 *  ?come=consulente|admin|titolare (chi è dentro) · ?largo=420 (larghezza del foglio, in px).
 *  Uso: npx vite -c strumenti/banco-chat/vite.oggi.config.mjs  →  http://localhost:5198/oggi.html */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { PannelloOggi } from "../../src/crm/chatwa/PannelloOggi";

const P = new URLSearchParams(location.search);
const largo = P.get("largo");
createRoot(document.getElementById("r")!).render(
  <StrictMode>
    <div style={{ height: "100dvh", width: largo ? `${largo}px` : "100%" }} className="bg-white">
      <PannelloOggi onApri={() => {}} onStato={() => {}} />
    </div>
  </StrictMode>,
);
