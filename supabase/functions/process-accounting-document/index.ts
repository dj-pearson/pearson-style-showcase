import { encode as base64Encode } from 'https://deno.land/std@0.190.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { validateCsrf, isStateChanging } from '../_shared/csrf.ts';
import {
  getAIConfigs,
  callAIWithVision,
  callAIWithConfig,
  parseJSONResponse,
} from '../_shared/ai-helper.ts';
import { structuredErrorResponse } from '../_shared/fetch-with-timeout.ts';

interface ProcessDocumentRequest {
  documentId: string;
  documentType:
    | 'invoice'
    | 'bill'
    | 'receipt'
    | 'payment_proof'
    | 'bank_statement'
    | 'contract'
    | 'tax_document'
    | 'other';
  relatedEntityType?: 'invoice' | 'payment' | 'journal_entry' | 'contact' | 'expense' | 'none';
  relatedEntityId?: string;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Reads uploaded accounting documents and calls paid AI vision with the
  // service role. The CSRF check below proves the request is same-origin, not
  // who sent it, so identity is established here first.
  const auth = await requireAdmin(req, corsHeaders, { allowServiceRole: true });
  if (!auth.ok) return auth.response!;

  // CSRF protection for state-changing document processing.
  if (isStateChanging(req.method)) {
    const csrf = validateCsrf(req);
    if (!csrf.valid) {
      console.warn(`process-accounting-document CSRF validation failed: ${csrf.reason}`);
      return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let documentId: string | null = null;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: ProcessDocumentRequest = await req.json();
    documentId = requestData.documentId;
    const { documentType, relatedEntityType, relatedEntityId } = requestData;

    console.log('[Document] Processing document:', documentId, 'Type:', documentType);

    // Fetch document metadata
    const { data: document, error: docError } = await supabaseClient
      .from('accounting_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Update status to processing
    await supabaseClient
      .from('accounting_documents')
      .update({
        ocr_status: 'processing',
        ai_status: 'processing',
      })
      .eq('id', documentId);

    console.log('[Document] Downloading file from storage:', document.file_path);

    // Download file from Supabase storage
    const { data: fileData, error: storageError } = await supabaseClient.storage
      .from('accounting-documents')
      .download(document.file_path);

    if (storageError || !fileData) {
      throw new Error(`Failed to download file: ${storageError?.message}`);
    }

    console.log('[Document] File downloaded, size:', fileData.size);

    // Convert file to base64 using Deno std library (avoids call stack overflow from spread operator)
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = base64Encode(arrayBuffer);

    // Determine media type
    const fileType = document.file_type || 'application/pdf';
    const dataUrl = `data:${fileType};base64,${base64}`;

    // Lightweight tier is enough for extraction, and getAIConfigs falls back to
    // the normal tier if no lightweight model is configured.
    const aiConfigs = await getAIConfigs(supabaseClient, 'lightweight', 'document_processing');
    console.log(`[Document] Found ${aiConfigs.length} AI configs for document processing`);

    console.log('[Document] Sending to vision AI for OCR...');

    // Build the parsing prompt based on document type
    const parsingPrompts: Record<string, string> = {
      invoice: `Analyze this invoice/bill and extract the following information in JSON format:
{
  "invoice_number": "Invoice or reference number",
  "invoice_date": "Date in YYYY-MM-DD format",
  "due_date": "Due date in YYYY-MM-DD format (if present)",
  "vendor_name": "Vendor/company name",
  "customer_name": "Customer name (if this is a sales invoice)",
  "vendor_address": "Full vendor address",
  "customer_address": "Full customer address (if present)",
  "subtotal": numeric value without currency symbols,
  "tax_amount": numeric value,
  "discount_amount": numeric value (if present),
  "total_amount": numeric value,
  "currency": "Currency code (USD, EUR, etc.)",
  "payment_terms": "Payment terms if mentioned",
  "line_items": [
    {
      "description": "Item description",
      "quantity": numeric,
      "unit_price": numeric,
      "amount": numeric
    }
  ],
  "notes": "Any additional notes or payment instructions"
}

Return ONLY valid JSON, no explanations.`,

      // 'bill' is an accepted documentType and must not fall through to the
      // generic 'other' prompt, which drops line items and addresses.
      bill: `Analyze this invoice/bill and extract the following information in JSON format:
{
  "invoice_number": "Invoice or reference number",
  "invoice_date": "Date in YYYY-MM-DD format",
  "due_date": "Due date in YYYY-MM-DD format (if present)",
  "vendor_name": "Vendor/company name",
  "customer_name": "Customer name (if this is a sales invoice)",
  "vendor_address": "Full vendor address",
  "customer_address": "Full customer address (if present)",
  "subtotal": numeric value without currency symbols,
  "tax_amount": numeric value,
  "discount_amount": numeric value (if present),
  "total_amount": numeric value,
  "currency": "Currency code (USD, EUR, etc.)",
  "payment_terms": "Payment terms if mentioned",
  "line_items": [
    {
      "description": "Item description",
      "quantity": numeric,
      "unit_price": numeric,
      "amount": numeric
    }
  ],
  "notes": "Any additional notes or payment instructions"
}

Return ONLY valid JSON, no explanations.`,

      receipt: `Analyze this receipt and extract:
{
  "merchant_name": "Merchant/store name",
  "receipt_number": "Receipt or transaction number",
  "transaction_date": "Date in YYYY-MM-DD format",
  "transaction_time": "Time if available",
  "location": "Store location/address",
  "subtotal": numeric,
  "tax_amount": numeric,
  "tip_amount": numeric (if present),
  "total_amount": numeric,
  "currency": "Currency code",
  "payment_method": "Payment method (cash, card, etc.)",
  "items": [
    {
      "description": "Item name",
      "quantity": numeric,
      "price": numeric
    }
  ]
}

Return ONLY valid JSON.`,

      payment_proof: `Analyze this payment proof/confirmation and extract:
{
  "payment_number": "Transaction or reference number",
  "payment_date": "Date in YYYY-MM-DD format",
  "payer_name": "Who made the payment",
  "payee_name": "Who received the payment",
  "amount": numeric,
  "currency": "Currency code",
  "payment_method": "Method (bank transfer, card, check, etc.)",
  "reference": "Payment reference or memo",
  "bank_name": "Bank name (if applicable)",
  "account_info": "Last 4 digits of account (if visible)",
  "status": "Payment status (completed, pending, etc.)"
}

Return ONLY valid JSON.`,

      bank_statement: `Analyze this bank statement and extract:
{
  "bank_name": "Bank name",
  "account_number": "Last 4 digits of account",
  "account_holder": "Account holder name",
  "statement_period": "Date range (YYYY-MM-DD to YYYY-MM-DD)",
  "opening_balance": numeric,
  "closing_balance": numeric,
  "currency": "Currency code",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description",
      "amount": numeric (positive for credits, negative for debits),
      "balance": numeric
    }
  ]
}

Return ONLY valid JSON.`,

      other: `Analyze this document and extract any relevant financial information:
{
  "document_title": "Document title or header",
  "document_date": "Date in YYYY-MM-DD format (if present)",
  "parties_involved": ["List of companies/people mentioned"],
  "amounts": [
    {
      "description": "What the amount is for",
      "amount": numeric,
      "currency": "Currency code"
    }
  ],
  "key_information": "Summary of important information",
  "dates": ["Any important dates in YYYY-MM-DD format"]
}

Return ONLY valid JSON.`,
    };

    const parsingPrompt = parsingPrompts[documentType] || parsingPrompts.other;

    // Two passes on purpose. A single vision call that both reads and structures
    // the document leaves nothing to store in ocr_text but the JSON it returned,
    // so anything reading ocr_text for search or audit gets a JSON blob instead
    // of the document's text.
    //
    // Pass 1: OCR. Vision model reads the document as text.
    const ocrPrompt =
      'Extract all text from this document. Return the complete text content as accurately as possible, maintaining the structure and layout.';

    const { response: ocrText, usedConfig: ocrConfig } = await callAIWithVision(
      aiConfigs,
      ocrPrompt,
      dataUrl,
      { temperature: 0.1, maxTokens: 4096 }
    );

    console.log(
      `[Document] OCR completed via ${ocrConfig.provider}/${ocrConfig.model_name}, text length: ${ocrText.length}`
    );

    // Pass 2: structure the extracted text into the document-type schema.
    console.log('[Document] Sending to AI for structured parsing...');

    const { response: aiContent, usedConfig: parseConfig } = await callAIWithConfig(
      aiConfigs,
      'You are an expert at extracting structured data from financial documents. Always return valid JSON without any explanations or markdown formatting.',
      `${parsingPrompt}\n\nDocument text:\n${ocrText}`,
      { temperature: 0.2, maxTokens: 4096, jsonMode: true }
    );

    console.log(
      `[Document] AI parsing completed via ${parseConfig.provider}/${parseConfig.model_name}`
    );

    // Parse JSON response (handles markdown code fences and stray prose)
    let parsedData;
    try {
      parsedData = parseJSONResponse(aiContent);
    } catch (e) {
      console.error('[Document] Failed to parse AI response:', e);
      parsedData = { error: 'Failed to parse AI response', raw: aiContent };
    }

    // Extract key fields for quick access
    const extractedDate =
      parsedData.invoice_date ||
      parsedData.transaction_date ||
      parsedData.payment_date ||
      parsedData.document_date ||
      null;
    const extractedAmount = parsedData.total_amount || parsedData.amount || null;
    const extractedVendor =
      parsedData.vendor_name || parsedData.merchant_name || parsedData.payee_name || null;
    const extractedInvoiceNumber =
      parsedData.invoice_number || parsedData.receipt_number || parsedData.payment_number || null;

    console.log('[Document] Updating document with parsed data...');

    // Update document with results
    const { data: updatedDoc, error: updateError } = await supabaseClient
      .from('accounting_documents')
      .update({
        ocr_status: 'completed',
        ocr_text: ocrText,
        ocr_confidence: 95,
        ocr_language: 'en',
        ocr_processed_at: new Date().toISOString(),
        ai_status: 'completed',
        ai_parsed_data: parsedData,
        ai_confidence: 90,
        ai_processed_at: new Date().toISOString(),
        extracted_date: extractedDate,
        extracted_amount: extractedAmount,
        extracted_vendor: extractedVendor,
        extracted_invoice_number: extractedInvoiceNumber,
        related_entity_type: relatedEntityType || 'none',
        related_entity_id: relatedEntityId || null,
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('[Document] Failed to update document:', updateError);
      throw updateError;
    }

    console.log('[Document] Document processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        document: updatedDoc,
        ocr_text_length: ocrText.length,
        parsed_data: parsedData,
        message: 'Document processed successfully',
        models_used: {
          ocr: `${ocrConfig.provider} - ${ocrConfig.model_name}`,
          parsing: `${parseConfig.provider} - ${parseConfig.model_name}`,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Document] Error in process-accounting-document function:', error);

    // Try to update document status to failed
    if (documentId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('accounting_documents')
          .update({
            ocr_status: 'failed',
            ai_status: 'failed',
          })
          .eq('id', documentId);
      } catch (e) {
        console.error('[Document] Failed to update error status:', e);
      }
    }

    return structuredErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'DOCUMENT_PROCESSING_FAILED',
      500,
      corsHeaders
    );
  }
};
