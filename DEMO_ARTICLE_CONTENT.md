# Enhanced Article Editor Demo

This is a demonstration of the new enhanced article editor features.

## Custom Components

### Buttons
Here are some example buttons with different styles:

[button:Get Started:https://example.com:primary]
[button:Learn More:https://example.com:secondary]
[button:Documentation:https://example.com:outline]

### Alerts
Different types of alerts to convey important information:

[alert:info:This is some helpful information for users to know.]

[alert:warning:Please be careful when following these instructions.]

[alert:success:Great! You've successfully completed this step.]

[alert:error:Oops! Something went wrong. Please try again.]

### Badges
Use badges to highlight important information:

[badge:New Feature:default] [badge:Beta:secondary] [badge:Important:destructive]

## Mixed Content Example

You can also mix HTML with Markdown seamlessly:

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 8px; text-align: center; margin: 2rem 0; color: white;">
  <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: bold;">🚀 Ready to Build Something Amazing?</h3>
  <p style="margin: 0 0 1.5rem 0; opacity: 0.9;">Join thousands of developers already using our platform to create incredible applications.</p>
  <a href="/signup" style="display: inline-block; background: white; color: #667eea; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: transform 0.2s;">
    Get Started Today - It's Free!
  </a>
</div>

## Code Examples

Here's a code block with syntax highlighting:

```javascript
// Example of a simple React component
import React from 'react';

const WelcomeMessage = ({ name }) => {
  return (
    <div className="welcome-container">
      <h1>Hello, {name}!</h1>
      <p>Welcome to our amazing platform.</p>
    </div>
  );
};

export default WelcomeMessage;
```

## Tables

| Feature | Markdown | HTML | Custom Components |
|---------|----------|------|-------------------|
| **Buttons** | ❌ | ✅ | ✅ |
| **Alerts** | ❌ | ✅ | ✅ |
| **Syntax Highlighting** | ✅ | ❌ | ✅ |
| **Tables** | ✅ | ✅ | ✅ |

## Lists and Formatting

### What you can do:
- Create **bold** and *italic* text
- Add `inline code` snippets
- Insert links like [this one](https://example.com)
- Create numbered lists:
  1. First item
  2. Second item
  3. Third item

### Images
You can add images with proper captions:

![Example Image](https://via.placeholder.com/600x300/667eea/ffffff?text=Demo+Image)

## Blockquotes

> "The enhanced article editor makes it incredibly easy to create beautiful, interactive content with both Markdown and HTML support. It's a game-changer for content creators!" 
> 
> — Happy Developer

---

This demonstration shows how the enhanced editor supports both traditional Markdown and modern interactive components, giving you the best of both worlds!
