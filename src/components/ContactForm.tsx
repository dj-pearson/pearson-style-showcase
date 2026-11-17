import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';
import { useAnalytics } from '@/components/Analytics';

/*
 * Letters from any script, plus the combining marks that accented and
 * non-Latin names are built from, and the four separators real names use:
 * space, hyphen, apostrophe (straight and the curly one phone keyboards
 * insert), and the period in an initial.
 *
 * The previous rule was /^[a-zA-Z\s]+$/, which rejected O'Brien, Mary-Jane,
 * Jose Garcia spelled with its accent, and every name not written in Latin
 * letters - people who then had no way to send a message at all.
 */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'\u2019.-]*$/u;

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(NAME_PATTERN, 'Name must start with a letter and contain no digits or symbols'),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(100, 'Email must be less than 100 characters'),
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(100, 'Subject must be less than 100 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

// The address the rest of the site publishes (Footer, Connect, AuthorByline).
const CONTACT_EMAIL = 'dan@danpearson.net';

const ContactForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const startTracked = useRef(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const { trackContactForm } = useAnalytics();

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
    const completedFields = fields.filter((field) => field && field.length > 0).length;
    return Math.round((completedFields / fields.length) * 100);
  }, [watchedFields]);

  // "start" means someone began filling the form in, not that they pressed
  // submit; fire it once, on the first field that takes focus.
  const handleFirstFocus = () => {
    if (startTracked.current) return;
    startTracked.current = true;
    trackContactForm('start');
  };

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitError(false);
    trackContactForm('submit');

    try {
      const { error } = await invokeEdgeFunction('send-contact-email', {
        body: {
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
        },
      });

      if (error) {
        throw error;
      }

      trackContactForm('success');
      setSentTo(data.email);
    } catch (error) {
      // The raw error is for the log; the reader gets a way to reach me.
      logger.error('Contact form submission failed:', error);
      trackContactForm('failure');
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The confirmation replaces a form the reader may have scrolled well past
  // on a phone, and the button that had focus is gone. Move focus to the new
  // heading and bring it into view so neither keyboard nor touch users are
  // left looking at the page footer.
  useEffect(() => {
    if (!sentTo) return;
    const heading = sentHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'center' });
  }, [sentTo]);

  // One live region that stays mounted for the component's lifetime. A region
  // inserted together with its text is often not announced at all, so the
  // text changes here instead.
  const statusMessage = sentTo
    ? `Message sent. I'll reply to ${sentTo} within one business day.`
    : isSubmitting
      ? 'Sending your message...'
      : '';
  const liveRegion = (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {statusMessage}
    </p>
  );

  if (sentTo) {
    return (
      <div className="max-w-lg mx-auto">
        {liveRegion}
        <div className="mobile-card bg-card border rounded-xl">
          <CheckCircle className="w-10 h-10 text-primary mb-4" aria-hidden="true" />
          <h2
            ref={sentHeadingRef}
            tabIndex={-1}
            className="mobile-heading-sm mb-2 focus:outline-none"
          >
            Message sent.
          </h2>
          <p className="text-base text-muted-foreground">
            I&apos;ll reply to <span className="font-medium text-foreground">{sentTo}</span> within
            one business day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {liveRegion}
      <div className="mobile-card bg-card border rounded-xl">
        {/* Form Completion Indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="mobile-heading-sm">Send a Message</h2>
            <span className="text-sm text-muted-foreground font-medium">
              {completionPercentage()}% complete
            </span>
          </div>
          <Progress
            value={completionPercentage()}
            className="h-2.5"
            aria-label="Form completion progress"
          />
        </div>

        {/* Sending. The bar that used to sit here jumped to 25% on submit and
            100% on response, which measured nothing - the request has no
            progress to report. A spinner says the same thing honestly. */}
        {isSubmitting && (
          <div
            aria-hidden="true"
            className="mb-6 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <Loader2
              className="w-5 h-5 animate-spin text-primary flex-shrink-0"
              aria-hidden="true"
            />
            <span className="text-base font-medium">Sending your message...</span>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onFocusCapture={handleFirstFocus}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      autoComplete="name"
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
                      autoComplete="email"
                      spellCheck={false}
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
                      className="min-h-[140px] sm:min-h-[160px] resize-none"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
              >
                <AlertCircle
                  className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p>
                  Your message didn&apos;t go through. Try again, or email me at{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            )}

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

            <p className="text-xs text-muted-foreground text-center">
              We use the details you provide only to respond to your message. See our{' '}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
                Privacy Policy
              </Link>{' '}
              for how we handle your information.
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ContactForm;
