import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/termini-e-condizioni")({
  component: TerminiPage,
  head: () => ({
    meta: [
      { title: "Termini e Condizioni — Hair Genius Labs" },
      {
        name: "description",
        content:
          "Termini e condizioni di utilizzo dei servizi Hair Genius Labs SRLS — Bio-Mimetic™.",
      },
    ],
  }),
});

function TerminiPage() {
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
          Termini e Condizioni
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}
        </p>

        <Section title="1. Identificazione del Fornitore">
          I servizi sono erogati da <strong>HAIR GENIUS LABS SRLS</strong>,
          P.IVA 18486531009, con sede in Via degli Scipioni 132, 00192 Roma
          (RM). Email: hairgeniuslabs@gmail.com — Tel: +39 379 311 3802.
        </Section>

        <Section title="2. Oggetto del servizio">
          Il presente sito ha finalità informative e consente di prenotare
          un'<strong>analisi tecnica gratuita</strong> finalizzata alla
          valutazione dell'idoneità all'applicazione del{" "}
          <strong>Bio-Mimetic™</strong>, un impianto estetico non
          chirurgico di grado clinico. L'analisi non costituisce prestazione
          medica.
        </Section>

        <Section title="3. Prenotazione e disdetta">
          La prenotazione è confermata via email. È possibile annullare o
          riprogrammare l'appuntamento gratuitamente fino a 24 ore prima
          della data prevista. Mancate presentazioni ripetute possono
          comportare la non ammissione a future prenotazioni gratuite.
        </Section>

        <Section title="4. Prezzi e promozioni">
          L'analisi tecnica è offerta gratuitamente nei limiti dei posti
          disponibili indicati sul sito. Il prezzo di listino indicato (47€)
          si applica una volta esauriti gli slot promozionali del mese in
          corso. I prezzi dei prodotti e dei trattamenti vengono comunicati
          in sede di consulenza.
        </Section>

        <Section title="5. Limitazioni di responsabilità">
          I risultati estetici dipendono da fattori individuali. Hair Genius
          Labs SRLS non garantisce risultati identici per tutti gli utenti e
          non risponde di malfunzionamenti derivanti da un uso improprio
          dell'impianto o dal mancato rispetto delle istruzioni di
          manutenzione fornite.
        </Section>

        <Section title="6. Diritto di recesso">
          Per i servizi acquistati a distanza si applica il diritto di
          recesso ai sensi del D.Lgs. 206/2005 entro 14 giorni dalla
          conclusione del contratto, salvo che il servizio non sia già stato
          eseguito con consenso espresso del consumatore.
        </Section>

        <Section title="7. Legge applicabile e foro competente">
          I presenti termini sono regolati dalla legge italiana. Per ogni
          controversia è competente in via esclusiva il Foro di Roma, fatte
          salve le disposizioni inderogabili a tutela del consumatore.
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
