import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2, Rocket, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Venture {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  screenshot_url: string | null;
  tech_stack: string[];
  status: string;
  live_url: string | null;
  github_url: string | null;
  metrics: Record<string, any> | null;
  featured: boolean;
  display_order: number;
  launch_date: string | null;
  created_at: string;
}

const VenturesManager = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVenture, setEditingVenture] = useState<Venture | null>(null);

  const emptyForm = {
    name: '',
    tagline: '',
    description: '',
    logo_url: '',
    screenshot_url: '',
    tech_stack: '',
    status: 'in-development',
    live_url: '',
    github_url: '',
    metrics: '',
    featured: false,
    display_order: 0,
    launch_date: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const { data: ventures, isLoading } = useQuery({
    queryKey: ['ventures-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventures')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as Venture[];
    },
  });

  const createVenture = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        tech_stack: data.tech_stack.split(',').map((s: string) => s.trim()).filter(Boolean),
        metrics: data.metrics ? JSON.parse(data.metrics) : null,
        launch_date: data.launch_date || null,
      };
      const { error } = await supabase.from('ventures').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
      toast.success('Venture created successfully!');
      setIsDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast.error(`Failed to create venture: ${error.message}`);
    },
  });

  const updateVenture = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = {
        ...data,
        tech_stack: data.tech_stack.split(',').map((s: string) => s.trim()).filter(Boolean),
        metrics: data.metrics ? JSON.parse(data.metrics) : null,
        launch_date: data.launch_date || null,
      };
      const { error } = await supabase
        .from('ventures')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
      toast.success('Venture updated successfully!');
      setIsDialogOpen(false);
      setEditingVenture(null);
      setFormData(emptyForm);
    },
    onError: (error: any) => {
      toast.error(`Failed to update venture: ${error.message}`);
    },
  });

  const deleteVenture = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ventures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventures-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ventures'] });
      toast.success('Venture deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete venture: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVenture) {
        updateVenture.mutate({ id: editingVenture.id, data: formData });
      } else {
        createVenture.mutate(formData);
      }
    } catch (error: any) {
      toast.error(`Invalid data: ${error.message}`);
    }
  };

  const handleEdit = (venture: Venture) => {
    setEditingVenture(venture);
    setFormData({
      name: venture.name,
      tagline: venture.tagline || '',
      description: venture.description || '',
      logo_url: venture.logo_url || '',
      screenshot_url: venture.screenshot_url || '',
      tech_stack: venture.tech_stack?.join(', ') || '',
      status: venture.status,
      live_url: venture.live_url || '',
      github_url: venture.github_url || '',
      metrics: venture.metrics ? JSON.stringify(venture.metrics, null, 2) : '',
      featured: venture.featured,
      display_order: venture.display_order,
      launch_date: venture.launch_date || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this venture?')) {
      deleteVenture.mutate(id);
    }
  };

  const statusColors: Record<string, string> = {
    planning: 'bg-gray-500',
    'in-development': 'bg-yellow-500',
    beta: 'bg-blue-500',
    live: 'bg-green-500',
    maintenance: 'bg-orange-500',
    archived: 'bg-gray-400',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Ventures Manager
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingVenture(null);
                setFormData(emptyForm);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Venture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVenture ? 'Edit Venture' : 'Add New Venture'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Platform Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My SaaS Platform"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="Solve X problem for Y audience"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed description of what this platform does..."
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="screenshot_url">Screenshot URL</Label>
                    <Input
                      id="screenshot_url"
                      value={formData.screenshot_url}
                      onChange={(e) => setFormData({ ...formData, screenshot_url: e.target.value })}
                      placeholder="https://example.com/screenshot.png"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tech_stack">Tech Stack (comma-separated)</Label>
                  <Input
                    id="tech_stack"
                    value={formData.tech_stack}
                    onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value })}
                    placeholder="React, TypeScript, Supabase, AI"
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate technologies with commas
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="in-development">In Development</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="launch_date">Launch Date</Label>
                    <Input
                      id="launch_date"
                      type="date"
                      value={formData.launch_date}
                      onChange={(e) => setFormData({ ...formData, launch_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="live_url">Live URL</Label>
                    <Input
                      id="live_url"
                      value={formData.live_url}
                      onChange={(e) => setFormData({ ...formData, live_url: e.target.value })}
                      placeholder="https://myplatform.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github_url">GitHub URL</Label>
                    <Input
                      id="github_url"
                      value={formData.github_url}
                      onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                      placeholder="https://github.com/username/repo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metrics">Metrics (JSON format)</Label>
                  <Textarea
                    id="metrics"
                    value={formData.metrics}
                    onChange={(e) => setFormData({ ...formData, metrics: e.target.value })}
                    placeholder='{"users": 500, "revenue": "$10k MRR"}'
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter as JSON: {`{"key": "value", "another_key": 123}`}
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_order">Display Order</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="featured">Featured</Label>
                    <Select
                      value={formData.featured.toString()}
                      onValueChange={(value) => setFormData({ ...formData, featured: value === 'true' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createVenture.isPending || updateVenture.isPending}>
                    {(createVenture.isPending || updateVenture.isPending) ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Venture'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {ventures && ventures.length > 0 ? (
          <div className="space-y-4">
            {ventures.map((venture) => (
              <Card key={venture.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-lg">{venture.name}</span>
                        <Badge className={`${statusColors[venture.status]} text-white`}>
                          {venture.status}
                        </Badge>
                        {venture.featured && (
                          <Badge variant="outline" className="border-primary text-primary">
                            Featured
                          </Badge>
                        )}
                      </div>
                      {venture.tagline && (
                        <p className="text-sm text-muted-foreground italic mb-2">
                          {venture.tagline}
                        </p>
                      )}
                      {venture.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {venture.description.substring(0, 150)}
                          {venture.description.length > 150 && '...'}
                        </p>
                      )}
                      {venture.tech_stack && venture.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {venture.tech_stack.map((tech, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {venture.live_url && (
                          <a
                            href={venture.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            Live Site <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {venture.github_url && (
                          <a
                            href={venture.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            GitHub <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(venture)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(venture.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No ventures yet. Click "Add Venture" to create one.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VenturesManager;
