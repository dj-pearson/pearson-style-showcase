import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, FileText, Link, Terminal, Key, FolderKanban, Globe } from 'lucide-react';

type VaultType = {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
};

type TaskProject = {
  id: string;
  name: string;
  color: string | null;
};

type VaultItem = {
  id: string;
  name: string;
  type_id: string | null;
  project_id?: string | null;
  notes: string | null;
};

interface VaultItemFormProps {
  types: VaultType[];
  projects: TaskProject[];
  editItem?: VaultItem | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  lock: <Lock className="h-4 w-4" />,
  'file-text': <FileText className="h-4 w-4" />,
  link: <Link className="h-4 w-4" />,
  terminal: <Terminal className="h-4 w-4" />,
  key: <Key className="h-4 w-4" />,
};

export const VaultItemForm = ({ types, projects, editItem, onSuccess, onCancel }: VaultItemFormProps) => {
  const [name, setName] = useState(editItem?.name || '');
  const [value, setValue] = useState('');
  const [typeId, setTypeId] = useState(editItem?.type_id || '');
  const [projectId, setProjectId] = useState(editItem?.project_id || 'global');
  const [notes, setNotes] = useState(editItem?.notes || '');
  const [showValue, setShowValue] = useState(false);
  const [loadingDecrypt, setLoadingDecrypt] = useState(false);

  // If editing, fetch the decrypted value
  useEffect(() => {
    if (editItem) {
      setLoadingDecrypt(true);
      supabase.functions.invoke('secure-vault', {
        body: { action: 'decrypt', itemId: editItem.id }
      }).then(response => {
        if (response.data?.value) {
          setValue(response.data.value);
        }
      }).finally(() => {
        setLoadingDecrypt(false);
      });
    }
  }, [editItem]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const action = editItem ? 'update' : 'encrypt';
      const resolvedProjectId = projectId === 'global' ? null : projectId;
      const body = editItem 
        ? { action, itemId: editItem.id, name, value, typeId: typeId || null, projectId: resolvedProjectId, notes: notes || null }
        : { action, name, value, typeId: typeId || null, projectId: resolvedProjectId, notes: notes || null };

      const response = await supabase.functions.invoke('secure-vault', { body });
      
      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to save');
      
      return response.data;
    },
    onSuccess: () => {
      toast.success(editItem ? 'Item updated' : 'Item saved');
      onSuccess();
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!value.trim() && !editItem) {
      toast.error('Value is required');
      return;
    }

    saveMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., GitHub Personal Token"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {types.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  <span className="flex items-center gap-2">
                    {iconMap[type.icon] || <Key className="h-4 w-4" />}
                    {type.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Global
                </span>
              </SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  <span className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" style={{ color: project.color || undefined }} />
                    {project.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">Value {!editItem && '*'}</Label>
        <div className="relative">
          {loadingDecrypt ? (
            <div className="h-20 flex items-center justify-center border rounded-md bg-muted/50">
              <span className="text-muted-foreground">Loading encrypted value...</span>
            </div>
          ) : (
            <>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={editItem ? "Leave empty to keep current value" : "Enter the secret value"}
                className={`pr-10 font-mono ${!showValue ? 'text-security-disc' : ''}`}
                rows={3}
                required={!editItem}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => setShowValue(!showValue)}
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
        {editItem && (
          <p className="text-xs text-muted-foreground">
            Leave empty to keep the current value unchanged
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this item"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : editItem ? 'Update' : 'Save'}
        </Button>
      </div>
    </form>
  );
};
