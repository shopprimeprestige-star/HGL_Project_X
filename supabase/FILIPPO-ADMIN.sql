-- ════════════════════════════════════════════════════════════════════════
--  FILIPPO CONA, ADMIN UFFICIALE DEL PROGETTO
--
--  Supabase → SQL Editor → incolla → Run. Si può rilanciare.
--
--  Il livello di chi entra col PIN sta in consultant_pins.permissions
--  (vedi src/crm/permessi.ts, risolviAccesso): con "ruolo":"admin" la persona
--  ha TUTTI i permessi, mestieri compresi — quindi anche il gruppo Numeri e
--  le Impostazioni. Si tolgono anche le deroghe ("extra"): una deroga a false
--  spegnerebbe un permesso persino a un admin.
--
--  ⚠️ Serve che Filippo abbia già un PIN (Collaboratori → Filippo Cona →
--   PIN). Sul database nuovo i PIN non arrivano con la copia dei dati: prima
--   si carica la copia, poi si crea il PIN, poi si lancia questo.
--  Dopo, Filippo esce e rientra col PIN (o ricarica la pagina).
-- ════════════════════════════════════════════════════════════════════════
update public.consultant_pins p
set permissions = (coalesce(p.permissions, '{}'::jsonb) - 'extra') || '{"ruolo": "admin"}'::jsonb
from public.crm_consultants c
where c.id = p.consultant_id
  and lower(trim(c.data->>'nome')) = 'filippo cona';

-- Controllo: deve comparire una riga con ruolo = admin.
select c.data->>'nome' as nome, p.permissions->>'ruolo' as ruolo
from public.consultant_pins p
join public.crm_consultants c on c.id = p.consultant_id
where lower(trim(c.data->>'nome')) = 'filippo cona';
