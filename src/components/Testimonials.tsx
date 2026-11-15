import { useQuery } from '@tanstack/react-query';
import { publicDb } from '@/integrations/supabase/public-client';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';

interface Testimonial {
  id: string;
  client_name: string;
  client_title: string | null;
  client_company: string | null;
  client_photo_url: string | null;
  testimonial_text: string;
  rating: number | null;
  project_type: string | null;
  featured: boolean;
}

const Testimonials = () => {
  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const { data, error } = await publicDb
        .from('testimonials')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as Testimonial[];
    },
  });

  // No heading over an empty grid: while loading, on error, or with nothing
  // published, the whole section stays out of the page.
  if (isLoading || !testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="mobile-section mobile-container animate-section pointer-events-auto">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="mobile-heading-lg text-primary mb-4">What Clients Say</h2>
          <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
            Don't just take my word for it. Here's what people I've worked with have to say.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="group hover:shadow-2xl transition-all duration-500 bg-card/50 border-border hover:border-primary/30 relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 text-primary/20 group-hover:text-primary/40 transition-colors">
                <Quote className="w-12 h-12" />
              </div>

              <CardContent className="mobile-card relative">
                {/* Rating */}
                {testimonial.rating && (
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    ))}
                  </div>
                )}

                {/* Testimonial Text */}
                <p className="text-base text-muted-foreground leading-relaxed mb-6 relative z-10">
                  "{testimonial.testimonial_text}"
                </p>

                {/* Client Info */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  {testimonial.client_photo_url ? (
                    <img
                      src={testimonial.client_photo_url}
                      alt={testimonial.client_name}
                      loading="lazy"
                      decoding="async"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/20">
                      <span className="text-lg font-bold text-primary">
                        {testimonial.client_name.charAt(0)}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {testimonial.client_name}
                    </p>
                    {testimonial.client_title && (
                      <p className="text-sm text-muted-foreground truncate">
                        {testimonial.client_title}
                        {testimonial.client_company && ` at ${testimonial.client_company}`}
                      </p>
                    )}
                    {testimonial.project_type && (
                      <p className="text-xs text-primary mt-1">{testimonial.project_type}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
