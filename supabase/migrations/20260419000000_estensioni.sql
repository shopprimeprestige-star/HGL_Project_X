-- Estensioni per i lavori periodici (cron) e le chiamate HTTP dal database
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

