import { describe, it, expect, vi } from 'vitest';
import {
  buildInvoiceWrite,
  expenseCategoryOf,
  invoiceSubtotalCents,
  replaceInvoiceItems,
  toInvoiceItemRows,
  type InvoiceFormValues,
  type InvoiceItemsClient,
} from '../invoices';

const form: InvoiceFormValues = {
  invoice_type: 'sales',
  invoice_number: ' INV-7 ',
  invoice_date: '2026-03-01',
  due_date: '',
  contact_id: 'none',
  status: 'sent',
  notes: 'updated notes',
};

describe('buildInvoiceWrite', () => {
  it('never writes amount_paid when editing', () => {
    const row = buildInvoiceWrite({ ...form, status: 'paid' }, 200000, {
      import_source: 'manual',
      amount_paid: 2000,
    });
    expect(row).not.toHaveProperty('amount_paid');
    expect(row.total_amount).toBe(2000);
    expect(row.amount_due).toBe(0);
    expect(row.notes).toBe('updated notes');
  });

  it('keeps amount_due in line with payments already recorded', () => {
    const row = buildInvoiceWrite(form, 250000, { import_source: null, amount_paid: 2000 });
    expect(row.amount_due).toBe(500);
  });

  it('records a paid invoice as paid in full on create', () => {
    const row = buildInvoiceWrite({ ...form, status: 'paid' }, 10030, null);
    expect(row.amount_paid).toBe(100.3);
    expect(row.amount_due).toBe(0);
    expect(row.import_source).toBe('manual');
  });

  it('records nothing paid for other statuses on create', () => {
    const row = buildInvoiceWrite(form, 10030, null);
    expect(row.amount_paid).toBe(0);
    expect(row.amount_due).toBe(100.3);
    expect(row.invoice_number).toBe('INV-7');
    expect(row.contact_id).toBeNull();
    expect(row.due_date).toBeNull();
  });
});

describe('line items', () => {
  const lines = [
    { description: 'Design', quantity: 1, unit_price: 50.1, line_total: 50.1 },
    {
      description: 'Build',
      quantity: 1,
      unit_price: 50.2,
      line_total: 50.2,
      expense_category_id: 'cat-1',
    },
    { description: '', quantity: 1, unit_price: 0, line_total: 0 },
    { description: 'Ignored', quantity: 0, unit_price: 5, line_total: 0 },
  ];

  it('sums saved lines in cents', () => {
    expect(invoiceSubtotalCents(lines)).toBe(10030);
  });

  it('stores the category in metadata, not a missing column', () => {
    const rows = toInvoiceItemRows(lines);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      line_number: 1,
      description: 'Design',
      quantity: 1,
      unit_price: 50.1,
      line_total: 50.1,
      metadata: null,
    });
    expect(rows[1].metadata).toEqual({ expense_category_id: 'cat-1' });
    expect(rows[1]).not.toHaveProperty('expense_category_id');
    expect(expenseCategoryOf(rows[1])).toBe('cat-1');
    expect(expenseCategoryOf({ metadata: null })).toBeUndefined();
  });
});

function fakeClient(opts: {
  rpcError?: { message: string; code?: string } | null;
  deleteError?: { message: string } | null;
  insertError?: { message: string } | null;
}) {
  const eq = vi.fn(() => Promise.resolve({ error: opts.deleteError ?? null }));
  const del = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => Promise.resolve({ error: opts.insertError ?? null }));
  const client = {
    rpc: vi.fn(() => Promise.resolve({ error: opts.rpcError ?? null })),
    from: vi.fn(() => ({ delete: del, insert })),
  };
  return { client: client as unknown as InvoiceItemsClient, raw: client, del, eq, insert };
}

const rows = toInvoiceItemRows([
  { description: 'Design', quantity: 1, unit_price: 10, line_total: 10 },
]);

describe('replaceInvoiceItems', () => {
  it('uses the transactional RPC when available', async () => {
    const f = fakeClient({});
    await replaceInvoiceItems(f.client, 'inv-1', rows);
    expect(f.raw.rpc).toHaveBeenCalledWith('replace_invoice_items', {
      p_invoice_id: 'inv-1',
      p_items: rows,
    });
    expect(f.raw.from).not.toHaveBeenCalled();
  });

  it('surfaces an RPC failure instead of falling back', async () => {
    const f = fakeClient({ rpcError: { message: 'permission denied', code: '42501' } });
    await expect(replaceInvoiceItems(f.client, 'inv-1', rows)).rejects.toMatchObject({
      message: 'permission denied',
    });
    expect(f.raw.from).not.toHaveBeenCalled();
  });

  it('falls back to delete + insert when the RPC is not deployed', async () => {
    const f = fakeClient({ rpcError: { message: 'not found', code: 'PGRST202' } });
    await replaceInvoiceItems(f.client, 'inv-1', rows);
    expect(f.eq).toHaveBeenCalledWith('invoice_id', 'inv-1');
    expect(f.insert).toHaveBeenCalledWith([{ ...rows[0], invoice_id: 'inv-1' }]);
  });

  it('does not insert when the fallback delete fails', async () => {
    const f = fakeClient({
      rpcError: { message: 'not found', code: 'PGRST202' },
      deleteError: { message: 'delete blocked' },
    });
    await expect(replaceInvoiceItems(f.client, 'inv-1', rows)).rejects.toMatchObject({
      message: 'delete blocked',
    });
    expect(f.insert).not.toHaveBeenCalled();
  });

  it('reports a failed fallback insert', async () => {
    const f = fakeClient({
      rpcError: { message: 'not found', code: 'PGRST202' },
      insertError: { message: 'bad row' },
    });
    await expect(replaceInvoiceItems(f.client, 'inv-1', rows)).rejects.toThrow(/bad row/);
  });
});
