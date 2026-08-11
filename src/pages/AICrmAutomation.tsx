import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import StructuredData from '@/components/SEO/StructuredData';
import Breadcrumbs from '@/components/Breadcrumbs';
import { useAnalytics } from '@/components/Analytics';
import { getCanonicalUrl } from '@/lib/seo';
import {
  AUDIT_CHECKS,
  CRM_FAQS,
  FAILURE_MODES,
  PIPELINE_AUTOMATION_LADDER,
  SERVICE_TIERS,
  THESIS,
  type AuditCheck,
} from '@/lib/crm-automation';

const PAGE_URL = getCanonicalUrl('/ai-crm-automation');

const AUDIT_GROUPS: AuditCheck['group'][] = ['Capture', 'Data', 'Flow', 'Trust'];

const AICrmAutomation = () => {
  const { trackCTA } = useAnalytics();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="AI CRM Automation Consultant | Make Your CRM Run Itself"
        description="AI CRM automation for revenue teams under 50 seats. Most AI CRM projects fail because they automate the reporting layer instead of the capture layer. Starts with a flat $2,500 two-week audit — findings and a roadmap you keep, whoever builds it."
        keywords="AI CRM automation, CRM automation consultant, AI CRM consultant, CRM automation audit, HubSpot automation consultant, Salesforce automation, agentic CRM, sales pipeline automation, CRM data quality, fractional RevOps engineer"
        url={PAGE_URL}
        type="website"
        contentSummary="Dan Pearson is an AI CRM automation consultant who works with revenue teams under 50 seats. His central argument is that most AI CRM projects fail because they automate the reporting layer (dashboards, forecasts, scoring) instead of the capture layer (call logging, notes, enrichment, stage changes). He publishes the Pipeline Automation Ladder, a five-rung maturity model, and a 12-point CRM automation audit methodology. Engagements start with a flat $2,500 two-week CRM automation audit that delivers a findings document and a prioritised roadmap the client keeps. Capture-layer implementation builds and ongoing automation retainers are scoped from that audit rather than quoted up front."
        citationSource="Dan Pearson - AI CRM Automation Consultant"
      />

      <StructuredData
        type="service"
        data={{
          name: 'AI CRM Automation Consulting',
          serviceType: 'AI CRM Automation',
          description:
            'Capture-layer automation for revenue teams under 50 seats: automated call and meeting logging, note generation, enrichment, deduplication, routing and stage-change evidence, built into the CRM the team already owns.',
          url: PAGE_URL,
          audience: {
            '@type': 'BusinessAudience',
            name: 'Sales-led revenue teams of 5-50 seats',
          },
          offerCatalogName: 'AI CRM Automation Services',
          offers: SERVICE_TIERS.map((tier) => ({
            name: tier.name,
            description: tier.description,
            priceMin: tier.priceMin,
            priceMax: tier.priceMax,
            unit: tier.unit,
          })),
        }}
      />

      <StructuredData
        type="itemlist"
        data={{
          name: 'The Pipeline Automation Ladder',
          description:
            'A five-rung maturity model for CRM automation. The load-bearing rule is that rung 2, assisted capture, cannot be skipped.',
          items: PIPELINE_AUTOMATION_LADDER.map((rung) => ({
            name: `Rung ${rung.rung}: ${rung.name}`,
            description: rung.reality,
          })),
        }}
      />

      <StructuredData
        type="howto"
        data={{
          title: 'The 12-Point CRM Automation Audit',
          description:
            'A twelve-check review of how data enters a CRM, where it degrades, and what that costs the forecast — grouped into capture, data, flow and trust.',
          totalTime: 'P14D',
          steps: AUDIT_CHECKS.map((check) => ({
            name: `${check.group}: ${check.name}`,
            text: check.question,
          })),
        }}
      />

      <StructuredData type="faq" data={{ questions: CRM_FAQS }} />

      <StructuredData
        type="breadcrumb"
        data={{
          items: [
            { name: 'Home', url: getCanonicalUrl('/') },
            { name: 'AI CRM Automation', url: PAGE_URL },
          ],
        }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-24 sm:pt-28 pb-20">
        <div className="mobile-container max-w-5xl mx-auto">
          <Breadcrumbs
            items={[{ label: 'AI CRM Automation', path: '/ai-crm-automation' }]}
            className="mb-8"
          />

          {/* Opening statement ------------------------------------------------ */}
          <header className="mb-16 sm:mb-20">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] mb-6 max-w-[20ch]">
              AI CRM automation that actually sticks
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-[68ch] mb-8">
              I build AI automation inside the CRM for revenue teams under 50 seats — so sellers
              stop doing data entry and the pipeline stops lying. Fifteen years carrying a quota,
              seven SaaS platforms shipped. I have been the person whose deal died because the CRM
              said something that was not true.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/connect"
                onClick={() => trackCTA('Book an audit', 'CRM money page hero')}
                className="btn-futuristic mobile-button inline-flex items-center justify-center text-base font-bold"
              >
                Book a CRM automation audit
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Link>
              <a
                href="#how-i-work"
                onClick={() => trackCTA('See pricing', 'CRM money page hero')}
                className="mobile-button inline-flex items-center justify-center text-base font-semibold rounded-xl border border-border text-foreground hover:border-primary/60 hover:bg-primary/5 transition-colors"
              >
                See what it costs
              </a>
            </div>
          </header>

          {/* The thesis -------------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="thesis-heading">
            <h2 id="thesis-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
              The argument
            </h2>
            <div className="max-w-[68ch] space-y-5">
              <p className="text-xl sm:text-2xl text-foreground font-medium leading-snug">
                {THESIS}
              </p>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Almost all CRM budget goes to the reporting layer, because the reporting layer is
                what executives see. Dashboards, forecast models, lead scores, deal summaries. All
                of it sits downstream of information that a human being typed in by hand, late, from
                memory, at the end of a week they would rather forget.
              </p>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                So the AI reads a thin record and produces a confident answer about it. People check
                the first few, find them wrong, and quietly stop looking. That is not a model
                problem and no amount of prompt engineering fixes it. It is a capture problem, and
                it is the least glamorous work in the entire category, which is exactly why it stays
                unfixed.
              </p>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Automate capture and something quietly good happens: the downstream AI you already
                paid for starts working, because it finally has dense, recent, structured history to
                reason over. Dashboards are the last thing to automate, not the first.
              </p>
            </div>
          </section>

          {/* The ladder -------------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="ladder-heading">
            <h2 id="ladder-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              The Pipeline Automation Ladder
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[68ch] mb-10">
              Five rungs. Every team I audit sits on one of them, and most know which before I
              finish describing it. The rule that matters:{' '}
              <strong className="text-foreground font-semibold">you cannot skip rung 2</strong>.
              Every failed AI CRM project I have been called in to rescue jumped straight from 1 to
              3.
            </p>

            <ol className="relative">
              {PIPELINE_AUTOMATION_LADDER.map((rung, index) => (
                <li key={rung.rung} className="relative pl-14 sm:pl-16 pb-10 last:pb-0">
                  {/* Connector rail, drawn between markers rather than around content */}
                  {index < PIPELINE_AUTOMATION_LADDER.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-5 sm:left-6 top-11 bottom-0 w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-primary/40 bg-primary/10 text-primary text-lg font-bold"
                  >
                    {rung.rung}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 pt-1">
                    <span className="sr-only">Rung {rung.rung}: </span>
                    {rung.name}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-[68ch] mb-3">
                    {rung.reality}
                  </p>
                  <p className="text-base text-foreground/80 leading-relaxed max-w-[68ch]">
                    <span className="font-semibold text-foreground">Where it breaks: </span>
                    {rung.failure}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* Failure modes ----------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="failures-heading">
            <h2
              id="failures-heading"
              className="text-2xl sm:text-3xl font-bold text-foreground mb-4"
            >
              Five ways this goes wrong
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[68ch] mb-10">
              If you have already bought AI for your CRM and it did not take, you are almost
              certainly in one of these. They are all the same mistake wearing different clothes.
            </p>

            <div className="space-y-10">
              {FAILURE_MODES.map((mode, index) => (
                <article key={mode.name} className="max-w-[68ch]">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">
                    <span className="text-primary tabular-nums mr-3">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {mode.name}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-2">
                    <span className="font-semibold text-foreground">What it looks like. </span>
                    {mode.symptom}
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">
                      What is actually happening.{' '}
                    </span>
                    {mode.cause}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* The audit --------------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              The 12-point CRM automation audit
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[68ch] mb-10">
              This is the whole methodology, published. Twelve checks across four groups. Run it
              yourself if you would rather — the scoring and the remediation are the work, the
              checklist is not a secret.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {AUDIT_GROUPS.map((group) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-primary mb-4">{group}</h3>
                  <dl className="space-y-4">
                    {AUDIT_CHECKS.filter((check) => check.group === group).map((check) => (
                      <div key={check.name}>
                        <dt className="text-base font-medium text-foreground flex gap-2">
                          <Check
                            className="w-4 h-4 mt-1 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          {check.name}
                        </dt>
                        <dd className="text-sm text-muted-foreground leading-relaxed pl-6">
                          {check.question}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Offer ladder ------------------------------------------------------ */}
          <section
            id="how-i-work"
            className="mb-16 sm:mb-20 scroll-mt-24"
            aria-labelledby="work-heading"
          >
            <h2 id="work-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              How I work, and what it costs
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[68ch] mb-10">
              The audit is a flat fee, published on purpose — you should not have to sit through a
              discovery call to find out whether I am in your range. Build and retainer work is
              scoped out of the audit rather than quoted here, because the cost depends on what the
              audit finds, and anyone quoting an implementation number before looking at your data
              is guessing.
            </p>

            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <caption className="sr-only">
                  Engagement tiers, durations and price ranges for AI CRM automation work
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-3 pr-6 text-sm font-semibold text-primary">
                      Engagement
                    </th>
                    <th scope="col" className="py-3 pr-6 text-sm font-semibold text-primary">
                      What you get
                    </th>
                    <th
                      scope="col"
                      className="py-3 pr-6 text-sm font-semibold text-primary whitespace-nowrap"
                    >
                      Timeline
                    </th>
                    <th
                      scope="col"
                      className="py-3 text-sm font-semibold text-primary whitespace-nowrap"
                    >
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SERVICE_TIERS.map((tier) => (
                    <tr key={tier.name} className="border-b border-border align-top">
                      <th scope="row" className="py-6 pr-6 font-semibold text-foreground">
                        {tier.name}
                        <span className="block mt-1 text-xs font-normal text-primary">
                          {tier.tier}
                        </span>
                      </th>
                      <td className="py-6 pr-6 text-sm text-muted-foreground leading-relaxed max-w-md">
                        {tier.description}
                      </td>
                      <td className="py-6 pr-6 text-sm text-muted-foreground whitespace-nowrap">
                        {tier.duration}
                      </td>
                      <td className="py-6 text-sm font-semibold text-foreground whitespace-nowrap">
                        {tier.priceLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-[68ch] mt-6">
              Platform and API costs sit on top and are usually modest by comparison. The expensive
              part of CRM automation has always been the thinking, not the tokens.
            </p>
          </section>

          {/* Fit --------------------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="fit-heading">
            <h2 id="fit-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-10">
              Whether this is for you
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">This works well when</h3>
                <ul className="space-y-3">
                  {[
                    'You have 5 to 50 people touching the pipeline and no dedicated RevOps hire.',
                    'You are already on HubSpot, Salesforce, Pipedrive, GoHighLevel or Zoho — and unhappy with what is in it.',
                    'A founder or VP Sales still looks at the pipeline personally and does not believe it.',
                    'You bought an AI add-on at some point and it did not stick.',
                    'Reps are spending real hours a week feeding the system instead of selling.',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-base text-muted-foreground leading-relaxed"
                    >
                      <Check className="w-5 h-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Look elsewhere if</h3>
                <ul className="space-y-3">
                  {[
                    'You do not have a defined sales process yet — automation makes an existing process cheaper, it does not invent one.',
                    'You want a CRM migration. That is a different job, and it is usually the wrong one.',
                    'You are an enterprise needing a certified platform partner with a delivery team behind them.',
                    'What you actually want is a dashboard. I will tell you that on the first call, for free.',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-base text-muted-foreground leading-relaxed"
                    >
                      <Minus
                        className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ --------------------------------------------------------------- */}
          <section className="mb-16 sm:mb-20" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-10">
              Questions people actually ask
            </h2>

            <div className="border-t border-border">
              {CRM_FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="border-b border-border">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-answer-${index}`}
                        className="w-full flex items-start justify-between gap-6 py-5 text-left group"
                      >
                        <span className="text-base sm:text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <Minus
                            className="w-5 h-5 mt-1 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus
                            className="w-5 h-5 mt-1 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </h3>
                    {isOpen && (
                      <div id={`faq-answer-${index}`} className="pb-6">
                        <p className="text-base text-muted-foreground leading-relaxed max-w-[68ch]">
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Close ------------------------------------------------------------- */}
          <section
            className="rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:p-12"
            aria-labelledby="cta-heading"
          >
            <h2 id="cta-heading" className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Start with the audit
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[62ch] mb-8">
              Two weeks, fixed fee, and you keep the findings whether or not you build with me. Tell
              me which CRM you are on and what your pipeline is lying about.
            </p>
            <Link
              to="/connect"
              onClick={() => trackCTA('Book an audit', 'CRM money page footer')}
              className="btn-futuristic mobile-button inline-flex items-center justify-center text-base font-bold"
            >
              Book a CRM automation audit
              <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-muted-foreground mt-6">
              Prefer to read first?{' '}
              <Link to="/topics/ai-crm-automation" className="text-primary hover:underline">
                Guides and teardowns on AI CRM automation
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AICrmAutomation;
