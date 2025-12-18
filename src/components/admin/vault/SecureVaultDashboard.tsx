import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VaultMFAGate } from './VaultMFAGate';
import { VaultItemForm } from './VaultItemForm';
import { VaultTypeManager } from './VaultTypeManager';
import { VaultPlatformManager } from './VaultPlatformManager';
import { VaultImporter } from './VaultImporter';
import { CommandBuilder } from './CommandBuilder';
import { CommandTemplateManager } from './CommandTemplateManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Shield, Plus, Search, Eye, EyeOff, Copy, Trash2, Edit,
  Lock, FileText, Link, Terminal, Key, Settings, RefreshCw,
  FolderKanban, Globe, Building2, Wand2, FileCode, Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { invokeEdgeFunction } from '@/lib/edge-functions';

type VaultItem = {
  id: string;
  name: string;
  type_id: string | null;
  project_id: string | null;
  platform_id: string | null;
  placeholder_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
};

type TaskProject = {
  id: string;
  name: string;
  color: string | null;
};

type VaultType = {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
};

type VaultPlatform = {
  id: string;
  name: string;
  icon: string | null;
  url: string | null;
};

const iconMap: Record<string, React.ReactNode> = {
  lock: <Lock className="h-4 w-4" />,
  'file-text': <FileText className="h-4 w-4" />,
  link: <Link className="h-4 w-4" />,
  terminal: <Terminal className="h-4 w-4" />,
  key: <Key className="h-4 w-4" />,
};

export const SecureVaultDashboard = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'updated_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [revealedItems, setRevealedItems] = useState<Record<string, string>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<VaultItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
  const [isPlatformManagerOpen, setIsPlatformManagerOpen] = useState(false);
  const [isCommandBuilderOpen, setIsCommandBuilderOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch vault types
  const { data: types = [] } = useQuery({
    queryKey: ['vault-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secure_vault_types')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as VaultType[];
    },
    enabled: isVerified
  });

  // Fetch task projects for filtering
  const { data: projects = [] } = useQuery({
    queryKey: ['task-projects-vault'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_projects')
        .select('id, name, color')
        .order('name');
      if (error) throw error;
      return data as TaskProject[];
    },
    enabled: isVerified
  });

  // Fetch vault platforms
  const { data: platforms = [] } = useQuery({
    queryKey: ['vault-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vault_platforms')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as VaultPlatform[];
    },
    enabled: isVerified
  });

  // Fetch vault items (metadata only, not decrypted values)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vault-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secure_vault_items')
        .select('id, name, type_id, project_id, platform_id, placeholder_key, notes, created_at, updated_at, last_accessed_at')
        .order(sortBy, { ascending: sortOrder === 'asc' });
      if (error) throw error;
      return data as VaultItem[];
    },
    enabled: isVerified
  });

  // Decrypt mutation
  const decryptMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await invokeEdgeFunction('secure-vault', {
        body: { action: 'decrypt', itemId }
      });

      if (response.error) throw new Error(response.error.message);
      return { itemId, value: response.data.value };
    },
    onSuccess: ({ itemId, value }) => {
      setRevealedItems(prev => ({ ...prev, [itemId]: value }));
      setLoadingItems(prev => ({ ...prev, [itemId]: false }));
    },
    onError: (error) => {
      toast.error('Failed to decrypt: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await invokeEdgeFunction('secure-vault', {
        body: { action: 'delete', itemId }
      });
      if (response.error) throw new Error(response.error.message);
      return itemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-items'] });
      toast.success('Item deleted');
      setDeleteItem(null);
    },
    onError: (error) => {
      toast.error('Failed to delete: ' + error.message);
    }
  });

  const handleReveal = async (itemId: string) => {
    if (revealedItems[itemId]) {
      // Hide if already revealed
      setRevealedItems(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
      return;
    }

    setLoadingItems(prev => ({ ...prev, [itemId]: true }));
    decryptMutation.mutate(itemId);
  };

  const handleCopy = async (itemId: string) => {
    let value = revealedItems[itemId];
    
    if (!value) {
      // Need to decrypt first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await invokeEdgeFunction('secure-vault', {
        body: { action: 'decrypt', itemId }
      });

      if (response.error) {
        toast.error('Failed to copy: ' + response.error.message);
        return;
      }
      value = response.data.value;
    }

    await navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  // Filter and sort items
  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || item.type_id === typeFilter;
      const matchesProject = projectFilter === 'all' || 
        (projectFilter === 'global' && !item.project_id) ||
        item.project_id === projectFilter;
      const matchesPlatform = platformFilter === 'all' ||
        (platformFilter === 'none' && !item.platform_id) ||
        item.platform_id === platformFilter;
      return matchesSearch && matchesType && matchesProject && matchesPlatform;
    })
    .sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

  const getTypeName = (typeId: string | null) => {
    if (!typeId) return 'Unknown';
    const type = types.find(t => t.id === typeId);
    return type?.name || 'Unknown';
  };

  const getTypeIcon = (typeId: string | null) => {
    if (!typeId) return <Key className="h-4 w-4" />;
    const type = types.find(t => t.id === typeId);
    return iconMap[type?.icon || 'key'] || <Key className="h-4 w-4" />;
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'Global';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const getProjectColor = (projectId: string | null) => {
    if (!projectId) return undefined;
    const project = projects.find(p => p.id === projectId);
    return project?.color || undefined;
  };

  const getPlatformName = (platformId: string | null) => {
    if (!platformId) return null;
    const platform = platforms.find(p => p.id === platformId);
    return platform?.name || null;
  };

  // Clear revealed items after timeout for security
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (Object.keys(revealedItems).length > 0) {
        setRevealedItems({});
        toast.info('Values hidden for security');
      }
    }, 60000); // 1 minute

    return () => clearTimeout(timeout);
  }, [revealedItems]);

  if (!isVerified) {
    return <VaultMFAGate onVerified={() => setIsVerified(true)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Secure Vault
          </h2>
          <p className="text-muted-foreground">
            Encrypted storage for secrets, commands, and sensitive information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" onClick={() => setIsCommandBuilderOpen(true)}>
            <Wand2 className="h-4 w-4 mr-2" />
            Command Builder
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTemplateManagerOpen(true)}>
            <FileCode className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsPlatformManagerOpen(true)}>
            <Building2 className="h-4 w-4 mr-2" />
            Platforms
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTypeManagerOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Types
          </Button>
          <Button variant="outline" onClick={() => setIsImporterOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => { setEditingItem(null); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
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
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
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
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="none">No Platform</SelectItem>
                {platforms.map(platform => (
                  <SelectItem key={platform.id} value={platform.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {platform.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="created_at">Created</SelectItem>
                <SelectItem value="updated_at">Updated</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              <RefreshCw className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vault Items ({filteredItems.length})</CardTitle>
          <CardDescription>
            Click the eye icon to reveal values. Values auto-hide after 60 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || typeFilter !== 'all' ? 'No items match your filters' : 'No items in vault. Add your first item!'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Placeholder Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getTypeIcon(item.type_id)}
                        {getTypeName(item.type_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getPlatformName(item.platform_id) ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Building2 className="h-3 w-3" />
                          {getPlatformName(item.platform_id)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 w-fit"
                        style={{ borderColor: getProjectColor(item.project_id) || undefined }}
                      >
                        {item.project_id ? (
                          <FolderKanban className="h-3 w-3" style={{ color: getProjectColor(item.project_id) || undefined }} />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {getProjectName(item.project_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {item.placeholder_key ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          [{item.placeholder_key}]
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono max-w-[200px]">
                      {loadingItems[item.id] ? (
                        <span className="text-muted-foreground">Decrypting...</span>
                      ) : revealedItems[item.id] ? (
                        <span className="break-all text-sm">{revealedItems[item.id]}</span>
                      ) : (
                        <span className="text-muted-foreground">••••••••</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReveal(item.id)}
                          disabled={loadingItems[item.id]}
                        >
                          {revealedItems[item.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(item.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingItem(item); setIsFormOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <VaultItemForm 
            types={types}
            projects={projects}
            platforms={platforms}
            editItem={editingItem}
            onSuccess={() => {
              setIsFormOpen(false);
              setEditingItem(null);
              queryClient.invalidateQueries({ queryKey: ['vault-items'] });
            }}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingItem(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Type Manager Dialog */}
      <Dialog open={isTypeManagerOpen} onOpenChange={setIsTypeManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Vault Types</DialogTitle>
          </DialogHeader>
          <VaultTypeManager 
            types={types}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['vault-types'] })}
          />
        </DialogContent>
      </Dialog>

      {/* Platform Manager Dialog */}
      <Dialog open={isPlatformManagerOpen} onOpenChange={setIsPlatformManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Platforms</DialogTitle>
          </DialogHeader>
          <VaultPlatformManager />
        </DialogContent>
      </Dialog>

      {/* Command Builder Dialog */}
      <Dialog open={isCommandBuilderOpen} onOpenChange={setIsCommandBuilderOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <CommandBuilder onClose={() => setIsCommandBuilderOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Template Manager Dialog */}
      <Dialog open={isTemplateManagerOpen} onOpenChange={setIsTemplateManagerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Command Templates</DialogTitle>
          </DialogHeader>
          <CommandTemplateManager />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vault Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Importer Dialog */}
      <Dialog open={isImporterOpen} onOpenChange={setIsImporterOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Secrets</DialogTitle>
          </DialogHeader>
          <VaultImporter 
            onSuccess={() => {
              setIsImporterOpen(false);
              queryClient.invalidateQueries({ queryKey: ['vault-items'] });
            }}
            onCancel={() => setIsImporterOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
