/**
 * The public routes that have no per-row data but still need their own HTML
 * at build time. Before this table existed scripts/prerender.mjs wrote files
 * for the home page, the money page, one topic hub and the articles only, and
 * every other URL was answered with the home page's title, description and
 * canonical until JavaScript ran.
 *
 * `title` and `description` are copied from the <SEO> props in `source`, so
 * the head a crawler reads and the head React writes on mount say the same
 * thing. scripts/__tests__/static-routes.test.ts fails when a page's copy
 * changes and this table does not. `intro` is the page's own lead paragraph.
 *
 * `titleInSource` covers pages whose layout appends " | Dan Pearson" itself
 * (LegalPageLayout), so the test can still find the literal in the page.
 */

export const STATIC_ROUTES = [
  {
    path: '/about',
    source: 'src/pages/About.tsx',
    title: 'About Dan Pearson | AI CRM Automation Consultant',
    description:
      'Fifteen years in sales and business development — including managing 29 fitness locations at $600K+ monthly — before building seven SaaS platforms and moving into AI CRM automation. The rare consultant who has carried a quota and written the automation.',
    h1: 'Dan Pearson',
    intro:
      'Capture-layer automation for revenue teams under 50 seats. Fifteen years carrying a quota came first; seven SaaS platforms came after.',
    schemaType: 'ProfilePage',
    crumb: 'About',
    sitemap: { priority: '0.8', changefreq: 'monthly' },
  },
  {
    path: '/projects',
    source: 'src/pages/Projects.tsx',
    title: 'Projects & Case Studies | AI CRM Automation | Dan Pearson',
    description:
      'Seven production SaaS platforms and the CRM automation case studies behind them. Construction, real estate, fitness and meal planning — four industries of real revenue data.',
    h1: 'My Projects',
    intro:
      'Seven SaaS platforms across construction, real estate, fitness and meal planning — four industries’ worth of real, messy revenue data, and where the CRM automation thinking came from.',
    schemaType: 'CollectionPage',
    crumb: 'Projects',
    sitemap: { priority: '0.7', changefreq: 'monthly' },
  },
  {
    path: '/news',
    source: 'src/pages/News.tsx',
    title: 'AI Automation & Business Technology Insights | Expert Analysis | Dan Pearson',
    description:
      'Teardowns and field notes on AI CRM automation: what works inside HubSpot and Salesforce, what it costs, and why most projects stall at data capture.',
    h1: 'News & Insights',
    intro:
      'Field notes and teardowns on AI CRM automation — what actually works inside the CRM, and why so much of it does not.',
    schemaType: 'CollectionPage',
    crumb: 'News',
    sitemap: { priority: '0.8', changefreq: 'daily' },
  },
  {
    path: '/connect',
    source: 'src/pages/Connect.tsx',
    title: 'Book a CRM Automation Audit | Dan Pearson',
    description:
      'Book a flat-fee CRM automation audit, or get in touch about capture-layer automation for your revenue team. Two weeks, findings and a roadmap you keep whoever builds it.',
    h1: 'Book a CRM automation audit',
    intro:
      "$2,500 flat, two weeks, and the findings are yours whether or not you build with me. Tell me which CRM you're on and what your pipeline gets wrong.",
    schemaType: 'ContactPage',
    crumb: 'Connect',
    sitemap: { priority: '0.8', changefreq: 'monthly' },
  },
  {
    path: '/ai-tools',
    source: 'src/pages/AITools.tsx',
    title: 'AI Tools Directory: Pricing and Skill Level | Dan Pearson',
    description:
      'A directory of AI tools for writing, development, image work and business automation. Filter by category and compare pricing and skill level for each tool.',
    h1: 'AI Tools & Services',
    intro:
      'AI tools for writing, development, image work and automation, with pricing and skill level for each.',
    schemaType: 'CollectionPage',
    crumb: 'AI Tools',
    sitemap: { priority: '0.6', changefreq: 'weekly' },
  },
  {
    path: '/topics',
    source: 'src/pages/Topics.tsx',
    title: 'Topics - AI & Business Insights Hub | Dan Pearson',
    description:
      'Guides and teardowns on AI CRM automation, machine learning, business automation and digital transformation, grouped by topic.',
    h1: 'Topics & Resources',
    intro:
      'Guides and teardowns grouped by topic. Start with AI CRM automation if you run a sales team.',
    schemaType: 'CollectionPage',
    crumb: 'Topics',
    sitemap: { priority: '0.7', changefreq: 'weekly' },
  },
  {
    path: '/faq',
    source: 'src/pages/FAQ.tsx',
    title: 'FAQ | AI Automation Questions Answered | Dan Pearson',
    description:
      'Straight answers on AI CRM automation: what the $2,500 audit covers, how long a build takes, and whether you need to switch CRMs.',
    h1: 'Frequently Asked Questions',
    intro:
      'Get answers to common questions about AI automation, implementation, and how it can transform your business operations.',
    schemaType: 'WebPage',
    crumb: 'FAQ',
    sitemap: { priority: '0.6', changefreq: 'monthly' },
  },
  {
    path: '/showcase',
    source: 'src/pages/Showcase.tsx',
    title: 'The Living Canvas — Advanced Web Design Showcase',
    description:
      'A single-page experience pushing the 2026 web platform to its limits: hand-written WebGL2 shaders, scroll-driven animations, container queries, OKLCH color and more.',
    h1: 'The Web Is a Living Canvas',
    intro:
      'Real-time shaders, scroll-driven motion and perceptual colour — every pixel below is computed in your browser, right now, with no images and no 3D framework.',
    schemaType: 'WebPage',
    crumb: 'Showcase',
    sitemap: { priority: '0.4', changefreq: 'yearly' },
  },
  {
    path: '/privacy',
    source: 'src/pages/PrivacyPolicy.tsx',
    title: 'Privacy Policy | Dan Pearson',
    titleInSource: 'title="Privacy Policy"',
    description:
      'How Dan Pearson / Pearson Media LLC collects, uses, shares, and protects your personal information, and your privacy rights under GDPR and US state privacy laws.',
    h1: 'Privacy Policy',
    intro:
      'This Privacy Policy explains what personal information Pearson Media LLC (“we”, “us”, “Dan Pearson”) collects through danpearson.net, how we use and share it, and the choices and rights you have.',
    schemaType: 'WebPage',
    crumb: 'Privacy Policy',
    sitemap: { priority: '0.3', changefreq: 'yearly' },
  },
  {
    path: '/terms',
    source: 'src/pages/TermsOfService.tsx',
    title: 'Terms of Service | Dan Pearson',
    titleInSource: 'title="Terms of Service"',
    description:
      'The terms and conditions governing your use of danpearson.net, including acceptable use, intellectual property, disclaimers, and limitation of liability.',
    h1: 'Terms of Service',
    intro:
      'These Terms of Service govern your use of danpearson.net. Please read them carefully. By accessing or using the site, you agree to be bound by these Terms.',
    schemaType: 'WebPage',
    crumb: 'Terms of Service',
    sitemap: { priority: '0.3', changefreq: 'yearly' },
  },
  {
    path: '/cookies',
    source: 'src/pages/CookiePolicy.tsx',
    title: 'Cookie Policy | Dan Pearson',
    titleInSource: 'title="Cookie Policy"',
    description:
      'How danpearson.net uses cookies and similar technologies, the categories of cookies used, and how to manage your consent.',
    h1: 'Cookie Policy',
    intro:
      'This Cookie Policy explains how danpearson.net uses cookies and similar technologies, what categories we use, and how you can control them.',
    schemaType: 'WebPage',
    crumb: 'Cookie Policy',
    sitemap: { priority: '0.3', changefreq: 'yearly' },
  },
  {
    path: '/accessibility',
    source: 'src/pages/Accessibility.tsx',
    title: 'Accessibility Statement | Dan Pearson - ADA Compliance & WCAG 2.1',
    description:
      'Our commitment to digital accessibility. Learn about our accessibility features, WCAG 2.1 AA compliance efforts, and how to contact us for accessibility assistance.',
    h1: 'Accessibility Statement',
    intro:
      'Dan Pearson and Pearson Media LLC are committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.',
    schemaType: 'WebPage',
    crumb: 'Accessibility',
    sitemap: { priority: '0.3', changefreq: 'yearly' },
  },
  {
    // Live data with nothing to index, so it gets its own head but no sitemap entry.
    path: '/status',
    source: 'src/pages/Status.tsx',
    title: 'System Status | Dan Pearson',
    description: 'Live operational status of the Dan Pearson platform services.',
    h1: 'System Status',
    intro: 'Live health of platform services.',
    schemaType: 'WebPage',
    crumb: 'Status',
    sitemap: null,
  },
];

/** The links every prerendered page carries in its header. */
export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/news', label: 'News' },
  { href: '/topics', label: 'Topics' },
  { href: '/ai-crm-automation', label: 'AI CRM Automation' },
  { href: '/connect', label: 'Connect' },
];

/** Footer links: the legal pages and the feed. */
export const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/rss.xml', label: 'RSS' },
];
