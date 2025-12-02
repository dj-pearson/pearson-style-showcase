import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Download, Search, X, FileText, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';
import { BulkImportDialog } from './BulkImportDialog';
import { TextExportDialog } from './TextExportDialog';

interface TasksManagerProps {
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export const TasksManager = ({ selectedProject, onSelectProject }: TasksManagerProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTextExportOpen, setIsTextExportOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['task_projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_projects').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', selectedProject],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:task_projects(id, name, color, platform),
          subtasks(*)
        `)
        .order('created_at', { ascending: false });

      if (selectedProject) {
        query = query.eq('project_id', selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Client-side filtering with search
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    let filtered = [...tasks];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(t => t.source === sourceFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.dependencies?.toLowerCase().includes(query) ||
        t.effort?.toLowerCase().includes(query) ||
        t.original_priority?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tasks, statusFilter, priorityFilter, categoryFilter, sourceFilter, searchQuery]);

  // Extract unique values for filters
  const uniqueCategories = useMemo(() => {
    if (!tasks) return [];
    return Array.from(new Set(tasks.map(t => t.category).filter(Boolean))).sort();
  }, [tasks]);

  const uniqueSources = useMemo(() => {
    if (!tasks) return [];
    return Array.from(new Set(tasks.map(t => t.source).filter(Boolean))).sort();
  }, [tasks]);

  const handleEdit = (task: any) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task and all its subtasks?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Task deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const handleUpdateField = async (taskId: string, field: string, value: any) => {
    const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', taskId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const handleBulkMarkDone = async () => {
    if (selectedTasks.size === 0) return;
    
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .in('id', Array.from(selectedTasks));
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update tasks', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${selectedTasks.size} task(s) marked as done` });
      setSelectedTasks(new Set());
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const handleExport = () => {
    if (!filteredTasks || filteredTasks.length === 0) {
      toast({ title: 'No tasks to export', description: 'Apply filters to select tasks for export' });
      return;
    }

    // Create CSV content
    const headers = ['Title', 'Category', 'Priority', 'Status', 'Description', 'Effort', 'Dependencies', 'Source', 'Project', 'Due Date', 'Created'];
    const rows = filteredTasks.map(task => [
      task.title || '',
      task.category || '',
      task.original_priority || task.priority || '',
      task.status || '',
      task.description || '',
      task.effort || '',
      task.dependencies || '',
      task.source || '',
      task.project?.name || '',
      task.due_date || '',
      task.created_at ? new Date(task.created_at).toLocaleDateString() : ''
    ]);

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Success', description: `Exported ${filteredTasks.length} tasks to CSV` });
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setSourceFilter('all');
    setSearchQuery('');
    onSelectProject(null);
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    priorityFilter !== 'all',
    categoryFilter !== 'all',
    sourceFilter !== 'all',
    searchQuery.trim() !== '',
    selectedProject !== null
  ].filter(Boolean).length;

  if (isLoading) return <TableSkeleton rows={8} columns={7} />;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Tasks</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredTasks.length} of {tasks?.length || 0} tasks
                  {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}</Badge>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTasks.size > 0 && (
                  <>
                    <Button variant="default" onClick={handleBulkMarkDone}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Done ({selectedTasks.size})
                    </Button>
                    <Button variant="secondary" onClick={() => setIsTextExportOpen(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export Text ({selectedTasks.size})
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
                <Button variant="outline" onClick={handleExport} disabled={filteredTasks.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by title, description, category, effort, dependencies..."
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={selectedProject || 'all'} onValueChange={(v) => onSelectProject(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TasksTable
            tasks={filteredTasks || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateField={handleUpdateField}
            selectedTasks={selectedTasks}
            onSelectionChange={setSelectedTasks}
          />
        </CardContent>
      </Card>

      <TaskFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingTask={editingTask}
        projects={projects || []}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingTask(null);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />

      <BulkImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        projects={projects || []}
        onSuccess={() => {
          setIsImportOpen(false);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />

      <TextExportDialog
        open={isTextExportOpen}
        onOpenChange={setIsTextExportOpen}
        tasks={filteredTasks?.filter(t => selectedTasks.has(t.id)) || []}
      />
    </>
  );
};
