/**
 * Create Invoice From Document
 * Creates a paid purchase invoice + payment record from an AI-parsed document.
 * Receipts are marked as paid immediately since they represent completed purchases.
 * Verifies user is in admin whitelist before proceeding.
 */
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/ai-helper.ts';

interface CreateInvoiceRequest {
  documentId: string;
  parsedData: {
    invoice_number?: string;
    invoiceNumber?: string;
    receipt_number?: string;
    invoice_date?: string;
    invoiceDate?: string;
    transaction_date?: string;
    date?: string;
    due_date?: string;
    dueDate?: string;
    total_amount?: number;
    totalAmount?: number;
    amount?: number;
    subtotal?: number;
    tax_amount?: number;
    vendor_name?: string;
    vendorName?: string;
    merchant_name?: string;
    payment_method?: string;
    currency?: string;
    notes?: string;
    line_items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      price?: number;
      amount?: number;
      total?: number;
    }>;
    items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      price?: number;
      amount?: number;
      total?: number;
    }>;
  };
  /** Document type from the upload (receipt, invoice, etc.) */
  documentType?: string;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createSupabaseClient();

    // Verify user and get email
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is in admin whitelist
    const { data: whitelistEntry } = await supabaseAdmin
      .from('admin_whitelist')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!whitelistEntry) {
      return new Response(JSON.stringify({ error: 'Forbidden - Not an admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: CreateInvoiceRequest = await req.json();
    const { documentId, parsedData, documentType } = body;

    if (!documentId || !parsedData) {
      return new Response(JSON.stringify({ error: 'Missing documentId or parsedData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      '[create-invoice-from-document] Processing document:',
      documentId,
      'type:',
      documentType
    );

    // Look up the actual document type from the database if not provided
    let resolvedDocType = documentType;
    if (!resolvedDocType) {
      const { data: docRecord } = await supabaseAdmin
        .from('accounting_documents')
        .select('document_type')
        .eq('id', documentId)
        .single();
      resolvedDocType = docRecord?.document_type || undefined;
      console.log(
        '[create-invoice-from-document] Resolved document type from DB:',
        resolvedDocType
      );
    }

    const lineItems = parsedData.line_items || parsedData.items || [];
    const totalAmount =
      parseFloat(
        String(parsedData.total_amount ?? parsedData.totalAmount ?? parsedData.amount ?? 0)
      ) || 0;
    const vendorName =
      parsedData.vendor_name || parsedData.vendorName || parsedData.merchant_name || null;
    const invoiceDate =
      parsedData.invoice_date ||
      parsedData.invoiceDate ||
      parsedData.transaction_date ||
      parsedData.date ||
      new Date().toISOString().split('T')[0];
    const invoiceNumber =
      parsedData.invoice_number ||
      parsedData.invoiceNumber ||
      parsedData.receipt_number ||
      `SCAN-${Date.now()}`;

    // Receipts represent completed purchases — mark as paid and create a payment
    const isReceipt =
      resolvedDocType === 'receipt' || !!parsedData.receipt_number || !!parsedData.merchant_name;

    const invoiceData = {
      invoice_type: 'purchase' as const,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: parsedData.due_date || parsedData.dueDate || null,
      subtotal: parsedData.subtotal ?? totalAmount,
      tax_amount: parsedData.tax_amount ?? 0,
      total_amount: totalAmount,
      amount_paid: isReceipt ? totalAmount : 0,
      amount_due: isReceipt ? 0 : totalAmount,
      status: isReceipt ? 'paid' : 'draft',
      import_source: 'ai_scan',
      notes: vendorName
        ? `Vendor: ${vendorName}${parsedData.notes ? '\n' + parsedData.notes : ''}`
        : parsedData.notes || null,
    };

    // 1. Create the purchase invoice
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('invoices')
      .insert([invoiceData])
      .select()
      .single();

    if (insertError) {
      console.error('[create-invoice-from-document] Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      '[create-invoice-from-document] Invoice created:',
      inserted.id,
      'status:',
      invoiceData.status
    );

    // 2. Insert line items if available
    const validItems = lineItems.filter((item: any) => item?.description);
    if (validItems.length > 0 && inserted) {
      const items = validItems.map((item: any, index: number) => ({
        invoice_id: inserted.id,
        line_number: index + 1,
        description: item.description,
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? item.price ?? item.amount ?? item.total ?? 0,
        line_total:
          item.amount ??
          item.total ??
          (item.quantity ?? 1) * (item.unit_price ?? item.price ?? item.amount ?? item.total ?? 0),
      }));

      const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(items);
      if (itemsError) {
        console.error('[create-invoice-from-document] Line items error:', itemsError);
      } else {
        console.log(`[create-invoice-from-document] ${items.length} line items created`);
      }
    }

    // 3. For receipts, also create a payment record so it shows in the Payments tab
    let paymentRecord = null;
    if (isReceipt && totalAmount > 0) {
      const paymentData = {
        payment_type: 'made' as const,
        payment_number: `PAY-${invoiceNumber}`,
        payment_date: invoiceDate,
        amount: totalAmount,
        payment_method: parsedData.payment_method || 'Other',
        reference_number: `RCPT-${invoiceNumber}`,
        notes: `Payment for ${vendorName || 'receipt'} — ${invoiceNumber}`,
        status: 'completed',
      };

      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

      if (paymentError) {
        console.error('[create-invoice-from-document] Payment creation error:', paymentError);
      } else {
        paymentRecord = payment;
        console.log('[create-invoice-from-document] Payment created:', payment.id);

        // Create payment allocation linking payment to invoice
        const { error: allocError } = await supabaseAdmin.from('payment_allocations').insert([
          {
            payment_id: payment.id,
            invoice_id: inserted.id,
            amount: totalAmount,
          },
        ]);

        if (allocError) {
          console.error('[create-invoice-from-document] Allocation error:', allocError);
        } else {
          console.log('[create-invoice-from-document] Payment allocated to invoice');
        }
      }
    }

    // 4. Link document to the created invoice
    await supabaseAdmin
      .from('accounting_documents')
      .update({ related_entity_type: 'invoice', related_entity_id: inserted.id })
      .eq('id', documentId);

    console.log('[create-invoice-from-document] Complete — invoice + payment created');

    return new Response(
      JSON.stringify({
        success: true,
        invoice: inserted,
        invoice_number: invoiceData.invoice_number,
        payment: paymentRecord,
        is_receipt: isReceipt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-invoice-from-document] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};
