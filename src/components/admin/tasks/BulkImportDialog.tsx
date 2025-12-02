import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
  onSuccess: () => void;
}

export const BulkImportDialog = ({ open, onOpenChange, projects, onSuccess }: BulkImportDialogProps) => {
  const [selectedProject, setSelectedProject] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [createProject, setCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const downloadSampleCSV = () => {
    const csv = `Priority,Category,Item,Status,Description,Effort,Dependencies
"P0-Critical","Core Auth","Fix CORS policies on Edge Functions","Not Started","Restrict Access-Control-Allow-Origin from '*' to specific domains","2 hours","None"
"P1-High","Security","Add request rate limiting middleware","In Progress","Implement rate limiting on all API endpoints","8 hours","None"
"P2-Medium","CRM","Implement lead scoring","Completed","Auto-score leads based on engagement","16 hours","CRM system"`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks_sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const mapPriority = (originalPriority: string): string => {
    const priority = originalPriority.toLowerCase();
    if (priority.includes('p0') || priority.includes('critical') || priority.includes('urgent')) return 'urgent';
    if (priority.includes('p1') || priority.includes('high')) return 'high';
    if (priority.includes('p2') || priority.includes('medium')) return 'medium';
    if (priority.includes('p3') || priority.includes('low')) return 'low';
    return 'medium';
  };

  const mapStatus = (originalStatus: string): string => {
    const status = originalStatus.toLowerCase();
    if (status.includes('complete') || status.includes('done')) return 'completed';
    if (status.includes('progress') || status.includes('partial')) return 'in_progress';
    return 'to_do';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!createProject && !selectedProject) {
      toast({ title: 'Error', description: 'Please select a project or create a new one', variant: 'destructive' });
      return;
    }

    if (createProject && !newProjectName.trim()) {
      toast({ title: 'Error', description: 'Please enter a project name', variant: 'destructive' });
      return;
    }

    setIsImporting(true);

    try {
      let projectId = selectedProject;

      // Create new project if requested
      if (createProject) {
        const { data: newProject, error: projectError } = await supabase
          .from('task_projects')
          .insert([{
            name: newProjectName.trim(),
            platform: sourceName || file.name,
            status: 'active'
          }])
          .select()
          .single();

        if (projectError) throw projectError;
        projectId = newProject.id;
      }

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      
      // Detect CSV format (support multiple formats)
      const hasItem = headers.includes('item');
      const hasTitle = headers.includes('title');
      const hasPriority = headers.includes('priority');
      const hasCategory = headers.includes('category');
      const hasEffort = headers.includes('effort');
      const hasDependencies = headers.includes('dependencies');
      
      const tasks = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = parseCSVLine(line);
          const task: any = {
            project_id: projectId,
            source: sourceName || file.name,
            metadata: {}
          };
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            
            // Map CSV fields to database fields
            switch (header) {
              case 'item':
              case 'title':
                task.title = value;
                break;
              case 'description':
                task.description = value;
                break;
              case 'category':
                task.category = value;
                break;
              case 'priority':
                task.original_priority = value;
                task.priority = mapPriority(value);
                break;
              case 'status':
                task.status = mapStatus(value);
                task.metadata.original_status = value;
                break;
              case 'effort':
                task.effort = value;
                break;
              case 'dependencies':
                task.dependencies = value;
                break;
              case 'due_date':
              case 'due date':
                if (value) task.due_date = value;
                break;
              case 'links':
                if (value) task.links = value.split(',').map(l => l.trim());
                break;
              default:
                // Store any other fields in metadata
                if (value) task.metadata[header] = value;
            }
          });

          // Create tags from category and priority for better searching
          task.tags = [
            task.category,
            task.original_priority,
            task.priority,
          ].filter(Boolean);

          return task;
        });

      const { error } = await supabase.from('tasks').insert(tasks);
      
      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Successfully imported ${tasks.length} tasks${createProject ? ` into new project "${newProjectName}"` : ''}` 
      });
      onSuccess();
      e.target.value = '';
      setSourceName('');
      setNewProjectName('');
      setCreateProject(false);
    } catch (error) {
      console.error('Import error:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to import tasks. Please check your CSV format.', 
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Tasks from CSV
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Source Name */}
          <div>
            <Label>Source/Platform Name (Optional)</Label>
            <Input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Enterprise Readiness, Platform A"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Track which platform or system these tasks came from
            </p>
          </div>

          {/* Project Selection or Creation */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-project"
                checked={createProject}
                onCheckedChange={(checked) => setCreateProject(checked as boolean)}
              />
              <Label htmlFor="create-project" className="cursor-pointer">
                Create new project for this import
              </Label>
            </div>

            {createProject ? (
              <div>
                <Label>New Project Name *</Label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <Label>Select Existing Project *</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          {project.color && (
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: project.color }}
                            />
                          )}
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="border-t pt-4">
            <div className="flex gap-2 mb-3">
              <Button variant="outline" onClick={downloadSampleCSV} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download Sample CSV
              </Button>
              <label className="flex-1">
                <Button 
                  variant="default" 
                  disabled={(!selectedProject && !createProject) || isImporting} 
                  className="w-full"
                  asChild
                >
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
                  disabled={(!selectedProject && !createProject) || isImporting}
                />
              </label>
            </div>
          </div>

          {/* Format Guide */}
          <div className="bg-muted p-4 rounded-lg text-sm space-y-3">
            <div>
              <h4 className="font-medium mb-2">✅ Supported CSV Formats:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Enterprise Format:</strong> Priority, Category, Item, Status, Description, Effort, Dependencies</li>
                <li><strong>Simple Format:</strong> Title, Description, Status, Priority, Due Date</li>
                <li>All other columns will be preserved in metadata</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">🔄 Automatic Mapping:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Priority:</strong> P0/Critical → Urgent, P1/High → High, P2/Medium → Medium, P3/Low → Low</li>
                <li><strong>Status:</strong> "Not Started" → To Do, "In Progress" → In Progress, "Completed" → Completed</li>
                <li><strong>Item/Title:</strong> Automatically detected as task title</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">📝 Notes:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Headers are case-insensitive</li>
                <li>Quoted values with commas are supported</li>
                <li>Empty rows are automatically skipped</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
