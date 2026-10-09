import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/cookie-policy")({
  component: CookiePolicyPage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — Hair Genius Labs" },
      {
        name: "description",
        content:
          "Informativa sull'uso dei cookie e tecnologie simili in conformità al GDPR e alla normativa italiana (Provv. Garante 10/06/2021).",
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
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}
        </p>

        <Section title="1. Cosa sono i cookie">
          I cookie sono piccoli file di testo memorizzati sul dispositivo
          dell'utente che consentono il corretto funzionamento del sito e la
          raccolta di informazioni statistiche o di profilazione.
        </Section>

        <Section title="2. Cookie utilizzati">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Tecnici (necessari)</strong>: garantiscono la
              navigazione, la memorizzazione delle preferenze cookie e la
              sicurezza. Non richiedono consenso.
            </li>
            <li>
              <strong>Analitici anonimizzati</strong>: misurano
              aggregatamente l'uso del sito per migliorarne le prestazioni.
            </li>
            <li>
              <strong>Marketing (previo consenso)</strong>: utilizzati per
              mostrare contenuti personalizzati e misurare campagne.
            </li>
          </ul>
        </Section>

        <Section title="3. Gestione del consenso">
          Al primo accesso viene mostrato un banner che consente di accettare
          o rifiutare i cookie non necessari. È possibile modificare in
          qualsiasi momento le preferenze cancellando i cookie dal browser.
        </Section>

        <Section title="4. Disabilitazione dei cookie">
          L'utente può disabilitare i cookie direttamente dalle impostazioni
          del proprio browser (Chrome, Safari, Firefox, Edge). La
          disabilitazione dei cookie tecnici può compromettere il
          funzionamento del sito.
        </Section>

        <Section title="5. Titolare e contatti">
          Titolare: <strong>HAIR GENIUS LABS SRLS</strong> — Via degli
          Scipioni 132, 00192 Roma (RM). P.IVA 18486531009. Email:{" "}
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
