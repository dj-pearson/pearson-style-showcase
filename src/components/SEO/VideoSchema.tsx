import { useEffect } from 'react';

/**
 * Video Schema Component for SEO
 * Implements VideoObject schema for rich video results in Google Search
 *
 * Benefits:
 * - Rich video thumbnails in search results
 * - Video carousels and featured snippets
 * - Better visibility in Google Video Search
 * - Enhanced CTR from search results
 *
 * Usage:
 * <VideoSchema
 *   name="How to Build an AI Application"
 *   description="Learn how to build AI-powered applications from scratch"
 *   thumbnailUrl="https://example.com/thumbnail.jpg"
 *   uploadDate="2024-01-15"
 *   duration="PT10M30S"
 *   contentUrl="https://example.com/video.mp4"
 *   embedUrl="https://youtube.com/embed/abc123"
 * />
 */

export interface VideoSchemaProps {
  /** Video title */
  name: string;
  /** Video description */
  description: string;
  /** URL to video thumbnail image */
  thumbnailUrl: string;
  /** ISO 8601 date when video was uploaded (e.g., "2024-01-15") */
  uploadDate: string;
  /** ISO 8601 duration (e.g., "PT1H30M" for 1 hour 30 minutes, "PT10M30S" for 10 minutes 30 seconds) */
  duration: string;
  /** Direct URL to the video file (optional if embedUrl provided) */
  contentUrl?: string;
  /** URL to embedded video player (for YouTube, Vimeo, etc.) */
  embedUrl?: string;
  /** Video width in pixels (default: 1280) */
  width?: number;
  /** Video height in pixels (default: 720) */
  height?: number;
  /** Publisher/creator name (default: "Dan Pearson") */
  author?: string;
  /** Date video was published (defaults to uploadDate if not provided) */
  publicationDate?: string;
  /** Array of video tags/keywords */
  keywords?: string[];
  /** Video category (e.g., "Technology", "Tutorial", "Business") */
  genre?: string;
  /** Whether video is family-friendly (default: true) */
  isFamilyFriendly?: boolean;
  /** Region where video is allowed (ISO 3166 country code, e.g., "US") */
  regionsAllowed?: string[];
  /** Whether video requires subscription (default: false) */
  requiresSubscription?: boolean;
  /** Video language (default: "en") */
  inLanguage?: string;
}

const VideoSchema: React.FC<VideoSchemaProps> = ({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  contentUrl,
  embedUrl,
  width = 1280,
  height = 720,
  author = 'Dan Pearson',
  publicationDate,
  keywords = [],
  genre,
  isFamilyFriendly = true,
  regionsAllowed = ['US'],
  requiresSubscription = false,
  inLanguage = 'en',
}) => {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name,
      description,
      thumbnailUrl,
      uploadDate,
      duration,
      ...(contentUrl && { contentUrl }),
      ...(embedUrl && { embedUrl }),
      width: `${width}px`,
      height: `${height}px`,

      // Author/Creator
      author: {
        '@type': 'Person',
        name: author,
        url: 'https://danpearson.net/about',
      },

      // Publisher (required for rich results)
      publisher: {
        '@type': 'Person',
        name: 'Dan Pearson',
        url: 'https://danpearson.net',
        logo: {
          '@type': 'ImageObject',
          url: 'https://danpearson.net/android-chrome-512x512.png',
        },
      },

      // Publication date
      datePublished: publicationDate || uploadDate,

      // Additional metadata
      ...(keywords.length > 0 && { keywords: keywords.join(', ') }),
      ...(genre && { genre }),

      // Content ratings and restrictions
      isFamilyFriendly,
      ...(regionsAllowed.length > 0 && { regionsAllowed }),

      // Access
      requiresSubscription,
      isAccessibleForFree: !requiresSubscription,

      // Language
      inLanguage,

      // Interaction statistics (can be updated dynamically)
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/WatchAction',
        userInteractionCount: 0, // Update with actual view count if available
      },
    };

    // Create or update the script tag
    const scriptId = 'video-schema';
    let existingScript = document.getElementById(scriptId);

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
  }, [
    name,
    description,
    thumbnailUrl,
    uploadDate,
    duration,
    contentUrl,
    embedUrl,
    width,
    height,
    author,
    publicationDate,
    keywords,
    genre,
    isFamilyFriendly,
    regionsAllowed,
    requiresSubscription,
    inLanguage,
  ]);

  return null;
};

export default VideoSchema;
