import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
    
    try {
      // Simulate progressive form submission with analytics
      setSubmitProgress(25);
      
      // Track form submission attempt
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'form_start', {
          event_category: 'Contact',
          event_label: 'Contact Form Submission Started'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setSubmitProgress(50);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      setSubmitProgress(75);
      
      // Simulate final processing
      await new Promise(resolve => setTimeout(resolve, 400));
      setSubmitProgress(100);
      
      // Track successful submission
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'form_submit', {
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
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'form_error', {
          event_category: 'Contact',
          event_label: 'Contact Form Submission Failed'
        });
      }
      
      toast({
        title: "Error sending message",
        description: "Please try again or contact me directly via email.",
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
      <div className="bg-card border rounded-lg p-5 sm:p-6">
        {/* Form Completion Indicator */}
        <div className="mb-5 sm:mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg sm:text-xl font-semibold">Send a Message</h3>
            <span className="text-xs sm:text-sm text-muted-foreground">{completionPercentage()}% complete</span>
          </div>
          <Progress value={completionPercentage()} className="h-2" />
        </div>
        
        {/* Submission Progress */}
        {isSubmitting && (
          <div className="mb-5 sm:mb-6 p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              <span className="text-sm font-medium">Sending your message...</span>
            </div>
            <Progress value={submitProgress} className="h-2" />
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your full name" 
                      {...field}
                      disabled={isSubmitting}
                      className="min-h-[48px] text-base"
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
                  <FormLabel className="text-base">Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="your.email@example.com" 
                      {...field}
                      disabled={isSubmitting}
                      className="min-h-[48px] text-base"
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
                  <FormLabel className="text-base">Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="What's this about?" 
                      {...field}
                      disabled={isSubmitting}
                      className="min-h-[48px] text-base"
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
                  <FormLabel className="text-base">Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell me about your project or question..."
                      className="min-h-[140px] resize-none text-base"
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
              className="w-full min-h-[48px] sm:min-h-[52px] text-base"
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