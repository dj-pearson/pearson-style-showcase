import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language: string;
  value: string;
  [key: string]: unknown;
}

/**
 * Prism highlighting, split into its own module so MarkdownRenderer can load it
 * lazily. The full Prism build carries roughly 200 language definitions and is
 * about 780 kB raw, which every article page paid for whether or not it held a
 * single fenced code block. Nothing here is imported by MarkdownRenderer at
 * module scope; see the React.lazy call there.
 */
const CodeBlock = ({ language, value, ...props }: CodeBlockProps) => (
  <SyntaxHighlighter
    style={oneDark}
    language={language}
    PreTag="div"
    className="rounded-md"
    {...props}
  >
    {value}
  </SyntaxHighlighter>
);

export default CodeBlock;
