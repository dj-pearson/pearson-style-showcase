# Enhanced Article Editor - Markdown and HTML Support

## Overview

The enhanced article editor now supports both Markdown and HTML content with automatic detection and rendering. It provides a rich editing experience with custom components and beautiful styling.

## Features

### 1. Content Type Detection
- **Automatic Detection**: The editor automatically detects whether your content contains Markdown, HTML, or both
- **Mixed Content Support**: You can freely mix Markdown and HTML in the same article
- **Visual Indicators**: Content type is displayed with badges for easy identification

### 2. Enhanced Markdown Support
- **GitHub Flavored Markdown**: Full support for tables, strikethrough, task lists, and more
- **Syntax Highlighting**: Code blocks with beautiful syntax highlighting
- **Custom Styling**: Optimized for dark theme with proper typography

### 3. Custom Components (Markdown Syntax)

#### Buttons
Create beautiful, styled buttons using simple syntax:

```markdown
[button:Click Me:https://example.com:primary]
[button:Learn More:https://example.com:secondary]
[button:Read More:https://example.com:outline]
[button:Delete:https://example.com:destructive]
```

**Parameters:**
- `text`: Button text
- `url`: Target URL
- `style`: Button style (primary, secondary, outline, destructive)

#### Alerts
Add informational alerts with different styles:

```markdown
[alert:info:This is an informational message]
[alert:warning:This is a warning message]
[alert:success:This operation was successful]
[alert:error:Something went wrong]
```

**Parameters:**
- `type`: Alert type (info, warning, success, error)
- `message`: Alert message content

#### Badges
Create inline badges and tags:

```markdown
[badge:New Feature:default]
[badge:Important:destructive]
[badge:Beta:secondary]
[badge:Coming Soon:outline]
```

**Parameters:**
- `text`: Badge text
- `variant`: Badge style (default, secondary, destructive, outline)

### 4. HTML Support
Full HTML support with custom CSS classes and inline styles:

```html
<div class="bg-primary text-primary-foreground p-4 rounded-lg">
  <h3>Custom HTML Content</h3>
  <p>You can use any HTML elements with Tailwind CSS classes.</p>
</div>
```

### 5. Rich Text Editor Features

#### Formatting Toolbar
- **Headings**: H1-H4 with keyboard shortcuts
- **Text Formatting**: Bold, italic, code
- **Lists**: Ordered and unordered lists
- **Links and Images**: Easy insertion with proper syntax
- **Code Blocks**: Multi-line code with syntax highlighting
- **Tables**: Quick table creation
- **Quotes**: Blockquotes for emphasis

#### Keyboard Shortcuts
- `Ctrl+1`: Heading 1
- `Ctrl+2`: Heading 2
- `Ctrl+B`: Bold
- `Ctrl+I`: Italic
- `Ctrl+K`: Link
- `Ctrl+L`: List
- `Ctrl+Q`: Quote
- `Ctrl+T`: Table
- `Ctrl+Shift+C`: Code block
- `Ctrl+Shift+I`: Image

### 6. Preview Mode
- **Live Preview**: Real-time preview of your content
- **Custom Component Rendering**: See how your custom buttons and alerts will look
- **Responsive Design**: Preview adapts to different screen sizes

### 7. Smart Features

#### Build-Desk Integration
For articles in the "Build Desk" category, the editor offers:
- **Auto-link Addition**: One-click addition of Build-Desk promotional content
- **Styled Components**: Custom-styled buttons and CTAs for Build-Desk
- **Duplicate Prevention**: Prevents adding the same content multiple times

#### Content Suggestions
- **HTML Snippets**: Pre-built HTML components for common use cases
- **Call-to-Action Boxes**: Beautiful, gradient CTA sections
- **Centered Content**: Easy content centering with proper spacing

## Usage Examples

### Example 1: Mixed Content Article
```markdown
# Getting Started with AI Development

Welcome to our comprehensive guide on AI development!

[alert:info:This guide assumes basic programming knowledge]

## What You'll Learn

- Machine learning fundamentals
- **Neural networks** and deep learning
- Practical implementation with Python

[button:Start Learning:https://example.com/course:primary]

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 8px; text-align: center; margin: 2rem 0; color: white;">
  <h3 style="margin: 0 0 1rem 0;">Ready to Build Something Amazing?</h3>
  <p style="margin: 0 0 1.5rem 0;">Join our community of developers</p>
  <a href="/signup" style="background: white; color: #667eea; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
    Get Started Free
  </a>
</div>

[badge:New:default] This section was recently updated!
```

### Example 2: Technical Tutorial
```markdown
# Setting Up Your Development Environment

## Prerequisites
[alert:warning:Make sure you have Node.js 18+ installed]

## Installation Steps

1. Clone the repository:
```bash
git clone https://github.com/example/project.git
cd project
```

2. Install dependencies:
```bash
npm install
```

[alert:success:Installation complete! You're ready to start coding.]

[button:View Documentation:https://docs.example.com:outline]
[button:Get Support:https://support.example.com:secondary]
```

## Best Practices

### 1. Content Organization
- Use proper heading hierarchy (H1 → H2 → H3)
- Break up long content with alerts and buttons
- Include relevant images with descriptive alt text

### 2. Custom Components
- Use buttons sparingly for important calls-to-action
- Choose appropriate alert types for the message context
- Use badges to highlight important information

### 3. HTML Integration
- Validate HTML before publishing
- Use semantic HTML elements when possible
- Ensure accessibility with proper ARIA labels

### 4. Performance
- Optimize images before embedding
- Keep HTML snippets concise
- Test on different devices and screen sizes

## Technical Details

### Supported Markdown Extensions
- **Tables**: GitHub-style tables with alignment
- **Strikethrough**: ~~crossed out text~~
- **Task Lists**: Interactive checkboxes
- **Footnotes**: Reference-style footnotes
- **Math**: LaTeX-style mathematical expressions (planned)

### CSS Classes Available
All Tailwind CSS classes are available for HTML content:
- Layout: `flex`, `grid`, `container`
- Spacing: `p-4`, `m-2`, `space-y-4`
- Colors: `bg-primary`, `text-muted-foreground`
- Typography: `text-xl`, `font-bold`, `leading-relaxed`

### Security
- HTML content is sanitized to prevent XSS attacks
- External links automatically get `rel="noopener noreferrer"`
- Custom components are rendered safely without eval()

## Troubleshooting

### Common Issues
1. **Custom components not rendering**: Check syntax and parameter order
2. **HTML not displaying**: Ensure proper tag closure and valid HTML
3. **Images not loading**: Verify image URLs and alt text
4. **Styles not applying**: Check Tailwind class names and spelling

### Getting Help
- Use the preview mode to test your content
- Check the browser console for errors
- Refer to the toolbar tooltips for syntax help
- Contact support for technical issues

---

*This documentation covers the enhanced article editor features. For additional help, please refer to the in-editor tooltips and examples.*
