import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileJson, AlertCircle, CheckCircle2, X, Key, FolderKanban } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edge-functions';

// Expected JSON structure from password manager export
interface ImportedProject {
  id: string;
  name: string;
}

interface ImportedSecret {
  key: string;
  value: string;
  note?: string;
  id: string;
  projectIds?: string[];
}

interface ImportData {
  projects?: ImportedProject[];
  secrets: ImportedSecret[];
}

interface ParsedSecret {
  originalId: string;
  name: string;
  value: string;
  notes: string;
  projectName: string | null;
  selected: boolean;
}

interface VaultImporterProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const VaultImporter = ({ onSuccess, onCancel }: VaultImporterProps) => {
  const [jsonInput, setJsonInput] = useState('');
  const [parsedSecrets, setParsedSecrets] = useState<ParsedSecret[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  
  const queryClient = useQueryClient();

  const parseJson = () => {
    setParseError(null);
    setParsedSecrets([]);

    if (!jsonInput.trim()) {
      setParseError('Please paste JSON data');
      return;
    }

    try {
      const data: ImportData = JSON.parse(jsonInput);
      
      if (!data.secrets || !Array.isArray(data.secrets)) {
        setParseError('Invalid format: "secrets" array is required');
        return;
      }

      // Build project lookup
      const projectLookup = new Map<string, string>();
      if (data.projects && Array.isArray(data.projects)) {
        data.projects.forEach(p => {
          projectLookup.set(p.id, p.name);
        });
      }

      // Parse secrets
      const secrets: ParsedSecret[] = data.secrets.map(secret => {
        // Get first project name if projectIds exist
        let projectName: string | null = null;
        if (secret.projectIds && secret.projectIds.length > 0) {
          projectName = projectLookup.get(secret.projectIds[0]) || null;
        }

        return {
          originalId: secret.id,
          name: secret.key,
          value: secret.value,
          notes: secret.note || '',
          projectName,
          selected: true
        };
      });

      if (secrets.length === 0) {
        setParseError('No secrets found in the JSON data');
        return;
      }

      setParsedSecrets(secrets);
      toast.success(`Found ${secrets.length} secrets to import`);
    } catch (err) {
      setParseError(`Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  };

  const toggleSecret = (index: number) => {
    setParsedSecrets(prev => prev.map((s, i) => 
      i === index ? { ...s, selected: !s.selected } : s
    ));
  };

  const toggleAll = (selected: boolean) => {
    setParsedSecrets(prev => prev.map(s => ({ ...s, selected })));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedSecrets = parsedSecrets.filter(s => s.selected);
      
      if (selectedSecrets.length === 0) {
        throw new Error('No secrets selected for import');
      }

      const results: { name: string; success: boolean; error?: string }[] = [];
      setImportProgress({ current: 0, total: selectedSecrets.length });

      for (let i = 0; i < selectedSecrets.length; i++) {
        const secret = selectedSecrets[i];
        setImportProgress({ current: i + 1, total: selectedSecrets.length });

        try {
          const response = await invokeEdgeFunction('secure-vault', {
            body: {
              action: 'encrypt',
              name: secret.name,
              value: secret.value,
              notes: secret.notes || `Imported from password manager. Original project: ${secret.projectName || 'None'}`,
              placeholderKey: secret.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
            }
          });

          if (response.error || !response.data?.success) {
            results.push({ 
              name: secret.name, 
              success: false, 
              error: response.error?.message || response.data?.error || 'Unknown error' 
            });
          } else {
            results.push({ name: secret.name, success: true });
          }
        } catch (err) {
          results.push({ 
            name: secret.name, 
            success: false, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed === 0) {
        toast.success(`Successfully imported ${successful} secrets`);
      } else {
        toast.warning(`Imported ${successful} secrets, ${failed} failed`);
        // Log failures
        results.filter(r => !r.success).forEach(r => {
          console.error(`Failed to import "${r.name}": ${r.error}`);
        });
      }

      setImportProgress(null);
      queryClient.invalidateQueries({ queryKey: ['vault-items'] });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Import failed: ' + error.message);
      setImportProgress(null);
    }
  });

  const selectedCount = parsedSecrets.filter(s => s.selected).length;

  return (
    <div className="space-y-6">
      {parsedSecrets.length === 0 ? (
        // Step 1: Paste JSON
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Import from Password Manager
            </CardTitle>
            <CardDescription>
              Paste your exported JSON data. Supports formats with "projects" and "secrets" arrays.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="json-input">JSON Data</Label>
              <Textarea
                id="json-input"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`{
  "projects": [
    { "id": "...", "name": "MyProject" }
  ],
  "secrets": [
    { "key": "API_KEY", "value": "secret123", "note": "...", "id": "...", "projectIds": ["..."] }
  ]
}`}
                className="font-mono text-sm min-h-[200px]"
              />
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button onClick={parseJson} disabled={!jsonInput.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                Parse JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Step 2: Review & Import
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Review Secrets to Import
            </CardTitle>
            <CardDescription>
              Select which secrets you want to import into your vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCount === parsedSecrets.length}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <Label htmlFor="select-all" className="text-sm">
                  Select All ({selectedCount} of {parsedSecrets.length})
                </Label>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setParsedSecrets([]);
                  setJsonInput('');
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Value Preview</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedSecrets.map((secret, index) => (
                    <TableRow key={secret.originalId}>
                      <TableCell>
                        <Checkbox
                          checked={secret.selected}
                          onCheckedChange={() => toggleSecret(index)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{secret.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {secret.value.substring(0, 20)}
                          {secret.value.length > 20 ? '...' : ''}
                        </code>
                      </TableCell>
                      <TableCell>
                        {secret.projectName ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <FolderKanban className="h-3 w-3" />
                            {secret.projectName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {secret.notes || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {importProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Importing...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={importMutation.isPending}>
                  Cancel
                </Button>
              )}
              <Button 
                onClick={() => importMutation.mutate()} 
                disabled={selectedCount === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>Importing...</>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {selectedCount} Secret{selectedCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

