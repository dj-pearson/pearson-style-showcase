-- Rollback for 20261117000101_replace_invoice_items_rpc.sql
-- The invoice form falls back to a checked DELETE + INSERT when the function
-- is missing (PGRST202), so dropping it does not break saving.

DROP FUNCTION IF EXISTS public.replace_invoice_items(UUID, JSONB);
