import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ProcessDocumentRequest {
  documentId: string;
  documentType: 'invoice' | 'bill' | 'receipt' | 'payment_proof' | 'bank_statement' | 'contract' | 'tax_document' | 'other';
  relatedEntityType?: 'invoice' | 'payment' | 'journal_entry' | 'contact' | 'expense' | 'none';
  relatedEntityId?: string;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let documentId: string | null = null;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY not configured');
    }

    const requestData: ProcessDocumentRequest = await req.json();
    documentId = requestData.documentId;
    const { documentType, relatedEntityType, relatedEntityId } = requestData;

    console.log('Processing document:', documentId, 'Type:', documentType);

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

    console.log('Downloading file from storage:', document.file_path);

    // Download file from Supabase storage
    const { data: fileData, error: storageError } = await supabaseClient
      .storage
      .from('accounting-documents')
      .download(document.file_path);

    if (storageError || !fileData) {
      throw new Error(`Failed to download file: ${storageError?.message}`);
    }

    console.log('File downloaded, size:', fileData.size);

    // Convert file to base64 for Claude API
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Build binary string in chunks to avoid stack overflow, then encode as base64 once
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binaryString);

    // Determine media type
    const fileType = document.file_type || 'application/pdf';
    const isPdf = fileType === 'application/pdf' || document.file_path?.endsWith('.pdf');

    console.log('Sending to Claude for OCR and parsing... (isPdf:', isPdf, 'fileType:', fileType, ')');

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

    // Build the content block based on file type
    // Claude vision only accepts image/jpeg, image/png, image/gif, image/webp
    // For PDFs, use the 'document' content type instead
    let fileContentBlock;
    if (isPdf) {
      fileContentBlock = {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      };
    } else {
      // Map to a supported image media type
      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const imageMediaType = supportedImageTypes.includes(fileType) ? fileType : 'image/png';
      fileContentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType,
          data: base64,
        },
      };
    }

    // Use Claude's Messages API - single call for OCR + parsing
    const headers: Record<string, string> = {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
    // PDF support requires the beta header
    if (isPdf) {
      headers['anthropic-beta'] = 'pdfs-2024-09-25';
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: 'You are an expert at extracting structured data from financial documents. First read and extract all text from the document, then parse it into the requested JSON format. Always return valid JSON without any explanations or markdown formatting.',
        messages: [
          {
            role: 'user',
            content: [
              fileContentBlock,
              {
                type: 'text',
                text: parsingPrompt,
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);
      throw new Error(`Claude API failed: ${claudeResponse.status} - ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const aiContent = claudeData.content[0].text;

    console.log('Claude processing completed, response length:', aiContent.length);

    // Parse JSON response (handle potential markdown code blocks)
    let parsedData;
    try {
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) || aiContent.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Claude response:', e);
      parsedData = { error: 'Failed to parse AI response', raw: aiContent };
    }

    // Extract key fields for quick access
    const extractedDate = parsedData.invoice_date || parsedData.transaction_date || parsedData.payment_date || parsedData.document_date || null;
    const extractedAmount = parsedData.total_amount || parsedData.amount || null;
    const extractedVendor = parsedData.vendor_name || parsedData.merchant_name || parsedData.payee_name || null;
    const extractedInvoiceNumber = parsedData.invoice_number || parsedData.receipt_number || parsedData.payment_number || null;

    console.log('Updating document with parsed data...');

    // Update document with results
    const { data: updatedDoc, error: updateError } = await supabaseClient
      .from('accounting_documents')
      .update({
        ocr_status: 'completed',
        ocr_text: aiContent,
        ocr_confidence: 95,
        ocr_language: 'en',
        ocr_processed_at: new Date().toISOString(),
        ai_status: 'completed',
        ai_parsed_data: parsedData,
        ai_confidence: 95,
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
      console.error('Failed to update document:', updateError);
      throw updateError;
    }

    console.log('Document processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        document: updatedDoc,
        parsed_data: parsedData,
        message: 'Document processed successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-accounting-document function:', error);

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
        console.error('Failed to update error status:', e);
      }
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
});
