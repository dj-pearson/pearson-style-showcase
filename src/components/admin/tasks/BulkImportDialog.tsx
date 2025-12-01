import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
  onSuccess: () => void;
}

export const BulkImportDialog = ({ open, onOpenChange, projects, onSuccess }: BulkImportDialogProps) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const downloadSampleCSV = () => {
    const csv = `title,description,status,priority,due_date,links
"Example Task 1","This is a sample task description","to_do","high","2025-02-01","https://example.com"
"Example Task 2","Another task with multiple links","in_progress","medium","2025-02-15","https://example.com,https://example2.com"
"Example Task 3","Simple task","to_do","low","2025-03-01",""`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks_sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const tasks = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || [];
          const task: any = { project_id: selectedProject };
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            if (header === 'links' && value) {
              task.links = value.split(',').map(l => l.trim());
            } else if (header === 'due_date' && value) {
              task.due_date = value;
            } else if (value) {
              task[header] = value;
            }
          });

          return task;
        });

      const { error } = await supabase.from('tasks').insert(tasks);
      
      if (error) throw error;

      toast.success(`Successfully imported ${tasks.length} tasks`);
      onSuccess();
      e.target.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import tasks. Please check your CSV format.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Import Tasks</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Select Project *</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Download the sample CSV to see the required format, then upload your tasks file.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadSampleCSV}>
                <Download className="mr-2 h-4 w-4" />
                Download Sample CSV
              </Button>
              <label>
                <Button variant="default" disabled={!selectedProject || isImporting} asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? 'Importing...' : 'Upload CSV'}
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={!selectedProject || isImporting}
                />
              </label>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Required columns: title</li>
              <li>Optional columns: description, status, priority, due_date, links</li>
              <li>Status values: to_do, in_progress, completed</li>
              <li>Priority values: low, medium, high, urgent</li>
              <li>Links: comma-separated URLs</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
