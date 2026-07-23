import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accessibility as AccessibilityIcon,
  Eye,
  Keyboard,
  Monitor,
  Volume2,
  Mail,
  Phone,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import ExternalLinkComponent from '@/components/ui/external-link';

// Date of the most recent accessibility review. Update this when the statement
// is re-audited — it must reflect the actual review date, not today's date.
const LAST_REVIEWED = 'July 23, 2026';

const Accessibility = () => {
  const currentDate = LAST_REVIEWED;

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Accessibility Statement | Dan Pearson - ADA Compliance & WCAG 2.1"
        description="Our commitment to digital accessibility. Learn about our accessibility features, WCAG 2.1 AA compliance efforts, and how to contact us for accessibility assistance."
        keywords="accessibility statement, ADA compliance, WCAG 2.1, web accessibility, screen reader support, keyboard navigation, assistive technology"
        url="https://danpearson.net/accessibility"
        type="website"
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                <AccessibilityIcon className="w-8 h-8 text-primary" aria-hidden="true" />
              </div>
              <h1 className="mobile-heading-lg hero-gradient-text mb-4">Accessibility Statement</h1>
              <p className="mobile-body text-muted-foreground max-w-2xl mx-auto">
                Dan Pearson and Pearson Media LLC are committed to ensuring digital accessibility
                for people with disabilities. We continually improve the user experience for
                everyone and apply relevant accessibility standards.
              </p>
              <p className="text-sm text-muted-foreground mt-4">Last updated: {currentDate}</p>
            </div>

            {/* Conformance Status */}
            <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" aria-hidden="true" />
                  Conformance Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  The Web Content Accessibility Guidelines (WCAG) defines requirements for designers
                  and developers to improve accessibility for people with disabilities. It defines
                  three levels of conformance: Level A, Level AA, and Level AAA.
                </p>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="font-semibold text-foreground">
                    danpearson.net is <strong>substantially conformant</strong> with WCAG 2.1 level
                    AA.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Substantially conformant means that most content on this website meets the WCAG
                    2.1 Level AA success criteria. We continuously audit and improve accessibility
                    to maintain and enhance compliance.
                  </p>
                </div>

                {/* WCAG 2.1 AA Criteria Met */}
                <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">
                    Key WCAG 2.1 AA Criteria Met:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                    <li>
                      <strong>1.1.1 Non-text Content:</strong> Alt text for images and icons
                    </li>
                    <li>
                      <strong>1.3.1 Info and Relationships:</strong> Semantic HTML, proper heading
                      hierarchy
                    </li>
                    <li>
                      <strong>1.4.3 Contrast (Minimum):</strong> 4.5:1 ratio for normal text
                    </li>
                    <li>
                      <strong>1.4.4 Resize Text:</strong> Content reflows up to 400% zoom
                    </li>
                    <li>
                      <strong>2.1.1 Keyboard:</strong> All functionality available via keyboard
                    </li>
                    <li>
                      <strong>2.4.1 Bypass Blocks:</strong> Skip-to-content links provided
                    </li>
                    <li>
                      <strong>2.4.3 Focus Order:</strong> Logical tab order throughout
                    </li>
                    <li>
                      <strong>2.4.7 Focus Visible:</strong> Clear focus indicators on all elements
                    </li>
                    <li>
                      <strong>2.5.5 Target Size:</strong> 44px minimum touch targets
                    </li>
                    <li>
                      <strong>3.2.1 On Focus:</strong> No unexpected context changes
                    </li>
                    <li>
                      <strong>4.1.2 Name, Role, Value:</strong> Proper ARIA labels and roles
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Accessibility Features */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Accessibility Features</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  We have implemented the following accessibility features on this website:
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Keyboard className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Keyboard Navigation</h3>
                        <p className="text-sm text-muted-foreground">
                          All interactive elements are accessible via keyboard. Use Tab to navigate,
                          Enter/Space to activate, and Escape to close dialogs.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Visual Design</h3>
                        <p className="text-sm text-muted-foreground">
                          Color contrast ratios meet WCAG AA standards. Focus indicators are clearly
                          visible on all interactive elements.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Volume2 className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Screen Reader Support</h3>
                        <p className="text-sm text-muted-foreground">
                          Semantic HTML structure, ARIA labels, and live regions ensure
                          compatibility with assistive technologies.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Responsive Design</h3>
                        <p className="text-sm text-muted-foreground">
                          Content reflows at all zoom levels up to 400%. The site works on all
                          screen sizes and orientations.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Skip Links</h3>
                        <p className="text-sm text-muted-foreground">
                          Skip navigation links allow keyboard users to bypass repetitive content
                          and jump directly to main content.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <AccessibilityIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Motion Preferences</h3>
                        <p className="text-sm text-muted-foreground">
                          Animations respect the "prefers-reduced-motion" system setting for users
                          who are sensitive to motion.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technical Specifications */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Technical Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Accessibility of danpearson.net relies on the following technologies to work:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>HTML5 with semantic markup</li>
                  <li>
                    WAI-ARIA (Web Accessibility Initiative - Accessible Rich Internet Applications)
                  </li>
                  <li>CSS with support for high contrast and reduced motion preferences</li>
                  <li>JavaScript with progressive enhancement</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  These technologies are relied upon for conformance with the accessibility
                  standards used.
                </p>
              </CardContent>
            </Card>

            {/* Tested With */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Compatibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  This website is designed to be compatible with the following assistive
                  technologies:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>NVDA and JAWS screen readers on Windows</li>
                  <li>VoiceOver screen reader on macOS and iOS</li>
                  <li>TalkBack screen reader on Android</li>
                  <li>Browser magnification tools</li>
                  <li>Keyboard-only navigation</li>
                  <li>Voice control software</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  The site is tested with the latest versions of Chrome, Firefox, Safari, and Edge
                  browsers.
                </p>
              </CardContent>
            </Card>

            {/* Known Limitations */}
            <Card className="mb-8 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" aria-hidden="true" />
                  Known Limitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Despite our best efforts to ensure accessibility, there may be some limitations.
                  The following are known accessibility issues that we are working to resolve:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1" aria-hidden="true">
                      •
                    </span>
                    <div>
                      <strong className="text-foreground">Third-party content:</strong>
                      <span className="text-muted-foreground ml-1">
                        Some embedded content from third-party services may not meet all
                        accessibility standards.
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1" aria-hidden="true">
                      •
                    </span>
                    <div>
                      <strong className="text-foreground">PDF documents:</strong>
                      <span className="text-muted-foreground ml-1">
                        Some older PDF files may not be fully accessible. Contact us for accessible
                        alternatives.
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1" aria-hidden="true">
                      •
                    </span>
                    <div>
                      <strong className="text-foreground">Complex visualizations:</strong>
                      <span className="text-muted-foreground ml-1">
                        3D elements and complex charts include text alternatives, but may not convey
                        all information.
                      </span>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle>Feedback & Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  We welcome your feedback on the accessibility of danpearson.net. Please let us
                  know if you encounter accessibility barriers:
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <a
                    href="mailto:accessibility@danpearson.net"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Mail className="w-5 h-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Email</p>
                      <p className="text-sm text-primary">accessibility@danpearson.net</p>
                    </div>
                  </a>

                  <a
                    href="/connect"
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Phone className="w-5 h-5 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Contact Form</p>
                      <p className="text-sm text-primary">Use our accessible contact form</p>
                    </div>
                  </a>
                </div>

                <p className="text-sm text-muted-foreground">
                  We try to respond to accessibility feedback within 5 business days. If you need
                  immediate assistance, please specify in your message.
                </p>
              </CardContent>
            </Card>

            {/* Formal Complaints */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Formal Complaints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  If you are not satisfied with our response to your accessibility concern, you may
                  escalate the matter to:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary" aria-hidden="true">
                      •
                    </span>
                    <span>
                      <strong className="text-foreground">U.S. Department of Justice</strong> -
                      Civil Rights Division, Disability Rights Section
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary" aria-hidden="true">
                      •
                    </span>
                    <span>
                      <strong className="text-foreground">U.S. Access Board</strong> - For Section
                      508 compliance concerns
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Resources */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Accessibility Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Learn more about web accessibility and your rights:
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ExternalLinkComponent
                    href="https://www.w3.org/WAI/standards-guidelines/wcag/"
                    className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors block"
                  >
                    <span className="text-foreground font-medium">WCAG Guidelines</span>
                    <p className="text-sm text-muted-foreground">
                      Web Content Accessibility Guidelines
                    </p>
                  </ExternalLinkComponent>

                  <ExternalLinkComponent
                    href="https://www.ada.gov/"
                    className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors block"
                  >
                    <span className="text-foreground font-medium">ADA.gov</span>
                    <p className="text-sm text-muted-foreground">Americans with Disabilities Act</p>
                  </ExternalLinkComponent>

                  <ExternalLinkComponent
                    href="https://webaim.org/"
                    className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors block"
                  >
                    <span className="text-foreground font-medium">WebAIM</span>
                    <p className="text-sm text-muted-foreground">Web Accessibility In Mind</p>
                  </ExternalLinkComponent>

                  <ExternalLinkComponent
                    href="https://www.section508.gov/"
                    className="p-3 rounded-lg border border-border hover:border-primary/50 transition-colors block"
                  >
                    <span className="text-foreground font-medium">Section508.gov</span>
                    <p className="text-sm text-muted-foreground">Federal IT Accessibility</p>
                  </ExternalLinkComponent>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-6">
                Have questions or need assistance? We're here to help.
              </p>
              <Button
                size="lg"
                className="btn-futuristic"
                onClick={() => (window.location.href = '/connect')}
              >
                Contact Us
                <ExternalLink className="w-5 h-5 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Accessibility;
