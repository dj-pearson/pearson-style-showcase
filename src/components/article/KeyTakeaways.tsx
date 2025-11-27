import { Lightbulb } from 'lucide-react';

interface KeyTakeawaysProps {
  takeaways: string[];
  articleTitle: string;
}

/**
 * KeyTakeaways component for AI Search Optimization
 *
 * This component:
 * 1. Provides clear, quotable statements that AI can cite
 * 2. Uses semantic HTML for better LLM parsing
 * 3. Improves content structure for answer engines (Perplexity, ChatGPT, etc.)
 * 4. Supports the "speakable" schema for voice search
 */
const KeyTakeaways = ({ takeaways, articleTitle }: KeyTakeawaysProps) => {
  if (!takeaways || takeaways.length === 0) {
    return null;
  }

  return (
    <aside
      className="my-8 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg"
      aria-labelledby="key-takeaways-heading"
      // data-speakable attribute helps identify content suitable for text-to-speech
      data-speakable="true"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Lightbulb className="w-5 h-5 text-cyan-400" aria-hidden="true" />
        </div>
        <h2
          id="key-takeaways-heading"
          className="text-lg font-semibold text-cyan-400"
        >
          Key Takeaways
        </h2>
      </div>

      {/* Summary statement for AI engines */}
      <p className="sr-only">
        Summary of key points from the article "{articleTitle}":
      </p>

      <ul
        className="space-y-3"
        role="list"
        aria-label={`Key takeaways from ${articleTitle}`}
      >
        {takeaways.map((takeaway, index) => (
          <li
            key={index}
            className="flex items-start gap-3 text-gray-300"
          >
            <span
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-cyan-500/20 text-cyan-400 text-sm font-medium rounded-full mt-0.5"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="leading-relaxed">{takeaway}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

/**
 * Utility function to extract key takeaways from markdown content
 * Looks for:
 * 1. Explicit "Key Takeaways" or "Summary" sections
 * 2. Bullet points at the start of the article
 * 3. Falls back to generating from headings and first sentences
 */
export const extractKeyTakeaways = (content: string, maxTakeaways: number = 5): string[] => {
  if (!content) return [];

  const takeaways: string[] = [];

  // Pattern 1: Look for explicit Key Takeaways/Summary section
  const takeawaysMatch = content.match(
    /(?:##?\s*(?:Key\s*Takeaways?|Summary|TL;?DR|Highlights?|Main\s*Points?))\s*\n([\s\S]*?)(?=\n##|\n---|\Z)/i
  );

  if (takeawaysMatch) {
    const section = takeawaysMatch[1];
    // Extract bullet points from the section
    const bullets = section.match(/^[\s]*[-*•]\s*(.+)$/gm);
    if (bullets) {
      bullets.slice(0, maxTakeaways).forEach(bullet => {
        const cleanBullet = bullet.replace(/^[\s]*[-*•]\s*/, '').trim();
        if (cleanBullet.length > 10 && cleanBullet.length < 300) {
          takeaways.push(cleanBullet);
        }
      });
    }
  }

  // Pattern 2: Look for numbered lists that could be takeaways
  if (takeaways.length === 0) {
    const numberedList = content.match(/^\s*\d+[\.\)]\s*\*\*(.+?)\*\*/gm);
    if (numberedList && numberedList.length >= 3) {
      numberedList.slice(0, maxTakeaways).forEach(item => {
        const cleanItem = item.replace(/^\s*\d+[\.\)]\s*\*\*/, '').replace(/\*\*$/, '').trim();
        if (cleanItem.length > 10 && cleanItem.length < 300) {
          takeaways.push(cleanItem);
        }
      });
    }
  }

  // Pattern 3: Extract from headings if no explicit takeaways found
  if (takeaways.length === 0) {
    const headings = content.match(/^##\s+(.+)$/gm);
    if (headings && headings.length >= 3) {
      headings.slice(0, maxTakeaways).forEach(heading => {
        const cleanHeading = heading.replace(/^##\s+/, '').trim();
        // Convert heading to statement if it's short enough
        if (cleanHeading.length > 5 && cleanHeading.length < 100) {
          takeaways.push(cleanHeading);
        }
      });
    }
  }

  return takeaways;
};

export default KeyTakeaways;
