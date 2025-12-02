import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type VaultPlatform = {
  id: string;
  name: string;
  icon: string | null;
  url: string | null;
  created_at: string;
};

export const VaultPlatformManager = () => {
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformUrl, setNewPlatformUrl] = useState('');
  const queryClient = useQueryClient();

  const { data: platforms = [], isLoading } = useQuery({
    queryKey: ['vault-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vault_platforms')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as VaultPlatform[];
    }
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('vault_platforms')
        .insert({ 
          name: newPlatformName.trim(),
          url: newPlatformUrl.trim() || null,
          icon: 'globe'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-platforms'] });
      setNewPlatformName('');
      setNewPlatformUrl('');
      toast.success('Platform added');
    },
    onError: (error) => {
      toast.error('Failed to add platform: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vault_platforms')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-platforms'] });
      toast.success('Platform deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete platform: ' + error.message);
    }
  });

  const handleAdd = () => {
    if (!newPlatformName.trim()) {
      toast.error('Platform name is required');
      return;
    }
    addMutation.mutate();
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading platforms...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="platform-name" className="text-xs">Name</Label>
          <Input
            id="platform-name"
            value={newPlatformName}
            onChange={(e) => setNewPlatformName(e.target.value)}
            placeholder="e.g., Netflix"
            className="h-8"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="platform-url" className="text-xs">URL (optional)</Label>
          <Input
            id="platform-url"
            value={newPlatformUrl}
            onChange={(e) => setNewPlatformUrl(e.target.value)}
            placeholder="https://..."
            className="h-8"
          />
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {platforms.map(platform => (
          <Badge key={platform.id} variant="secondary" className="gap-1 pr-1">
            <Globe className="h-3 w-3" />
            <span>{platform.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-destructive/20"
              onClick={() => deleteMutation.mutate(platform.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
};
