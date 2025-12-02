import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, ChevronDown, ChevronRight, Clock, Tag } from 'lucide-react';
import { useState } from 'react';

interface TasksTableProps {
  tasks: any[];
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => void;
  onUpdateField: (taskId: string, field: string, value: any) => void;
  selectedTasks: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

export const TasksTable = ({ tasks, onEdit, onDelete, onUpdateField, selectedTasks, onSelectionChange }: TasksTableProps) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(tasks.map(t => t.id)));
    }
  };

  const toggleSelect = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    onSelectionChange(newSelected);
  };

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return '';
    }
  };

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead className="min-w-[200px]">Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Effort</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No tasks found. Import CSV or create a new task.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <>
                  <TableRow key={task.id} className={selectedTasks.has(task.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                        aria-label={`Select ${task.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(task.id)}
                        >
                          {expandedTasks.has(task.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{task.title}</div>
                        {task.source && (
                          <Badge variant="outline" className="text-xs">
                            {task.source}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.category ? (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          <Tag className="h-3 w-3 mr-1" />
                          {task.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.project && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.project.color }} />
                          <span className="truncate">{task.project.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.status}
                        onValueChange={(value) => onUpdateField(task.id, 'status', value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="to_do">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Select
                              value={task.priority}
                              onValueChange={(value) => onUpdateField(task.id, 'priority', value)}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue className={getPriorityColor(task.priority)} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        {task.original_priority && (
                          <TooltipContent>
                            Original: {task.original_priority}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {task.effort ? (
                        <Badge variant="outline" className="whitespace-nowrap">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.effort}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={task.due_date ? task.due_date.split('T')[0] : ''}
                        onChange={(e) => onUpdateField(task.id, 'due_date', e.target.value || null)}
                        className="w-[150px]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit task</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete task</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedTasks.has(task.id) && task.subtasks?.map((subtask: any) => (
                    <TableRow key={subtask.id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="pl-8">↳ {subtask.title}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                          {subtask.status}
                        </span>
                      </TableCell>
                      <TableCell className={getPriorityColor(subtask.priority)}>
                        {subtask.priority}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        {subtask.due_date ? new Date(subtask.due_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
