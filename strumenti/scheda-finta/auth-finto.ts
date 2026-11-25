/** Al posto di `@/crm/AuthContext` SOLO nella scheda finta (alias di `avvia.mjs`): nessun accesso, nessun gettone. Il finto non ha utenti:
 *  la guardia del server risponde sempre «sì». Esporta solo ciò che la pagina importa (`fetchCRM`). */
export const fetchCRM = (url: string, init?: RequestInit): Promise<Response> => fetch(url, init);
