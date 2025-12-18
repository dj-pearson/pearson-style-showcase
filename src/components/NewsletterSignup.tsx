import * as React from 'react';
import { logger } from "@/lib/logger";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type NewsletterFormData = z.infer<typeof newsletterSchema>;

const NewsletterSignup = () => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
  });

  const onSubmit = async (data: NewsletterFormData) => {
    setIsSubmitting(true);
    
    try {
      const { data: result, error } = await invokeEdgeFunction('newsletter-signup', {
        body: { email: data.email }
      });

      if (error) {
        logger.error('Newsletter signup error:', error);
        throw new Error(error.message || 'Failed to subscribe');
      }
      
      toast({
        title: "Successfully subscribed!",
        description: result.message || "Thank you for subscribing. Check your inbox for a welcome email!",
      });
      
      reset();
    } catch (error) {
      logger.error('Newsletter signup failed:', error);
      toast({
        title: "Subscription failed",
        description: error instanceof Error ? error.message : "Please try again later or contact me directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold mb-2">Stay Updated</h3>
          <p className="text-muted-foreground">
            Get notified about new projects, AI insights, and business development tips.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Enter your email address"
                {...register('email')}
                disabled={isSubmitting}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="whitespace-nowrap"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  Subscribe
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            No spam. Unsubscribe at any time. Your privacy is important to me.
          </p>
        </form>
      </CardContent>
    </Card>
  );
import { invokeEdgeFunction } from '@/lib/edge-functions';
};

export default NewsletterSignup;