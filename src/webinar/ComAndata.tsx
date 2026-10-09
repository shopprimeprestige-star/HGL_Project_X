import { useEffect, useState } from "react";
import { Loader2, TrendingDown, Users, Clock, MessageCircle } from "lucide-react";
import { misuraDiretta, type MisuraDiretta } from "./misura-diretta";

/** ── COM'È ANDATA UNA DIRETTA ──────────────────────────────────────────────
 *
 *  ⚠️ QUATTRO NUMERI E UNA CURVA, non un cruscotto. Un pannello con venti
 *   riquadri si guarda una volta e poi mai più, perché non dice cosa fare.
 *   Questi quattro rispondono alle uniche domande che cambiano qualcosa:
 *   quanta gente è venuta, quanto è rimasta, dove l'hai persa, quanti hanno
 *   fatto il passo finale.
 *
 *  ⚠️ LA CURVA È IL PEZZO CHE VALE, e va guardata prima dei numeri: i numeri
 *   dicono com'è andata, la curva dice DOVE. Il minuto in cui scende di colpo
 *   è il minuto da riascoltare.
 */
export function ComAndata({ codice }: { codice: string }) {
  const [misura, setMisura] = useState<MisuraDiretta | null>(null);
  const [carico, setCarico] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/crm/webinar?azione=misura&codice=${encodeURIComponent(codice)}`);
        const j = await r.json();
        if (!vivo) return;
        if (!j?.ok) { setErrore("Non riesco a leggere i dati di questa sala."); return; }
        const inizio = Date.parse(String(j.inizio || ""));
        setMisura(misuraDiretta({
          presenze: j.presenze ?? [],
          //  ⚠️ Senza un inizio vero si prende la prima entrata: una sala mai
          //   andata in onda non deve dare una schermata vuota senza spiegare
          //   perché.
          inizio: Number.isFinite(inizio)
            ? inizio
            : Math.min(...((j.presenze ?? []).map((p: { entrata: number }) => p.entrata) as number[])),
          conversioni: j.conversioni ?? 0,
        }));
      } catch { if (vivo) setErrore("Non riesco a leggere i dati di questa sala."); }
      finally { if (vivo) setCarico(false); }
    })();
    return () => { vivo = false; };
  }, [codice]);

  if (carico) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Sto contando…
      </div>
    );
  }
  if (errore) return <p className="px-4 py-6 text-[13px] text-muted-foreground">{errore}</p>;
  if (!misura || !misura.entrati) {
    //  ⚠️ «Non è ancora entrato nessuno» e non un pannello di zeri: uno zero
    //   accanto a un altro zero sembra un guasto, e fa perdere tempo a
    //   cercarlo.
    return (
      <p className="px-4 py-6 text-[13px] text-muted-foreground">
        Di questa sala non c'è ancora niente da misurare: nessuno è entrato.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Numero icona={Users} testo="Entrati" valore={String(misura.entrati)}
          nota={`${misura.picco} insieme al minuto ${misura.minutoDelPicco}`} />
        <Numero icona={Clock} testo="Rimasti in media" valore={`${misura.permanenzaMedia} min`}
          /*  ⚠️ La mediana accanto alla media, sempre: quando le due si
              allontanano vuol dire che il pubblico si spacca in due — chi resta
              fino in fondo e chi se ne va subito — ed è una cosa che la sola
              media nasconde. */
          nota={`metà oltre ${misura.permanenzaMediana} min`} />
        <Numero icona={TrendingDown} testo="Se ne vanno al"
          valore={misura.peggiorMinuto ? `min ${misura.peggiorMinuto.minuto}` : "—"}
          nota={misura.peggiorMinuto ? `${misura.peggiorMinuto.persi} in un minuto` : "nessun crollo"} />
        <Numero icona={MessageCircle} testo="Hanno scritto su WhatsApp"
          valore={String(misura.conversioni)} nota={`${misura.tassoConversione}% di chi è entrato`} />
      </div>

      <Curva misura={misura} />
    </div>
  );
}

function Numero({
  icona: Icona, testo, valore, nota,
}: { icona: typeof Users; testo: string; valore: string; nota: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icona className="h-3.5 w-3.5" />{testo}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valore}</p>
      <p className="text-[11px] text-muted-foreground">{nota}</p>
    </div>
  );
}

/** ── LA CURVA ──────────────────────────────────────────────────────────────
 *  ⚠️ Disegnata a barre e non a linea: una linea invita a leggere la pendenza,
 *   e la pendenza fra due minuti non vuol dire niente su numeri piccoli. Le
 *   barre si contano.
 *  ⚠️ E il minuto peggiore è ROSSO. Senza, per trovarlo bisogna confrontare
 *   sessanta barre a occhio — ed è l'unica cosa per cui questa schermata
 *   esiste. */
function Curva({ misura }: { misura: MisuraDiretta }) {
  const max = Math.max(1, misura.picco);
  //  Su una diretta lunga le barre diventerebbero un pettine illeggibile: si
  //  tiene un punto ogni pochi minuti, senza mai perdere il minuto peggiore.
  const passo = Math.max(1, Math.ceil(misura.curva.length / 60));
  const punti = misura.curva.filter(
    (p, i) => i % passo === 0 || p.minuto === misura.peggiorMinuto?.minuto,
  );
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Quante persone c'erano, minuto per minuto
      </p>
      <div className="mt-3 flex h-28 items-end gap-px">
        {punti.map((p) => (
          <div
            key={p.minuto}
            title={`Minuto ${p.minuto}: ${p.presenti} in sala`}
            style={{ height: `${Math.max(2, (p.presenti / max) * 100)}%` }}
            className={`min-w-[2px] flex-1 rounded-t ${
              p.minuto === misura.peggiorMinuto?.minuto ? "bg-rose-500" : "bg-primary/60"
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>minuto 0</span>
        <span>minuto {misura.curva[misura.curva.length - 1]?.minuto ?? 0}</span>
      </div>
      {misura.peggiorMinuto && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Al <b className="text-foreground">minuto {misura.peggiorMinuto.minuto}</b> se ne sono
          andate {misura.peggiorMinuto.persi} persone in sessanta secondi: è il pezzo da
          riascoltare.
        </p>
      )}
    </div>
  );
}
