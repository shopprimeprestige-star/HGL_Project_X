/** Al posto di `CRMContext` e `AuthContext` nel banco: schede dal generatore, nessuna rete. */
import { D } from "./supabase-finto";

const user = { id: D.utente };
const consultants = [
  { id: "c1", data: { nome: "Anna" } },
  { id: "c2", data: { nome: "Bruno" } },
];
const valore = {
  leads: D.leads,
  consultants,
  loading: false,
  updateLead: async () => true,
  createLead: async () => null,
  adSpending: [],
};
export const useCRM = () => valore as never;
export const useAuth = () => ({ user }) as never;
export const usePuo = () => () => true;
export const useConsulenteCollegato = () => null;
export const intestazioniCRM = async () => ({});
export const fetchCRM = async () => new Response("{}", { status: 404 });
