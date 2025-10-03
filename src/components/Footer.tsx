import React from 'react';
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
    <footer className="bg-card border-t mt-auto">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 lg:py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Brand Section */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-lg sm:text-xl font-bold hero-gradient-text">
              Dan Pearson
            </h3>
            <p className="text-sm sm:text-base text-primary font-medium mb-2">
              Sales Leader • NFT Developer • AI Enthusiast
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Driving innovation through technology and building lasting client relationships.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-base sm:text-lg font-semibold text-foreground">Quick Links</h4>
            <nav className="flex flex-col space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm sm:text-base text-muted-foreground hover:text-primary transition-colors duration-200 min-h-[44px] flex items-center"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Connect Section */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-base sm:text-lg font-semibold text-foreground">Connect</h4>
            <div className="flex space-x-3 sm:space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-primary transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={social.name}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Ready to collaborate? Let's build something amazing together.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-5 sm:mb-6"></div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 text-center sm:text-left">
          <div className="text-xs sm:text-sm text-muted-foreground">
            © {currentYear} Dan Pearson. All rights reserved. Built with passion for innovation.
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
            <span>Built with React & Supabase</span>
            <a
              href="/admin/login"
              className="flex items-center space-x-1 hover:text-primary transition-colors min-h-[44px] py-2"
            >
              <span>Admin</span>
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;