/**
 * Class strings and copy shared by the React components and the static HTML
 * that scripts/prerender.mjs writes for the same routes.
 *
 * Why: the prerendered markup paints first, then React's first commit
 * replaces it. When the static copy was unstyled <h1>/<p>, React's styled
 * element was bigger, so Chrome counted it as a new LCP candidate and LCP
 * waited on the whole JavaScript bundle. With the same wrappers and classes
 * the early paint is the same size and position as React's, the swap is
 * invisible, and LCP stays on the first paint.
 *
 * Rules for this file:
 * - No imports. prerender.mjs transpiles it with esbuild in memory.
 * - Every class the prerender emits must be written out here (or elsewhere in
 *   src/), because Tailwind only generates classes it finds in its content
 *   globs, and scripts/ is not one of them.
 * - Strings marked "mirror" copy markup from a file that does not import this
 *   one. Change both together.
 */

// --- site chrome ------------------------------------------------------------

/**
 * The prerendered header on pages with a matched layout. Navigation.tsx is
 * position: fixed, so the static header is too; in normal flow it pushed the
 * page down by its own height and the swap to React moved everything up.
 */
export const PRERENDER_NAV = {
  bar: 'fixed top-0 left-0 right-0 z-50 navbar-blur',
  container: 'container mx-auto mobile-container py-3 sm:py-4',
  row: 'flex items-center justify-between gap-4',
  logo: 'shrink-0 whitespace-nowrap text-xl sm:text-xl lg:text-2xl font-bold text-primary touch-target',
  links: 'flex min-w-0 items-center overflow-x-auto whitespace-nowrap',
  link: 'px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary',
} as const;

// --- homepage hero ------------------------------------------------------------

/** Mirror of the Index.tsx wrappers around <HeroSection />. */
export const INDEX_LAYOUT = {
  root: 'min-h-screen flex flex-col relative bg-background',
  backdrop: 'fixed inset-0 z-0',
  backdropGradient:
    'absolute inset-0 bg-gradient-to-br from-background via-background/90 to-secondary/20 z-10 pointer-events-none',
  main: 'relative z-10 pointer-events-none',
  heroWrap: 'pointer-events-auto',
  /** The crawl copy under the hero; it sits below the fold at every width. */
  section: 'mobile-section mobile-container relative pointer-events-auto',
  sectionInner: 'max-w-3xl mx-auto',
  sectionHeading: 'mobile-heading-lg text-primary mb-6',
  sectionLead: 'text-xl sm:text-2xl text-foreground font-medium leading-snug mb-6',
  sectionBody: 'mobile-body text-muted-foreground leading-relaxed mb-6',
  sectionList: 'space-y-2 mobile-body',
  sectionLink: 'text-primary hover:underline',
} as const;

export const HERO_CLASSES = {
  section:
    'relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-32 sm:pt-40 pb-20 mobile-container bg-transparent',
  content: 'relative z-10 text-center max-w-[95%] sm:max-w-2xl lg:max-w-4xl mx-auto px-4',
  title:
    'text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-12 sm:mb-16 leading-[1.1] perspective-text py-4',
  nameWrapper: 'inline-block',
  firstName: 'inline-block text-cyan-400',
  lastName: 'inline-block text-white',
  subtitleWrap: 'relative z-20 mb-6 sm:mb-8',
  subtitle: 'text-base sm:text-xl md:text-2xl lg:text-3xl text-white font-semibold leading-relaxed',
  descWrap: 'relative z-20 mb-10 sm:mb-12 max-w-3xl mx-auto',
  desc: 'text-sm sm:text-base md:text-lg text-white/95 font-normal leading-relaxed',
  descEmphasis: 'text-primary font-bold',
  ctaRow: 'relative z-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4',
  ctaPrimary:
    'btn-futuristic group mobile-button inline-flex items-center justify-center text-base sm:text-lg font-bold active:scale-95',
  ctaPrimaryIcon: 'ml-2 w-5 h-5 transition-transform group-hover:translate-x-1',
  ctaSecondary:
    'mobile-button inline-flex items-center justify-center rounded-lg border border-primary/60 bg-background/70 px-6 py-3 text-base sm:text-lg font-semibold text-foreground transition-colors hover:bg-primary/10 active:scale-95',
  scrollHint:
    'absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60 animate-float',
  scrollHintLabel: 'text-xs text-muted-foreground uppercase tracking-wider',
  scrollHintBar: 'w-0.5 h-8 bg-primary rounded-full',
  dots: [
    'absolute top-6 sm:top-10 right-6 sm:right-10 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-primary rounded-full animate-ping',
    'absolute bottom-20 sm:bottom-24 left-6 sm:left-10 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-tech-cyan rounded-full animate-pulse',
    'absolute top-1/4 right-1/4 w-2 h-2 bg-tech-purple rounded-full animate-ping',
    'absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-tech-orange rounded-full animate-pulse',
  ],
  /** animation-delay for each dot, in the same order. */
  dotDelays: ['', '', '1s', '2s'],
} as const;

/** text-shadow values, applied as inline styles by both renderers. */
export const HERO_SHADOWS = {
  firstName: '0 0 15px rgba(0, 212, 255, 0.4), 0 2px 5px rgba(0,0,0,0.5)',
  lastName: '0 0 10px rgba(255, 255, 255, 0.3), 0 2px 5px rgba(0,0,0,0.5)',
  subtitle: '2px 2px 4px rgba(0, 0, 0, 1)',
  desc: '1px 1px 3px rgba(0, 0, 0, 1)',
  descEmphasis: '0 0 20px rgba(0, 212, 255, 0.8), 1px 1px 3px rgba(0, 0, 0, 1)',
  ctaPrimary: '0 0 40px rgba(0, 212, 255, 0.8), 0 8px 20px rgba(0, 0, 0, 0.6)',
} as const;

export const HERO_COPY = {
  firstName: 'Dan',
  lastName: 'Pearson',
  subtitle: 'I make your CRM run itself',
  desc: 'AI CRM automation for revenue teams under 50 seats. Fifteen years carrying a quota, seven SaaS platforms shipped.',
  descEmphasis: 'Sellers stop doing data entry. The pipeline stops lying.',
  ctaPrimary: { href: '/connect', label: 'Book a CRM automation audit' },
  ctaSecondary: { href: '/ai-crm-automation', label: 'See how it works' },
} as const;

/** Set on the prerendered hero <section> so HeroSection can tell it painted. */
export const PRERENDERED_HERO_ATTR = 'data-prerendered-hero';

// --- article header -----------------------------------------------------------

/** Mirror of the Article.tsx wrappers and Breadcrumbs.tsx around the header. */
export const ARTICLE_LAYOUT = {
  root: 'min-h-screen flex flex-col',
  main: 'flex-1 pt-20 px-4 md:px-6',
  container: 'container mx-auto max-w-4xl',
  breadcrumbsWrap: 'mb-6',
  breadcrumbs: 'flex items-center space-x-2 text-sm',
  breadcrumbList: 'flex items-center space-x-2',
  breadcrumbItem: 'flex items-center',
  breadcrumbSeparator: 'w-4 h-4 mx-2 text-muted-foreground',
  breadcrumbLink:
    'text-muted-foreground hover:text-primary transition-colors flex items-center gap-1',
  breadcrumbIcon: 'w-4 h-4',
  breadcrumbCurrent: 'text-foreground font-medium',
  article: 'space-y-8',
  body: 'prose prose-invert max-w-none',
} as const;

/**
 * Mirror of badgeVariants in components/ui/badge.tsx after cn() merges each
 * badge's className over it: the base, then the variant, then the override.
 */
const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

export const ARTICLE_HEADER = {
  header: 'space-y-6',
  badges: 'flex flex-wrap gap-2',
  /** className passed to <Badge> in Article.tsx. */
  categoryBadge: 'bg-primary/10 text-primary border-primary/20',
  featuredBadge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  tagBadge: 'border-border/50 text-muted-foreground hover:border-primary/50',
  title: 'text-4xl md:text-5xl font-bold leading-tight',
  lead: 'text-xl text-muted-foreground leading-relaxed',
  meta: 'flex flex-wrap items-center gap-6 text-sm text-muted-foreground',
  metaItem: 'flex items-center gap-2',
  metaIcon: 'w-4 h-4',
  metaLabel: 'text-xs',
} as const;

/** Fully merged badge classes, for the static copy. */
export const ARTICLE_BADGES = {
  category: `${BADGE_BASE} hover:bg-primary/80 ${ARTICLE_HEADER.categoryBadge}`,
  featured: `${BADGE_BASE} hover:bg-secondary/80 ${ARTICLE_HEADER.featuredBadge}`,
  tag: `${BADGE_BASE} ${ARTICLE_HEADER.tagBadge}`,
} as const;
