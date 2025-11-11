import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Github, Rocket, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Venture {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  screenshot_url: string | null;
  tech_stack: string[];
  status: string;
  live_url: string | null;
  github_url: string | null;
  metrics: Record<string, any> | null;
  featured: boolean;
  launch_date: string | null;
}

const statusColors = {
  planning: 'bg-gray-500',
  'in-development': 'bg-yellow-500',
  beta: 'bg-blue-500',
  live: 'bg-green-500',
  maintenance: 'bg-orange-500',
  archived: 'bg-gray-400'
};

const statusLabels = {
  planning: 'Planning',
  'in-development': 'In Development',
  beta: 'Beta',
  live: 'Live',
  maintenance: 'Maintenance',
  archived: 'Archived'
};

const CurrentVentures = () => {
  const { data: ventures, isLoading } = useQuery({
    queryKey: ['ventures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventures' as any)
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Venture[];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton w-full h-96 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!ventures || ventures.length === 0) {
    return (
      <div className="text-center py-12">
        <Rocket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">
          Currently building exciting new platforms. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Featured ventures in grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {ventures.filter(v => v.featured).map((venture) => (
          <VentureCard key={venture.id} venture={venture} featured />
        ))}
      </div>

      {/* Non-featured ventures in smaller grid */}
      {ventures.filter(v => !v.featured).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ventures.filter(v => !v.featured).map((venture) => (
            <VentureCard key={venture.id} venture={venture} />
          ))}
        </div>
      )}
    </div>
  );
};

const VentureCard = ({ venture, featured = false }: { venture: Venture; featured?: boolean }) => {
  return (
    <Card className={`group hover:shadow-2xl transition-all duration-500 bg-card/50 border-border hover:border-primary/50 overflow-hidden ${featured ? 'md:col-span-1' : ''}`}>
      <CardContent className="p-0">
        {/* Screenshot/Logo */}
        {venture.screenshot_url && (
          <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
            <img
              src={venture.screenshot_url}
              alt={venture.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 right-3">
              <Badge className={`${statusColors[venture.status as keyof typeof statusColors]} text-white`}>
                {statusLabels[venture.status as keyof typeof statusLabels]}
              </Badge>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                {venture.name}
              </h3>
              {venture.tagline && (
                <p className="text-sm text-muted-foreground italic">
                  {venture.tagline}
                </p>
              )}
            </div>
            {venture.logo_url && (
              <img
                src={venture.logo_url}
                alt={`${venture.name} logo`}
                className="w-10 h-10 rounded object-contain"
              />
            )}
          </div>

          {venture.description && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3">
              {venture.description}
            </p>
          )}

          {/* Tech Stack */}
          {venture.tech_stack && venture.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {venture.tech_stack.slice(0, 4).map((tech, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-primary/10 text-primary border border-primary/20"
                >
                  {tech}
                </span>
              ))}
              {venture.tech_stack.length > 4 && (
                <span className="px-2 py-1 text-xs text-muted-foreground">
                  +{venture.tech_stack.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Metrics */}
          {venture.metrics && Object.keys(venture.metrics).length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-primary" />
              {Object.entries(venture.metrics).slice(0, 2).map(([key, value]) => (
                <span key={key}>
                  <span className="font-semibold text-foreground">{value}</span> {key.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2">
            {venture.live_url && (
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => window.open(venture.live_url!, '_blank')}
              >
                Visit Site
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
            {venture.github_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(venture.github_url!, '_blank')}
              >
                <Github className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrentVentures;
