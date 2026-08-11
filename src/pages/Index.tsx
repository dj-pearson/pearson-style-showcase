import { lazy, Suspense, useRef, useEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import HeroErrorBoundary from '../components/HeroErrorBoundary';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import StructuredData from '../components/SEO/StructuredData';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PIPELINE_AUTOMATION_LADDER, SERVICE_TIERS, THESIS } from '@/lib/crm-automation';
import { useAnalytics } from '../components/Analytics';
import { shouldSuppressForOddTraffic } from '@/lib/traffic-detection';
import { useAccessibility } from '@/contexts/AccessibilityContext';

// Lazy load below-the-fold components to improve FID
const CaseStudies = lazy(() => import('../components/CaseStudies'));
const NewsletterSignup = lazy(() => import('../components/NewsletterSignup'));
const Testimonials = lazy(() => import('../components/Testimonials'));
const CurrentVentures = lazy(() => import('../components/CurrentVentures'));
const AuthoritySection = lazy(() => import('../components/homepage/AuthoritySection'));
const FAQSection = lazy(() => import('../components/homepage/FAQSection'));
const Interactive3DOrb = lazy(() =>
  import('../components/Interactive3DOrb').then((module) => ({ default: module.Interactive3DOrb }))
);

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

/**
 * Check if user prefers reduced motion or is on a low-performance device
 */
function shouldDisableHeavyAnimations(): boolean {
  if (typeof window === 'undefined') return false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const connection = (navigator as any).connection;
  const isSlowConnection =
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g';

  return prefersReducedMotion || isSlowConnection;
}

const Index = () => {
  const { trackCTA } = useAnalytics();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [shouldLoadOrb, setShouldLoadOrb] = useState(false);
  const { preferences } = useAccessibility();

  // Check if heavy animations should be disabled. This honors the OS-level
  // reduced-motion setting, the in-app "Reduce Motion" widget toggle, and
  // flagged "odd traffic" (e.g. bot floods) — the expensive 3D orb / WebGL
  // context is skipped entirely in any of those cases. Re-evaluates when the
  // in-app preference changes so toggling it live unmounts the orb.
  const disableHeavyAnimations = useMemo(
    () =>
      preferences.reducedMotion || shouldDisableHeavyAnimations() || shouldSuppressForOddTraffic(),
    [preferences.reducedMotion]
  );

  useEffect(() => {
    // Skip 3D orb entirely if user prefers reduced motion
    if (disableHeavyAnimations) {
      return;
    }

    // Use requestIdleCallback to load 3D orb during browser idle time
    // This prevents blocking the main thread during critical rendering
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadOrb = () => {
      setShouldLoadOrb(true);
    };

    if ('requestIdleCallback' in window) {
      // Load during idle time, with 1.5s timeout as fallback
      idleCallbackId = (window as any).requestIdleCallback(loadOrb, { timeout: 1500 });
    } else {
      // Fallback for Safari - use setTimeout
      timeoutId = setTimeout(loadOrb, 500);
    }

    return () => {
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [disableHeavyAnimations]);

  useGSAP(
    () => {
      if (!mainRef.current) return;

      // Hero Exit Animation
      // As user scrolls down, Hero content fades out and scales down (zooms out)
      gsap.to(heroRef.current, {
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom center',
          scrub: 1,
        },
        opacity: 0,
        scale: 0.8,
        ease: 'power1.inOut',
      });

      // Sections Entry Animation (Zoom Out / Settle effect)
      // Select all direct section children of the content wrapper
      const sections = gsap.utils.toArray<HTMLElement>('.animate-section');

      sections.forEach((section) => {
        gsap.fromTo(
          section,
          {
            opacity: 0,
            scale: 1.1,
            y: 50,
          },
          {
            scrollTrigger: {
              trigger: section,
              start: 'top 85%', // Start animation when top of section hits 85% of viewport
              end: 'top 50%',
              scrub: 1,
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1,
            ease: 'power2.out',
          }
        );
      });
    },
    { scope: mainRef }
  );

  return (
    <div ref={mainRef} className="min-h-screen flex flex-col relative bg-background">
      {/* Fixed 3D Background - Interactive (skipped for reduced motion/low performance) */}
      <div className="fixed inset-0 z-0" aria-hidden="true" role="presentation">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-secondary/20 z-10 pointer-events-none"></div>
        {shouldLoadOrb && !disableHeavyAnimations && (
          <div
            className="absolute inset-0 z-0"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '100vw 100vh' }}
          >
            <HeroErrorBoundary>
              <Suspense
                fallback={
                  <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/10">
                    <div className="absolute inset-0 animate-pulse opacity-30 bg-gradient-radial from-primary/20 via-transparent to-transparent" />
                  </div>
                }
              >
                <Interactive3DOrb />
              </Suspense>
            </HeroErrorBoundary>
          </div>
        )}
      </div>
      <SEO
        title="AI CRM Automation Consultant | Make Your CRM Run Itself | Dan Pearson"
        description="AI CRM automation for revenue teams under 50 seats. Most AI CRM projects fail because they automate the reporting layer instead of the capture layer — I fix capture first, so sellers stop doing data entry and the pipeline stops lying. Based in Des Moines, working nationwide."
        keywords="AI CRM automation, CRM automation consultant, AI CRM consultant, CRM automation audit, HubSpot automation consultant, Salesforce automation, agentic CRM, sales pipeline automation, CRM data quality, fractional RevOps engineer, AI consultant Des Moines"
        url="https://danpearson.net"
        type="website"
        contentSummary="Dan Pearson is an AI CRM automation consultant based in Des Moines, Iowa, working with sales-led revenue teams of 5-50 seats nationwide. His central argument is that most AI CRM projects fail because they automate the reporting layer instead of the capture layer. He publishes the Pipeline Automation Ladder, a five-rung CRM automation maturity model, and a 12-point CRM automation audit methodology. He has 15+ years in sales leadership and has shipped seven SaaS platforms under Pearson Media LLC."
        citationSource="Dan Pearson - AI CRM Automation Consultant"
      />

      {/* Enhanced Person Schema for AI Citation */}
      <StructuredData
        type="person"
        data={{
          name: 'Dan Pearson',
          jobTitle: 'AI CRM Automation Consultant',
          description:
            'AI CRM automation consultant working with sales-led revenue teams of 5-50 seats. Automates the capture layer of the CRM — call logging, note generation, enrichment, routing and stage-change evidence — so pipeline data stays trustworthy. 15+ years in sales leadership and seven SaaS platforms shipped under Pearson Media LLC.',
          url: 'https://danpearson.net',
          email: 'dan@danpearson.net',
          sameAs: ['https://linkedin.com/in/danpearson', 'https://github.com/dj-pearson'],
          knowsAbout: [
            'AI CRM Automation',
            'CRM Data Quality',
            'Sales Pipeline Automation',
            'Revenue Operations',
            'AI Agents for Sales',
            'HubSpot Automation',
            'Salesforce Automation',
            'Business Process Automation',
            'SaaS Development',
            'OpenAI Integration',
            'Claude AI Integration',
            'React Development',
          ],
          worksFor: {
            '@type': 'Organization',
            name: 'Pearson Media LLC',
          },
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Des Moines',
            addressRegion: 'IA',
            addressCountry: 'US',
          },
          alumniOf: [],
          // Kept to structural facts. The revenue and client-count figures that
          // used to sit here are not awards, and they are pending substantiation
          // (see AI_CRM_AUTOMATION_STRATEGY.md §11.4) — putting unsourced
          // numbers in markup is exactly what makes an entity less citable.
          awards: [
            'Built and shipped 7 SaaS platforms under Pearson Media LLC',
            '15+ years in sales leadership before moving into automation',
          ],
        }}
      />

      {/* Website Schema */}
      <StructuredData
        type="website"
        data={{
          name: 'Dan Pearson - AI CRM Automation',
          description:
            'AI CRM automation consulting for revenue teams under 50 seats: capture-layer automation that keeps pipeline data trustworthy.',
          url: 'https://danpearson.net',
        }}
      />

      {/* Organization/Professional Service Schema */}
      <StructuredData
        type="organization"
        data={{
          name: 'Pearson Media LLC',
          email: 'dan@danpearson.net',
          phone: '',
        }}
      />

      {/* SiteNavigationElement Schema - helps search engines and AI understand site structure */}
      <StructuredData
        type="sitenavigation"
        data={{
          name: 'Main Navigation',
          items: [
            {
              name: 'Home',
              url: 'https://danpearson.net/',
              description: 'AI Business Automation Consultant',
            },
            {
              name: 'AI CRM Automation',
              url: 'https://danpearson.net/ai-crm-automation',
              description:
                'AI CRM automation consulting: the capture-layer thesis, the Pipeline Automation Ladder, the 12-point audit, and what engagements cost',
            },
            {
              name: 'About',
              url: 'https://danpearson.net/about',
              description: 'About Dan Pearson - AI CRM automation consultant and SaaS developer',
            },
            {
              name: 'Projects',
              url: 'https://danpearson.net/projects',
              description: 'AI automation projects and case studies',
            },
            {
              name: 'News',
              url: 'https://danpearson.net/news',
              description: 'Latest articles on AI automation and business',
            },
            {
              name: 'AI Tools',
              url: 'https://danpearson.net/ai-tools',
              description: 'Recommended AI tools for business',
            },
            {
              name: 'FAQ',
              url: 'https://danpearson.net/faq',
              description: 'Frequently asked questions about AI automation',
            },
            {
              name: 'Connect',
              url: 'https://danpearson.net/connect',
              description: 'Get in touch for AI consulting',
            },
          ],
        }}
      />

      {/* LocalBusiness Schema for Local SEO - improves "near me" searches and Maps visibility */}
      <StructuredData
        type="localbusiness"
        data={{
          name: 'Dan Pearson - AI CRM Automation Consulting',
          alternateName: 'Pearson Media LLC',
          description:
            'AI CRM automation consulting for sales-led revenue teams of 5-50 seats: automated call logging, note capture, enrichment, routing and stage-change evidence inside the CRM you already own. Based in Des Moines, working nationwide.',
          email: 'dan@danpearson.net',
          addressLocality: 'Des Moines',
          addressRegion: 'IA',
          addressCountry: 'US',
          priceRange: '$$',
        }}
      />

      <Navigation />
      <main id="main-content" className="relative z-10 pointer-events-none" ref={contentRef}>
        <div ref={heroRef} className="pointer-events-auto">
          <HeroErrorBoundary>
            <HeroSection />
          </HeroErrorBoundary>
        </div>

        {/* Authority Section - SEO Enhancement */}
        <div className="animate-section pointer-events-auto">
          <Suspense
            fallback={
              <div className="mobile-section text-center">
                <div className="skeleton w-full h-96"></div>
              </div>
            }
          >
            <AuthoritySection />
          </Suspense>
        </div>

        {/* The thesis — the most-quoted text on the site. Deliberately prose,
            deliberately early, deliberately not in a card. */}
        <section
          className="mobile-section mobile-container relative animate-section pointer-events-auto"
          aria-labelledby="thesis-heading"
        >
          <div className="max-w-3xl mx-auto">
            <h2 id="thesis-heading" className="mobile-heading-lg text-primary mb-6">
              Why most AI CRM projects fail
            </h2>
            <p className="text-xl sm:text-2xl text-foreground font-medium leading-snug mb-6">
              {THESIS}
            </p>
            <p className="mobile-body text-muted-foreground leading-relaxed mb-6">
              The AI reads a thin record and produces a confident answer about it. People check the
              first few, find them wrong, and quietly stop looking. That is not a model problem, and
              no amount of prompt engineering fixes it. It is a capture problem — the least
              glamorous work in the category, which is exactly why it stays unfixed.
            </p>
            <Link
              to="/ai-crm-automation"
              onClick={() => trackCTA('Read the full argument', 'Homepage thesis')}
              className="inline-flex items-center text-base font-semibold text-primary hover:underline"
            >
              Read the full argument
              <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Pipeline Automation Ladder — a progression, rendered as one */}
        <section
          className="mobile-section mobile-container relative animate-section pointer-events-auto"
          aria-labelledby="ladder-heading"
        >
          <div className="max-w-3xl mx-auto">
            <h2 id="ladder-heading" className="mobile-heading-lg text-primary mb-4">
              The Pipeline Automation Ladder
            </h2>
            <p className="mobile-body text-muted-foreground leading-relaxed mb-10">
              Five rungs. Most teams know which one they are on before I finish describing it — and
              the rule that matters is that you cannot skip rung 2.
            </p>

            <ol className="relative">
              {PIPELINE_AUTOMATION_LADDER.map((rung, index) => (
                <li key={rung.rung} className="relative pl-14 pb-8 last:pb-0">
                  {index < PIPELINE_AUTOMATION_LADDER.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-5 top-11 bottom-0 w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 flex items-center justify-center w-10 h-10 rounded-full border border-primary/40 bg-primary/10 text-primary font-bold"
                  >
                    {rung.rung}
                  </span>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-1 pt-1">
                    <span className="sr-only">Rung {rung.rung}: </span>
                    {rung.name}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{rung.reality}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Offer ladder — weighted by commitment, not three identical tiles */}
        <section
          className="mobile-section mobile-container relative animate-section pointer-events-auto"
          aria-labelledby="work-heading"
        >
          <div className="max-w-3xl mx-auto">
            <h2 id="work-heading" className="mobile-heading-lg text-primary mb-4">
              How I work
            </h2>
            <p className="mobile-body text-muted-foreground leading-relaxed mb-10">
              Three ways in, in ascending order of commitment. Prices are published on the{' '}
              <Link to="/ai-crm-automation#how-i-work" className="text-primary hover:underline">
                services page
              </Link>{' '}
              — you should not need a discovery call to find out whether I am in your range.
            </p>

            <dl className="divide-y divide-border border-y border-border">
              {SERVICE_TIERS.map((tier) => (
                <div key={tier.name} className="py-6 sm:flex sm:gap-8">
                  <dt className="sm:w-56 shrink-0 mb-2 sm:mb-0">
                    <span className="block text-lg font-semibold text-foreground">{tier.name}</span>
                    <span className="block text-sm text-primary mt-1">{tier.priceLabel}</span>
                  </dt>
                  <dd className="text-base text-muted-foreground leading-relaxed">
                    {tier.summary}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="mobile-section mobile-container relative animate-section pointer-events-auto">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30 relative overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-shadow duration-300 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
              <CardContent className="relative mobile-card sm:p-10 lg:p-12 text-center">
                <h2 className="mobile-heading-lg text-foreground mb-6">Start with the audit</h2>
                <p className="mobile-body text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Two weeks, fixed fee, and you keep the findings whether or not you build with me.
                  Tell me which CRM you are on and what your pipeline is lying about.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
                  <Button
                    size="lg"
                    className="mobile-button btn-futuristic text-base sm:text-lg font-bold"
                    onClick={() => {
                      trackCTA('Book an audit', 'Homepage CTA');
                      navigate('/connect');
                    }}
                  >
                    Book a CRM automation audit
                    <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="mobile-button text-base sm:text-lg font-semibold border-primary/50 hover:bg-primary/10 active:bg-primary/20 hover:border-primary"
                    onClick={() => {
                      trackCTA('See how it works', 'Homepage CTA');
                      navigate('/ai-crm-automation');
                    }}
                  >
                    See how it works
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Current Ventures Section */}
        <section className="mobile-section mobile-container animate-section pointer-events-auto">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-12">
              <h2 className="mobile-heading-lg text-primary mb-4">Current Ventures</h2>
              <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
                Building 7 AI-powered SaaS platforms under Pearson Media LLC. Here's what I'm
                working on right now.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton w-full h-96 rounded-lg"></div>
                  ))}
                </div>
              }
            >
              <CurrentVentures />
            </Suspense>
          </div>
        </section>

        {/* Case Studies Section */}
        <div className="animate-section pointer-events-auto">
          <Suspense
            fallback={
              <div className="mobile-section text-center">
                <div className="skeleton w-16 h-16 mx-auto mb-4 rounded-full"></div>
                <div className="skeleton w-48 h-6 mx-auto"></div>
              </div>
            }
          >
            <CaseStudies />
          </Suspense>
        </div>

        {/* Testimonials Section */}
        <section className="mobile-section mobile-container animate-section pointer-events-auto">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-12">
              <h2 className="mobile-heading-lg text-primary mb-4">What Clients Say</h2>
              <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
                Don't just take my word for it. Here's what people I've worked with have to say.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton w-full h-64 rounded-lg"></div>
                  ))}
                </div>
              }
            >
              <Testimonials />
            </Suspense>
          </div>
        </section>

        {/* FAQ Section - SEO Enhancement */}
        <div className="animate-section pointer-events-auto">
          <Suspense
            fallback={
              <div className="mobile-section text-center">
                <div className="skeleton w-full h-96"></div>
              </div>
            }
          >
            <FAQSection />
          </Suspense>
        </div>

        {/* Newsletter Signup Section */}
        <section className="mobile-section mobile-container bg-muted/30 animate-section pointer-events-auto">
          <div className="max-w-2xl mx-auto">
            <Suspense
              fallback={
                <div className="text-center">
                  <div className="skeleton w-full h-32 mb-4"></div>
                  <div className="skeleton w-full h-12"></div>
                </div>
              }
            >
              <NewsletterSignup />
            </Suspense>
          </div>
        </section>
      </main>

      <div className="relative z-20 bg-background">
        <Footer />
      </div>
    </div>
  );
};

export default Index;
