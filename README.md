# Dan Pearson Style Showcase

A modern React application built with Vite, TypeScript, and shadcn/ui components.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment

### Cloudflare Pages

This project is configured for deployment on Cloudflare Pages with the following settings:

**Build Configuration:**

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js version:** 18

**Environment Variables (if needed):**

- No environment variables required for basic deployment
- Supabase configuration is handled via hardcoded public keys

**Deployment Steps:**

1. Connect your GitHub repository to Cloudflare Pages
2. Set the build command to: `npm run build`
3. Set the publish directory to: `dist`
4. Deploy!

### Manual Deployment

```bash
# Build the project
npm run build

# The built files will be in the `dist` directory
# Upload the contents of `dist` to your web server
```

## 🛠️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── admin/          # Admin-specific components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
└── lib/                # Utility functions
```

## 🎨 Technologies Used

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Routing:** React Router DOM
- **State Management:** TanStack Query
- **Backend:** Supabase
- **3D Graphics:** Three.js with React Three Fiber

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Configuration Files

- `wrangler.toml` - Cloudflare Pages configuration
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

## 🚨 Troubleshooting

### Build Issues

If you encounter build issues on Cloudflare Pages:

1. **Lockfile conflicts:** Ensure only one lockfile exists (package-lock.json)
2. **Node version:** Make sure Node.js 18+ is specified
3. **Build command:** Verify `npm run build` works locally first

### Common Issues

- **404 errors on refresh:** Handled by `_redirects` file for client-side routing
- **Large bundle size:** Consider code splitting for better performance
- **Environment variables:** Add any required env vars in Cloudflare Pages settings

## 📄 License

This project is private and proprietary.
