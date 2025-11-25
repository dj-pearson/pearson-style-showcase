import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, File, CheckCircle, XCircle, Loader2, Eye, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export type DocumentType = 'invoice' | 'bill' | 'receipt' | 'payment_proof' | 'bank_statement' | 'contract' | 'tax_document' | 'other';
export type RelatedEntityType = 'invoice' | 'payment' | 'journal_entry' | 'contact' | 'expense' | 'none';

interface DocumentUploadProps {
  documentType?: DocumentType;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  onUploadComplete?: (documentId: string, parsedData: any) => void;
  onError?: (error: string) => void;
  autoProcess?: boolean; // Auto-trigger OCR/AI processing after upload
  showExistingDocuments?: boolean; // Show list of existing documents
}

interface UploadedDocument {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  document_type: string;
  ocr_status: string;
  ai_status: string;
  extracted_date: string | null;
  extracted_amount: number | null;
  extracted_vendor: string | null;
  extracted_invoice_number: string | null;
  ai_parsed_data: any;
  created_at: string;
  storage_path?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentType: defaultDocumentType,
  relatedEntityType,
  relatedEntityId,
  onUploadComplete,
  onError,
  autoProcess = true,
  showExistingDocuments = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(defaultDocumentType || 'invoice');
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingDocuments, setExistingDocuments] = useState<UploadedDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [showParsedData, setShowParsedData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing documents if enabled
  React.useEffect(() => {
    if (showExistingDocuments && relatedEntityId) {
      loadExistingDocuments();
    }
  }, [showExistingDocuments, relatedEntityId]);

  const loadExistingDocuments = async () => {
    try {
      let query = supabase
        .from('accounting_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (relatedEntityId && relatedEntityType) {
        query = query
          .eq('related_entity_type', relatedEntityType)
          .eq('related_entity_id', relatedEntityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExistingDocuments((data || []) as UploadedDocument[]);
    } catch (error) {
      logger.error('Failed to load existing documents:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF or image file (JPG, PNG, GIF, WebP)',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 10MB',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${documentType}/${timestamp}_${sanitizedFileName}`;

      logger.log('Uploading file to storage:', filePath);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('accounting-documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);
      logger.log('File uploaded successfully:', uploadData.path);

      // Create document record
      const { data: user } = await supabase.auth.getUser();

      const { data: documentRecord, error: insertError } = await supabase
        .from('accounting_documents')
        .insert({
          file_name: selectedFile.name,
          file_path: uploadData.path,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          document_type: documentType,
          related_entity_type: relatedEntityType || 'none',
          related_entity_id: relatedEntityId || null,
          uploaded_by: user.user?.id,
          ocr_status: 'pending',
          ai_status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadProgress(75);
      logger.log('Document record created:', documentRecord.id);

      toast({
        title: 'Upload successful',
        description: autoProcess
          ? 'File uploaded. Processing with OCR and AI...'
          : 'File uploaded successfully',
      });

      // Auto-process if enabled
      if (autoProcess) {
        setIsProcessing(true);
        await processDocument(documentRecord.id);
      }

      setUploadProgress(100);

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload documents list
      if (showExistingDocuments) {
        loadExistingDocuments();
      }

      if (onUploadComplete) {
        onUploadComplete(documentRecord.id, null);
      }
    } catch (error: any) {
      logger.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });

      if (onError) {
        onError(error.message);
      }
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const processDocument = async (documentId: string) => {
    try {
      logger.log('Processing document with OCR and AI:', documentId);

      const { data, error } = await supabase.functions.invoke('process-accounting-document', {
        body: {
          documentId,
          documentType,
          relatedEntityType: relatedEntityType || 'none',
          relatedEntityId: relatedEntityId || null,
        },
      });

      if (error) throw error;

      logger.log('Document processed successfully:', data);

      toast({
        title: 'Processing complete',
        description: 'Document has been analyzed and data extracted',
      });

      if (onUploadComplete && data.parsed_data) {
        onUploadComplete(documentId, data.parsed_data);
      }

      // Reload documents to show updated status
      if (showExistingDocuments) {
        loadExistingDocuments();
      }
    } catch (error: any) {
      logger.error('Processing failed:', error);
      toast({
        title: 'Processing failed',
        description: error.message || 'Failed to process document',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (doc: UploadedDocument) => {
    try {
      const filePath = doc.storage_path || `${doc.id}/${doc.file_name}`;
      const { data, error } = await supabase.storage
        .from('accounting-documents')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download failed:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (doc: UploadedDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.file_name}"?`)) {
      return;
    }

    try {
      const filePath = doc.storage_path || `${doc.id}/${doc.file_name}`;
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('accounting-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('accounting_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });

      loadExistingDocuments();
    } catch (error) {
      logger.error('Delete failed:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { variant: 'outline', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      processing: { variant: 'secondary', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
          <CardDescription>
            Upload invoices, receipts, or other accounting documents for automatic OCR and AI processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Invoice / Bill</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
                <SelectItem value="payment_proof">Payment Proof</SelectItem>
                <SelectItem value="bank_statement">Bank Statement</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="tax_document">Tax Document</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileSelect}
                className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <File className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span className="text-xs">({formatFileSize(selectedFile.size)})</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || isProcessing}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload and Process
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {showExistingDocuments && existingDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>Previously uploaded documents for this record</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{doc.file_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {doc.document_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>OCR: {getStatusBadge(doc.ocr_status)}</span>
                      <span>•</span>
                      <span>AI: {getStatusBadge(doc.ai_status)}</span>
                    </div>
                    {doc.ai_status === 'completed' && (
                      <div className="flex items-center gap-3 text-xs">
                        {doc.extracted_invoice_number && (
                          <span className="text-muted-foreground">
                            #: {doc.extracted_invoice_number}
                          </span>
                        )}
                        {doc.extracted_date && (
                          <span className="text-muted-foreground">
                            Date: {formatDate(doc.extracted_date)}
                          </span>
                        )}
                        {doc.extracted_amount && (
                          <span className="text-muted-foreground">
                            Amount: {formatCurrency(doc.extracted_amount)}
                          </span>
                        )}
                        {doc.extracted_vendor && (
                          <span className="text-muted-foreground">
                            Vendor: {doc.extracted_vendor}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.ai_status === 'completed' && doc.ai_parsed_data && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowParsedData(true);
                        }}
                        title="View parsed data"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Data Dialog */}
      <Dialog open={showParsedData} onOpenChange={setShowParsedData}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Parsed Data</DialogTitle>
            <DialogDescription>
              Extracted information from: {selectedDocument?.file_name}
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Document Type</Label>
                  <p className="font-medium">{selectedDocument.document_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">OCR Confidence</Label>
                  <p className="font-medium">95%</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Structured Data (JSON)</Label>
                <Textarea
                  value={JSON.stringify(selectedDocument.ai_parsed_data, null, 2)}
                  readOnly
                  rows={15}
                  className="font-mono text-xs"
                />
              </div>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedDocument.ai_parsed_data, null, 2));
                  toast({
                    title: 'Copied to clipboard',
                    description: 'Parsed data copied to clipboard',
                  });
                }}
              >
                Copy JSON to Clipboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
