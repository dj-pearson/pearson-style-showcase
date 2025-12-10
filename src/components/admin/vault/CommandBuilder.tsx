import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import {
  Terminal, Copy, Check, RefreshCw, Wand2, Eye, EyeOff,
  Database, Server, Cloud, GitBranch, Code2, Settings,
  ChevronRight, AlertCircle, Lock, Sparkles
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

type VaultItemWithKey = {
  id: string;
  name: string;
  placeholder_key: string | null;
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

export const CommandBuilder = ({ onClose }: CommandBuilderProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [customCommand, setCustomCommand] = useState('');

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

  // Fetch vault items with placeholder keys
  const { data: vaultItems = [] } = useQuery({
    queryKey: ['vault-items-with-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secure_vault_items')
        .select('id, name, placeholder_key')
        .not('placeholder_key', 'is', null)
        .order('name');
      if (error) throw error;
      return data as VaultItemWithKey[];
    }
  });

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
    const map: Record<string, VaultItemWithKey> = {};
    vaultItems.forEach(item => {
      if (item.placeholder_key) {
        map[item.placeholder_key] = item;
      }
    });
    return map;
  }, [vaultItems]);

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
    return command;
  }, [selectedTemplate, currentPlaceholders, placeholderValues, customCommand]);

  // Check if all required placeholders are filled
  const allPlaceholdersFilled = useMemo(() => {
    if (!selectedTemplate) return true;
    return currentPlaceholders.every(p => placeholderValues[p]?.trim());
  }, [selectedTemplate, currentPlaceholders, placeholderValues]);

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
    } catch (error) {
      toast.error(`Failed to fetch ${placeholder}`);
    }
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setPlaceholderValues({});
    setShowSecrets({});
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Command Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Build commands using your vault secrets as placeholders
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

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
          <div className="flex items-center gap-2">
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
              <Button variant="outline" size="sm" onClick={clearTemplate}>
                Clear Selection
              </Button>
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
                          const hasValue = !!placeholderValues[placeholder];

                          return (
                            <div key={placeholder} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-mono flex items-center gap-2">
                                  [{placeholder}]
                                  {vaultItem && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Lock className="h-2 w-2 mr-1" />
                                      {vaultItem.name}
                                    </Badge>
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
                                value={placeholderValues[placeholder] || ''}
                                onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                                placeholder={vaultItem ? `Auto-filled from ${vaultItem.name}` : 'Enter value...'}
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
              <CardTitle className="text-sm">Custom Command with Placeholders</CardTitle>
              <CardDescription>
                Write your own command and use [PLACEHOLDER_KEY] syntax to reference vault secrets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Command</Label>
                <Textarea
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="e.g., psql -h db.[SUPABASE_PROJECT_REF].supabase.co -U postgres"
                  className="font-mono text-sm min-h-[100px]"
                />
              </div>

              {/* Available placeholder keys */}
              <div className="space-y-2">
                <Label className="text-sm">Available Placeholder Keys</Label>
                <div className="flex flex-wrap gap-2">
                  {vaultItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vault items have placeholder keys assigned. Edit a vault item to add one.
                    </p>
                  ) : (
                    vaultItems.map(item => (
                      <Badge
                        key={item.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => {
                          setCustomCommand(prev => prev + `[${item.placeholder_key}]`);
                        }}
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        [{item.placeholder_key}] - {item.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <Separator />

              {/* Parse and fill placeholders */}
              {customCommand && (
                <div className="space-y-4">
                  <Label className="text-sm">Detected Placeholders</Label>
                  {(() => {
                    const matches = customCommand.match(/\[([A-Z0-9_]+)\]/g) || [];
                    const uniquePlaceholders = [...new Set(matches.map(m => m.slice(1, -1)))];

                    if (uniquePlaceholders.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No placeholders detected. Use [PLACEHOLDER_KEY] syntax.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {uniquePlaceholders.map(placeholder => {
                          const vaultItem = placeholderToVaultItem[placeholder];
                          return (
                            <div key={placeholder} className="flex items-center gap-2">
                              <Label className="font-mono text-xs min-w-[150px]">[{placeholder}]</Label>
                              <Input
                                value={placeholderValues[placeholder] || ''}
                                onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                                placeholder={vaultItem ? `From: ${vaultItem.name}` : 'Enter value...'}
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
                    );
                  })()}

                  <Separator />

                  {/* Final command */}
                  <div className="space-y-2">
                    <Label className="text-sm">Generated Command</Label>
                    <div className="relative">
                      <Textarea
                        value={(() => {
                          let cmd = customCommand;
                          Object.entries(placeholderValues).forEach(([key, value]) => {
                            cmd = cmd.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
                          });
                          return cmd;
                        })()}
                        readOnly
                        className="font-mono text-sm min-h-[80px] pr-12 bg-muted/50"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        onClick={async () => {
                          let cmd = customCommand;
                          Object.entries(placeholderValues).forEach(([key, value]) => {
                            cmd = cmd.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
                          });
                          await navigator.clipboard.writeText(cmd);
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
    </div>
  );
};
