/**
 * Create Invoice From Document
 * Uses service role to bypass RLS when creating invoices from approved documents.
 * Verifies user is in admin whitelist before proceeding.
 */
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

interface CreateInvoiceRequest {
  documentId: string;
  parsedData: {
    invoice_number?: string;
    invoiceNumber?: string;
    invoice_date?: string;
    invoiceDate?: string;
    date?: string;
    due_date?: string;
    dueDate?: string;
    total_amount?: number;
    totalAmount?: number;
    amount?: number;
    vendor_name?: string;
    vendorName?: string;
    notes?: string;
    line_items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      amount?: number;
      total?: number;
    }>;
    items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      amount?: number;
      total?: number;
    }>;
  };
}

serve(async (req) => {
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    const { documentId, parsedData } = body;

    if (!documentId || !parsedData) {
      return new Response(JSON.stringify({ error: 'Missing documentId or parsedData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lineItems = parsedData.line_items || parsedData.items || [];
    const totalAmount =
      parseFloat(
        String(parsedData.total_amount ?? parsedData.totalAmount ?? parsedData.amount ?? 0)
      ) || 0;

    const invoiceData = {
      invoice_type: 'purchase' as const,
      invoice_number: parsedData.invoice_number || parsedData.invoiceNumber || `SCAN-${Date.now()}`,
      invoice_date:
        parsedData.invoice_date ||
        parsedData.invoiceDate ||
        parsedData.date ||
        new Date().toISOString().split('T')[0],
      due_date: parsedData.due_date || parsedData.dueDate || null,
      subtotal: totalAmount,
      total_amount: totalAmount,
      amount_due: totalAmount,
      amount_paid: 0,
      status: 'draft',
      import_source: 'ai_scan',
      notes: parsedData.vendor_name
        ? `Vendor: ${parsedData.vendor_name}${parsedData.notes ? '\n' + parsedData.notes : ''}`
        : parsedData.notes || null,
    };

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

    const validItems = lineItems.filter((item: any) => item?.description);
    if (validItems.length > 0 && inserted) {
      const items = validItems.map((item: any, index: number) => ({
        invoice_id: inserted.id,
        line_number: index + 1,
        description: item.description,
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? item.amount ?? item.total ?? 0,
        line_total:
          item.amount ??
          item.total ??
          (item.quantity ?? 1) * (item.unit_price ?? item.amount ?? item.total ?? 0),
      }));

      await supabaseAdmin.from('invoice_items').insert(items);
    }

    await supabaseAdmin
      .from('accounting_documents')
      .update({ related_entity_type: 'invoice', related_entity_id: inserted.id })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({
        success: true,
        invoice: inserted,
        invoice_number: invoiceData.invoice_number,
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
});
