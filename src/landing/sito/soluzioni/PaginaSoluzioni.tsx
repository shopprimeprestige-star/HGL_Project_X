/** ── LA PAGINA /soluzioni · «TRE SOLUZIONI» ─────────────────────────────────
 *  Scheletro (S3.0): la composizione vera arriva in S3.3. Riceve solo la `VistaSoluzioni`
 *  già filtrata dal server, mai il contenuto grezzo del CRM. */
import type { VistaSoluzioni } from "./ponte";

export function PaginaSoluzioni({ vista: _vista, apriDalServer: _apriDalServer }: { vista: VistaSoluzioni; apriDalServer: boolean }) {
  return <main className="tema-soluzioni" lang="it" />;
}
