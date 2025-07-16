import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Eye } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Article = Tables<"articles">;

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card className="group h-full bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-all duration-300">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge 
            variant="secondary" 
            className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-2"
          >
            {article.category}
          </Badge>
          {article.featured && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              Featured
            </Badge>
          )}
        </div>
        <CardTitle className="text-xl mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2">
          {article.title}
        </CardTitle>
        <CardDescription className="text-gray-400 line-clamp-3">
          {article.excerpt}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(article.created_at!)}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.read_time}
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {article.view_count || 0}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {article.tags?.slice(0, 3).map((tag, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="border-gray-600 text-gray-300 hover:border-cyan-500/50"
              >
                {tag}
              </Badge>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full border-gray-600 hover:border-cyan-500/50 hover:bg-cyan-500/10"
          >
            Read More
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};