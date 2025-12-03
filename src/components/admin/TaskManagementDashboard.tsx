import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsManager } from './tasks/ProjectsManager';
import { TasksManager } from './tasks/TasksManager';
import { Archive, ListTodo, FolderKanban } from 'lucide-react';

export const TaskManagementDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedArchiveProject, setSelectedArchiveProject] = useState<string | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="px-1">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Task Management</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Manage your projects, tasks, and subtasks</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        {/* Mobile-optimized tabs with icons */}
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          <TabsTrigger
            value="tasks"
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm"
          >
            <ListTodo className="h-4 w-4" />
            <span>Tasks</span>
          </TabsTrigger>
          <TabsTrigger
            value="archive"
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm"
          >
            <Archive className="h-4 w-4" />
            <span>Archive</span>
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm"
          >
            <FolderKanban className="h-4 w-4" />
            <span>Projects</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4 mt-4">
          <TasksManager
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            showArchived={false}
          />
        </TabsContent>

        <TabsContent value="archive" className="space-y-4 mt-4">
          <TasksManager
            selectedProject={selectedArchiveProject}
            onSelectProject={setSelectedArchiveProject}
            showArchived={true}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-4">
          <ProjectsManager onSelectProject={setSelectedProject} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
