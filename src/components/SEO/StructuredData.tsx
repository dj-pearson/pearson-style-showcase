import { useEffect } from 'react';

interface StructuredDataProps {
  type: 'website' | 'article' | 'person' | 'organization' | 'project' | 'faq' | 'howto' | 'product' | 'breadcrumb' | 'review' | 'localbusiness';
  data?: Record<string, unknown>;
}

const StructuredData = ({ type, data }: StructuredDataProps) => {
  useEffect(() => {
    let schema = {};

    switch (type) {
      case 'website':
        schema = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Dan Pearson - AI Engineer & Business Development Expert",
          "description": "Experienced AI engineer and business development leader specializing in NFT development, AI integration, and sales leadership.",
          "url": "https://danpearson.net",
          "author": {
            "@type": "Person",
            "name": "Dan Pearson",
            "url": "https://danpearson.net/about",
            "jobTitle": "AI Engineer & Business Development Expert",
            "knowsAbout": ["Artificial Intelligence", "Business Development", "NFT Development", "Sales Leadership", "React Development"]
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://danpearson.net/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        };
        break;

      case 'person':
        schema = {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "Dan Pearson",
          "jobTitle": "AI Engineer & Business Development Expert",
          "description": "Experienced AI engineer and business development leader specializing in NFT development, AI integration, and sales leadership.",
          "url": "https://danpearson.net",
          "sameAs": [
            "https://linkedin.com/in/danpearson",
            "https://github.com/danpearson",
            "https://twitter.com/danpearson"
          ],
          "knowsAbout": [
            "Artificial Intelligence",
            "Machine Learning",
            "Business Development",
            "NFT Development", 
            "Sales Leadership",
            "React Development",
            "JavaScript",
            "TypeScript"
          ],
          "alumniOf": data?.education || [],
          "worksFor": {
            "@type": "Organization",
            "name": data?.currentEmployer || "Freelance"
          }
        };
        break;

      case 'article':
        // Enhanced article schema for AI search optimization
        // Includes: entity linking (about/mentions), speakable, and rich author data
        schema = {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": data?.headline || data?.title,
          "alternativeHeadline": data?.excerpt,
          "description": data?.description || data?.excerpt,
          "image": data?.image,
          "datePublished": data?.datePublished,
          "dateModified": data?.dateModified,
          "author": data?.author || {
            "@type": "Person",
            "name": "Dan Pearson",
            "url": "https://danpearson.net/about"
          },
          "publisher": data?.publisher || {
            "@type": "Person",
            "name": "Dan Pearson",
            "url": "https://danpearson.net"
          },
          "mainEntityOfPage": data?.mainEntityOfPage || {
            "@type": "WebPage",
            "@id": `https://danpearson.net/news/${data?.slug}`
          },
          "keywords": data?.keywords,
          "articleSection": data?.articleSection,
          "wordCount": data?.wordCount,

          // AI Search Optimization: Entity linking
          // "about" - Main topics/entities the article is about
          ...(data?.about && Array.isArray(data.about) ? {
            "about": (data.about as string[]).map(topic => ({
              "@type": "Thing",
              "name": topic
            }))
          } : {}),

          // "mentions" - Entities mentioned in the article
          ...(data?.mentions && Array.isArray(data.mentions) ? {
            "mentions": (data.mentions as string[]).map(entity => ({
              "@type": "Thing",
              "name": entity
            }))
          } : {}),

          // Voice search optimization: Speakable content
          // Identifies content suitable for text-to-speech
          ...(data?.speakable ? {
            "speakable": {
              "@type": "SpeakableSpecification",
              "cssSelector": data.speakable
            }
          } : {}),

          // AI-friendly: Key takeaways as abstract
          ...(data?.abstract ? {
            "abstract": data.abstract
          } : {}),

          // Citation: For AI engines that cite sources
          ...(data?.citation ? {
            "citation": data.citation
          } : {}),

          // isAccessibleForFree: Helps AI understand content availability
          "isAccessibleForFree": true,

          // inLanguage: Helps with language understanding
          "inLanguage": "en-US"
        };
        break;

      case 'project':
        schema = {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          "name": data?.title,
          "description": data?.description,
          "image": data?.image_url,
          "url": data?.live_link,
          "codeRepository": data?.github_link,
          "dateCreated": data?.created_at,
          "dateModified": data?.updated_at,
          "creator": {
            "@type": "Person",
            "name": "Dan Pearson",
            "url": "https://danpearson.net/about"
          },
          "keywords": (data?.tags as string[])?.join(', ') || '',
          "programmingLanguage": data?.technologies || []
        };
        break;

      case 'organization':
        schema = {
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          "name": "Dan Pearson - AI Engineering Services",
          "description": "Professional AI engineering and business development consulting services.",
          "url": "https://danpearson.net",
          "founder": {
            "@type": "Person",
            "name": "Dan Pearson"
          },
          "serviceType": [
            "AI Development",
            "Business Development",
            "NFT Development",
            "Sales Consulting",
            "React Development"
          ],
          "areaServed": "Worldwide",
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": data?.phone || "",
            "email": data?.email || "dan@danpearson.net",
            "contactType": "business inquiry"
          }
        };
        break;

      case 'faq':
        schema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": (data?.questions as Array<{ question: string; answer: string }>)?.map(q => ({
            "@type": "Question",
            "name": q.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": q.answer
            }
          })) || []
        };
        break;

      case 'howto':
        schema = {
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": data?.title,
          "description": data?.description,
          "image": data?.image_url,
          "totalTime": data?.totalTime || "PT30M",
          "estimatedCost": {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": data?.cost || "0"
          },
          "step": (data?.steps as Array<{ name: string; text: string; image?: string }>)?.map((step, index) => ({
            "@type": "HowToStep",
            "position": index + 1,
            "name": step.name,
            "text": step.text,
            "image": step.image
          })) || []
        };
        break;

      case 'product':
        schema = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": data?.title,
          "description": data?.description,
          "image": data?.image_url,
          "brand": {
            "@type": "Brand",
            "name": data?.brand || "Generic"
          },
          "offers": {
            "@type": "Offer",
            "url": data?.affiliate_url,
            "priceCurrency": "USD",
            "price": data?.price,
            "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            "availability": "https://schema.org/InStock",
            "seller": {
              "@type": "Organization",
              "name": "Amazon"
            }
          },
          "aggregateRating": data?.rating ? {
            "@type": "AggregateRating",
            "ratingValue": data?.rating,
            "reviewCount": data?.rating_count || 0,
            "bestRating": "5",
            "worstRating": "1"
          } : undefined
        };
        break;

      case 'breadcrumb':
        schema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": (data?.items as Array<{ name: string; url: string }>)?.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url
          })) || []
        };
        break;

      case 'review':
        schema = {
          "@context": "https://schema.org",
          "@type": "Review",
          "itemReviewed": {
            "@type": data?.itemType || "Thing",
            "name": data?.itemName
          },
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": data?.rating,
            "bestRating": "5",
            "worstRating": "1"
          },
          "author": {
            "@type": "Person",
            "name": data?.reviewerName || "Dan Pearson"
          },
          "reviewBody": data?.reviewText,
          "datePublished": data?.datePublished
        };
        break;

      case 'localbusiness':
        // LocalBusiness schema for improved local SEO rankings
        // Helps with "near me" searches and Google Maps visibility
        schema = {
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          "@id": "https://danpearson.net/#localbusiness",
          "name": data?.name || "Dan Pearson - AI Automation Consulting",
          "alternateName": data?.alternateName || "Pearson Media LLC",
          "description": data?.description || "AI automation consulting services helping businesses reduce operational costs by 40% through intelligent automation, workflow optimization, and digital transformation. Specializing in OpenAI, Claude AI, and custom SaaS development.",
          "url": "https://danpearson.net",
          "telephone": data?.telephone || "",
          "email": data?.email || "dan@danpearson.net",
          "image": data?.image || "https://danpearson.net/android-chrome-512x512.png",
          "logo": "https://danpearson.net/android-chrome-512x512.png",
          "priceRange": data?.priceRange || "$$",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": data?.addressLocality || "Des Moines",
            "addressRegion": data?.addressRegion || "IA",
            "addressCountry": data?.addressCountry || "US"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": data?.latitude || "41.5868",
            "longitude": data?.longitude || "-93.6250"
          },
          "areaServed": [
            {
              "@type": "City",
              "name": "Des Moines",
              "containedInPlace": {
                "@type": "State",
                "name": "Iowa"
              }
            },
            {
              "@type": "Country",
              "name": "United States"
            }
          ],
          "serviceType": data?.serviceType || [
            "AI Automation Consulting",
            "Business Process Automation",
            "AI Integration Services",
            "SaaS Development",
            "Digital Transformation Consulting",
            "Workflow Optimization",
            "OpenAI Integration",
            "Claude AI Implementation"
          ],
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "AI Consulting Services",
            "itemListElement": [
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "AI Automation Consulting",
                  "description": "Strategic consulting for implementing AI automation in business processes"
                }
              },
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "Custom SaaS Development",
                  "description": "End-to-end development of AI-powered SaaS applications"
                }
              },
              {
                "@type": "Offer",
                "itemOffered": {
                  "@type": "Service",
                  "name": "AI Integration Services",
                  "description": "Integration of OpenAI, Claude, and other AI systems into existing workflows"
                }
              }
            ]
          },
          "founder": {
            "@type": "Person",
            "name": "Dan Pearson",
            "jobTitle": "AI Solutions Consultant",
            "url": "https://danpearson.net/about"
          },
          "aggregateRating": data?.aggregateRating || {
            "@type": "AggregateRating",
            "ratingValue": "5",
            "reviewCount": "50",
            "bestRating": "5",
            "worstRating": "1"
          },
          "sameAs": [
            "https://linkedin.com/in/danpearson",
            "https://github.com/dj-pearson"
          ],
          "knowsAbout": [
            "Artificial Intelligence",
            "Business Automation",
            "SaaS Development",
            "Digital Transformation",
            "Machine Learning",
            "Workflow Optimization"
          ],
          "slogan": "Reduce operational costs by 40% with intelligent AI automation"
        };
        break;
    }

    // Create or update the script tag
    const scriptId = `structured-data-${type}`;
    const existingScript = document.getElementById(scriptId);
    
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [type, data]);

  return null;
};

export default StructuredData;