import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, ArrowRight, Code, Zap, TrendingUp, LucideIcon } from 'lucide-react';
import { useAnalytics } from './Analytics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CaseStudyDB {
  id: string;
  title: string;
  category: string;
  description: string;
  challenge: string | null;
  solution: string | null;
  results: string[];
  technologies: string[];
  icon_name: string;
  gradient: string;
  link: string | null;
  display_order: number;
}

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  Code,
  Zap,
  TrendingUp,
};

const CaseStudies = () => {
  const { trackClick } = useAnalytics();

  // Fetch case studies from database
  const { data: caseStudies = [], isLoading } = useQuery({
    queryKey: ['case-studies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_studies')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as CaseStudyDB[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  if (isLoading) {
    return (
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8" role="status" aria-label="Loading case studies">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 max-w-full mx-auto" />
          </div>
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    <Skeleton className="lg:w-1/3 h-48 lg:h-80" />
                    <div className="lg:w-2/3 p-6 sm:p-8 space-y-4">
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-6 w-14" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (caseStudies.length === 0) {
    return null;
  }

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-primary">
            Case Studies
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Real projects, real results. Here's how I've helped clients achieve their goals with innovative solutions.
          </p>
        </div>

        {/* Case Studies Grid */}
        <div className="space-y-8 sm:space-y-12">
          {caseStudies.map((study, index) => {
            const IconComponent = iconMap[study.icon_name] || Code;
            return (
              <Card
                key={study.id}
                className={`group hover:shadow-2xl transition-all duration-500 bg-card/50 border-border overflow-hidden ${
                  index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Visual/Icon Section */}
                    <div className={`lg:w-1/3 p-8 sm:p-12 bg-gradient-to-br ${study.gradient} flex items-center justify-center relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/10"></div>
                      <div className="relative text-center text-white">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                          <IconComponent className="w-10 h-10" />
                        </div>
                        <p className="text-lg font-semibold">{study.category}</p>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="lg:w-2/3 p-6 sm:p-8">
                      <div className="mb-6">
                        <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">
                          {study.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {study.description}
                        </p>
                      </div>

                      <div className="space-y-4 mb-6">
                        {study.challenge && (
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Challenge</h4>
                            <p className="text-sm text-muted-foreground">{study.challenge}</p>
                          </div>
                        )}
                        {study.solution && (
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Solution</h4>
                            <p className="text-sm text-muted-foreground">{study.solution}</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        {study.results && study.results.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-foreground mb-3">Key Results</h4>
                            <ul className="space-y-2">
                              {study.results.map((result, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground flex items-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2 flex-shrink-0"></div>
                                  {result}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {study.technologies && study.technologies.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-foreground mb-3">Technologies</h4>
                            <div className="flex flex-wrap gap-2">
                              {study.technologies.map((tech, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {study.link && (
                        <Button variant="outline" className="group" asChild>
                          <a href={study.link} target="_blank" rel="noopener noreferrer">
                            View Project
                            <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12 sm:mt-16">
          <Button
            size="lg"
            onClick={() => {
              trackClick('Discuss Your Project CTA', 'Case Studies');
              window.location.href = '/connect';
            }}
            className="btn-futuristic"
          >
            Discuss Your Project
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;
