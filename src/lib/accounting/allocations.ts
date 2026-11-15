/**
 * Payment-to-invoice allocation checks, all in integer cents.
 *
 * A payment can be allocated in several sittings, so what's left to allocate
 * is the payment amount minus allocations already stored, not the payment
 * amount. Each invoice can take at most its amount_due.
 */
import { formatCurrency } from './calculations';
import { fromCents, toCents, type MoneyInput } from './money';

export interface AllocationRowInput {
  invoice_id: string;
  amount: string;
}

export interface AllocatableInvoice {
  id: string;
  invoice_number: string;
  amount_due: MoneyInput;
}

export type AllocationResult =
  | { ok: true; allocations: Array<{ invoice_id: string; amount_allocated: number }> }
  | { ok: false; error: string };

/** Cents still free on a payment after the allocations already saved. */
export function unallocatedCents(paymentAmount: MoneyInput, existing: MoneyInput[]): number {
  const used = existing.reduce<number>((sum, a) => sum + toCents(a), 0);
  return toCents(paymentAmount) - used;
}

/**
 * Clamp a typed amount to what the invoice can take and what the payment has
 * left. Returns the amount as a 2-decimal string, or the input unchanged when
 * it isn't a positive number.
 */
export function clampAllocationAmount(
  amount: string,
  invoiceDue: MoneyInput,
  remainingCents: number
): string {
  const cents = toCents(amount);
  if (!amount.trim() || cents <= 0) return amount;
  const capped = Math.max(0, Math.min(cents, toCents(invoiceDue), remainingCents));
  return fromCents(capped).toFixed(2);
}

export function validateAllocations(args: {
  paymentAmount: MoneyInput;
  existingAllocations: MoneyInput[];
  rows: AllocationRowInput[];
  invoices: AllocatableInvoice[];
}): AllocationResult {
  const { paymentAmount, existingAllocations, rows, invoices } = args;
  const filled = rows.filter((r) => r.invoice_id && toCents(r.amount) > 0);
  if (filled.length === 0) {
    return { ok: false, error: 'Select at least one invoice and enter an amount.' };
  }

  // Two rows for the same invoice are one allocation.
  const perInvoice = new Map<string, number>();
  for (const r of filled) {
    perInvoice.set(r.invoice_id, (perInvoice.get(r.invoice_id) ?? 0) + toCents(r.amount));
  }

  const byId = new Map(invoices.map((i) => [i.id, i]));
  for (const [invoiceId, cents] of perInvoice) {
    const invoice = byId.get(invoiceId);
    if (!invoice) {
      return { ok: false, error: 'An invoice in the list is no longer unpaid. Reopen the dialog.' };
    }
    const dueCents = toCents(invoice.amount_due);
    if (cents > dueCents) {
      return {
        ok: false,
        error: `${invoice.invoice_number} has only ${formatCurrency(fromCents(dueCents))} due.`,
      };
    }
  }

  const remaining = unallocatedCents(paymentAmount, existingAllocations);
  const total = [...perInvoice.values()].reduce((a, b) => a + b, 0);
  if (total > remaining) {
    return {
      ok: false,
      error: `Only ${formatCurrency(fromCents(Math.max(0, remaining)))} of this payment is unallocated.`,
    };
  }

  return {
    ok: true,
    allocations: [...perInvoice].map(([invoice_id, cents]) => ({
      invoice_id,
      amount_allocated: fromCents(cents),
    })),
  };
}
