/** Piccoli formattatori condivisi da elenco, conversazione e bolle (T6: spostati
 *  dalla pagina così come erano). */

export function initials(nome: string, cognome: string): string {
  const a = (nome || "").trim()[0] || "?";
  const b = (cognome || "").trim()[0] || "";
  return (a + b).toUpperCase();
}

export function formatTimeIT(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Ieri";
  }
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

export function previewText(body: string | null): string {
  if (!body) return "";
  return body.length > 60 ? body.slice(0, 60) + "…" : body;
}

/** Il numero come si legge: «+39 333 000 1234». Per i cellulari italiani 3-3-4 (o 3-3-3 se di 9
 *  cifre); per gli altri «+prefisso» e gruppi da 3. Se non è un numero riconoscibile lo ridà com'è.
 *  shortcut: il prefisso estero è preso di 2 cifre, i fissi italiani a coppie; basta per leggere,
 *  non per validare, passare a libphonenumber se serve un formato per paese. */
export function numeroLeggibile(t: string | null | undefined): string {
  const grezzo = String(t ?? "").trim();
  const cifre = grezzo.replace(/\D/g, "");
  if (cifre.length < 8) return grezzo;
  //  Gruppi da `n`; l'ultimo è di 4 cifre al massimo (come 3-3-4 dei cellulari).
  const gruppi = (s: string, n: number) => {
    const parti: string[] = [];
    for (let resto = s; resto; ) {
      const presi = resto.length > 4 ? n : resto.length;
      parti.push(resto.slice(0, presi));
      resto = resto.slice(presi);
    }
    return parti.join(" ");
  };
  if (cifre.startsWith("39")) {
    const nazionale = cifre.slice(2);
    if (/^3\d{8,9}$/.test(nazionale))
      return `+39 ${nazionale.slice(0, 3)} ${nazionale.slice(3, 6)} ${nazionale.slice(6)}`;
    return `+39 ${nazionale.slice(0, 2)} ${gruppi(nazionale.slice(2), 4)}`;
  }
  return `+${cifre.slice(0, 2)} ${gruppi(cifre.slice(2), 3)}`;
}
