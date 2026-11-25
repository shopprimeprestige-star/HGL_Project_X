import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";
import { GestisciCookie } from "@/components/tracciamento/GestisciCookie";

export const Route = createFileRoute("/cookie-policy")({
  component: CookiePolicyPage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — Hair Genius Labs" },
      {
        name: "description",
        content:
          "Informativa sull'uso dei cookie e tecnologie simili in conformità al GDPR e alla normativa italiana (Provv. Garante 10/06/2021): cosa usiamo, quando, e come cambiare la scelta.",
      },
    ],
  }),
});

function CookiePolicyPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white-trama">
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24 text-ink">
        <Link
          to="/"
          className="text-[0.7rem] tracking-[0.22em] uppercase text-brand font-semibold hover:underline"
        >
          ← Torna alla home
        </Link>
        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ultimo aggiornamento: 20/11/2026
        </p>

        {/* ⚠️ Shop R1 · T31. Questo testo descrive quello che il codice fa DAVVERO (banner v2, `lib/consenso`, `lib/tracciamento/carica`):
            se cambia il comportamento (per esempio si riaccende il pixel di TikTok nel browser) va cambiato anche qui.
            Le prove `prove/negozio/testi-legali.mjs` controllano i nomi dei cookie e che il pixel di TikTok nel browser sia spento.
            Testo da far approvare al titolare. */}
        <Section title="1. Cosa sono i cookie">
          I cookie sono piccoli file di testo memorizzati sul dispositivo
          dell'utente. Con lo stesso scopo usiamo anche la memoria del browser
          (<em>localStorage</em> e <em>sessionStorage</em>): in questa pagina
          «cookie» indica tutte queste tecnologie.
        </Section>

        <Section title="2. Le tre categorie">
          <ul className="list-disc pl-5 space-y-3">
            <li>
              <strong>Necessari</strong>: sono sempre attivi e non richiedono
              consenso. Fanno funzionare il sito: ricordano la tua scelta sui
              cookie, il carrello, il modulo di prenotazione che stai
              compilando e la sicurezza.
            </li>
            <li>
              <strong>Statistiche</strong>: solo se le accetti. Carichiamo
              Google per sapere, in forma aggregata, quali pagine si visitano.
              Con le sole statistiche Google non riceve i segnali pubblicitari
              né la personalizzazione degli annunci. Con le statistiche
              conserviamo nel browser, fino a 30 giorni, la storia delle
              campagne e dei canali da cui sei arrivato.
            </li>
            <li>
              <strong>Marketing (Meta, TikTok e Google)</strong>: solo se li
              accetti. Servono a misurare gli annunci e a mostrarti i nostri
              annunci su Meta (Facebook e Instagram), TikTok e Google. Con il
              marketing conserviamo anche gli identificativi dei clic sugli
              annunci e un codice casuale del tuo browser.
            </li>
          </ul>
        </Section>

        <Section title="3. Cosa si carica, e quando">
          Finché non scegli, e se scegli «solo necessari», non carichiamo nessuno
          script di Meta, TikTok o Google. Gli script e i cookie delle
          piattaforme si caricano solo dopo il tuo sì: quelli di Google con le
          statistiche o con il marketing, quelli di Meta con il marketing.
          Nessuno si carica sulle pagine personali (ordini, preventivi,
          videochiamate, anteprime) né nell'area riservata, anche se hai
          accettato.
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong>Google</strong> (statistiche o marketing): cookie{" "}
              <code>_ga</code>, <code>_ga_*</code>, e con il marketing{" "}
              <code>_gcl_*</code> e <code>_gac_*</code>.
            </li>
            <li>
              <strong>Meta</strong> (marketing): cookie <code>_fbp</code> e{" "}
              <code>_fbc</code>. Con il marketing, alcuni eventi di
              navigazione (pagine viste, prodotti, carrello) arrivano a Meta
              anche dai nostri server, con l'indirizzo IP e il tipo di browser
              della richiesta, senza nome, email o telefono.
            </li>
            <li>
              <strong>TikTok</strong> (marketing): il pixel di TikTok non viene
              caricato nel tuo browser e non lascia cookie. TikTok riceve gli
              eventi di navigazione solo dai nostri server, con l'indirizzo IP
              e il tipo di browser della richiesta, senza nome, email o
              telefono.
            </li>
          </ul>
          <p className="mt-3">
            Se prenoti una consulenza e hai accettato il marketing, i dati del
            modulo (email e telefono, in forma cifrata) possono essere inviati
            alle piattaforme per misurare gli annunci. Senza marketing non
            partono.
          </p>
        </Section>

        <Section title="4. Cosa facciamo anche senza cookie di marketing">
          Contiamo le visite in modo interno (pagina vista, campagna da cui
          arrivi, un codice casuale che vale solo per la tua visita), senza
          identificativi del tuo dispositivo né degli annunci. Se arrivi da un
          annuncio Meta o TikTok, ricordiamo nella sessione del browser (si
          cancella quando chiudi la scheda) solo il canale,{" "}
          <code>click_canale</code> = «meta» o «tiktok», e i parametri di
          campagna dell'indirizzo: ci serve a capire da dove arrivano le
          richieste, anche se rifiuti. Non identifica te né il tuo
          dispositivo.
        </Section>

        <Section title="5. Cambiare o revocare la scelta">
          Al primo accesso mostriamo un banner con tre scelte: Accetta, Rifiuta
          o Scegli. Chi aveva accettato con il vecchio banner lo rivede una
          volta, perché quel testo non nominava Meta, TikTok e Google; chi
          aveva rifiutato non deve scegliere di nuovo.
          <p className="mt-3">
            Puoi cambiare idea quando vuoi dal pulsante «Gestisci cookie»:{" "}
            <GestisciCookie className="font-semibold text-ink underline underline-offset-4 hover:text-brand" />.
            Lo trovi anche in fondo a ogni pagina. Se togli un consenso cancelliamo i cookie delle piattaforme
            che conosciamo (<code>_fbp</code>, <code>_fbc</code>,{" "}
            <code>_ga</code>, <code>_ga_*</code>, <code>_gcl_*</code>,{" "}
            <code>_gac_*</code>) e il nostro identificativo, e ricarichiamo la
            pagina senza gli script: il modulo di prenotazione che stavi
            compilando non va perso. La revoca non cancella ciò che le
            piattaforme hanno già ricevuto: per quello valgono le loro
            impostazioni.
          </p>
        </Section>

        <Section title="6. Disabilitazione dai browser">
          Puoi anche bloccare o cancellare i cookie dalle impostazioni del
          browser (Chrome, Safari, Firefox, Edge). Se blocchi la memoria del
          sito non possiamo ricordare la tua scelta, e per prudenza non
          carichiamo cookie di statistica né di marketing. Bloccare i cookie
          necessari può compromettere il funzionamento del sito.
        </Section>

        <Section title="7. Titolare e contatti">
          Titolare: <strong>HAIR GENIUS LABS SRLS</strong>. P.IVA 18486531009.
          Email:{" "}
          <a className="text-brand" href="mailto:hairgeniuslabs@gmail.com">
            hairgeniuslabs@gmail.com
          </a>
          .
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}
