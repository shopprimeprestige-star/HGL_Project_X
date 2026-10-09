import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Hair Genius Labs" },
      {
        name: "description",
        content:
          "Informativa sulla protezione dei dati personali ai sensi del GDPR (Reg. UE 2016/679) per gli utenti di Hair Genius Labs SRLS.",
      },
    ],
  }),
});

function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}
        </p>

        <Section title="1. Titolare del trattamento">
          Il titolare del trattamento dei dati è{" "}
          <strong>HAIR GENIUS LABS SRLS</strong>, con sede legale in Via degli
          Scipioni 132, 00192 Roma (RM), Italia. P.IVA 18486531009. Email:{" "}
          <a className="text-brand" href="mailto:hairgeniuslabs@gmail.com">
            hairgeniuslabs@gmail.com
          </a>
          . Telefono: +39 379 311 3802.
        </Section>

        <Section title="2. Tipologie di dati raccolti">
          Raccogliamo dati di contatto (nome, email, telefono) forniti
          volontariamente al momento della prenotazione di un'analisi tecnica
          gratuita; dati di navigazione (IP, user agent, pagine visitate) per
          finalità statistiche e di sicurezza; dati relativi alle preferenze
          cookie. Eventuali dati relativi alla salute (fototipo, stato del
          cuoio capelluto) sono trattati solo previo consenso esplicito ai
          sensi dell'art. 9 GDPR.
        </Section>

        <Section title="3. Finalità e basi giuridiche">
          I dati sono trattati per: (a) gestione della prenotazione e
          dell'analisi tecnica — esecuzione del contratto/misure
          precontrattuali; (b) adempimenti fiscali e contabili — obbligo di
          legge; (c) invio di comunicazioni commerciali — consenso
          dell'interessato; (d) miglioramento del servizio e analytics —
          legittimo interesse o consenso.
        </Section>

        <Section title="4. Conservazione dei dati">
          I dati di contatto sono conservati per il tempo strettamente
          necessario alle finalità indicate e comunque non oltre 24 mesi dal
          termine del rapporto, salvo obblighi di legge (es. fatturazione: 10
          anni).
        </Section>

        <Section title="5. Comunicazione e trasferimento">
          I dati possono essere comunicati a fornitori di servizi tecnici
          (hosting, email, calendario, analytics) nominati Responsabili del
          trattamento ex art. 28 GDPR. Eventuali trasferimenti extra-UE
          avvengono sulla base di Clausole Contrattuali Standard approvate
          dalla Commissione Europea.
        </Section>

        <Section title="6. Diritti dell'interessato">
          L'interessato può esercitare in qualsiasi momento i diritti previsti
          dagli artt. 15-22 GDPR (accesso, rettifica, cancellazione,
          limitazione, portabilità, opposizione, revoca del consenso)
          scrivendo a{" "}
          <a className="text-brand" href="mailto:hairgeniuslabs@gmail.com">
            hairgeniuslabs@gmail.com
          </a>
          . È inoltre possibile presentare reclamo al Garante per la
          protezione dei dati personali (www.garanteprivacy.it).
        </Section>

        <Section title="7. Sicurezza">
          Adottiamo misure tecniche e organizzative adeguate per proteggere i
          dati da accessi non autorizzati, perdita o distruzione, in conformità
          all'art. 32 GDPR.
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
