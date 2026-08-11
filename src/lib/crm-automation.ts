/**
 * Canonical content for the AI CRM automation positioning.
 *
 * This is the single source of truth for the framework, the offer ladder and
 * the FAQ set. The page renders from it and the structured data serialises from
 * it, so the human-readable page and the machine-readable schema can never
 * drift apart — which matters more than usual here, because assistants now
 * shortlist consultants from the markup before a person ever loads the page.
 *
 * See AI_CRM_AUTOMATION_STRATEGY.md for the reasoning behind each section.
 */

/** The one-sentence position. Reused verbatim wherever the category is named. */
export const POSITIONING_STATEMENT =
  'AI CRM automation for revenue teams under 50 seats — capture-layer automation that keeps the pipeline honest.';

/** The contrarian thesis. This is the most-quoted text on the site; keep it prose. */
export const THESIS =
  'Most AI CRM projects fail because they automate the reporting layer instead of the capture layer. Teams buy AI that summarises a pipeline nobody updated. Fix capture first — automate what the seller actually does between 8am and 6pm — and the forecasting AI gets clean data for free.';

export interface LadderRung {
  rung: number;
  name: string;
  reality: string;
  failure: string;
}

/**
 * The Pipeline Automation Ladder — the framework buyers self-locate on.
 * The load-bearing rule is that rung 2 cannot be skipped; every failed AI CRM
 * project worth rescuing jumped from 1 to 3.
 */
export const PIPELINE_AUTOMATION_LADDER: LadderRung[] = [
  {
    rung: 0,
    name: 'Manual',
    reality:
      'The CRM is a reporting obligation. Reps update it Friday afternoon, from memory, in a hurry.',
    failure:
      'The data is fiction. Any AI built on top of it will confidently amplify that fiction.',
  },
  {
    rung: 1,
    name: 'Rules',
    reality:
      'Workflows, assignment rules and sequences are running. Everything is deterministic and brittle.',
    failure:
      'Rules multiply until nobody can say why a record changed, and no one dares delete one.',
  },
  {
    rung: 2,
    name: 'Assisted capture',
    reality:
      'AI writes the notes, logs the call, enriches the contact and proposes the stage change from the actual conversation. A human confirms.',
    failure:
      'Most teams skip this rung because it is unglamorous. That is precisely why rungs 3 and 4 collapse for them.',
  },
  {
    rung: 3,
    name: 'Agentic execution',
    reality:
      'Agents act inside the CRM: qualifying inbound, chasing stalled deals, booking meetings, escalating risk. A human supervises.',
    failure: 'Deployed on rung-0 data, agents do the wrong thing quickly and at scale.',
  },
  {
    rung: 4,
    name: 'Self-maintaining revenue system',
    reality:
      'The CRM is a byproduct of doing the work rather than a task on top of it. The forecast is trustworthy because capture is automatic.',
    failure: 'Only reachable in sequence. There is no version of this that skips the boring rung.',
  },
];

export interface AuditCheck {
  group: 'Capture' | 'Data' | 'Flow' | 'Trust';
  name: string;
  question: string;
}

/**
 * The 12-Point CRM Automation Audit. Published openly on purpose: the scoring
 * and the remediation are the product, the checklist is the marketing.
 */
export const AUDIT_CHECKS: AuditCheck[] = [
  {
    group: 'Capture',
    name: 'Call and meeting logging',
    question:
      'What share of customer conversations end up in the CRM without a human typing them in?',
  },
  {
    group: 'Capture',
    name: 'Email sync fidelity',
    question:
      'Are threads attached to the right deal, or to the wrong contact record and no deal at all?',
  },
  {
    group: 'Capture',
    name: 'Stage-change provenance',
    question: 'When a deal moves stage, can you tell what actually happened to justify it?',
  },
  {
    group: 'Capture',
    name: 'Required-field decay',
    question: 'How fast do mandatory fields fill up with "N/A", "TBD" and a single space?',
  },
  {
    group: 'Data',
    name: 'Duplicate rate',
    question: 'What percentage of accounts and contacts exist more than once?',
  },
  {
    group: 'Data',
    name: 'Enrichment coverage',
    question: 'How many records have the firmographic fields your routing and scoring depend on?',
  },
  {
    group: 'Data',
    name: 'Field-level staleness',
    question: 'How old is the median value in the fields that drive your forecast?',
  },
  {
    group: 'Flow',
    name: 'Handoff latency',
    question: 'How long does a lead sit between marketing, SDR and AE ownership?',
  },
  {
    group: 'Flow',
    name: 'Stalled-deal detection',
    question: 'Does anything notice a deal going quiet before the forecast call does?',
  },
  {
    group: 'Flow',
    name: 'Routing accuracy',
    question: 'What share of inbound reaches the right owner on the first attempt?',
  },
  {
    group: 'Trust',
    name: 'Forecast variance',
    question:
      'How far apart are the committed forecast and the closed number, quarter over quarter?',
  },
  {
    group: 'Trust',
    name: 'Seller time in CRM',
    question:
      'How many hours a week do reps say they spend feeding the system rather than selling?',
  },
];

export interface ServiceTier {
  tier: string;
  name: string;
  summary: string;
  description: string;
  duration: string;
  priceLabel: string;
  priceMin?: number;
  priceMax?: number;
  unit?: string;
}

/**
 * The offer ladder.
 *
 * Only the audit carries a number, and it is a flat one. That is deliberate on
 * both sides: the audit is the offer we actually want a stranger to buy, so it
 * needs to be legible to an assistant answering "what does he charge?" — while
 * build and retainer scope genuinely cannot be known before the audit, and a
 * wide published band there would anchor the whole page on its ceiling rather
 * than on the $2,500 door. Only tiers with `priceMin` emit a PriceSpecification.
 */
export const SERVICE_TIERS: ServiceTier[] = [
  {
    tier: 'Start here',
    name: 'CRM Automation Audit',
    summary: 'Two weeks, fixed fee. You get findings and a roadmap, not a proposal.',
    description:
      'A twelve-point review of how data enters your CRM, where it rots and what it is costing the forecast. Delivered as a written findings document with a prioritised roadmap and your placement on the Pipeline Automation Ladder. Yours to keep and to implement with anyone.',
    duration: '2 weeks',
    priceLabel: '$2,500 flat',
    priceMin: 2500,
    priceMax: 2500,
  },
  {
    tier: 'Build',
    name: 'Capture-Layer Build',
    summary: 'An implementation sprint against the roadmap the audit produced.',
    description:
      'Automating the rung-2 work: call and meeting capture, note generation, enrichment, deduplication, routing and stage-change evidence. Built into the CRM you already own, with the integrations and custom services the job actually needs.',
    duration: '4 – 12 weeks',
    priceLabel: 'Scoped from the audit',
  },
  {
    tier: 'Operate',
    name: 'Automation Retainer',
    summary: 'Fractional revenue-systems engineering, ongoing.',
    description:
      'Continuous work on the automation layer: extending what is built, retiring what stopped earning its keep, and moving the team up the ladder one rung at a time. For teams that want the capability without hiring a full-time RevOps engineer.',
    duration: 'Monthly',
    priceLabel: 'Scoped to the work',
  },
];

export interface FailureMode {
  name: string;
  symptom: string;
  cause: string;
}

/** The five failure modes. Written so a reader recognises their own team. */
export const FAILURE_MODES: FailureMode[] = [
  {
    name: 'The dashboard that nobody trusts',
    symptom:
      'Leadership has a beautiful pipeline view and still asks reps to confirm every number before the board call.',
    cause:
      'Reporting was automated on top of manual capture. The visualisation got better; the underlying data did not.',
  },
  {
    name: 'The AI add-on that got switched off',
    symptom: "You paid for the platform's AI tier, used it for six weeks, and quietly stopped.",
    cause:
      'Summarisation and scoring need dense, recent, structured history. On sparse records they produce plausible nonsense, and people stop believing the feature.',
  },
  {
    name: 'The workflow thicket',
    symptom: 'Nobody will delete an automation because nobody can prove what depends on it.',
    cause:
      'Years of rung-1 rules accumulated without ownership or documentation. New automation gets layered on rather than replacing anything.',
  },
  {
    name: 'The compliance spiral',
    symptom: 'More required fields were added to force better data, and data quality got worse.',
    cause:
      'Mandatory fields do not create information, they create placeholder text. Capture has to get easier, not more obligatory.',
  },
  {
    name: 'The agent with no supervision surface',
    symptom:
      'An agent is sending emails and updating records, and nobody can review what it did or why.',
    cause:
      'Rung 3 was deployed without the rung-2 evidence trail that makes agent behaviour auditable.',
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQ set for the money page. These are also the rows to load into the `faqs`
 * table with category "CRM Automation" so /faq picks them up automatically.
 */
export const CRM_FAQS: FaqEntry[] = [
  {
    question: 'What is AI CRM automation?',
    answer:
      'AI CRM automation is the use of language models and AI agents to do the work that a CRM normally asks people to do by hand: logging calls and meetings, writing notes, enriching records, routing leads, spotting stalled deals and keeping deal stages honest. It differs from traditional CRM automation, which is rule-based and deterministic — a rule fires when a condition is met. AI automation can work from unstructured input like a call transcript or an email thread, which is what makes it able to handle the capture problem that rules never could.',
  },
  {
    question: 'Why do most AI CRM projects fail?',
    answer:
      'Because they automate the reporting layer instead of the capture layer. The visible, fundable, demo-friendly work is summarisation, scoring and forecasting — all of which sit downstream of data that reps enter by hand, late, from memory. When the input is sparse, AI output is confidently wrong, trust collapses and the feature gets switched off. Teams that automate capture first find the downstream AI starts working almost on its own, because it finally has dense, recent, structured history to reason over.',
  },
  {
    question: 'What is the difference between the capture layer and the reporting layer?',
    answer:
      'The capture layer is everything that puts information into the CRM: call logging, note-taking, email sync, contact enrichment, stage changes. The reporting layer is everything that reads it back out: dashboards, forecasts, lead scores, summaries, alerts. Most CRM spending goes to the reporting layer because that is what executives see. But the reporting layer can only ever be as good as the capture layer feeding it, and the capture layer is where nearly all the manual effort and nearly all the data loss actually happen.',
  },
  {
    question: 'How much does CRM automation cost?',
    answer:
      'The audit is $2,500, flat, and takes two weeks. You get a findings document and a prioritised roadmap that is yours to keep regardless of who implements it. Build and retainer work is scoped out of that audit rather than quoted up front, because the cost depends almost entirely on how many capture paths need automating and what integration work sits underneath — and neither of us knows that before the audit. Anyone who quotes an implementation number before looking at your data is guessing. Platform and API costs sit on top and are usually modest by comparison; the expensive part of CRM automation has always been the thinking, not the tokens.',
  },
  {
    question: 'How long does a CRM automation project take?',
    answer:
      'The audit is two weeks. A first capture-layer build is usually four to twelve weeks depending on scope, and it is deliberately sequenced so something useful ships in the first fortnight rather than everything landing at the end. Teams generally feel the difference in seller hours within the first month, while forecast accuracy takes a full quarter to show, because you need a complete cycle of clean data before the comparison means anything.',
  },
  {
    question: 'Do I need to switch CRMs to automate with AI?',
    answer:
      'Almost never, and being told to switch early is a warning sign. HubSpot, Salesforce, Pipedrive, GoHighLevel and Zoho are all automatable to a useful depth, and the migration cost of switching usually exceeds the cost of fixing what you have. A platform change is worth considering only when the current system genuinely cannot represent how you sell — and that is a much rarer diagnosis than the people selling migrations suggest.',
  },
  {
    question: 'Will AI automation make my sales forecast accurate?',
    answer:
      "Indirectly, and only in that order. Forecasting models fail on sparse and stale data far more often than they fail on modelling. When capture is automated, the forecast improves substantially before anyone touches the forecasting logic, because the model is finally reading a record of what happened rather than a rep's Friday-afternoon reconstruction of it. Automating the forecast first, on manual capture, is the single most common way to spend real money and change nothing.",
  },
  {
    question: 'How is this different from RevOps consulting?',
    answer:
      'RevOps consulting typically covers process design, territory and comp planning, tooling strategy and reporting structure across the whole revenue organisation. This is narrower and more technical: the automation layer inside the CRM, built and shipped rather than specified. Plenty of teams need both. If you do not have a defined sales process yet, RevOps comes first — automation makes an existing process cheaper to run, it does not invent one for you.',
  },
  {
    question: 'Can a team under 20 seats justify CRM automation?',
    answer:
      'Often more easily than a large one, because small teams have no operations staff absorbing the manual work — it comes straight out of selling time. The arithmetic is simple: multiply seats by hours per week spent on CRM admin by loaded hourly cost. Teams in the five-to-twenty range routinely find several hours per rep per week, which pays for a capture-layer build inside a year while also making the pipeline legible for the first time.',
  },
  {
    question: 'What is agentic CRM and is it ready?',
    answer:
      'Agentic CRM means AI that executes inside the system rather than just recommending — qualifying inbound, chasing stalled deals, booking meetings, updating records under supervision. As of 2026 it is genuinely ready for narrow, well-bounded, reviewable tasks, and genuinely not ready to be handed a messy pipeline and left alone. That is rung 3 on the Pipeline Automation Ladder, and it works when rung 2 is solid underneath it. On manual capture, an agent simply makes mistakes faster than a human would.',
  },
];
