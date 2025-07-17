import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Github } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => {
  return (
    <Card className="group h-full bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-all duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2 group-hover:text-cyan-400 transition-colors">
              {project.title}
            </CardTitle>
            <CardDescription className="text-gray-400 line-clamp-3">
              {project.description}
            </CardDescription>
          </div>
          {project.featured && (
            <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {project.tags?.map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="border-gray-600 text-gray-300 hover:border-cyan-500/50"
              >
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="flex gap-2">
            {project.github_link && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-gray-600 hover:border-cyan-500/50 hover:bg-cyan-500/10"
                onClick={() => window.open(project.github_link!, '_blank')}
              >
                <Github className="w-4 h-4 mr-2" />
                Code
              </Button>
            )}
            {project.live_link && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-gray-600 hover:border-cyan-500/50 hover:bg-cyan-500/10"
                onClick={() => window.open(project.live_link!, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Live
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};