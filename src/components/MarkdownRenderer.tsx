import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DOMPurify from 'dompurify';
import { validateUrl } from '@/lib/security';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface MarkdownComponentProps {
  children?: React.ReactNode;
  node?: unknown;
  inline?: boolean;
  className?: string;
  href?: string;
  src?: string;
  alt?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Allowed style values for custom components (whitelist approach)
  const ALLOWED_BUTTON_STYLES = ['primary', 'secondary', 'outline', 'destructive'];
  const ALLOWED_ALERT_TYPES = ['info', 'warning', 'success', 'error'];
  const ALLOWED_BADGE_VARIANTS = ['default', 'secondary', 'destructive', 'outline'];

  // Custom component for rendering HTML buttons and components
  const renderCustomHTML = (htmlContent: string) => {
    // Parse custom button syntax: [button:text:url:style]
    const buttonRegex = /\[button:([^:]+):([^:]+):?([^\]]*)\]/g;
    let processedContent = htmlContent.replace(
      buttonRegex,
      (match, text, url, style = 'primary') => {
        // SECURITY: Validate URL at parse time to prevent XSS via javascript:, data:, vbscript: protocols
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          // Render as plain text if URL is invalid
          return `<span>${DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })}</span>`;
        }
        // SECURITY: Whitelist style values to prevent attribute injection
        const safeStyle = ALLOWED_BUTTON_STYLES.includes(style) ? style : 'primary';
        const buttonId = `btn-${Math.random().toString(36).substr(2, 9)}`;
        // Sanitize text content (strip all HTML)
        const safeText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
        return `<span data-custom-btn="${buttonId}" data-url="${validatedUrl}" data-style="${safeStyle}">${safeText}</span>`;
      }
    );

    // Parse custom alert syntax: [alert:type:message]
    const alertRegex = /\[alert:([^:]+):([^\]]+)\]/g;
    processedContent = processedContent.replace(alertRegex, (match, type, message) => {
      // SECURITY: Whitelist alert type values
      const safeType = ALLOWED_ALERT_TYPES.includes(type) ? type : 'info';
      const alertId = `alert-${Math.random().toString(36).substr(2, 9)}`;
      // Sanitize message content (allow limited formatting)
      const safeMessage = DOMPurify.sanitize(message, { ALLOWED_TAGS: ['strong', 'em'] });
      return `<div data-custom-alert="${alertId}" data-type="${safeType}">${safeMessage}</div>`;
    });

    // Parse custom badge syntax: [badge:text:variant]
    const badgeRegex = /\[badge:([^:]+):?([^\]]*)\]/g;
    processedContent = processedContent.replace(badgeRegex, (match, text, variant = 'default') => {
      // SECURITY: Whitelist variant values
      const safeVariant = ALLOWED_BADGE_VARIANTS.includes(variant) ? variant : 'default';
      const badgeId = `badge-${Math.random().toString(36).substr(2, 9)}`;
      // Sanitize text content (strip all HTML)
      const safeText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
      return `<span data-custom-badge="${badgeId}" data-variant="${safeVariant}">${safeText}</span>`;
    });

    return processedContent;
  };

  const components = {
    code({ node, inline, className, children, ...props }: MarkdownComponentProps) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-md"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },

    blockquote({ children }: MarkdownComponentProps) {
      return (
        <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
          {children}
        </blockquote>
      );
    },

    table({ children }: MarkdownComponentProps) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="w-full border-collapse border border-border">{children}</table>
        </div>
      );
    },

    th({ children }: MarkdownComponentProps) {
      return (
        <th className="border border-border bg-muted p-2 text-left font-semibold">{children}</th>
      );
    },

    td({ children }: MarkdownComponentProps) {
      return <td className="border border-border p-2">{children}</td>;
    },

    h1({ children }: MarkdownComponentProps) {
      return <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">{children}</h1>;
    },

    h2({ children }: MarkdownComponentProps) {
      return <h2 className="text-2xl font-semibold mt-6 mb-3">{children}</h2>;
    },

    h3({ children }: MarkdownComponentProps) {
      return <h3 className="text-xl font-semibold mt-5 mb-2">{children}</h3>;
    },

    h4({ children }: MarkdownComponentProps) {
      return <h4 className="text-lg font-semibold mt-4 mb-2">{children}</h4>;
    },

    p({ children }: MarkdownComponentProps) {
      return <p className="mb-4 leading-relaxed">{children}</p>;
    },

    ul({ children }: MarkdownComponentProps) {
      return <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>;
    },

    ol({ children }: MarkdownComponentProps) {
      return <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>;
    },

    li({ children }: MarkdownComponentProps) {
      return <li className="ml-4">{children}</li>;
    },

    a({ href, children }: MarkdownComponentProps) {
      // SECURITY: Validate URL to prevent XSS via javascript: protocol.
      // Relative hrefs are allowed here so in-site links written in article
      // markdown ("/ai-crm-automation") resolve instead of being downgraded to
      // plain text — internal linking is load-bearing for the content strategy.
      const validatedHref = href ? validateUrl(href, { allowRelative: true }) : null;

      // If URL validation fails, render as plain text instead of link
      if (!validatedHref) {
        return <span className="text-muted-foreground">{children}</span>;
      }

      return (
        <a
          href={validatedHref}
          className="text-primary hover:text-primary/80 underline transition-colors"
          target={validatedHref.startsWith('http') ? '_blank' : undefined}
          rel={validatedHref.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },

    img({ src, alt }: MarkdownComponentProps) {
      // SECURITY: Validate image src to reject javascript:, data:image/svg (can contain JS), and other dangerous URIs
      let safeSrc = src;
      if (src) {
        // Block data: URIs with SVG (can embed JavaScript) and other dangerous protocols
        const lowerSrc = src.toLowerCase().trim();
        if (
          lowerSrc.startsWith('data:image/svg') ||
          lowerSrc.startsWith('javascript:') ||
          lowerSrc.startsWith('vbscript:')
        ) {
          safeSrc = undefined;
        }
        // For http/https URLs, validate them
        if (lowerSrc.startsWith('http:') || lowerSrc.startsWith('https:')) {
          safeSrc = validateUrl(src) || undefined;
        }
        // Allow relative URLs and safe data: URIs (non-SVG like data:image/png)
      }

      if (!safeSrc) {
        return (
          <div className="my-6 p-4 bg-muted rounded-lg text-center text-muted-foreground">
            <p className="text-sm">Image could not be displayed</p>
            {alt && <p className="text-sm italic mt-1">{alt}</p>}
          </div>
        );
      }

      return (
        <div className="my-6">
          <img src={safeSrc} alt={alt} className="w-full rounded-lg shadow-lg" loading="lazy" />
          {alt && <p className="text-sm text-muted-foreground text-center mt-2 italic">{alt}</p>}
        </div>
      );
    },

    hr() {
      return <hr className="my-8 border-border" />;
    },
  };

  // Process content to handle both Markdown and HTML
  const containsHTML = /<[a-z][\s\S]*>/i.test(content);
  const containsMarkdown =
    /[#*`[\]_~-]/.test(content) ||
    content.includes('**') ||
    content.includes('##') ||
    content.includes('###');

  // Only process custom HTML syntax if we have HTML content or custom components
  const hasCustomComponents =
    content.includes('[button:') || content.includes('[alert:') || content.includes('[badge:');
  const processedContent =
    containsHTML || hasCustomComponents ? renderCustomHTML(content) : content;

  // Custom component to handle our special elements with sanitization
  const CustomHTMLRenderer: React.FC<{ html: string }> = ({ html }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Sanitize HTML to prevent XSS attacks
    const sanitizedHtml = React.useMemo(() => {
      // SECURITY: 'button' removed from ALLOWED_TAGS - custom buttons use span[data-custom-btn] instead
      // This prevents onclick handler injection via button elements
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'u',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'a',
          'ul',
          'ol',
          'li',
          'blockquote',
          'code',
          'pre',
          'img',
          'div',
          'span',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'hr',
        ],
        ALLOWED_ATTR: [
          'href',
          'src',
          'alt',
          'title',
          'class',
          'id',
          'data-custom-btn',
          'data-url',
          'data-style',
          'data-custom-alert',
          'data-type',
          'data-custom-badge',
          'data-variant',
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
      });

      // SECURITY: Post-sanitization - validate all img src attributes to block SVG XSS
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitized;
      const images = tempDiv.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          const lowerSrc = src.toLowerCase().trim();
          if (
            lowerSrc.startsWith('data:image/svg') ||
            lowerSrc.startsWith('javascript:') ||
            lowerSrc.startsWith('vbscript:')
          ) {
            img.removeAttribute('src');
            img.setAttribute('alt', 'Image blocked for security');
          }
        }
      });

      return tempDiv.innerHTML;
    }, [html]);

    React.useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;

      // Handle custom buttons (now rendered as span elements for security)
      const customButtons = container.querySelectorAll('[data-custom-btn]');
      customButtons.forEach((btn) => {
        const url = btn.getAttribute('data-url');
        // SECURITY: Re-validate style against whitelist (defense in depth)
        const rawStyle = btn.getAttribute('data-style') || 'primary';
        const style = ALLOWED_BUTTON_STYLES.includes(rawStyle) ? rawStyle : 'primary';

        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.className = `inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer ring-offset-background h-10 py-2 px-4 ${
          style === 'primary'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : style === 'secondary'
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : style === 'outline'
                ? 'border border-input hover:bg-accent hover:text-accent-foreground'
                : style === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } my-2 mx-1`;

        if (url) {
          // SECURITY: Re-validate URL at click time (defense in depth - already validated at parse time)
          const handleClick = () => {
            const validatedUrl = validateUrl(url);
            if (!validatedUrl) {
              return;
            }
            window.open(validatedUrl, '_blank', 'noopener,noreferrer');
          };
          btn.addEventListener('click', handleClick);
          btn.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
              e.preventDefault();
              handleClick();
            }
          });
        }
      });

      // Handle custom alerts
      const customAlerts = container.querySelectorAll('[data-custom-alert]');
      customAlerts.forEach((alert) => {
        const type = alert.getAttribute('data-type') || 'info';

        const colorMap = {
          info: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
          warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
          success: 'border-green-500/50 bg-green-500/10 text-green-400',
          error: 'border-red-500/50 bg-red-500/10 text-red-400',
        };

        alert.className = `flex items-center space-x-2 rounded-md border p-4 my-4 ${colorMap[type as keyof typeof colorMap] || colorMap.info}`;
      });

      // Handle custom badges
      const customBadges = container.querySelectorAll('[data-custom-badge]');
      customBadges.forEach((badge) => {
        const variant = badge.getAttribute('data-variant') || 'default';

        const variantMap = {
          default: 'bg-primary text-primary-foreground hover:bg-primary/80',
          secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
          outline:
            'text-foreground border border-input hover:bg-accent hover:text-accent-foreground',
        };

        badge.className = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantMap[variant as keyof typeof variantMap] || variantMap.default} mx-1`;
      });

      // Style any links in HTML (but preserve amazon-button and other custom classes)
      const htmlLinks = container.querySelectorAll('a:not([data-custom-btn])');
      htmlLinks.forEach((link) => {
        // SECURITY: Validate href to prevent XSS via javascript: protocol.
        // Relative hrefs allowed for the same reason as the markdown `a`
        // renderer above — in-site links in embedded HTML must survive.
        const href = link.getAttribute('href');
        if (href) {
          const validatedHref = validateUrl(href, { allowRelative: true });
          if (!validatedHref) {
            // Remove href if invalid (converts to plain text)
            link.removeAttribute('href');
            // Anchor elements from an 'a' selector are HTMLElements at runtime
            (link as HTMLElement).style.cursor = 'default';
            (link as HTMLElement).style.textDecoration = 'none';
            return;
          }
          // Update with validated URL
          link.setAttribute('href', validatedHref);
        }

        // Don't override amazon-button or other custom styled links
        if (
          !link.className.includes('amazon-button') &&
          !link.className.includes('text-') &&
          !link.getAttribute('style')?.includes('color')
        ) {
          link.className =
            `${link.className} text-primary hover:text-primary/80 underline transition-colors`.trim();
        }

        // Ensure external links open in new tab
        if (href?.startsWith('http')) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }, [sanitizedHtml]);

    return (
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        className="space-y-6 text-foreground/90 leading-relaxed"
      />
    );
  };

  if (containsHTML && !containsMarkdown) {
    // Pure HTML content - render as HTML
    return (
      <div className={`prose prose-lg prose-invert max-w-none ${className}`}>
        <CustomHTMLRenderer html={processedContent} />
      </div>
    );
  } else if (containsHTML && containsMarkdown) {
    // Mixed content - sanitize and render HTML first, then process any remaining markdown
    // SECURITY: 'button' removed from ALLOWED_TAGS - custom buttons use span[data-custom-btn]
    const sanitizedContent = DOMPurify.sanitize(processedContent, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
        'pre',
        'img',
        'div',
        'span',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'data-custom-btn',
        'data-url',
        'data-style',
        'data-custom-alert',
        'data-type',
        'data-custom-badge',
        'data-variant',
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });

    return (
      <div className={`prose prose-lg prose-invert max-w-none ${className}`}>
        <div
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          className="space-y-6 text-foreground/90 leading-relaxed"
        />
      </div>
    );
  }

  // Pure Markdown content - render with ReactMarkdown
  return (
    <div className={`prose prose-lg prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
