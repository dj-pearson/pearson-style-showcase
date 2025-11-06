import { useEffect } from 'react';

interface StructuredDataProps {
  type: 'website' | 'article' | 'person' | 'organization' | 'project';
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
        schema = {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": data?.title,
          "description": data?.excerpt,
          "image": data?.image_url,
          "datePublished": data?.created_at,
          "dateModified": data?.updated_at,
          "author": {
            "@type": "Person",
            "name": data?.author || "Dan Pearson",
            "url": "https://danpearson.net/about"
          },
          "publisher": {
            "@type": "Person",
            "name": "Dan Pearson",
            "url": "https://danpearson.net"
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://danpearson.net/article/${data?.slug}`
          },
          "keywords": (data?.tags as string[])?.join(', ') || '',
          "articleSection": data?.category,
          "wordCount": (data?.content as string)?.length || 0
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