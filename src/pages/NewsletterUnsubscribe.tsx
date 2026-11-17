import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';

type State = 'working' | 'done' | 'failed';

/**
 * Landing page for the unsubscribe link in newsletter email. It POSTs the
 * signed token to newsletter-unsubscribe; the function never acts on a GET.
 */
const NewsletterUnsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(token ? 'working' : 'failed');
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    invokeEdgeFunction('newsletter-unsubscribe', { body: { token } })
      .then(({ error }) => {
        if (error) throw error;
        setState('done');
      })
      .catch((error) => {
        logger.error('Newsletter unsubscribe failed:', error);
        setState('failed');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Unsubscribe | Dan Pearson"
        description="Unsubscribe from Dan Pearson's pipeline notes."
        url="https://danpearson.net/newsletter/unsubscribe"
        noIndex={true}
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-24 sm:pt-28 pb-16 px-4">
        <div className="mx-auto max-w-xl" role="status" aria-live="polite">
          {state === 'working' && (
            <p className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              Unsubscribing...
            </p>
          )}
          {state === 'done' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                You&apos;re off the list.
              </h1>
              <p className="text-muted-foreground mb-6">
                No more newsletter email will go to this address. If you change your mind, sign up
                again on the homepage.
              </p>
              <Link to="/" className="text-primary underline underline-offset-4 hover:no-underline">
                Back to danpearson.net
              </Link>
            </>
          )}
          {state === 'failed' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                That unsubscribe link didn&apos;t work.
              </h1>
              <p className="text-muted-foreground">
                Reply to any newsletter email, or write to{' '}
                <a
                  href="mailto:dan@danpearson.net?subject=Unsubscribe"
                  className="text-primary underline underline-offset-4 hover:no-underline"
                >
                  dan@danpearson.net
                </a>
                , and I&apos;ll take you off by hand.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NewsletterUnsubscribe;
