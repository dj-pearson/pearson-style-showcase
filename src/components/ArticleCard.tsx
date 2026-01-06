import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Eye } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { OptimizedImage } from "@/components/OptimizedImage";

type Article = Tables<"articles">;

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="group h-full bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden">
      {/* Featured Image - Responsive with lazy loading */}
      {article.image_url && (
        <div className="relative aspect-video overflow-hidden" aria-hidden="true">
          <OptimizedImage
            src={article.image_url}
            alt=""
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            width={800}
            height={450}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {article.featured && (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 bg-yellow-500/90 text-yellow-900 border-yellow-500 text-xs"
            >
              Featured
            </Badge>
          )}
        </div>
      )}

      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <Badge
            variant="secondary"
            className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs"
          >
            {article.category}
          </Badge>
          {!article.image_url && article.featured && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
              Featured
            </Badge>
          )}
        </div>
        <Link to={`/news/${article.slug}`}>
          <CardTitle className="text-base sm:text-lg md:text-xl mb-1 sm:mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-tight">
            {article.title}
          </CardTitle>
        </Link>
        <CardDescription className="text-gray-400 line-clamp-2 sm:line-clamp-3 text-sm leading-relaxed">
          {article.excerpt}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 pt-0">
        <div className="space-y-3 sm:space-y-4">
          {/* Meta info - Mobile optimized with wrapping */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{formatDate(article.created_at!)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span>{article.read_time}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
              <span>{article.view_count || 0}</span>
            </div>
          </div>

          {/* Tags - Mobile optimized */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {article.tags?.slice(0, 3).map((tag, index) => (
              <Badge
                key={index}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:border-cyan-500/50 text-xs px-2 py-0.5"
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Read More Button - Touch-optimized */}
          <Link
            to={`/news/${article.slug}`}
            className="inline-flex items-center justify-center w-full min-h-[44px] h-10 sm:h-9 px-3 text-sm font-medium rounded-md border border-gray-600 bg-transparent hover:border-cyan-500/50 hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Read More
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};