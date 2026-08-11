import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AUDIT_CHECKS } from '@/lib/crm-automation';

/**
 * Authority section.
 *
 * This used to be a four-stat bar ($2.8M+ / 10,000+ / 40% / 83%). Those were
 * aggregate client-outcome claims with no client, period, baseline or method
 * attached, and they have been retired — see AI_CRM_AUTOMATION_STRATEGY.md
 * §11.4. Round unsourced numbers are the single most common element on
 * consultant sites, so they read as template rather than as evidence, and
 * generative engines discount them when assembling answers.
 *
 * What replaces them is proof a reader can check without trusting anyone: a
 * published method, artifacts they can click, and the two structural facts that
 * are true by construction. Any retired figure can come back the moment it has
 * a client, a period and a measurement behind it — put the provenance in a
 * comment beside it when it does.
 */

const METHOD_STEPS = [
  {
    title: 'Audit the capture layer',
    body: 'Every engagement opens with the same twelve checks on how data actually enters your CRM — what gets logged, what decays, what the forecast is built on. The full checklist is published, so you can run it yourself before you ever talk to me.',
  },
  {
    title: 'Place you on the ladder',
    body: 'The findings resolve to a rung on the Pipeline Automation Ladder, which tells you what to fix next and — more usefully — what not to buy yet. Most teams arrive convinced they need agents and turn out to need capture.',
  },
  {
    title: 'Build the boring rung first',
    body: 'Implementation starts with rung 2: call and meeting capture, note generation, enrichment, deduplication, routing. It ships in pieces, so something is working in the first fortnight rather than everything landing at the end.',
  },
  {
    title: 'Then let the downstream AI work',
    body: 'Scoring, summarisation and forecasting stop being a gamble once they have dense, recent, structured history underneath them. In most cases the AI you already paid for starts earning its licence without being replaced.',
  },
];

const EXPERTISE = [
  {
    title: 'Capture-layer automation',
    body: 'Automated call and meeting logging, AI-written notes from real conversations, contact and account enrichment, deduplication, lead routing, and stage changes that carry evidence for why they happened.',
  },
  {
    title: 'Agentic workflows, supervised',
    body: 'Agents that qualify inbound, chase stalled deals and escalate risk inside the CRM — built with a review surface, so a human can always see what the agent did and why.',
  },
  {
    title: 'Revenue data and reporting',
    body: 'Forecast variance analysis, pipeline hygiene instrumentation, and the reporting layer built last, on data that can support it.',
  },
  {
    title: 'The engineering underneath',
    body: 'React and TypeScript, self-hosted Postgres with row-level security, edge functions, and integrations against HubSpot, Salesforce, Pipedrive, GoHighLevel and Zoho.',
  },
];

const AuthoritySection = () => {
  return (
    <section className="mobile-section mobile-container" aria-labelledby="authority-heading">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 sm:mb-16">
          <h2 id="authority-heading" className="mobile-heading-lg text-primary mb-4">
            How I work, and how you can check it
          </h2>
          <p className="mobile-body text-muted-foreground leading-relaxed max-w-[68ch]">
            Fifteen years in sales and business development, then seven SaaS platforms built under
            Pearson Media LLC. Rather than ask you to take a number on faith, here is the method
            itself — and the things you can go and verify without talking to me first.
          </p>
        </header>

        {/* The method ---------------------------------------------------------- */}
        <div className="mb-14 sm:mb-16">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-8">The method</h3>
          <ol className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {METHOD_STEPS.map((step, index) => (
              <li key={step.title}>
                <h4 className="font-semibold text-foreground mb-2 flex items-baseline gap-3">
                  <span className="text-primary tabular-nums text-sm">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {step.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Checkable proof ----------------------------------------------------- */}
        <div className="mb-14 sm:mb-16">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">
            What you can verify yourself
          </h3>
          <p className="text-base text-muted-foreground leading-relaxed max-w-[68ch] mb-8">
            Three things on this site are checkable in about ten minutes, which is more than most
            consultants will give you.
          </p>

          <dl className="divide-y divide-border border-y border-border">
            <div className="py-5 sm:flex sm:gap-8">
              <dt className="sm:w-52 shrink-0 font-semibold text-foreground mb-1 sm:mb-0">
                The audit methodology
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                All {AUDIT_CHECKS.length} checks are published in full, with the question each one
                asks.{' '}
                <Link to="/ai-crm-automation" className="text-primary hover:underline">
                  Read the audit
                </Link>{' '}
                and run it against your own CRM. If it tells you something useful and you never hire
                me, it has still done its job.
              </dd>
            </div>

            <div className="py-5 sm:flex sm:gap-8">
              <dt className="sm:w-52 shrink-0 font-semibold text-foreground mb-1 sm:mb-0">
                The platforms
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Seven production SaaS products across construction, real estate, fitness and meal
                planning — real messy sales data in four different industries.{' '}
                <Link to="/projects" className="text-primary hover:underline">
                  They are listed here
                </Link>
                , and the live ones are clickable.
              </dd>
            </div>

            <div className="py-5 sm:flex sm:gap-8">
              <dt className="sm:w-52 shrink-0 font-semibold text-foreground mb-1 sm:mb-0">
                This site
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Built and run on the same stack I would build your automation on — role-based access
                control, row-level security, encrypted session handling and two dozen edge functions
                behind it. Plenty of consultants describe their engineering. This one is running in
                your browser.
              </dd>
            </div>
          </dl>
        </div>

        {/* Expertise ----------------------------------------------------------- */}
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-8">
            Where I actually work
          </h3>
          <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {EXPERTISE.map((area) => (
              <div key={area.title}>
                <dt className="font-semibold text-foreground mb-2">{area.title}</dt>
                <dd className="text-sm text-muted-foreground leading-relaxed">{area.body}</dd>
              </div>
            ))}
          </dl>

          <p className="text-base text-muted-foreground leading-relaxed mt-10">
            <Link
              to="/ai-crm-automation"
              className="inline-flex items-center font-semibold text-primary hover:underline"
            >
              See the full argument and what it costs
              <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default AuthoritySection;
