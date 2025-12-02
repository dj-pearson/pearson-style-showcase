import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, FileText, Link, Terminal, Key, Shield, Tag } from 'lucide-react';

type VaultType = {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
};

interface VaultTypeManagerProps {
  types: VaultType[];
  onUpdate: () => void;
}

const iconOptions = [
  { value: 'key', label: 'Key', icon: <Key className="h-4 w-4" /> },
  { value: 'lock', label: 'Lock', icon: <Lock className="h-4 w-4" /> },
  { value: 'file-text', label: 'File', icon: <FileText className="h-4 w-4" /> },
  { value: 'link', label: 'Link', icon: <Link className="h-4 w-4" /> },
  { value: 'terminal', label: 'Terminal', icon: <Terminal className="h-4 w-4" /> },
  { value: 'shield', label: 'Shield', icon: <Shield className="h-4 w-4" /> },
  { value: 'tag', label: 'Tag', icon: <Tag className="h-4 w-4" /> },
];

const iconMap: Record<string, React.ReactNode> = {
  key: <Key className="h-4 w-4" />,
  lock: <Lock className="h-4 w-4" />,
  'file-text': <FileText className="h-4 w-4" />,
  link: <Link className="h-4 w-4" />,
  terminal: <Terminal className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  tag: <Tag className="h-4 w-4" />,
};

export const VaultTypeManager = ({ types, onUpdate }: VaultTypeManagerProps) => {
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('key');

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('secure_vault_types')
        .insert({ name: newTypeName, icon: newTypeIcon, is_system: false });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Type added');
      setNewTypeName('');
      setNewTypeIcon('key');
      onUpdate();
    },
    onError: (error) => {
      toast.error('Failed to add type: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (typeId: string) => {
      const { error } = await supabase
        .from('secure_vault_types')
        .delete()
        .eq('id', typeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Type deleted');
      onUpdate();
    },
    onError: (error) => {
      toast.error('Failed to delete type: ' + error.message);
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      toast.error('Type name is required');
      return;
    }
    if (types.some(t => t.name.toLowerCase() === newTypeName.toLowerCase())) {
      toast.error('A type with this name already exists');
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Add new type form */}
      <form onSubmit={handleAdd} className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="typeName">New Type Name</Label>
          <Input
            id="typeName"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g., Git Command"
          />
        </div>
        <div className="w-[140px] space-y-2">
          <Label>Icon</Label>
          <Select value={newTypeIcon} onValueChange={setNewTypeIcon}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {iconOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={addMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </form>

      {/* Types list */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Icon</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {types.map(type => (
            <TableRow key={type.id}>
              <TableCell>
                {iconMap[type.icon] || <Key className="h-4 w-4" />}
              </TableCell>
              <TableCell className="font-medium">{type.name}</TableCell>
              <TableCell>
                {type.is_system ? (
                  <Badge variant="secondary">System</Badge>
                ) : (
                  <Badge variant="outline">Custom</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!type.is_system && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(type.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
