import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PlayCircle, Plus, Star, AlertCircle, CheckCircle2, Edit2, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { invokeEdgeFunction } from '@/lib/edge-functions';

interface AIModelConfig {
  id: string;
  provider: string;
  model_name: string;
  api_key_secret_name: string;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  configuration: any;
  use_case: string | string[];
  model_tier: 'lightweight' | 'normal';
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
}

export function AIModelConfigManager() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<AIModelConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState({
    provider: "gemini-paid",
    model_name: "",
    api_key_secret_name: "",
    priority: 0,
    use_cases: ["general"] as string[],
    model_tier: "normal" as 'lightweight' | 'normal',
  });

  const { data: configs, isLoading } = useQuery({
    queryKey: ["ai-model-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_model_configs")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as AIModelConfig[];
    },
  });

  const addConfigMutation = useMutation({
    mutationFn: async (config: typeof newConfig) => {
      const { error } = await supabase.from("ai_model_configs").insert([config]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] });
      setIsAddDialogOpen(false);
      toast.success("AI model configuration added");
      setNewConfig({
        provider: "gemini-paid",
        model_name: "",
        api_key_secret_name: "",
        priority: 0,
        use_cases: ["general"],
        model_tier: "normal",
      });
    },
    onError: (error) => {
      toast.error("Failed to add configuration: " + error.message);
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AIModelConfig> }) => {
      const { error } = await supabase
        .from("ai_model_configs")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] });
      toast.success("Configuration updated");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const testModelMutation = useMutation({
    mutationFn: async (configId: string) => {
      setTestingModelId(configId);
      const { data, error } = await invokeEdgeFunction("test-ai-model", {
        body: { config_id: configId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] });
      if (data?.success) {
        toast.success(data.message || "Model tested successfully");
      } else {
        toast.error(data?.message || "Model test failed", {
          description: data?.errorDetails ? `Details: ${data.errorDetails}` : undefined
        });
      }
      setTestingModelId(null);
    },
    onError: (error) => {
      toast.error("Failed to test model: " + error.message);
      setTestingModelId(null);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_model_configs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] });
      toast.success("Configuration deleted");
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const openEditDialog = (config: AIModelConfig) => {
    setEditingConfig(config);
    setIsEditDialogOpen(true);
  };

  const saveEdit = () => {
    if (!editingConfig) return;
    
    updateConfigMutation.mutate({
      id: editingConfig.id,
      updates: {
        provider: editingConfig.provider,
        model_name: editingConfig.model_name,
        api_key_secret_name: editingConfig.api_key_secret_name,
        priority: editingConfig.priority,
        use_case: editingConfig.use_case,
        model_tier: editingConfig.model_tier,
      }
    });
    setIsEditDialogOpen(false);
    setEditingConfig(null);
  };

  const movePriority = (config: AIModelConfig, direction: 'up' | 'down') => {
    const newPriority = direction === 'up' ? config.priority + 1 : config.priority - 1;
    updateConfigMutation.mutate({
      id: config.id,
      updates: { priority: newPriority }
    });
  };

  const toggleDefault = async (id: string) => {
    // First, unset all other defaults
    const { error: unsetError } = await supabase
      .from("ai_model_configs")
      .update({ is_default: false })
      .neq("id", id);
    
    if (unsetError) {
      toast.error("Failed to update defaults");
      return;
    }

    // Then set this one as default
    updateConfigMutation.mutate({ id, updates: { is_default: true } });
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case "gemini-paid": return "bg-blue-500";
      case "gemini-free": return "bg-green-500";
      case "claude": return "bg-purple-500";
      case "openai": return "bg-orange-500";
      case "lovable": return "bg-pink-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Model Configuration</CardTitle>
            <CardDescription>
              Manage AI models with priority-based fallback system
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add AI Model Configuration</DialogTitle>
                <DialogDescription>
                  Configure a new AI model with priority and use case
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select
                    value={newConfig.provider}
                    onValueChange={(value) =>
                      setNewConfig({ ...newConfig, provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-paid">Gemini Paid</SelectItem>
                      <SelectItem value="gemini-free">Gemini Free</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="lovable">Lovable AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Model Name</Label>
                  <Input
                    value={newConfig.model_name}
                    onChange={(e) =>
                      setNewConfig({ ...newConfig, model_name: e.target.value })
                    }
                    placeholder="e.g., gemini-3-pro-preview"
                  />
                </div>
                <div>
                  <Label>API Key Secret Name</Label>
                  <Input
                    value={newConfig.api_key_secret_name}
                    onChange={(e) =>
                      setNewConfig({ ...newConfig, api_key_secret_name: e.target.value })
                    }
                    placeholder="e.g., GEMINI_API_KEY"
                  />
                </div>
                <div>
                  <Label>Priority (higher = preferred)</Label>
                  <Input
                    type="number"
                    value={newConfig.priority}
                    onChange={(e) =>
                      setNewConfig({ ...newConfig, priority: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Model Tier</Label>
                  <Select
                    value={newConfig.model_tier}
                    onValueChange={(value: 'lightweight' | 'normal') =>
                      setNewConfig({ ...newConfig, model_tier: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lightweight">⚡ Lightweight (Fast/Cheap)</SelectItem>
                      <SelectItem value="normal">🎯 Normal (Quality)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lightweight: extraction, social posts. Normal: articles, full content.
                  </p>
                </div>
                <div>
                  <Label>Use Cases</Label>
                  <div className="space-y-2 mt-2">
                    {["all", "general", "ticket_response", "content_generation", "article_generation", "social_content", "url_extraction", "document_processing"].map((useCase) => (
                      <div key={useCase} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`new-${useCase}`}
                          checked={newConfig.use_cases.includes(useCase)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewConfig({
                              ...newConfig,
                              use_cases: checked
                                ? [...newConfig.use_cases, useCase]
                                : newConfig.use_cases.filter((uc) => uc !== useCase),
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`new-${useCase}`} className="text-sm capitalize">
                          {useCase.replace(/_/g, " ")}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const configToSubmit = {
                      ...newConfig,
                      use_case: newConfig.use_cases.join(",")
                    };
                    addConfigMutation.mutate(configToSubmit as any);
                  }}
                  disabled={!newConfig.model_name || !newConfig.api_key_secret_name || newConfig.use_cases.length === 0}
                >
                  Add Configuration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit AI Model Configuration</DialogTitle>
                <DialogDescription>
                  Update the configuration for this AI model
                </DialogDescription>
              </DialogHeader>
              {editingConfig && (
                <div className="space-y-4">
                  <div>
                    <Label>Provider</Label>
                    <Select
                      value={editingConfig.provider}
                      onValueChange={(value) =>
                        setEditingConfig({ ...editingConfig, provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-paid">Gemini Paid</SelectItem>
                        <SelectItem value="gemini-free">Gemini Free</SelectItem>
                        <SelectItem value="claude">Claude</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="lovable">Lovable AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Model Name</Label>
                    <Input
                      value={editingConfig.model_name}
                      onChange={(e) =>
                        setEditingConfig({ ...editingConfig, model_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>API Key Secret Name</Label>
                    <Input
                      value={editingConfig.api_key_secret_name}
                      onChange={(e) =>
                        setEditingConfig({ ...editingConfig, api_key_secret_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Priority (higher = preferred)</Label>
                    <Input
                      type="number"
                      value={editingConfig.priority}
                      onChange={(e) =>
                        setEditingConfig({ ...editingConfig, priority: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Model Tier</Label>
                    <Select
                      value={editingConfig.model_tier || 'normal'}
                      onValueChange={(value: 'lightweight' | 'normal') =>
                        setEditingConfig({ ...editingConfig, model_tier: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lightweight">⚡ Lightweight (Fast/Cheap)</SelectItem>
                        <SelectItem value="normal">🎯 Normal (Quality)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lightweight: extraction, social posts. Normal: articles, full content.
                    </p>
                  </div>
                  <div>
                    <Label>Use Cases</Label>
                    <div className="space-y-2 mt-2">
                      {["all", "general", "ticket_response", "content_generation", "article_generation", "social_content", "url_extraction", "document_processing"].map((useCase) => {
                        const currentUseCases = typeof editingConfig.use_case === 'string' 
                          ? editingConfig.use_case.split(',') 
                          : Array.isArray(editingConfig.use_case) 
                            ? editingConfig.use_case 
                            : [];
                        
                        return (
                          <div key={useCase} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`edit-${useCase}`}
                              checked={currentUseCases.includes(useCase)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const updatedUseCases = checked
                                  ? [...currentUseCases, useCase]
                                  : currentUseCases.filter((uc) => uc !== useCase);
                                setEditingConfig({ 
                                  ...editingConfig, 
                                  use_case: updatedUseCases.join(',')
                                });
                              }}
                              className="w-4 h-4"
                            />
                            <label htmlFor={`edit-${useCase}`} className="text-sm capitalize">
                              {useCase.replace(/_/g, " ")}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEdit}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this AI model configuration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteConfirmId && deleteConfigMutation.mutate(deleteConfirmId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div>Loading configurations...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Use Cases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Reorder</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs?.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <Badge className={getProviderBadgeColor(config.provider)}>
                      {config.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{config.model_name}</TableCell>
                  <TableCell>
                    <Badge variant={config.model_tier === 'lightweight' ? 'secondary' : 'default'}>
                      {config.model_tier === 'lightweight' ? '⚡ Light' : '🎯 Normal'}
                    </Badge>
                  </TableCell>
                  <TableCell>{config.priority}</TableCell>
                  <TableCell>
                    {(() => {
                      const useCases = typeof config.use_case === 'string' 
                        ? config.use_case.split(',') 
                        : Array.isArray(config.use_case) 
                          ? config.use_case 
                          : ['general'];
                      
                      return (
                        <div className="flex flex-wrap gap-1">
                          {useCases.map((uc) => (
                            <Badge key={uc} variant="outline" className="text-xs">
                              {uc.replace("_", " ")}
                            </Badge>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {config.last_test_status === "success" ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        <span className="text-xs">Tested</span>
                      </div>
                    ) : config.last_test_status === "failed" ? (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        <span className="text-xs">Failed</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not tested</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDefault(config.id)}
                      disabled={config.is_default}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          config.is_default ? "fill-yellow-400 text-yellow-400" : ""
                        }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) =>
                        updateConfigMutation.mutate({
                          id: config.id,
                          updates: { is_active: checked },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => movePriority(config, 'up')}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => movePriority(config, 'down')}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testModelMutation.mutate(config.id)}
                        disabled={testingModelId === config.id}
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(config)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirmId(config.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
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
  );
}