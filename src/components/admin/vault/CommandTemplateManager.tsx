import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Lock, Terminal, Database, Server, Cloud, GitBranch, Code2, Settings } from 'lucide-react';

type CommandTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template: string;
  placeholders: string[];
  is_system: boolean;
};

const categoryOptions = [
  { value: 'supabase', label: 'Supabase CLI', icon: Database },
  { value: 'supabase-selfhost', label: 'Self-Hosted Supabase', icon: Server },
  { value: 'database', label: 'Database', icon: Database },
  { value: 'ssh', label: 'SSH', icon: Terminal },
  { value: 'docker', label: 'Docker', icon: Server },
  { value: 'git', label: 'Git', icon: GitBranch },
  { value: 'cloud', label: 'Cloud', icon: Cloud },
  { value: 'api', label: 'API', icon: Code2 },
  { value: 'environment', label: 'Environment', icon: Settings },
  { value: 'general', label: 'General', icon: Terminal },
];

export const CommandTemplateManager = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommandTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<CommandTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    template: ''
  });

  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['command-templates-manage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vault_command_templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('category')
        .order('name');
      if (error) throw error;
      return data as CommandTemplate[];
    }
  });

  // Extract placeholders from template string
  const extractPlaceholders = (template: string): string[] => {
    const matches = template.match(/\[([A-Z0-9_]+)\]/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const placeholders = extractPlaceholders(formData.template);

      const { error } = await supabase
        .from('vault_command_templates')
        .insert({
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          template: formData.template,
          placeholders,
          is_system: false,
          user_id: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-templates-manage'] });
      queryClient.invalidateQueries({ queryKey: ['command-templates'] });
      toast.success('Template created');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) return;

      const placeholders = extractPlaceholders(formData.template);

      const { error } = await supabase
        .from('vault_command_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
          category: formData.category,
          template: formData.template,
          placeholders,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-templates-manage'] });
      queryClient.invalidateQueries({ queryKey: ['command-templates'] });
      toast.success('Template updated');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vault_command_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-templates-manage'] });
      queryClient.invalidateQueries({ queryKey: ['command-templates'] });
      toast.success('Template deleted');
      setDeleteTemplate(null);
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', category: 'general', template: '' });
    setIsAdding(false);
    setEditingTemplate(null);
  };

  const handleEdit = (template: CommandTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      template: template.template
    });
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.template.trim()) {
      toast.error('Template is required');
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const getCategoryIcon = (category: string) => {
    const option = categoryOptions.find(c => c.value === category);
    if (option) {
      const Icon = option.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Terminal className="h-4 w-4" />;
  };

  const getCategoryLabel = (category: string) => {
    const option = categoryOptions.find(c => c.value === category);
    return option?.label || category;
  };

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      {isAdding ? (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium">
            {editingTemplate ? 'Edit Template' : 'New Template'}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., My Custom SSH Command"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of what this template does"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template *</Label>
            <Textarea
              id="template"
              value={formData.template}
              onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
              placeholder="e.g., ssh [SSH_USER]@[SSH_HOST] -p [SSH_PORT]"
              className="font-mono"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Use [PLACEHOLDER_KEY] syntax for values that should be filled from the vault.
            </p>
          </div>

          {/* Preview placeholders */}
          {formData.template && (
            <div className="space-y-2">
              <Label className="text-sm">Detected Placeholders</Label>
              <div className="flex flex-wrap gap-2">
                {extractPlaceholders(formData.template).length === 0 ? (
                  <span className="text-sm text-muted-foreground">No placeholders detected</span>
                ) : (
                  extractPlaceholders(formData.template).map(p => (
                    <Badge key={p} variant="outline" className="font-mono">
                      [{p}]
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingTemplate
                  ? 'Update'
                  : 'Create'
              }
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Template
        </Button>
      )}

      {/* Templates Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No templates found. Add your first custom template!
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Placeholders</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(template => (
              <TableRow key={template.id}>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    {getCategoryIcon(template.category)}
                    {getCategoryLabel(template.category)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {template.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(template.placeholders || []).slice(0, 2).map(p => (
                      <Badge key={p} variant="secondary" className="text-xs font-mono">
                        {p}
                      </Badge>
                    ))}
                    {(template.placeholders || []).length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(template.placeholders || []).length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {template.is_system ? (
                    <Badge variant="default" className="flex items-center gap-1 w-fit">
                      <Lock className="h-3 w-3" />
                      System
                    </Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {template.is_system ? (
                    <span className="text-xs text-muted-foreground">Read-only</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
