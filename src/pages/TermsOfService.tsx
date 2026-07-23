import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';
import { Link } from 'react-router-dom';

/** Single source of truth for the terms revision date. */
export const TERMS_LAST_UPDATED = 'July 23, 2026';

const TermsOfService = () => {
  return (
    <LegalPageLayout
      title="Terms of Service"
      intro="These Terms of Service govern your use of danpearson.net. Please read them carefully. By accessing or using the site, you agree to be bound by these Terms."
      lastUpdated={TERMS_LAST_UPDATED}
      description="The terms and conditions governing your use of danpearson.net, including acceptable use, intellectual property, disclaimers, and limitation of liability."
      keywords="terms of service, terms and conditions, terms of use, acceptable use, disclaimer"
      url="https://danpearson.net/terms"
    >
      <p>
        This website is operated by <strong>Pearson Media LLC</strong> (“we”, “us”, “Dan Pearson”).
        If you do not agree with these Terms, please do not use the site.
      </p>

      <LegalSection heading="1. Acceptance of terms">
        <p>
          By accessing or using danpearson.net (the “Site”), you confirm that you are at least 16
          years old and agree to these Terms of Service and our{' '}
          <Link to="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          . If you use the Site on behalf of an organization, you represent that you are authorized
          to accept these Terms on its behalf.
        </p>
      </LegalSection>

      <LegalSection heading="2. Use of the Site">
        <p>You agree to use the Site lawfully and not to:</p>
        <ul className="list-disc ml-6 space-y-2">
          <li>Violate any applicable law or regulation;</li>
          <li>Infringe the intellectual property or other rights of anyone;</li>
          <li>
            Attempt to gain unauthorized access to any part of the Site, accounts, or systems;
          </li>
          <li>Introduce malware, or interfere with or disrupt the Site's operation or security;</li>
          <li>Scrape, harvest, or collect information about other users;</li>
          <li>Use the Site to transmit unsolicited or unlawful communications.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Intellectual property">
        <p>
          Unless otherwise noted, the content on this Site — including text, articles, graphics,
          logos, and code — is owned by or licensed to Pearson Media LLC and is protected by
          intellectual property laws. You may view and share content for personal, non-commercial
          purposes with attribution. You may not reproduce, republish, or exploit content
          commercially without our prior written permission.
        </p>
      </LegalSection>

      <LegalSection heading="4. User submissions">
        <p>
          If you submit information through the contact form, newsletter, or any other feature, you
          represent that it is accurate and that you have the right to provide it. You grant us a
          limited license to use your submission for the purpose of responding to and communicating
          with you. Do not submit confidential or sensitive personal information you do not want us
          to process. See our{' '}
          <Link to="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="5. AI-generated and informational content">
        <p>
          Some content on this Site may be generated or assisted by AI tools and is provided for
          general informational purposes only. It does not constitute professional, legal,
          financial, or other advice. You should not rely on it as a substitute for advice from a
          qualified professional.
        </p>
      </LegalSection>

      <LegalSection heading="6. Third-party links and affiliate disclosure">
        <p>
          The Site may contain links to third-party websites, including affiliate links (for
          example, Amazon). We may earn a commission when you purchase through such links, at no
          additional cost to you. We are not responsible for the content, products, or practices of
          third-party sites and encourage you to review their terms and privacy policies.
        </p>
      </LegalSection>

      <LegalSection heading="7. Disclaimer of warranties">
        <p>
          The Site is provided “as is” and “as available” without warranties of any kind, whether
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant that the Site will be uninterrupted,
          error-free, or secure.
        </p>
      </LegalSection>

      <LegalSection heading="8. Limitation of liability">
        <p>
          To the fullest extent permitted by law, Pearson Media LLC and Dan Pearson will not be
          liable for any indirect, incidental, special, consequential, or punitive damages, or any
          loss of data, profits, or goodwill, arising from your use of or inability to use the Site.
          Nothing in these Terms limits liability that cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="9. Indemnification">
        <p>
          You agree to indemnify and hold harmless Pearson Media LLC and Dan Pearson from any
          claims, damages, or expenses arising out of your misuse of the Site or violation of these
          Terms.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to the Site and Terms">
        <p>
          We may modify or discontinue the Site, and we may update these Terms at any time. Changes
          are effective when posted, reflected by the “Last updated” date above. Your continued use
          of the Site after changes constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Governing law">
        <p>
          These Terms are governed by the laws of the State of Iowa, United States, without regard
          to its conflict-of-laws rules. Any dispute will be subject to the exclusive jurisdiction
          of the courts located in Iowa, unless applicable law provides otherwise.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact">
        <p>
          Questions about these Terms? Email{' '}
          <a
            href="mailto:legal@danpearson.net"
            className="text-primary underline underline-offset-2"
          >
            legal@danpearson.net
          </a>{' '}
          or use our{' '}
          <Link to="/connect" className="text-primary underline underline-offset-2">
            contact form
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default TermsOfService;
