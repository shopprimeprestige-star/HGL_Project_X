-- ════════════════════════════════════════════════════════════════════════
--  TUTTI I COLLABORATORI GIÀ ESISTENTI RIPARTONO DA «VEDE TUTTO»
--
--  Supabase → SQL Editor → incolla → Run. Si può rilanciare.
--
--  Il codice dà già «vede tutto» a chi non ha un livello scritto (persone
--  nuove, PIN appena assegnati: vedi RUOLO_DI_PARTENZA in src/crm/permessi.ts).
--  Questo file serve per chi un livello ce l'ha GIÀ (setter, consulente…):
--  lo porta ad ADMIN e toglie le restrizioni vecchie, così la base è uguale
--  per tutti. Poi si restringe da Collaboratori → la persona → «Che cosa può
--  fare».
--  Dopo, ognuno esce e rientra col PIN (o ricarica la pagina).
-- ════════════════════════════════════════════════════════════════════════
update public.consultant_pins
set permissions = (coalesce(permissions, '{}'::jsonb)
                    - 'extra' - 'daMestieri'
                    - 'canDeleteLead' - 'canAddLead' - 'canChangePayment')
                  || '{"ruolo": "admin"}'::jsonb;

-- Controllo: tutti devono risultare admin.
select c.data->>'nome' as nome, p.permissions->>'ruolo' as ruolo, p.active as attivo
from public.consultant_pins p
join public.crm_consultants c on c.id = p.consultant_id
order by 1;
