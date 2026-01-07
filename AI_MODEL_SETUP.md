# AI Model Configuration Setup Guide

**Issue**: Edge Functions can't find AI API keys  
**Solution**: Add API keys as environment variables in Coolify

---

## Architecture Overview

The AI system uses a **two-tier configuration**:

1. **Database (`ai_model_configs` table)**: Defines which models to use, priority order, and settings
2. **Environment Variables (Coolify)**: Stores the actual API keys (secure)

This separation allows you to:
- Change which models to use without redeploying
- Keep API keys secure (not in database)
- Configure different priorities and fallback chains

---

## Quick Fix

### 1. Add API Keys to Coolify

Go to: **Coolify → Edge Functions Service → Environment Variables**

Add these keys:

```env
# Google Gemini (Recommended - Best value)
GEMINI_API_KEY=your-paid-gemini-api-key
GEMINI_API_KEY_FREE=your-free-gemini-api-key

# Anthropic Claude (High quality)
CLAUDE_API_KEY=your-claude-api-key

# Lovable AI Gateway (Already have this)
LOVABLE_API_KEY=your-lovable-key

# Optional: OpenAI
OPENAI_API_KEY=your-openai-api-key
```

### 2. Get Your API Keys

**Google Gemini** (Recommended First):
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Get API Key" or "Create API Key"
3. Copy the key
4. Use it for both `GEMINI_API_KEY` and `GEMINI_API_KEY_FREE`

**Anthropic Claude** (Optional but recommended):
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up / Log in
3. Go to API Keys section
4. Create new key
5. Copy as `CLAUDE_API_KEY`

**OpenAI** (Optional):
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy as `OPENAI_API_KEY`

### 3. Redeploy Edge Functions

After adding keys:
1. Click **"Redeploy"** in Coolify
2. Wait for deployment to complete
3. Test AI article generation in admin dashboard

---

## Verify AI Configuration

### Check Database Configs

In Supabase Studio, run:

```sql
SELECT 
  provider,
  model_name,
  api_key_secret_name,
  priority,
  is_active,
  is_default,
  use_case,
  model_tier
FROM ai_model_configs
WHERE is_active = true
ORDER BY priority ASC;
```

You should see configs like:
- `gemini-paid` → `GEMINI_API_KEY` (priority 1, default)
- `gemini-free` → `GEMINI_API_KEY_FREE` (priority 2, fallback)
- `claude` → `CLAUDE_API_KEY` (priority 3, fallback)

### Test AI Models

In Admin Dashboard:
1. Go to Settings → AI Models
2. Click "Test" button for each model
3. Should show ✅ "Test successful"

---

## How It Works

### Priority & Fallback System

The AI helper tries models in priority order (lowest number first):

```
1. Try Gemini Paid (priority 1) ✅
   ↓ (if fails)
2. Try Gemini Free (priority 2) ✅
   ↓ (if fails)
3. Try Claude (priority 3) ✅
   ↓ (if all fail)
4. Error: All AI models failed
```

### Model Tiers

- **lightweight**: Fast, cheap models (Gemini Flash) - for quick tasks
- **normal**: Quality models (Gemini Pro, Claude) - for content generation

### Edge Function Flow

```typescript
// 1. Get configs from database
const configs = await getAIConfigs(supabase, 'normal', 'article_generation');

// 2. Try each config in priority order
const result = await callAIWithConfig(configs, systemPrompt, userPrompt);

// 3. Each config reads API key from environment
const apiKey = Deno.env.get(config.api_key_secret_name); // e.g., "GEMINI_API_KEY"
```

---

## Adding New AI Models

### Via Admin Dashboard

1. Go to Settings → AI Models
2. Click "+ Add Model"
3. Fill in:
   - **Provider**: gemini-free, gemini-paid, claude, openai, lovable
   - **Model Name**: e.g., "gemini-2.0-flash-exp"
   - **API Key Secret Name**: Environment variable name (e.g., "GEMINI_API_KEY")
   - **Priority**: Lower = higher priority
   - **Model Tier**: lightweight or normal
   - **Use Case**: general, article_generation, etc.
4. Make sure the corresponding environment variable exists in Coolify

### Via SQL

```sql
INSERT INTO ai_model_configs (
  provider,
  model_name,
  api_key_secret_name,
  priority,
  is_active,
  model_tier,
  use_case
) VALUES (
  'gemini-paid',
  'gemini-2.0-flash-thinking-exp',
  'GEMINI_API_KEY',
  1,
  true,
  'normal',
  'article_generation'
);
```

---

## Troubleshooting

### Error: "API key X not found"

**Problem**: Environment variable not set in Coolify

**Solution**:
1. Go to Coolify → Environment Variables
2. Add the missing key (e.g., `GEMINI_API_KEY=...`)
3. Redeploy

### Error: "All AI models failed"

**Problem**: None of the API keys work or all are missing

**Solution**:
1. Check Coolify logs for specific errors
2. Verify API keys are valid (test in respective consoles)
3. Check database has active configs: `SELECT * FROM ai_model_configs WHERE is_active = true;`
4. At minimum, add one working API key (Gemini is easiest)

### AI generates but quality is low

**Problem**: Using free tier or wrong model tier

**Solution**:
1. Check which model is being used (check logs)
2. Adjust priorities to prefer better models
3. For articles, use `model_tier = 'normal'`

### Can't test models in Admin Dashboard

**Problem**: Test function missing API keys

**Solution**: Same as "API key X not found" - add keys to Coolify

---

## Recommended Setup

### For Development/Testing

Just add one key:

```env
GEMINI_API_KEY_FREE=your-free-gemini-key
```

Adjust database to use only Gemini Free:

```sql
UPDATE ai_model_configs SET is_active = false WHERE provider != 'gemini-free';
```

### For Production

Add all keys for full fallback chain:

```env
GEMINI_API_KEY=your-paid-gemini-key
GEMINI_API_KEY_FREE=your-free-gemini-key-as-backup
CLAUDE_API_KEY=your-claude-key
LOVABLE_API_KEY=your-lovable-key
```

This gives you maximum resilience.

---

## Cost Considerations

### Gemini Pricing (2024)
- **Free Tier**: 15 RPM, 1500 RPD, $0/million tokens
- **Paid Tier**: 1000 RPM, $0.075-$3.50 per million tokens

### Claude Pricing
- **Claude Sonnet**: ~$3-15 per million tokens

### Recommendation
Start with **Gemini Free** for testing, then add **Gemini Paid** for production. Use Claude as a fallback for critical content.

---

## Security Notes

1. **Never commit API keys** to git
2. **Store keys only in Coolify** environment variables
3. **Rotate keys regularly** (every 90 days)
4. **Use separate keys** for dev/staging/prod if possible
5. **Monitor usage** in respective AI provider consoles

---

## Summary

**Problem**: Edge Functions can't find AI API keys

**Solution**: 
1. Add API keys as environment variables in Coolify
2. Redeploy Edge Functions
3. Test in Admin Dashboard

**Minimum Setup**:
```env
GEMINI_API_KEY_FREE=your-key-here
```

**Recommended Setup**:
```env
GEMINI_API_KEY=your-paid-key
GEMINI_API_KEY_FREE=your-free-key
CLAUDE_API_KEY=your-claude-key
LOVABLE_API_KEY=your-lovable-key
```

---

**Last Updated**: 2025-01-06  
**Status**: ✅ Ready to deploy
