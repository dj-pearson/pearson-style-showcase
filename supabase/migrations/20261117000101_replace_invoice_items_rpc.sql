-- Replace an invoice's line items in one transaction.
--
-- The invoice form saved items as DELETE then INSERT from the browser. When
-- the INSERT failed (bad row, dropped connection) the DELETE had already
-- committed, the update_invoice_totals trigger zeroed total_amount, and the
-- invoice was left with no items. Doing both inside one function makes the
-- pair atomic: either the new items replace the old ones or nothing changes.
--
-- SECURITY INVOKER: the caller's RLS still applies, so this needs exactly
-- the admin + aal2 access the direct table writes needed
-- (20260309000001, 20261115000001). No privilege is added.
--
-- p_items is a JSON array of
--   {line_number, description, quantity, unit_price, line_total, metadata}
-- The totals trigger on invoice_items recomputes subtotal / total_amount /
-- amount_due as rows go in; amount_paid is never touched here.

CREATE OR REPLACE FUNCTION public.replace_invoice_items(
  p_invoice_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent saves of the same invoice.
  PERFORM 1 FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice % not found', p_invoice_id USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id, line_number, description, quantity, unit_price, line_total, metadata
  )
  SELECT
    p_invoice_id,
    x.line_number,
    x.description,
    COALESCE(x.quantity, 1),
    x.unit_price,
    x.line_total,
    x.metadata
  FROM jsonb_to_recordset(p_items) AS x(
    line_number INTEGER,
    description TEXT,
    quantity NUMERIC,
    unit_price NUMERIC,
    line_total NUMERIC,
    metadata JSONB
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_invoice_items(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_invoice_items(UUID, JSONB) TO authenticated;
