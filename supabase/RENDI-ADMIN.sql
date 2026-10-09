-- Da solo: dà a tutti gli account registrati tutto il menu del gestionale.
-- Supabase → SQL Editor → incolla → Run. Si può rilanciare quante volte vuoi.
-- ── 4. AMMINISTRATORI: TUTTO IL MENU A CHI È GIÀ REGISTRATO ─────────────
--  Fallo girare dopo esserti registrato nel gestionale (rilanciare questa
--  parte da sola va bene). Ogni account già presente diventa amministratore
--  con tutte le schede: sul database nuovo c'è solo il titolare.
insert into public.user_settings (user_id, is_admin, scheme_access, display_name, can_accept_leads)
select u.id, true,
       array['dashboard','nuovi','leads','pipeline','sede','installazioni','installazioni_oggi',
             'consulenti','kpi','performance','ads','agenda','impostazioni'],
       u.email, true
from auth.users u
on conflict (user_id) do update
  set is_admin = true,
      scheme_access = excluded.scheme_access,
      can_accept_leads = true;
