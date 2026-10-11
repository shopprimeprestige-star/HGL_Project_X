import { useState } from "react";
import { Plus, Minus } from "lucide-react";

type FaqItem = {
  q: string;
  a: React.ReactNode;
};

const H = ({ children }: { children: React.ReactNode }) => (
  <span className="text-brand font-semibold">{children}</span>
);

const FAQS: FaqItem[] = [
  {
    q: "E se qualcuno mi tocca i capelli?",
    a: (
      <>
        La <H>Forza Reticolata HD</H> garantisce un'aderenza perimetrale
        continua: la membrana resta perfettamente ancorata anche sotto
        pressione, carezza o trazione laterale. Al tatto la superficie risulta
        morbida e cedevole come la cute, perché la struttura bio-osmotica
        replica la flessibilità del tessuto cutaneo. Nessuno scalino percepibile,
        nessun bordo rigido: chi ti tocca i capelli sente{" "}
        <H>solo capelli e pelle</H>.
      </>
    ),
  },
  {
    q: "Si accorgeranno che è un impianto?",
    a: (
      <>
        No. La sfumatura <H>Zero-Edge</H> elimina la linea di confine tipica
        delle patch, e il trattamento <H>Derm-Sync</H> azzera i riflessi
        sintetici anche sotto la luce solare diretta o l'illuminazione zenitale
        di un bar. L'attaccatura è ingegnerizzata per restare invisibile{" "}
        <H>a distanza di contatto</H> — il punto di osservazione più crudele,
        quello a cui ti guarda davvero una persona.
      </>
    ),
  },
  {
    q: "Capelli «effetto paglia»?",
    a: (
      <>
        A differenza delle protesi industriali che utilizzano capelli di scarto
        trattati con acidi corrosivi, il nostro protocollo prevede una{" "}
        <H>Selezione Biologica Manuale</H>. Utilizziamo esclusivamente capelli
        con cuticola integra e orientamento fisiologico. Ogni stelo viene
        sigillato con un trattamento proteico che trattiene l'idratazione
        all'interno, mantenendo il movimento fluido e la morbidezza identica a
        un capello naturale in crescita, anche dopo mesi di utilizzo.
      </>
    ),
  },
  {
    q: "Si vede sotto il sole?",
    a: (
      <>
        Il timore del «riflesso lucido» è risolto dalla tecnologia{" "}
        <H>Derm-Sync</H>. La nostra membrana bio-osmotica subisce un processo di
        opacizzazione molecolare che le permette di assorbire la luce zenitale
        esattamente come la pelle umana. Questo elimina l'effetto «plastica» o
        lo scalino visibile. Anche a distanza di contatto e sotto l'esposizione
        solare diretta, l'attaccatura risulta fusa con la tua cute.
      </>
    ),
  },
  {
    q: "Differenza vs membrana comune?",
    a: (
      <>
        Le membrane delle patch comuni (0.03mm) sono fragili e si lacerano facilmente. La
        nostra <H>Membrana Bio-osmotica a Reticolazione Molecolare</H> crea
        legami chimici a rete tra le catene polimeriche: il risultato è una
        struttura invisibile ma con una{" "}
        <H>resistenza alla trazione 5 volte superiore</H>. Inoltre, la sua
        natura bio-osmotica permette la traspirazione cutanea, evitando il
        ristagno di calore e sudore tipico dei sistemi economici.
      </>
    ),
  },
  {
    q: "Manutenzione: quanto tempo?",
    a: (
      <>
        Il sistema è progettato per darti la totale indipendenza. Dopo il primo
        setup tecnico in laboratorio (circa 120 minuti), la gestione periodica è
        estremamente semplificata. Grazie alla superficie ultra-liscia della
        membrana che non trattiene residui,{" "}
        <H>puoi effettuare la manutenzione in autonomia in meno di 15-20 minuti</H>
        . Una procedura rapida e pulita da eseguire circa una volta al mese,
        ideale per chi vive una vita dinamica e non vuole essere vincolato a
        continue visite in laboratorio.
      </>
    ),
  },
  {
    q: "Irritazioni o cattivi odori?",
    a: (
      <>
        Assolutamente no. Le irritazioni derivano spesso da membrane non
        traspiranti e residui di collanti di bassa qualità. Il Bio-Mimetic™
        utilizza materiali bio-compatibili e{" "}
        <H>adesivi medici ipoallergenici certificati</H>. La capacità osmotica
        della membrana permette alla pelle di «respirare» e mantenere il pH
        equilibrato, eliminando alla radice il rischio di dermatiti e cattivi
        odori.
      </>
    ),
  },
  {
    q: "Sport, nuoto, casco?",
    a: (
      <>
        È esattamente per questo che è stato progettato. La{" "}
        <H>Forza Reticolata HD</H> garantisce una tenuta meccanica superiore.
        Che tu faccia crossfit, immersioni o indossi un casco da moto per ore,
        l'impianto rimane stabile. La membrana non subisce micro-lacerazioni da
        trazione, permettendoti di vivere ogni attività senza la preoccupazione
        che il sistema si danneggi o si sposti.
      </>
    ),
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number>(-1);

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`bg-white rounded-sm border shadow-sm transition-colors ${
              isOpen ? "border-brand/60" : "border-ink/10"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="flex items-center gap-4">
                <span
                  className={`flex items-center justify-center w-7 h-7 text-[0.7rem] font-bold rounded-sm shrink-0 ${
                    isOpen
                      ? "bg-brand text-brand-foreground"
                      : "bg-brand/10 text-brand"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-semibold text-ink">{item.q}</span>
              </span>
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-sm border transition-colors shrink-0 ${
                  isOpen
                    ? "border-brand text-brand bg-brand/10"
                    : "border-brand/40 text-brand"
                }`}
              >
                {isOpen ? (
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pl-16 text-sm text-ink-muted leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
