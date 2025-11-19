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
import { PlayCircle, Plus, Star, AlertCircle, CheckCircle2 } from "lucide-react";

interface AIModelConfig {
  id: string;
  provider: string;
  model_name: string;
  api_key_secret_name: string;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  configuration: any;
  use_case: string;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
}

export function AIModelConfigManager() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [newConfig, setNewConfig] = useState({
    provider: "gemini-paid",
    model_name: "",
    api_key_secret_name: "",
    priority: 0,
    use_case: "general",
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
        use_case: "general",
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
      const { data, error } = await supabase.functions.invoke("test-ai-model", {
        body: { config_id: configId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-configs"] });
      toast.success(data.message || "Model tested successfully");
      setTestingModelId(null);
    },
    onError: (error) => {
      toast.error("Test failed: " + error.message);
      setTestingModelId(null);
    },
  });

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
                  <Label>Use Case</Label>
                  <Select
                    value={newConfig.use_case}
                    onValueChange={(value) =>
                      setNewConfig({ ...newConfig, use_case: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="ticket_response">Ticket Response</SelectItem>
                      <SelectItem value="content_generation">Content Generation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => addConfigMutation.mutate(newConfig)}
                  disabled={!newConfig.model_name || !newConfig.api_key_secret_name}
                >
                  Add Configuration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                <TableHead>Priority</TableHead>
                <TableHead>Use Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
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
                  <TableCell>{config.priority}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{config.use_case}</Badge>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testModelMutation.mutate(config.id)}
                      disabled={testingModelId === config.id}
                    >
                      <PlayCircle className="w-4 h-4 mr-1" />
                      Test
                    </Button>
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