import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';

// Type for gtag analytics
type WindowWithGtag = Window & {
  gtag?: (...args: unknown[]) => void;
};

const contactSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .email('Please enter a valid email address')
    .max(100, 'Email must be less than 100 characters'),
  subject: z.string()
    .min(5, 'Subject must be at least 5 characters')
    .max(100, 'Subject must be less than 100 characters'),
  message: z.string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  // Enhanced form completion tracking
  const watchedFields = form.watch();
  const completionPercentage = useCallback(() => {
    const fields = Object.values(watchedFields);
    const completedFields = fields.filter(field => field && field.length > 0).length;
    return Math.round((completedFields / fields.length) * 100);
  }, [watchedFields]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitProgress(0);

    const windowWithGtag = window as WindowWithGtag;

    try {
      // Track form submission attempt
      if (typeof window !== 'undefined' && windowWithGtag.gtag) {
        windowWithGtag.gtag('event', 'form_start', {
          event_category: 'Contact',
          event_label: 'Contact Form Submission Started'
        });
      }
      
      setSubmitProgress(25);

      // Send email via edge function
      const { error } = await supabase.functions.invoke(
        "send-contact-email",
        {
          body: {
            name: data.name,
            email: data.email,
            subject: data.subject,
            message: data.message,
          },
        }
      );

      setSubmitProgress(100);

      if (error) {
        throw error;
      }
      
      // Track successful submission
      if (typeof window !== 'undefined' && windowWithGtag.gtag) {
        windowWithGtag.gtag('event', 'form_submit', {
          event_category: 'Contact',
          event_label: 'Contact Form Submitted Successfully',
          value: 1
        });
      }
      
      toast({
        title: "Message sent successfully!",
        description: "Thank you for reaching out. I'll get back to you within 24 hours.",
        action: <CheckCircle className="w-5 h-5 text-green-500" />,
      });
      
      form.reset();
    } catch (error) {
      // Track failed submission
      if (typeof window !== 'undefined' && windowWithGtag.gtag) {
        windowWithGtag.gtag('event', 'form_error', {
          event_category: 'Contact',
          event_label: 'Contact Form Submission Failed'
        });
      }

      toast({
        title: "Error sending message",
        description: error instanceof Error ? error.message : "Please try again or contact me directly via email.",
        variant: "destructive",
        action: <AlertCircle className="w-5 h-5 text-red-500" />,
      });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mobile-card bg-card border rounded-xl">
        {/* Form Completion Indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="mobile-heading-sm">Send a Message</h3>
            <span className="text-sm text-muted-foreground font-medium">{completionPercentage()}% complete</span>
          </div>
          <Progress value={completionPercentage()} className="h-2.5" />
        </div>

        {/* Submission Progress */}
        {isSubmitting && (
          <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
              <span className="text-base font-medium">Sending your message...</span>
            </div>
            <Progress value={submitProgress} className="h-2.5" />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      {...field}
                      disabled={isSubmitting}
                      className="mobile-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your.email@example.com"
                      {...field}
                      disabled={isSubmitting}
                      className="mobile-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What's this about?"
                      {...field}
                      disabled={isSubmitting}
                      className="mobile-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell me about your project or question..."
                      className="min-h-[140px] sm:min-h-[160px] resize-none text-base"
                      style={{ fontSize: '16px' }}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="mobile-button text-base sm:text-lg font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ContactForm;