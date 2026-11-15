/**
 * Invoice write helpers.
 *
 * Two database triggers own the money columns on `invoices`
 * (supabase/migrations/20251113201636_*.sql):
 *
 *   update_invoice_totals       on invoice_items: recomputes subtotal,
 *                               tax_amount, discount_amount, total_amount and
 *                               amount_due = total_amount - amount_paid.
 *   update_invoice_amount_paid  on payment_allocations: sets amount_paid to
 *                               the sum of allocations, amount_due to the
 *                               rest, and status to paid / partially_paid.
 *
 * So the invoice form must never write amount_paid on edit (that wiped
 * recorded payments). On create, a "paid" invoice gets amount_paid = total,
 * which is what a full allocation would leave behind.
 */
import { fromCents, toCents } from './money';

export interface InvoiceFormValues {
  invoice_type: 'sales' | 'purchase';
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  contact_id: string;
  status: string;
  notes: string;
}

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  expense_category_id?: string;
}

export interface InvoiceItemRow {
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  metadata: { expense_category_id: string } | null;
}

/** Lines worth saving: a description and a positive total. */
export function validInvoiceLines(lines: InvoiceLineInput[]): InvoiceLineInput[] {
  return lines.filter((l) => l.description.trim() && toCents(l.line_total) > 0);
}

/** Subtotal of the lines that will be saved, in cents. */
export function invoiceSubtotalCents(lines: InvoiceLineInput[]): number {
  return validInvoiceLines(lines).reduce((sum, l) => sum + toCents(l.line_total), 0);
}

/**
 * Item rows for invoice_items. invoice_items has no expense_category_id
 * column, so the category goes in metadata.
 */
export function toInvoiceItemRows(lines: InvoiceLineInput[]): InvoiceItemRow[] {
  return validInvoiceLines(lines).map((l, i) => {
    const category =
      l.expense_category_id && l.expense_category_id !== 'none' ? l.expense_category_id : null;
    return {
      line_number: i + 1,
      description: l.description.trim(),
      quantity: Number(l.quantity) || 1,
      unit_price: fromCents(toCents(l.unit_price)),
      line_total: fromCents(toCents(l.line_total)),
      metadata: category ? { expense_category_id: category } : null,
    };
  });
}

/** Read the category back out of an invoice_items row. */
export function expenseCategoryOf(item: { metadata?: unknown }): string | undefined {
  const meta = item.metadata;
  if (meta && typeof meta === 'object' && 'expense_category_id' in meta) {
    const id = (meta as { expense_category_id?: unknown }).expense_category_id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

interface ExistingInvoice {
  import_source: string | null;
  amount_paid: number | null;
}

/**
 * The invoices row to insert (existing = null) or update. Never includes
 * amount_paid on update.
 */
export function buildInvoiceWrite(
  form: InvoiceFormValues,
  subtotalCents: number,
  existing: ExistingInvoice | null
): Record<string, unknown> {
  const total = fromCents(subtotalCents);
  const base = {
    invoice_type: form.invoice_type,
    invoice_number: form.invoice_number.trim(),
    invoice_date: form.invoice_date,
    due_date: form.due_date || null,
    contact_id: form.contact_id && form.contact_id !== 'none' ? form.contact_id : null,
    subtotal: total,
    total_amount: total,
    status: form.status,
    notes: form.notes || null,
  };

  if (existing) {
    // amount_due follows the payments already recorded. The items trigger
    // recomputes it from the stored amount_paid anyway once items change.
    const paidCents = toCents(existing.amount_paid);
    return {
      ...base,
      amount_due: fromCents(subtotalCents - paidCents),
      import_source: existing.import_source,
    };
  }

  const paidCents = form.status === 'paid' ? subtotalCents : 0;
  return {
    ...base,
    amount_paid: fromCents(paidCents),
    amount_due: fromCents(subtotalCents - paidCents),
    import_source: 'manual',
  };
}

interface PostgrestLikeError {
  message: string;
  code?: string;
}

export interface InvoiceItemsClient {
  rpc(
    fn: 'replace_invoice_items',
    args: { p_invoice_id: string; p_items: InvoiceItemRow[] }
  ): PromiseLike<{ error: PostgrestLikeError | null }>;
  from(table: 'invoice_items'): {
    delete(): {
      eq(col: 'invoice_id', v: string): PromiseLike<{ error: PostgrestLikeError | null }>;
    };
    insert(
      rows: Array<InvoiceItemRow & { invoice_id: string }>
    ): PromiseLike<{ error: PostgrestLikeError | null }>;
  };
}

/** PostgREST: function not in the schema cache (migration not applied). */
const FUNCTION_NOT_FOUND = 'PGRST202';

/**
 * Replace an invoice's line items in one transaction via the
 * replace_invoice_items RPC. If that migration has not been applied yet,
 * falls back to delete + insert, checking both errors so a failure is
 * reported instead of leaving the invoice silently empty.
 */
export async function replaceInvoiceItems(
  client: InvoiceItemsClient,
  invoiceId: string,
  rows: InvoiceItemRow[]
): Promise<void> {
  const { error: rpcError } = await client.rpc('replace_invoice_items', {
    p_invoice_id: invoiceId,
    p_items: rows,
  });
  if (!rpcError) return;
  if (rpcError.code !== FUNCTION_NOT_FOUND) throw rpcError;

  const { error: deleteError } = await client
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId);
  if (deleteError) throw deleteError;

  if (rows.length === 0) return;
  const { error: insertError } = await client
    .from('invoice_items')
    .insert(rows.map((r) => ({ ...r, invoice_id: invoiceId })));
  if (insertError) {
    throw new Error(
      `Old line items were removed but the new ones failed to save: ${insertError.message}`
    );
  }
}
