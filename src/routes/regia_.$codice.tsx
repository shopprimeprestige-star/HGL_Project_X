/** ── LA REGIA DEL WEBINAR, COME SCHERMATA SUA ───────────────────────────────
 *  /regia/kfr-mbqd-tzp
 *
 *  ⚠️ PERCHÉ È USCITA DA MEETLY, E NON È UNA QUESTIONE DI GUSTO.
 *  Dentro Meetly la regia era una finestrella appoggiata sopra le pagine del
 *  presentatore. Ogni pagina però disegna la PROPRIA barra, quindi passando da
 *  «Media» a «Slide» quella finestrella si smontava e si rimontava, perdendo
 *  tutto quello che teneva in mano: premevi «Slide», la sala ci andava davvero,
 *  ma il pannello tornava a dire «Solo te» — il comando aveva funzionato e
 *  l'interfaccia diceva di no. È il tipo di guasto che fa ripremere lo stesso
 *  pulsante quattro volte davanti a duecento persone.
 *  Qui non si naviga: i contenuti stanno dentro una cornice e si cambia
 *  quella. Non c'è niente da smontare, quindi non c'è niente da perdere.
 *
 *  ⚠️ E QUESTA PAGINA NON TOCCA LE CONSULENZE. Non monta la barra del
 *   presentatore, non monta il motore della videochiamata: è un'altra
 *   schermata, con un altro mestiere.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Radio, TriangleAlert } from "lucide-react";
import { ConsoleSala } from "@/webinar/DaMeetly";
import { impostaModo, useModo } from "@/webinar/modo";

export const Route = createFileRoute("/regia_/$codice")({
  head: () => ({ meta: [{ title: "Regia — Hair Genius Labs" }, { name: "robots", content: "noindex" }] }),
  component: PaginaRegia,
});

interface Sala { codice: string; titolo: string; link: string }

function PaginaRegia() {
  const { codice } = Route.useParams();
  const modo = useModo();
  const [errore, setErrore] = useState("");
  const [cerco, setCerco] = useState(true);

  /** In sala, come spettatore. `?daRegia=1` serve solo a farlo sapere: chi
   *  arriva qui perché conduce davvero e ha la sessione scaduta deve capire
   *  perché si ritrova dall'altra parte. */
  const inSala = () => {
    window.location.replace(`/webinar/${encodeURIComponent(codice)}?daRegia=1`);
  };

  //  ── SI CARICA LA SALA E LA SI METTE NEL NEGOZIETTO ──────────────────
  //   La console legge da lì, esattamente come quando vive dentro Meetly: è la
  //   stessa console, con la stessa logica, in un'altra cornice.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch("/api/crm/webinar?azione=elenco");
        //  ── ⚠️ CHI NON CONDUCE NON SBATTE CONTRO UN MURO, VA IN SALA ─────
        //   Questo indirizzo finisce in mano agli spettatori: è quello che il
        //   relatore ha davanti mentre conduce, quindi è quello che copia
        //   dalla barra del browser quando qualcuno chiede «mandami il link».
        //   Rispondergli «serve l'accesso da presentatore, entra col PIN» vuol
        //   dire mandare via una persona che voleva solo guardare — e a un
        //   webinar non si torna una seconda volta.
        //   Si entra in sala, dove non serve niente. Il codice è lo stesso.
        if (r.status === 401 || r.status === 403) {
          if (vivo) inSala();
          return;
        }
        const j = await r.json();
        const sala = (j?.stanze as Sala[] | undefined)?.find((s) => s.codice === codice);
        if (!vivo) return;
        if (!sala) {
          //  Stessa cosa per chi c'è ma non è fra chi la conduce: non è un
          //  errore suo, è semplicemente uno spettatore.
          inSala();
          return;
        }
        impostaModo({ sala: { codice: sala.codice, titolo: sala.titolo, link: sala.link }, consoleAperta: true });
      } catch {
        //  Un guasto di rete NON manda in sala: chi conduce si ritroverebbe
        //  spettatore della propria diretta senza capire perché. Qui si dice
        //  che è andato storto qualcosa e si riprova.
        if (vivo) setErrore("Non riesco a leggere la sala. Ricarica fra un momento.");
      } finally {
        if (vivo) setCerco(false);
      }
    })();
    return () => { vivo = false; };
  }, [codice]);

  //  Uscendo dalla regia si lascia la sala: senza, tornando in Meetly ci si
  //  ritroverebbe la finestrella aperta su una diretta che qui è già chiusa.
  useEffect(() => () => { impostaModo({ sala: null }); }, []);

  if (errore) {
    return (
      <div className="bg-blueprint flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <TriangleAlert className="h-8 w-8 text-amber-400/70" />
        <p className="text-base font-medium">Non posso aprire la regia</p>
        <p className="max-w-sm text-sm text-white/55">{errore}</p>
      </div>
    );
  }

  if (cerco || !modo.sala) {
    return (
      <div className="bg-blueprint flex min-h-screen flex-col items-center justify-center gap-3 text-white">
        <Radio className="h-7 w-7 text-white/30" />
        <p className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Apro la regia…
        </p>
      </div>
    );
  }

  return <ConsoleSala pagina />;
}
