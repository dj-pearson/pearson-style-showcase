import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { openCookiePreferences } from '@/lib/cookie-preferences';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

/** Single source of truth for the policy revision date. */
export const PRIVACY_LAST_UPDATED = 'July 23, 2026';

const PrivacyPolicy = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="This Privacy Policy explains what personal information Pearson Media LLC (“we”, “us”, “Dan Pearson”) collects through danpearson.net, how we use and share it, and the choices and rights you have."
      lastUpdated={PRIVACY_LAST_UPDATED}
      description="How Dan Pearson / Pearson Media LLC collects, uses, shares, and protects your personal information, and your privacy rights under GDPR and US state privacy laws."
      keywords="privacy policy, GDPR, CCPA, CPRA, data protection, personal information, data rights"
      url="https://danpearson.net/privacy"
    >
      <p>
        We are committed to protecting your privacy. This policy applies to information we collect
        on this website and through related communications. It does not apply to third-party
        websites we link to. By using this site you agree to the practices described here.
      </p>

      <LegalSection heading="1. Who we are (Data Controller)">
        <p>
          The controller responsible for your personal information is{' '}
          <strong>Pearson Media LLC</strong> (“Dan Pearson”). For any privacy question or to
          exercise your rights, contact us at{' '}
          <a
            href="mailto:privacy@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            privacy@danpearson.net
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>We collect only what we need to operate the site and respond to you:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>
            <strong>Contact form data:</strong> your name, email address, subject, and message when
            you submit our contact form.
          </li>
          <li>
            <strong>Newsletter data:</strong> your email address when you subscribe to updates.
          </li>
          <li>
            <strong>Usage &amp; device data:</strong> with your consent, analytics data such as
            pages viewed, referring page, approximate location (from an anonymized IP),
            device/browser type, and interactions. IP addresses used for analytics are anonymized.
          </li>
          <li>
            <strong>Diagnostic data:</strong> with your consent, error reports and limited
            session-replay data to help us reproduce and fix technical problems.
          </li>
          <li>
            <strong>Cookies &amp; local storage:</strong> see our{' '}
            <Link to="/cookies" className="text-primary underline underline-offset-2">
              Cookie Policy
            </Link>{' '}
            for details, including strictly-necessary storage and consent-gated analytics.
          </li>
          <li>
            <strong>Administrative account data (staff only):</strong> if you are an authorized
            administrator, we process authentication data and, for security, a device fingerprint
            and IP address to protect the account. This does not apply to ordinary visitors.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> knowingly collect special-category (sensitive) data, and we do
          not collect information from children under 16.
        </p>
      </LegalSection>

      <LegalSection heading="3. How and why we use your information (legal bases)">
        <p>We use personal information for the following purposes:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>
            <strong>To respond to enquiries</strong> you send via the contact form — legal basis:
            your consent and our legitimate interest in replying to you.
          </li>
          <li>
            <strong>To send newsletters</strong> you subscribe to — legal basis: your consent. You
            can unsubscribe at any time via the link in every email.
          </li>
          <li>
            <strong>To measure and improve the site</strong> using analytics — legal basis: your
            consent.
          </li>
          <li>
            <strong>To keep the site secure and diagnose errors</strong> — legal basis: our
            legitimate interest in a safe, working site (and your consent for optional session
            replay).
          </li>
          <li>
            <strong>To comply with legal obligations</strong> where applicable.
          </li>
        </ul>
        <p>
          We do not use your information for automated decision-making that produces legal or
          similarly significant effects, and we do not sell your personal information.
        </p>
      </LegalSection>

      <LegalSection heading="4. Cookies and consent">
        <p>
          Non-essential cookies (such as analytics) are only set after you consent. You can accept,
          reject, or customize cookies at any time.
        </p>
        <Button variant="outline" onClick={openCookiePreferences}>
          Manage cookie preferences
        </Button>
      </LegalSection>

      <LegalSection heading="5. How we share information">
        <p>
          We do not sell or rent your personal information. We share it only with service providers
          (processors) who help us run the site, under contracts that require them to protect it:
        </p>
        <ul className="list-disc ml-6 space-y-2">
          <li>
            <strong>Supabase</strong> — database and backend hosting for form submissions and
            content.
          </li>
          <li>
            <strong>Google Analytics (Google LLC)</strong> — website analytics (consent-gated, IP
            anonymized).
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring and optional session replay (consent-gated).
          </li>
          <li>
            <strong>Cloudflare</strong> — website hosting, content delivery, and security.
          </li>
          <li>
            <strong>Email delivery providers</strong> — to send contact replies and newsletters.
          </li>
        </ul>
        <p>
          We may also disclose information if required by law, to protect our rights, or in
          connection with a business transfer.
        </p>
      </LegalSection>

      <LegalSection heading="6. International data transfers">
        <p>
          Our providers may process data in the United States and other countries. Where personal
          data of individuals in the EEA/UK is transferred internationally, we rely on appropriate
          safeguards such as the EU Standard Contractual Clauses or an equivalent mechanism.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data retention">
        <p>
          We keep personal information only as long as necessary for the purposes above: contact
          messages are retained while we correspond and for a reasonable period afterward;
          newsletter data until you unsubscribe; and analytics/diagnostic data for a limited period
          per the provider's default retention. We delete or anonymize data when it is no longer
          needed.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights (GDPR / UK GDPR)">
        <p>If you are in the EEA or UK, you have the right to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Access the personal data we hold about you;</li>
          <li>Rectify inaccurate or incomplete data;</li>
          <li>Erase your data (“right to be forgotten”);</li>
          <li>Restrict or object to certain processing;</li>
          <li>Data portability;</li>
          <li>Withdraw consent at any time (without affecting prior processing);</li>
          <li>Lodge a complaint with your supervisory authority.</li>
        </ul>
        <p>
          To exercise any of these, email{' '}
          <a
            href="mailto:privacy@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            privacy@danpearson.net
          </a>
          . We will respond within the timeframe required by law (generally within one month).
        </p>
      </LegalSection>

      <LegalSection heading="9. US state privacy rights (California &amp; others)">
        <p>
          If you are a California resident (CCPA/CPRA) or resident of a state with a comparable law
          (e.g., Virginia, Colorado, Connecticut, Utah), you have the right to know what personal
          information we collect, to access and delete it, to correct it, and to opt out of any
          “sale” or “sharing” of personal information and of targeted advertising.
        </p>
        <p>
          <strong>We do not sell or share your personal information</strong> as those terms are
          defined under these laws, and we do not use it for cross-context behavioral advertising.
          You may still exercise your rights, and we will not discriminate against you for doing so.
          Submit requests to{' '}
          <a
            href="mailto:privacy@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            privacy@danpearson.net
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="10. Data security">
        <p>
          We use technical and organizational measures to protect your information, including
          encryption in transit (HTTPS), access controls, and encrypted storage of sensitive
          administrative data. No method of transmission or storage is completely secure, but we
          work to protect your data and to respond promptly to any incident.
        </p>
      </LegalSection>

      <LegalSection heading="11. Children's privacy">
        <p>
          This site is not directed to children under 16, and we do not knowingly collect their
          personal information. If you believe a child has provided us information, contact us and
          we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected by
          the “Last updated” date above, and where required we will ask for renewed consent.
        </p>
      </LegalSection>

      <LegalSection heading="13. Contact us">
        <p>
          Questions or requests? Email{' '}
          <a
            href="mailto:privacy@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            privacy@danpearson.net
          </a>{' '}
          or use our{' '}
          <Link to="/connect" className="text-primary underline underline-offset-2">
            contact form
          </Link>
          . See also our{' '}
          <Link to="/terms" className="text-primary underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/cookies" className="text-primary underline underline-offset-2">
            Cookie Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default PrivacyPolicy;
