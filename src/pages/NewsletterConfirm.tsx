import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { trackNewsletterConfirmed } from '@/components/Analytics';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';

type State = 'confirming' | 'confirmed' | 'expired' | 'invalid' | 'error';

const COPY: Record<Exclude<State, 'confirming'>, { heading: string; body: string }> = {
  confirmed: {
    heading: "You're subscribed.",
    body: "The welcome note is on its way. After that, you'll hear from me when a new teardown or guide goes up.",
  },
  expired: {
    heading: 'That link has expired.',
    body: 'Sign up again on the homepage.',
  },
  invalid: {
    heading: "That link doesn't work.",
    body: 'It may have been copied incompletely, or replaced by a newer one. Sign up again on the homepage.',
  },
  error: {
    heading: "That didn't go through.",
    body: 'Something failed on my end. Reload this page in a minute to try again.',
  },
};

/**
 * Landing page for the link in the double opt-in email. The token goes to the
 * newsletter-confirm function by POST; a GET of this page alone changes
 * nothing, so link scanners that only fetch the URL can't confirm anyone.
 */
const NewsletterConfirm = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(token ? 'confirming' : 'invalid');
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    invokeEdgeFunction<{ status?: string }>('newsletter-confirm', { body: { token } })
      .then(({ data, error }) => {
        if (error) throw error;
        const status = data?.status;
        // The lead counts here, once the address is confirmed, not at signup.
        if (status === 'confirmed') trackNewsletterConfirmed();
        setState(status === 'confirmed' || status === 'expired' ? status : 'invalid');
      })
      .catch((error) => {
        logger.error('Newsletter confirmation failed:', error);
        setState('error');
      });
  }, [token]);

  const copy = state === 'confirming' ? null : COPY[state];
  const offerHome = state === 'expired' || state === 'invalid';

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Confirm your subscription | Dan Pearson"
        description="Confirm your subscription to Dan Pearson's pipeline notes."
        url="https://danpearson.net/newsletter/confirm"
        noIndex={true}
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-24 sm:pt-28 pb-16 px-4">
        <div className="mx-auto max-w-xl" role="status" aria-live="polite">
          {copy ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {copy.heading}
              </h1>
              <p className="text-muted-foreground mb-6">{copy.body}</p>
              <Link to="/" className="text-primary underline underline-offset-4 hover:no-underline">
                {offerHome ? 'Go to the homepage' : 'Back to danpearson.net'}
              </Link>
            </>
          ) : (
            <p className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              Confirming your subscription...
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NewsletterConfirm;
