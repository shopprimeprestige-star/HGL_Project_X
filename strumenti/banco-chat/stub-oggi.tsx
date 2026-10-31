/** Al posto di CRMContext e AuthContext nel banco «Oggi»: consulenti, lead e accesso finti (nessun cliente vero). */
import { oggiIso } from "../../src/crm/ui";

const come = new URLSearchParams(location.search).get("come") ?? "consulente";
const oggi = oggiIso(new Date());
const consultants = [
  { id: "m", data: { nome: "Mirko", faConsulente: true, ...(new URLSearchParams(location.search).get("senza") ? { invitoMeet: "senza" } : {}) } },
  { id: "f", data: { nome: "Filippo", faConsulente: true } },
  { id: "s", data: { nome: "Sara", faConsulente: true } },
];
const lead = (id: string, nome: string, consulenteId: string, ora: string, stato = "appuntamento_fissato") => ({
  id,
  data: { nome, cognome: "Prova", telefono: `+39320000${id.padStart(4, "0")}`, stato, dataMeeting: oggi, oraMeeting: ora, consulenteId },
});
const leads = [
  lead("1", "Anna", "m", "10:30"),
  lead("2", "Bruno", "f", "11:00"),
  lead("3", "Carla", "m", "16:00"),
  lead("4", "Dario", "s", "17:30"),
];
const valore = { leads, consultants, loading: false, updateLead: async (id: string, patch: unknown) =>
    (window as unknown as { __updateLead?: (i: string, p: unknown) => Promise<boolean> }).__updateLead?.(id, patch) ?? true, createLead: async () => null, adSpending: [] };
export const useCRM = () => valore as never;

const consulente = come === "titolare" ? null : { id: "m", nome: "Mirko", iniziali: "M", token: "t" };
const accesso = { ruolo: come === "consulente" ? "consulente" : "admin", puo: () => true };
const auth = { user: { id: "u", email: "prova@example.com" }, consulente, accesso };
export const useAuth = () => auth as never;
export const usePuo = () => accesso.puo;
export const useConsulenteCollegato = () => consulente as never;
export const intestazioniCRM = async () => ({});
export const fetchCRM = async () => new Response("{}", { status: 404 });
export function Link({ children, className, title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return (
    <a className={className} title={title}>
      {children}
    </a>
  );
}
export const useNavigate = () => () => {};
export const useLocation = () => ({ pathname: "/CRM/chat", search: "", hash: "" });
export const useRouter = () => ({ navigate: () => {}, invalidate: () => {} });
export const useRouterState = () => ({ location: { pathname: "/CRM/chat" } });
export const useSearch = () => ({});
