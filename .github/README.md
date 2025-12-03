# GitHub Configuration & CI/CD Pipeline

This directory contains GitHub-specific configuration files for the Dan Pearson Portfolio project, including CI/CD workflows, issue templates, and automation configurations.

## 📁 Directory Structure

```
.github/
├── workflows/           # GitHub Actions workflow definitions
│   ├── ci.yml          # Main CI pipeline (lint, test, build)
│   └── deploy.yml      # Cloudflare Pages deployment
├── dependabot.yml      # Automated dependency updates
├── pull_request_template.md  # PR template
├── FUNDING.yml         # GitHub Sponsors configuration
└── README.md          # This file
```

## 🚀 CI/CD Workflows

### CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` branch
- Push to any `claude/**` branch
- Pull requests to `main` branch

**Jobs:**

1. **Lint Code**
   - Runs ESLint on the codebase
   - Enforces code style and quality standards
   - Fails the pipeline if linting errors are found

2. **Run Tests**
   - Executes all Vitest tests
   - Generates code coverage reports
   - Uploads coverage artifacts for review
   - Continues on error for coverage report generation

3. **Build Application**
   - Runs production build
   - Validates build output
   - Uploads build artifacts
   - Depends on successful lint and test jobs

4. **Build Size Check** (PR only)
   - Analyzes bundle sizes
   - Reports build size in PR comments
   - Helps track bundle size changes

5. **Security Audit**
   - Runs `npm audit` for known vulnerabilities
   - Checks for outdated dependencies
   - Provides security recommendations

6. **TypeScript Type Check**
   - Validates TypeScript types
   - Ensures type safety across the codebase

7. **All Checks Passed**
   - Final gate that requires all jobs to succeed
   - Posts success comment on PRs
   - Prevents merging if any job fails

**Artifacts:**
- Coverage reports (retained for 30 days)
- Build output (retained for 7 days)

**Environment:**
- Node.js 18
- Ubuntu latest
- npm ci for faster, deterministic installs

### Deployment Pipeline (`deploy.yml`)

**Triggers:**
- Push to `main` branch (production deployment)
- Pull requests to `main` (preview deployment)

**Jobs:**

1. **Deploy to Cloudflare Pages**
   - Builds the application
   - Deploys to Cloudflare Pages
   - Creates preview deployments for PRs
   - Posts deployment URL in PR comments

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages access
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

**Outputs:**
- Deployment URL (in PR comments and job summary)
- Deployment ID
- Environment indicator (Production/Preview)

## 🤖 Dependabot Configuration

Automated dependency updates are configured via `dependabot.yml`:

**Schedule:**
- Runs weekly on Mondays at 9:00 AM
- Opens up to 10 npm PRs
- Opens up to 5 GitHub Actions PRs

**Grouping Strategy:**
- **React Ecosystem**: All React-related packages (minor/patch)
- **Radix UI**: All Radix UI components (minor/patch)
- **Testing**: Testing libraries and Vitest (minor/patch)
- **Linting & Types**: ESLint, TypeScript, type definitions (minor/patch)
- **Build Tools**: Vite, Rollup, and related tools (minor/patch)

**PR Settings:**
- Auto-assigns to `dj-pearson`
- Labels: `dependencies`, `automated`
- Commit prefix: `chore:` for npm, `ci:` for actions
- Versioning strategy: `increase` (allows major version bumps)

## 📝 Pull Request Template

A comprehensive PR template is provided (`pull_request_template.md`) that includes:

- Description and type of change
- Related issues linking
- Testing checklist
- Security considerations
- Performance impact assessment
- Deployment notes
- Reviewer guidelines

**Usage:**
- Template auto-populates when creating a new PR
- Fill in all relevant sections
- Check off completed items
- Provide clear testing instructions

## 🔒 Required Secrets

To enable all workflows, configure these secrets in GitHub repository settings:

### Cloudflare Pages Deployment

```
CLOUDFLARE_API_TOKEN    # API token with Cloudflare Pages permissions
CLOUDFLARE_ACCOUNT_ID   # Your Cloudflare account ID
```

### Supabase (if needed for builds)

```
VITE_SUPABASE_URL                 # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY    # Supabase anon/public key
```

**Note:** Environment variables prefixed with `VITE_` are exposed to the client. Never store sensitive credentials with this prefix.

## 🎯 Workflow Permissions

The workflows require specific permissions:

### CI Workflow
- `contents: read` - Read repository contents
- `pull-requests: write` - Comment on PRs

### Deploy Workflow
- `contents: read` - Read repository contents
- `deployments: write` - Create deployment statuses
- `pull-requests: write` - Comment on PRs

These are configured in the workflow files and should be reviewed if modifying workflows.

## 📊 Status Badges

Add these badges to your README to show build status:

```markdown
[![CI Pipeline](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/ci.yml)

[![Deploy to Cloudflare Pages](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/deploy.yml/badge.svg)](https://github.com/dj-pearson/pearson-style-showcase/actions/workflows/deploy.yml)
```

## 🛠️ Local Development

To test changes locally before pushing:

```bash
# Run linter
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build application
npm run build

# Preview build
npm run preview
```

## 🔄 Workflow Maintenance

### Updating Node.js Version

To update the Node.js version used in workflows:

1. Update `NODE_VERSION` env var in both `ci.yml` and `deploy.yml`
2. Test locally with the new version
3. Update documentation

### Adding New Workflows

1. Create a new `.yml` file in `.github/workflows/`
2. Define triggers, jobs, and steps
3. Test in a feature branch before merging
4. Document in this README

### Modifying Dependabot

1. Edit `.github/dependabot.yml`
2. Adjust schedule, grouping, or limits as needed
3. Changes take effect immediately (no restart needed)

## 🐛 Troubleshooting

### Workflow Fails on npm ci

**Issue:** `npm ci` fails with "Cannot find module" errors

**Solution:**
- Ensure `package-lock.json` is committed
- Run `npm install` locally and commit updated lockfile
- Check for incompatible dependency versions

### Cloudflare Deployment Fails

**Issue:** Deploy workflow fails with authentication error

**Solution:**
- Verify `CLOUDFLARE_API_TOKEN` has correct permissions
- Check `CLOUDFLARE_ACCOUNT_ID` is correct
- Ensure Cloudflare Pages project name matches workflow config

### Tests Fail Only in CI

**Issue:** Tests pass locally but fail in CI

**Solution:**
- Check for environment-specific dependencies (e.g., browser APIs)
- Ensure all test dependencies are in `package.json`
- Review test logs for missing environment variables
- Consider timezone or locale differences

### Build Artifacts Not Uploading

**Issue:** Artifact upload fails or artifacts are empty

**Solution:**
- Verify `dist/` directory exists after build
- Check file permissions
- Ensure build step completes successfully
- Review artifact path in workflow

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Pages GitHub Action](https://github.com/cloudflare/pages-action)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CLAUDE.md](../CLAUDE.md) - Project-specific development guide

## 🔐 Security Best Practices

1. **Never commit secrets** to the repository
2. **Use GitHub Secrets** for sensitive data
3. **Review Dependabot PRs** before merging
4. **Monitor security advisories** in the Security tab
5. **Rotate API tokens** regularly
6. **Limit workflow permissions** to minimum required
7. **Enable branch protection** for main branch

## 📈 Metrics & Monitoring

### CI Performance
- Average workflow duration: ~5-7 minutes
- Concurrent job execution for faster results
- Artifact caching for dependency installation

### Coverage Goals
- Minimum coverage target: 70%
- Coverage reports uploaded for every test run
- Tracking trends over time

### Deployment Metrics
- Production deployment: Automatic on main branch merge
- Preview deployments: Automatic for all PRs
- Average deployment time: ~2-3 minutes

---

**Last Updated:** 2025-12-03
**Maintained By:** Dan Pearson
**Questions?** Open an issue or contact the maintainer
