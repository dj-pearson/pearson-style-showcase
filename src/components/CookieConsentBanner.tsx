import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, Shield, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  acceptAll,
  rejectAll,
  setConsent,
  getStoredConsent,
  hasStoredConsent,
} from '@/lib/consent';
import { OPEN_PREFERENCES_EVENT } from '@/lib/cookie-preferences';

/**
 * GDPR / CCPA compliant cookie consent banner.
 *
 * - Shows on first visit (and after a consent-version bump) with equally
 *   weighted "Accept all" and "Reject all" actions (GDPR requires rejecting to
 *   be as easy as accepting).
 * - "Customize" opens a preferences dialog for granular, category-level choice.
 * - Nothing optional is loaded until a choice is made — Google Consent Mode is
 *   defaulted to "denied" in index.html, and this component only ever *grants*.
 * - Once a decision exists the banner stays hidden; users can re-open
 *   preferences any time from the Cookie Policy / footer via the
 *   `openCookiePreferences()` custom event.
 * - While visible it publishes its height as --cookie-banner-offset on <html>
 *   so other bottom-right fixed controls (the accessibility button, the
 *   scroll-to-top button) can sit above it instead of covering its buttons.
 */

// CSS custom property read by other fixed bottom-right controls.
export const COOKIE_BANNER_OFFSET_VAR = '--cookie-banner-offset';

// Upper bound on how long the banner waits for web fonts before showing.
const FONT_WAIT_MS = 3000;

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [functional, setFunctional] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Decide initial visibility after mount (avoids SSR/hydration mismatch and
  // keeps the banner out of the critical render path).
  //
  // The banner is bottom-anchored, so any change in its height moves its
  // contents. Showing it before Inter has loaded meant the paragraph rewrapped
  // when the font swapped in, the banner grew, and everything in it jumped up:
  // that was the CLS the audit attributed to the banner. Waiting for
  // document.fonts.ready (capped) means it first paints at its final size.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!hasStoredConsent()) {
      const show = () => {
        if (!cancelled) setVisible(true);
      };
      const fontsReady = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
      if (fontsReady) {
        timer = setTimeout(show, FONT_WAIT_MS);
        fontsReady.then(show, show);
      } else {
        show();
      }
    }
    const openHandler = () => {
      const stored = getStoredConsent();
      setAnalytics(stored?.analytics ?? false);
      setFunctional(stored?.functional ?? false);
      setDialogOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, openHandler);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_PREFERENCES_EVENT, openHandler);
    };
  }, []);

  // Publish the banner's height so bottom-right controls can clear it.
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!visible || !el) {
      root.style.removeProperty(COOKIE_BANNER_OFFSET_VAR);
      return;
    }
    const update = () => root.style.setProperty(COOKIE_BANNER_OFFSET_VAR, `${el.offsetHeight}px`);
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(COOKIE_BANNER_OFFSET_VAR);
    };
  }, [visible]);

  const handleAcceptAll = () => {
    acceptAll();
    setVisible(false);
    setDialogOpen(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setVisible(false);
    setDialogOpen(false);
  };

  const handleSavePreferences = () => {
    setConsent({ analytics, functional });
    setVisible(false);
    setDialogOpen(false);
  };

  const openCustomize = () => {
    const stored = getStoredConsent();
    setAnalytics(stored?.analytics ?? false);
    setFunctional(stored?.functional ?? false);
    setDialogOpen(true);
  };

  if (!visible && !dialogOpen) return null;

  return (
    <>
      {visible && (
        <div
          ref={bannerRef}
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[9998] p-3 sm:p-4"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="container mx-auto max-w-5xl rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl shadow-black/20 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cookie className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">We value your privacy</p>
                  <p className="leading-relaxed">
                    We use necessary cookies to make this site work. With your consent, we also use
                    analytics cookies to understand how the site is used. You can accept, reject, or
                    choose what to allow. Read our{' '}
                    <Link
                      to="/cookies"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Cookie Policy
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/privacy"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
                <Button variant="outline" onClick={openCustomize} className="sm:min-w-[110px]">
                  Customize
                </Button>
                <Button variant="outline" onClick={handleRejectAll} className="sm:min-w-[110px]">
                  Reject all
                </Button>
                <Button onClick={handleAcceptAll} className="sm:min-w-[110px]">
                  Accept all
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5 text-primary" aria-hidden="true" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Choose which categories of cookies you allow. You can change this at any time from the
              Cookie Policy page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Necessary - always on */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-foreground">Strictly necessary</p>
                  <p className="text-sm text-muted-foreground">
                    Required for security, core functionality, and remembering your consent choice.
                    Always active.
                  </p>
                </div>
              </div>
              <Switch checked disabled aria-label="Strictly necessary cookies (always on)" />
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <BarChart3
                  className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-foreground">Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    Google Analytics helps us understand which pages are visited so we can improve
                    the site. IP addresses are anonymized.
                  </p>
                </div>
              </div>
              <Switch
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-label="Allow analytics cookies"
              />
            </div>

            {/* Functional */}
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Sparkles
                  className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-foreground">Functional</p>
                  <p className="text-sm text-muted-foreground">
                    Enables optional enhancements and diagnostic session replay used to reproduce
                    and fix errors you may encounter.
                  </p>
                </div>
              </div>
              <Switch
                checked={functional}
                onCheckedChange={setFunctional}
                aria-label="Allow functional cookies"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleRejectAll} className="sm:mr-auto">
              Reject all
            </Button>
            <Button variant="outline" onClick={handleAcceptAll}>
              Accept all
            </Button>
            <Button onClick={handleSavePreferences}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsentBanner;
