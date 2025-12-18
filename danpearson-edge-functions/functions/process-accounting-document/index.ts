import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { 
  createSupabaseClient, 
  getAIConfigs, 
  callAIWithVision, 
  callAIWithConfig,
  parseJSONResponse 
} from "../_shared/ai-helper.ts";

interface ProcessDocumentRequest {
  documentId: string;
  documentType: 'invoice' | 'bill' | 'receipt' | 'payment_proof' | 'bank_statement' | 'contract' | 'tax_document' | 'other';
  relatedEntityType?: 'invoice' | 'payment' | 'journal_entry' | 'contact' | 'expense' | 'none';
  relatedEntityId?: string;
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient();

    // Get lightweight AI configs for document processing (fast extraction)
    const aiConfigs = await getAIConfigs(supabaseClient, 'lightweight', 'document_processing');
    console.log(`[Document] Found ${aiConfigs.length} lightweight AI configs`);

    const requestData: ProcessDocumentRequest = await req.json();
    const { documentId, documentType, relatedEntityType, relatedEntityId } = requestData;

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
    const { data: fileData, error: storageError } = await supabaseClient
      .storage
      .from('accounting-documents')
      .download(document.file_path);

    if (storageError || !fileData) {
      throw new Error(`Failed to download file: ${storageError?.message}`);
    }

    console.log('[Document] File downloaded, size:', fileData.size);

    // Convert file to base64 for vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${document.file_type};base64,${base64}`;

    console.log('[Document] Sending to vision AI for OCR...');

    // Step 1: OCR with Vision AI (using lightweight model)
    const ocrPrompt = 'Extract all text from this document. Return the complete text content as accurately as possible, maintaining the structure and layout.';
    
    const { response: ocrText, usedConfig: ocrConfig } = await callAIWithVision(
      aiConfigs,
      ocrPrompt,
      dataUrl,
      { temperature: 0.1, maxTokens: 4000 }
    );

    console.log(`[Document] OCR completed using ${ocrConfig.provider}, extracted text length:`, ocrText.length);

    // Step 2: AI Parsing based on document type (using lightweight model)
    console.log('[Document] Sending to AI for structured parsing...');

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

Return ONLY valid JSON.`
    };

    const parsingPrompt = parsingPrompts[documentType] || parsingPrompts.other;
    const systemPrompt = 'You are an expert at extracting structured data from financial documents. Always return valid JSON without any explanations or markdown formatting.';

    const { response: aiContent, usedConfig: parseConfig } = await callAIWithConfig(
      aiConfigs,
      systemPrompt,
      `${parsingPrompt}\n\nDocument text:\n${ocrText}`,
      { temperature: 0.2, maxTokens: 4000, jsonMode: true }
    );

    console.log(`[Document] AI parsing completed using ${parseConfig.provider}`);

    // Parse JSON response
    let parsedData;
    try {
      parsedData = parseJSONResponse(aiContent);
    } catch (e) {
      console.error('[Document] Failed to parse AI response:', e);
      parsedData = { error: 'Failed to parse AI response', raw: aiContent };
    }

    // Extract key fields for quick access
    const extractedDate = parsedData.invoice_date || parsedData.transaction_date || parsedData.payment_date || parsedData.document_date || null;
    const extractedAmount = parsedData.total_amount || parsedData.amount || null;
    const extractedVendor = parsedData.vendor_name || parsedData.merchant_name || parsedData.payee_name || null;
    const extractedInvoiceNumber = parsedData.invoice_number || parsedData.receipt_number || parsedData.payment_number || null;

    console.log('[Document] Updating document with parsed data...');

    // Update document with OCR and AI results
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
          parsing: `${parseConfig.provider} - ${parseConfig.model_name}`
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Document] Error in process-accounting-document function:', error);

    // Try to update document status to failed
    try {
      const requestData = await req.clone().json();
      const supabaseClient = createSupabaseClient();

      await supabaseClient
        .from('accounting_documents')
        .update({
          ocr_status: 'failed',
          ai_status: 'failed',
        })
        .eq('id', requestData.documentId);
    } catch (e) {
      console.error('[Document] Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
