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
