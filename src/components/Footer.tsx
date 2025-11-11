
import { Link } from 'react-router-dom';
import { Github, Linkedin, Mail, ExternalLink } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: 'GitHub',
      href: 'https://github.com/danpearson',
      icon: Github
    },
    {
      name: 'LinkedIn',
      href: 'https://www.linkedin.com/in/danpearson',
      icon: Linkedin
    },
    {
      name: 'Email',
      href: 'mailto:dan@danpearson.net',
      icon: Mail
    }
  ];

  const quickLinks = [
    { name: 'About', href: '/about' },
    { name: 'Projects', href: '/projects' },
    { name: 'News', href: '/news' },
    { name: 'AI Tools', href: '/ai-tools' },
    { name: 'Connect', href: '/connect' }
  ];

  return (
    <footer className="bg-card border-t mt-auto bottom-nav">
      <div className="container mx-auto mobile-container mobile-section">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-8 lg:gap-10 mb-8">
          {/* Brand Section */}
          <div className="space-y-4 text-center sm:text-left">
            <h3 className="text-xl sm:text-xl font-bold hero-gradient-text">
              Dan Pearson
            </h3>
            <p className="text-base sm:text-base text-primary font-semibold mb-2">
              Sales Leader • NFT Developer • AI Enthusiast
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-sm mx-auto sm:mx-0">
              Driving innovation through technology and building lasting client relationships.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4 text-center sm:text-left">
            <h4 className="text-lg sm:text-lg font-semibold text-foreground">Quick Links</h4>
            <nav className="flex flex-col space-y-1">
              {quickLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-base sm:text-base text-muted-foreground hover:text-primary transition-all duration-200 touch-target flex items-center justify-center sm:justify-start rounded-lg hover:bg-muted/20 active:bg-muted/30 px-4 sm:px-0"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Connect Section */}
          <div className="space-y-4 text-center sm:text-left">
            <h4 className="text-lg sm:text-lg font-semibold text-foreground">Connect</h4>
            <div className="flex justify-center sm:justify-start space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target-lg rounded-xl bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 flex items-center justify-center active:scale-95 hover:shadow-lg hover:shadow-primary/10"
                    aria-label={`Connect on ${social.name}`}
                  >
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </a>
                );
              })}
            </div>
            <p className="text-sm sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto sm:mx-0">
              Ready to collaborate? Let's build something amazing together.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-6"></div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 text-center sm:text-left pb-4">
          <div className="text-sm sm:text-sm text-muted-foreground order-2 sm:order-1">
            © {currentYear} Dan Pearson. All rights reserved.
            <span className="hidden sm:inline"> Built with passion for innovation.</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-sm sm:text-sm text-muted-foreground order-1 sm:order-2">
            <span className="font-medium">Built with React & Supabase</span>
            <Link
              to="/admin/login"
              className="flex items-center space-x-2 hover:text-primary transition-all duration-200 touch-target rounded-lg hover:bg-muted/20 active:bg-muted/30 px-4"
            >
              <span>Admin</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;