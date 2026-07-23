import { ReactNode } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';

interface LegalPageLayoutProps {
  /** Page H1 / SEO title base. */
  title: string;
  /** Short intro sentence under the H1. */
  intro: string;
  /** Human-readable "last updated" date, e.g. "July 23, 2026". */
  lastUpdated: string;
  /** Meta description for SEO. */
  description: string;
  /** Canonical URL for the page. */
  url: string;
  keywords?: string;
  children: ReactNode;
}

/**
 * Shared shell for legal / policy pages (Privacy, Terms, Cookies). Provides
 * consistent SEO, landmark structure (skip-link target + single <main>), and
 * typographic rhythm so the individual pages only supply their body sections.
 */
const LegalPageLayout = ({
  title,
  intro,
  lastUpdated,
  description,
  url,
  keywords,
  children,
}: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={`${title} | Dan Pearson`}
        description={description}
        keywords={keywords}
        url={url}
        type="website"
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-3xl mx-auto">
            <header className="mb-10">
              <h1 className="mobile-heading-lg hero-gradient-text mb-4">{title}</h1>
              <p className="mobile-body text-muted-foreground">{intro}</p>
              <p className="text-sm text-muted-foreground mt-4">Last updated: {lastUpdated}</p>
            </header>

            <div className="legal-content space-y-8 text-muted-foreground leading-relaxed">
              {children}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

/** A titled section with a consistent heading style. */
export const LegalSection = ({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) => (
  <section id={id} className="space-y-3">
    <h2 className="text-xl sm:text-2xl font-bold text-foreground scroll-mt-24">{heading}</h2>
    {children}
  </section>
);

export default LegalPageLayout;
