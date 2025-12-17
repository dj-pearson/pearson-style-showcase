/**
 * Contact Import/Export Component
 *
 * Provides UI for importing contacts from CSV and exporting contacts to CSV.
 * Supports validation, error handling, and preview before import.
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  FileDown,
  FileUp,
  RefreshCw,
} from 'lucide-react';
import {
  importContactsFromCSV,
  validateContactsCSV,
  downloadContactsCSV,
  downloadImportTemplate,
  type ImportResult,
  type ImportOptions,
  type ExportOptions,
  type Contact,
} from '@/services/contacts/import-export';

interface ContactImportExportProps {
  onImportComplete?: (result: ImportResult) => void;
  className?: string;
}

export const ContactImportExport: React.FC<ContactImportExportProps> = ({
  onImportComplete,
  className,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    updateExisting: false,
    skipOnError: true,
    defaultContactType: 'customer',
  });

  // Export state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    contactType: 'all',
    includeInactive: false,
  });

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setValidationResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: false,
  });

  // Validate the selected file
  const handleValidate = async () => {
    if (!selectedFile) return;

    setIsValidating(true);
    try {
      const result = await validateContactsCSV(selectedFile, importOptions);
      setValidationResult(result);

      if (result.errors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Validation issues found',
          description: `${result.errors.length} error(s) found. Review before importing.`,
        });
      } else {
        toast({
          title: 'Validation successful',
          description: `${result.imported} contact(s) ready to import.`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Import the contacts
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      const result = await importContactsFromCSV(selectedFile, importOptions);

      if (result.success) {
        toast({
          title: 'Import successful',
          description: `Imported ${result.imported} new, updated ${result.updated} existing.`,
        });

        // Invalidate contacts query to refresh data
        queryClient.invalidateQueries({ queryKey: ['contacts'] });

        onImportComplete?.(result);
        handleCloseImport();
      } else {
        toast({
          variant: 'destructive',
          title: 'Import failed',
          description: result.errors[0]?.message || 'Unknown error',
        });
        setValidationResult(result);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Close import dialog and reset state
  const handleCloseImport = () => {
    setImportDialogOpen(false);
    setSelectedFile(null);
    setValidationResult(null);
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const success = await downloadContactsCSV(exportOptions);

      if (success) {
        toast({
          title: 'Export successful',
          description: 'Contacts have been exported to CSV.',
        });
        setExportDialogOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Export failed',
          description: 'No contacts to export or an error occurred.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    downloadImportTemplate();
    toast({
      title: 'Template downloaded',
      description: 'Use this template to prepare your contact data.',
    });
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        {/* Import Button */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Contacts
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Import Contacts from CSV
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file to import contacts. You can download a template to see the
                expected format.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Template download */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">Need a template?</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {/* File upload dropzone */}
              {!selectedFile ? (
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                    hover:border-primary hover:bg-primary/5
                  `}
                >
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">or click to select</p>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setValidationResult(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Import options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Import Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="updateExisting"
                      checked={importOptions.updateExisting}
                      onCheckedChange={(checked) =>
                        setImportOptions((prev) => ({
                          ...prev,
                          updateExisting: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="updateExisting" className="text-sm">
                      Update existing contacts (match by email)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="skipOnError"
                      checked={importOptions.skipOnError}
                      onCheckedChange={(checked) =>
                        setImportOptions((prev) => ({
                          ...prev,
                          skipOnError: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="skipOnError" className="text-sm">
                      Skip rows with errors (continue import)
                    </Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Default contact type:</Label>
                  <Select
                    value={importOptions.defaultContactType}
                    onValueChange={(value) =>
                      setImportOptions((prev) => ({
                        ...prev,
                        defaultContactType: value as 'customer' | 'vendor' | 'both',
                      }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Validation results */}
              {validationResult && (
                <div className="space-y-3">
                  <Alert variant={validationResult.errors.length > 0 ? 'destructive' : 'default'}>
                    <div className="flex items-start gap-3">
                      {validationResult.errors.length > 0 ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <div>
                        <AlertTitle>
                          {validationResult.errors.length > 0
                            ? 'Validation Issues'
                            : 'Ready to Import'}
                        </AlertTitle>
                        <AlertDescription>
                          {validationResult.imported} to import,{' '}
                          {validationResult.updated} to update,{' '}
                          {validationResult.skipped} skipped
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>

                  {/* Error list */}
                  {validationResult.errors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Errors ({validationResult.errors.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ScrollArea className="h-32">
                          <div className="space-y-2">
                            {validationResult.errors.slice(0, 10).map((error, i) => (
                              <div key={i} className="text-sm">
                                <span className="text-muted-foreground">Row {error.row}:</span>{' '}
                                {error.field && (
                                  <Badge variant="outline" className="mr-1">
                                    {error.field}
                                  </Badge>
                                )}
                                {error.message}
                              </div>
                            ))}
                            {validationResult.errors.length > 10 && (
                              <p className="text-sm text-muted-foreground">
                                ...and {validationResult.errors.length - 10} more errors
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {/* Preview table */}
                  {validationResult.contacts.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          Preview ({validationResult.contacts.length} contacts)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ScrollArea className="h-48">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Company</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {validationResult.contacts.slice(0, 5).map((contact, i) => (
                                <TableRow key={i}>
                                  <TableCell>{contact.contact_name}</TableCell>
                                  <TableCell>{contact.email || '-'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{contact.contact_type}</Badge>
                                  </TableCell>
                                  <TableCell>{contact.company_name || '-'}</TableCell>
                                </TableRow>
                              ))}
                              {validationResult.contacts.length > 5 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    ...and {validationResult.contacts.length - 5} more contacts
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCloseImport}>
                Cancel
              </Button>
              {!validationResult ? (
                <Button
                  onClick={handleValidate}
                  disabled={!selectedFile || isValidating}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Validate
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleImport}
                  disabled={isImporting || (validationResult.errors.length > 0 && !importOptions.skipOnError)}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {validationResult.imported} Contacts
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Button */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Contacts
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Export Contacts to CSV
              </DialogTitle>
              <DialogDescription>
                Download your contacts as a CSV file for backup or import into other systems.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Contact type:</Label>
                  <Select
                    value={exportOptions.contactType}
                    onValueChange={(value) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        contactType: value as ExportOptions['contactType'],
                      }))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="customer">Customers</SelectItem>
                      <SelectItem value="vendor">Vendors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeInactive"
                    checked={exportOptions.includeInactive}
                    onCheckedChange={(checked) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeInactive: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="includeInactive" className="text-sm">
                    Include inactive contacts
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ContactImportExport;
