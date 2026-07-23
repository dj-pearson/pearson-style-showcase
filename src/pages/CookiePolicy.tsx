import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { openCookiePreferences } from '@/lib/cookie-preferences';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

/** Single source of truth for the cookie policy revision date. */
export const COOKIES_LAST_UPDATED = 'July 23, 2026';

const CookiePolicy = () => {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      intro="This Cookie Policy explains how danpearson.net uses cookies and similar technologies, what categories we use, and how you can control them."
      lastUpdated={COOKIES_LAST_UPDATED}
      description="How danpearson.net uses cookies and similar technologies, the categories of cookies used, and how to manage your consent."
      keywords="cookie policy, cookies, tracking technologies, consent, GDPR, analytics cookies"
      url="https://danpearson.net/cookies"
    >
      <LegalSection heading="1. What are cookies?">
        <p>
          Cookies are small text files stored on your device when you visit a website. We also use
          related technologies such as <code className="text-foreground">localStorage</code> and{' '}
          <code className="text-foreground">sessionStorage</code>. Together these help the site
          function, remember your preferences, and — with your consent — measure how the site is
          used.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use them">
        <p>
          Non-essential technologies (such as analytics) are only activated after you give consent.
          Until you choose, we default to denying analytics and other optional storage.
          Strictly-necessary storage is always active because the site cannot work without it.
        </p>
      </LegalSection>

      <LegalSection heading="3. Categories we use">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-lg">
            <thead>
              <tr className="bg-muted/40 text-foreground text-left">
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Purpose</th>
                <th className="p-3 font-semibold">Examples</th>
                <th className="p-3 font-semibold">Consent</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-border">
                <td className="p-3 font-medium text-foreground">Strictly necessary</td>
                <td className="p-3">
                  Security, core functionality, and remembering your consent choice.
                </td>
                <td className="p-3">Consent record, CSRF token, session/UI state.</td>
                <td className="p-3">Always on</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-medium text-foreground">Analytics</td>
                <td className="p-3">
                  Understand which pages are visited so we can improve the site. IP anonymized.
                </td>
                <td className="p-3">
                  Google Analytics (<code>_ga</code>, <code>_ga_*</code>).
                </td>
                <td className="p-3">Opt-in</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-medium text-foreground">Functional</td>
                <td className="p-3">
                  Optional enhancements and diagnostic session replay to fix errors.
                </td>
                <td className="p-3">Sentry error/replay diagnostics.</td>
                <td className="p-3">Opt-in</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection heading="4. Managing your preferences">
        <p>
          You can change your choices at any time. Rejecting optional cookies will not affect
          essential site functionality.
        </p>
        <Button variant="outline" onClick={openCookiePreferences}>
          Manage cookie preferences
        </Button>
        <p className="mt-3">
          You can also block or delete cookies through your browser settings. Because consent is
          stored on your device, clearing your browser storage will cause the consent banner to
          appear again.
        </p>
      </LegalSection>

      <LegalSection heading="5. Third-party cookies">
        <p>
          Some cookies are set by the third-party services we use (Google Analytics, Sentry). Their
          use of data is governed by their own privacy policies. We only enable these services after
          you consent. For details on how we handle data, see our{' '}
          <Link to="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="6. Changes to this policy">
        <p>
          We may update this Cookie Policy as our practices or the law change. Material changes are
          reflected by the “Last updated” date above, and where required we will ask for renewed
          consent.
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact">
        <p>
          Questions about our use of cookies? Email{' '}
          <a
            href="mailto:privacy@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            privacy@danpearson.net
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default CookiePolicy;
