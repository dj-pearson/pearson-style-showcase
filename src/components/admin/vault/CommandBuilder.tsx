import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Terminal, Copy, Check, RefreshCw, Wand2, Eye, EyeOff,
  Database, Server, Cloud, GitBranch, Code2, Settings,
  ChevronRight, AlertCircle, Lock, Sparkles, ChevronDown,
  Plus, Save, Key, Edit2, Trash2
} from 'lucide-react';

type CommandTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template: string;
  placeholders: string[];
  is_system: boolean;
};

type VaultItem = {
  id: string;
  name: string;
  placeholder_key: string | null;
  type_id: string | null;
};

type CustomPlaceholder = {
  key: string;
  value: string;
  isCustom: true;
};

interface CommandBuilderProps {
  onClose?: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  supabase: <Database className="h-4 w-4" />,
  'supabase-selfhost': <Server className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  ssh: <Terminal className="h-4 w-4" />,
  docker: <Server className="h-4 w-4" />,
  git: <GitBranch className="h-4 w-4" />,
  cloud: <Cloud className="h-4 w-4" />,
  api: <Code2 className="h-4 w-4" />,
  environment: <Settings className="h-4 w-4" />,
  general: <Terminal className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  supabase: 'Supabase CLI',
  'supabase-selfhost': 'Self-Hosted Supabase',
  database: 'Database',
  ssh: 'SSH',
  docker: 'Docker',
  git: 'Git',
  cloud: 'Cloud',
  api: 'API',
  environment: 'Environment',
  general: 'General',
};

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }));

export const CommandBuilder = ({ onClose }: CommandBuilderProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [customPlaceholders, setCustomPlaceholders] = useState<CustomPlaceholder[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [vaultSecretsOpen, setVaultSecretsOpen] = useState(true);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('general');
  const [newCustomPlaceholderKey, setNewCustomPlaceholderKey] = useState('');

  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['command-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vault_command_templates')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      return data as CommandTemplate[];
    }
  });

  // Fetch ALL vault items (with and without placeholder keys)
  const { data: allVaultItems = [] } = useQuery({
    queryKey: ['vault-items-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secure_vault_items')
        .select('id, name, placeholder_key, type_id')
        .order('name');
      if (error) throw error;
      return data as VaultItem[];
    }
  });

  // Filter to items with placeholder keys
  const vaultItemsWithKeys = useMemo(() => {
    return allVaultItems.filter(item => item.placeholder_key);
  }, [allVaultItems]);

  // Filter to items without placeholder keys
  const vaultItemsWithoutKeys = useMemo(() => {
    return allVaultItems.filter(item => !item.placeholder_key);
  }, [allVaultItems]);

  // Decrypt mutation for fetching secret values
  const decryptMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await supabase.functions.invoke('secure-vault', {
        body: { action: 'decrypt', itemId }
      });
      if (response.error) throw new Error(response.error.message);
      return response.data.value;
    }
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: { name: string; description: string; category: string; template: string; placeholders: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('vault_command_templates')
        .insert({
          name: template.name,
          description: template.description || null,
          category: template.category,
          template: template.template,
          placeholders: template.placeholders,
          is_system: false,
          user_id: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-templates'] });
      toast.success('Template saved successfully');
      setSaveTemplateOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      setNewTemplateCategory('general');
    },
    onError: (error) => {
      toast.error('Failed to save template: ' + error.message);
    }
  });

  // Group templates by category
  const categorizedTemplates = useMemo(() => {
    const grouped: Record<string, CommandTemplate[]> = {};
    templates.forEach(template => {
      if (!grouped[template.category]) {
        grouped[template.category] = [];
      }
      grouped[template.category].push(template);
    });
    return grouped;
  }, [templates]);

  // Get unique categories
  const categories = useMemo(() => {
    return Object.keys(categorizedTemplates).sort();
  }, [categorizedTemplates]);

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return templates;
    return templates.filter(t => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  // Map placeholder keys to vault items
  const placeholderToVaultItem = useMemo(() => {
    const map: Record<string, VaultItem> = {};
    allVaultItems.forEach(item => {
      if (item.placeholder_key) {
        map[item.placeholder_key] = item;
      }
    });
    return map;
  }, [allVaultItems]);

  // Get available placeholders for current template
  const currentPlaceholders = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.placeholders || [];
  }, [selectedTemplate]);

  // Auto-fill placeholders from vault when template is selected
  const handleTemplateSelect = useCallback(async (template: CommandTemplate) => {
    setSelectedTemplate(template);
    setCopied(false);

    // Auto-fill from vault
    const newValues: Record<string, string> = {};
    const promises: Promise<void>[] = [];

    (template.placeholders || []).forEach(placeholder => {
      const vaultItem = placeholderToVaultItem[placeholder];
      if (vaultItem) {
        promises.push(
          decryptMutation.mutateAsync(vaultItem.id)
            .then(value => {
              newValues[placeholder] = value;
            })
            .catch(() => {
              // Silently fail for individual items
            })
        );
      }
    });

    await Promise.allSettled(promises);
    setPlaceholderValues(prev => ({ ...prev, ...newValues }));
  }, [placeholderToVaultItem, decryptMutation]);

  // Build the final command
  const builtCommand = useMemo(() => {
    if (!selectedTemplate) return customCommand;

    let command = selectedTemplate.template;
    currentPlaceholders.forEach(placeholder => {
      const value = placeholderValues[placeholder] || `[${placeholder}]`;
      command = command.replace(new RegExp(`\\[${placeholder}\\]`, 'g'), value);
    });
    // Also apply custom placeholders
    customPlaceholders.forEach(cp => {
      command = command.replace(new RegExp(`\\[${cp.key}\\]`, 'g'), cp.value);
    });
    return command;
  }, [selectedTemplate, currentPlaceholders, placeholderValues, customCommand, customPlaceholders]);

  // Check if any placeholder still shows as [PLACEHOLDER]
  const hasUnfilledPlaceholders = useMemo(() => {
    return builtCommand.includes('[') && builtCommand.includes(']');
  }, [builtCommand]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(builtCommand);
      setCopied(true);
      toast.success('Command copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy command');
    }
  };

  const handlePlaceholderChange = (placeholder: string, value: string) => {
    setPlaceholderValues(prev => ({ ...prev, [placeholder]: value }));
    setCopied(false);
  };

  const toggleShowSecret = (placeholder: string) => {
    setShowSecrets(prev => ({ ...prev, [placeholder]: !prev[placeholder] }));
  };

  const handleRefreshFromVault = async (placeholder: string) => {
    const vaultItem = placeholderToVaultItem[placeholder];
    if (!vaultItem) {
      toast.error(`No vault item mapped to ${placeholder}`);
      return;
    }

    try {
      const value = await decryptMutation.mutateAsync(vaultItem.id);
      setPlaceholderValues(prev => ({ ...prev, [placeholder]: value }));
      toast.success(`Refreshed ${placeholder} from vault`);
    } catch {
      toast.error(`Failed to fetch ${placeholder}`);
    }
  };

  const handleFetchVaultItem = async (item: VaultItem) => {
    try {
      const value = await decryptMutation.mutateAsync(item.id);
      if (item.placeholder_key) {
        setPlaceholderValues(prev => ({ ...prev, [item.placeholder_key!]: value }));
        toast.success(`Loaded ${item.name}`);
      } else {
        // Copy to clipboard if no placeholder key
        await navigator.clipboard.writeText(value);
        toast.success(`Copied ${item.name} to clipboard`);
      }
    } catch {
      toast.error(`Failed to fetch ${item.name}`);
    }
  };

  const addCustomPlaceholder = () => {
    const key = newCustomPlaceholderKey.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!key) {
      toast.error('Please enter a placeholder key');
      return;
    }
    if (customPlaceholders.some(cp => cp.key === key) || placeholderToVaultItem[key]) {
      toast.error('This placeholder key already exists');
      return;
    }
    setCustomPlaceholders(prev => [...prev, { key, value: '', isCustom: true }]);
    setNewCustomPlaceholderKey('');
    toast.success(`Added custom placeholder [${key}]`);
  };

  const updateCustomPlaceholder = (key: string, value: string) => {
    setCustomPlaceholders(prev =>
      prev.map(cp => cp.key === key ? { ...cp, value } : cp)
    );
    setCopied(false);
  };

  const removeCustomPlaceholder = (key: string) => {
    setCustomPlaceholders(prev => prev.filter(cp => cp.key !== key));
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setPlaceholderValues({});
    setShowSecrets({});
    setCopied(false);
    setCustomPlaceholders([]);
  };

  const handleSaveAsTemplate = () => {
    const templateString = selectedTemplate ? selectedTemplate.template : customCommand;
    if (!templateString.trim()) {
      toast.error('No command to save');
      return;
    }
    setNewTemplateName(selectedTemplate ? `${selectedTemplate.name} (Copy)` : '');
    setSaveTemplateOpen(true);
  };

  const submitSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    const templateString = selectedTemplate ? selectedTemplate.template : customCommand;
    const matches = templateString.match(/\[([A-Z0-9_]+)\]/g) || [];
    const placeholders = [...new Set(matches.map(m => m.slice(1, -1)))];

    saveTemplateMutation.mutate({
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim(),
      category: newTemplateCategory,
      template: templateString,
      placeholders
    });
  };

  // Extract placeholders from custom command
  const customCommandPlaceholders = useMemo(() => {
    const matches = customCommand.match(/\[([A-Z0-9_]+)\]/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  }, [customCommand]);

  // Build custom command with values
  const builtCustomCommand = useMemo(() => {
    let cmd = customCommand;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      cmd = cmd.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    });
    customPlaceholders.forEach(cp => {
      cmd = cmd.replace(new RegExp(`\\[${cp.key}\\]`, 'g'), cp.value);
    });
    return cmd;
  }, [customCommand, placeholderValues, customPlaceholders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Command Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Build commands using vault secrets and custom placeholders
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Available Vault Secrets Panel */}
      <Collapsible open={vaultSecretsOpen} onOpenChange={setVaultSecretsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Available Vault Secrets
                    <Badge variant="secondary" className="ml-2">
                      {vaultItemsWithKeys.length} mapped
                    </Badge>
                    {vaultItemsWithoutKeys.length > 0 && (
                      <Badge variant="outline" className="ml-1">
                        {vaultItemsWithoutKeys.length} unmapped
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Click a secret to use it • Secrets with placeholder keys auto-fill in templates
                  </CardDescription>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${vaultSecretsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Mapped secrets */}
                {vaultItemsWithKeys.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Mapped Secrets (click to insert)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {vaultItemsWithKeys.map(item => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => handleFetchVaultItem(item)}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          [{item.placeholder_key}]
                          <span className="text-muted-foreground ml-1">• {item.name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmapped secrets */}
                {vaultItemsWithoutKeys.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Unmapped Secrets (click to copy value)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {vaultItemsWithoutKeys.map(item => (
                        <Badge
                          key={item.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => handleFetchVaultItem(item)}
                        >
                          <Key className="h-3 w-3 mr-1 opacity-50" />
                          {item.name}
                          <span className="text-xs text-muted-foreground ml-1">(no key)</span>
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: Edit these vault items to add a placeholder key for use in templates
                    </p>
                  </div>
                )}

                {allVaultItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No vault secrets found. Add secrets to the vault first.
                  </p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Custom Placeholders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Custom Placeholders
          </CardTitle>
          <CardDescription>
            Add one-time placeholders that aren't stored in the vault
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Add new custom placeholder */}
            <div className="flex gap-2">
              <Input
                value={newCustomPlaceholderKey}
                onChange={(e) => setNewCustomPlaceholderKey(e.target.value.toUpperCase())}
                placeholder="PLACEHOLDER_KEY"
                className="font-mono flex-1"
              />
              <Button onClick={addCustomPlaceholder} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* List of custom placeholders */}
            {customPlaceholders.length > 0 && (
              <div className="space-y-2 pt-2">
                {customPlaceholders.map(cp => (
                  <div key={cp.key} className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono shrink-0">
                      [{cp.key}]
                    </Badge>
                    <Input
                      value={cp.value}
                      onChange={(e) => updateCustomPlaceholder(cp.key, e.target.value)}
                      placeholder="Enter value..."
                      type={showSecrets[cp.key] ? 'text' : 'password'}
                      className="font-mono text-sm flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleShowSecret(cp.key)}
                    >
                      {showSecrets[cp.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeCustomPlaceholder(cp.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {customPlaceholders.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Custom placeholders are useful for one-time values you don't want to store
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">
            <Terminal className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Code2 className="h-4 w-4 mr-2" />
            Custom Command
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-sm">Category:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      {categoryIcons[cat] || <Terminal className="h-4 w-4" />}
                      {categoryLabels[cat] || cat}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <>
                <Button variant="outline" size="sm" onClick={clearTemplate}>
                  Clear Selection
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                  <Save className="h-4 w-4 mr-1" />
                  Save as Template
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Template List */}
            <Card className="h-[400px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Available Templates</CardTitle>
                <CardDescription>
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  {loadingTemplates ? (
                    <div className="p-4 text-center text-muted-foreground">Loading templates...</div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No templates found</div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className={`w-full text-left p-3 rounded-md transition-colors hover:bg-muted ${
                            selectedTemplate?.id === template.id ? 'bg-primary/10 border border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {categoryIcons[template.category] || <Terminal className="h-4 w-4" />}
                                <span className="font-medium text-sm truncate">{template.name}</span>
                                {!template.is_system && (
                                  <Badge variant="secondary" className="text-xs">Custom</Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {template.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(template.placeholders || []).slice(0, 3).map(p => (
                                  <Badge key={p} variant="outline" className="text-xs">
                                    {placeholderToVaultItem[p] ? (
                                      <Lock className="h-2 w-2 mr-1" />
                                    ) : null}
                                    {p}
                                  </Badge>
                                ))}
                                {(template.placeholders || []).length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{(template.placeholders || []).length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Placeholder Configuration */}
            <Card className="h-[400px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {selectedTemplate ? 'Configure Placeholders' : 'Select a Template'}
                </CardTitle>
                <CardDescription>
                  {selectedTemplate
                    ? `Fill in the values for ${currentPlaceholders.length} placeholder${currentPlaceholders.length !== 1 ? 's' : ''}`
                    : 'Choose a template from the list to get started'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  {selectedTemplate ? (
                    <div className="space-y-4 p-4">
                      {currentPlaceholders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          This template has no placeholders to configure.
                        </p>
                      ) : (
                        currentPlaceholders.map(placeholder => {
                          const vaultItem = placeholderToVaultItem[placeholder];
                          const customPlaceholder = customPlaceholders.find(cp => cp.key === placeholder);
                          const hasValue = !!(placeholderValues[placeholder] || customPlaceholder?.value);

                          return (
                            <div key={placeholder} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-mono flex items-center gap-2">
                                  [{placeholder}]
                                  {vaultItem ? (
                                    <Badge variant="secondary" className="text-xs">
                                      <Lock className="h-2 w-2 mr-1" />
                                      {vaultItem.name}
                                    </Badge>
                                  ) : customPlaceholder ? (
                                    <Badge variant="outline" className="text-xs">Custom</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">Not mapped</Badge>
                                  )}
                                </Label>
                                <div className="flex items-center gap-1">
                                  {vaultItem && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleRefreshFromVault(placeholder)}
                                      disabled={decryptMutation.isPending}
                                    >
                                      <RefreshCw className={`h-3 w-3 ${decryptMutation.isPending ? 'animate-spin' : ''}`} />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleShowSecret(placeholder)}
                                  >
                                    {showSecrets[placeholder] ? (
                                      <EyeOff className="h-3 w-3" />
                                    ) : (
                                      <Eye className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              <Input
                                value={customPlaceholder?.value || placeholderValues[placeholder] || ''}
                                onChange={(e) => {
                                  if (customPlaceholder) {
                                    updateCustomPlaceholder(placeholder, e.target.value);
                                  } else {
                                    handlePlaceholderChange(placeholder, e.target.value);
                                  }
                                }}
                                placeholder={vaultItem ? `Auto-filled from ${vaultItem.name}` : 'Enter value or add as custom placeholder...'}
                                type={showSecrets[placeholder] ? 'text' : 'password'}
                                className={`font-mono text-sm ${hasValue ? 'border-green-500/50' : ''}`}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Select a template from the left to configure placeholders
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Generated Command */}
          {selectedTemplate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Generated Command
                  {hasUnfilledPlaceholders && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Missing values
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    value={builtCommand}
                    readOnly
                    className="font-mono text-sm min-h-[80px] pr-12 bg-muted/50"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={handleCopy}
                    disabled={hasUnfilledPlaceholders}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {hasUnfilledPlaceholders && (
                  <p className="text-xs text-destructive mt-2">
                    Fill in all placeholder values before copying the command.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Custom Command with Placeholders</CardTitle>
                  <CardDescription>
                    Write your own command using [PLACEHOLDER_KEY] syntax
                  </CardDescription>
                </div>
                {customCommand.trim() && (
                  <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                    <Save className="h-4 w-4 mr-1" />
                    Save as Template
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Command</Label>
                <Textarea
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="e.g., psql -h db.[SUPABASE_PROJECT_REF].supabase.co -U postgres -d [DB_NAME]"
                  className="font-mono text-sm min-h-[100px]"
                />
              </div>

              {/* Available placeholder keys */}
              <div className="space-y-2">
                <Label className="text-sm">Click to Insert Placeholder</Label>
                <div className="flex flex-wrap gap-2">
                  {vaultItemsWithKeys.length === 0 && customPlaceholders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No mapped vault items or custom placeholders. Add a placeholder key to vault items or create custom placeholders above.
                    </p>
                  ) : (
                    <>
                      {vaultItemsWithKeys.map(item => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => {
                            setCustomCommand(prev => prev + `[${item.placeholder_key}]`);
                          }}
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          [{item.placeholder_key}]
                        </Badge>
                      ))}
                      {customPlaceholders.map(cp => (
                        <Badge
                          key={cp.key}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => {
                            setCustomCommand(prev => prev + `[${cp.key}]`);
                          }}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          [{cp.key}]
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Parse and fill placeholders */}
              {customCommand && (
                <div className="space-y-4">
                  <Label className="text-sm">Detected Placeholders</Label>
                  {customCommandPlaceholders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No placeholders detected. Use [PLACEHOLDER_KEY] syntax.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {customCommandPlaceholders.map(placeholder => {
                        const vaultItem = placeholderToVaultItem[placeholder];
                        const customPlaceholder = customPlaceholders.find(cp => cp.key === placeholder);
                        return (
                          <div key={placeholder} className="flex items-center gap-2">
                            <Label className="font-mono text-xs min-w-[150px] flex items-center gap-1">
                              [{placeholder}]
                              {vaultItem ? (
                                <Lock className="h-3 w-3 text-primary" />
                              ) : customPlaceholder ? (
                                <Edit2 className="h-3 w-3 text-muted-foreground" />
                              ) : null}
                            </Label>
                            <Input
                              value={customPlaceholder?.value || placeholderValues[placeholder] || ''}
                              onChange={(e) => {
                                if (customPlaceholder) {
                                  updateCustomPlaceholder(placeholder, e.target.value);
                                } else {
                                  handlePlaceholderChange(placeholder, e.target.value);
                                }
                              }}
                              placeholder={vaultItem ? `From: ${vaultItem.name}` : customPlaceholder ? 'Custom value...' : 'Enter value...'}
                              type={showSecrets[placeholder] ? 'text' : 'password'}
                              className="font-mono text-sm flex-1"
                            />
                            {vaultItem && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefreshFromVault(placeholder)}
                                disabled={decryptMutation.isPending}
                              >
                                <RefreshCw className={`h-3 w-3 ${decryptMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleShowSecret(placeholder)}
                            >
                              {showSecrets[placeholder] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Separator />

                  {/* Final command */}
                  <div className="space-y-2">
                    <Label className="text-sm">Generated Command</Label>
                    <div className="relative">
                      <Textarea
                        value={builtCustomCommand}
                        readOnly
                        className="font-mono text-sm min-h-[80px] pr-12 bg-muted/50"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        onClick={async () => {
                          await navigator.clipboard.writeText(builtCustomCommand);
                          toast.success('Command copied to clipboard');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save as Template Dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., My Database Connection"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        {categoryIcons[opt.value] || <Terminal className="h-4 w-4" />}
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Command Template</Label>
              <Textarea
                value={selectedTemplate ? selectedTemplate.template : customCommand}
                readOnly
                className="font-mono text-sm bg-muted/50"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSaveTemplate} disabled={saveTemplateMutation.isPending}>
              {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
