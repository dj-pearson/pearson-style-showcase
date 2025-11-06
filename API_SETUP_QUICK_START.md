# API Setup Quick Start Guide

## 🔑 Required API Keys

### 1. SerpAPI (Primary - Recommended) ⭐

**Get your key in 2 minutes:**

1. Visit: https://serpapi.com/users/sign_up
2. Sign up (free account = 100 searches/month)
3. Go to dashboard: https://serpapi.com/manage-api-key
4. Copy your API key
5. Add to Supabase:
   ```bash
   supabase secrets set SERPAPI_KEY=your_key_here
   ```

**Pricing:**
- Free: 100 searches/month (good for testing)
- Starter: $50/month (5,000 searches)
- Developer: $100/month (15,000 searches)

---

### 2. Google Custom Search API (Fallback)

**Part A: Get Google API Key (3 minutes)**

1. Visit: https://console.cloud.google.com/
2. Create new project or select existing
3. Enable API: https://console.cloud.google.com/apis/library/customsearch.googleapis.com
4. Go to Credentials: https://console.cloud.google.com/apis/credentials
5. Click **Create Credentials** → **API Key**
6. Copy your API key
7. Add to Supabase:
   ```bash
   supabase secrets set GOOGLE_SEARCH_API_KEY=your_key_here
   ```

**Part B: Create Search Engine ID (2 minutes)**

1. Visit: https://programmablesearchengine.google.com/controlpanel/create
2. Fill in:
   - **Name**: Amazon Product Search
   - **What to search**: Search specific sites
   - **Sites to search**: `www.amazon.com`
3. Click **Create**
4. Copy your **Search Engine ID**
5. Add to Supabase:
   ```bash
   supabase secrets set GOOGLE_SEARCH_ENGINE_ID=your_engine_id_here
   ```

**Pricing:**
- Free: 100 queries/day
- Paid: $5 per 1,000 queries

---

### 3. Lovable AI (Required for Content Generation)

**Get your key:**

1. You should already have this from your existing setup
2. If not, contact Lovable support
3. Add to Supabase:
   ```bash
   supabase secrets set LOVABLE_API_KEY=your_key_here
   ```

---

### 4. Amazon Associate Tag (Required)

**Set your affiliate tag:**

1. Log into Supabase Dashboard
2. Go to Table Editor → `amazon_pipeline_settings`
3. Update `amazon_tag` field to your Associate ID
   - Example: `yourname-20`
4. All generated links will use this tag automatically

**Don't have an Associate ID?**
1. Visit: https://affiliate-program.amazon.com/
2. Sign up for free
3. Get approved (usually 1-3 days)
4. Your ID format: `firstname-lastname-20`

---

### 5. DataForSEO (Optional - For SEO Keywords)

**This is optional but recommended for better SEO:**

1. Visit: https://dataforseo.com/
2. Sign up for account
3. Go to Dashboard → API Access
4. Copy your login and password
5. Add to Supabase:
   ```bash
   supabase secrets set DATAFORSEO_API_LOGIN=your_login
   supabase secrets set DATAFORSEO_API_PASSWORD=your_password
   ```

**Note**: Pipeline works without this, but SEO data helps optimize articles.

---

## 🚀 Quick Deploy

### Method 1: Supabase CLI

```bash
# Set all secrets at once
supabase secrets set SERPAPI_KEY=your_serpapi_key
supabase secrets set GOOGLE_SEARCH_API_KEY=your_google_key
supabase secrets set GOOGLE_SEARCH_ENGINE_ID=your_engine_id
supabase secrets set LOVABLE_API_KEY=your_lovable_key
supabase secrets set DATAFORSEO_API_LOGIN=your_dataforseo_login
supabase secrets set DATAFORSEO_API_PASSWORD=your_dataforseo_password

# Deploy the edge function
supabase functions deploy amazon-article-pipeline
```

### Method 2: Supabase Dashboard

1. Go to: Settings → Edge Functions → Secrets
2. Click **Add new secret** for each key:
   - `SERPAPI_KEY`
   - `GOOGLE_SEARCH_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`
   - `LOVABLE_API_KEY`
   - `DATAFORSEO_API_LOGIN` (optional)
   - `DATAFORSEO_API_PASSWORD` (optional)
3. Deploy function via dashboard or CLI

---

## ✅ Test Your Setup

### Quick Test via curl

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/amazon-article-pipeline \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

**Replace:**
- `YOUR_PROJECT` with your Supabase project ref
- `YOUR_ANON_KEY` with your anon key from Settings → API

### Check Results

1. **View Logs:**
   ```bash
   supabase functions logs amazon-article-pipeline --tail
   ```

2. **Check Database:**
   - Table: `amazon_pipeline_runs` (should show `status: 'success'`)
   - Table: `articles` (should have new article)
   - Table: `article_products` (should have affiliate links)

---

## 🎯 Configuration Checklist

Before your first run:

- [ ] SerpAPI key configured
- [ ] Google Search API key configured (fallback)
- [ ] Google Search Engine ID configured
- [ ] Lovable AI key configured
- [ ] Amazon Associate tag set in `amazon_pipeline_settings`
- [ ] At least 3 niches configured in settings
- [ ] `cache_only_mode` is `false` (to fetch fresh products)
- [ ] Edge function deployed

---

## 💡 Pro Tips

### Start with Free Tiers
- SerpAPI: 100 free searches/month
- Google Search: 100 free queries/day
- This is enough for 1-3 articles per day

### Test with One Niche First
```sql
-- Update settings to test with one niche
UPDATE amazon_pipeline_settings
SET niches = ARRAY['wireless earbuds']
WHERE id = 1;
```

### Monitor Your Usage
- **SerpAPI**: Check dashboard at https://serpapi.com/dashboard
- **Google Search**: Check quota at https://console.cloud.google.com/apis/dashboard

### Use Cache Wisely
- First run: Fetches fresh data from APIs
- Next 24 hours: Uses cached products (no API calls!)
- After 7 days: Cache expires, fresh fetch needed

---

## 🔧 Troubleshooting

### "SERPAPI_KEY not configured"
→ Add the key to Supabase secrets and redeploy function

### "Google Search API error: 403"
→ API not enabled. Go to Google Cloud Console and enable Custom Search API

### "Both SerpAPI and Google Search failed"
→ Check API keys are correct and you haven't exceeded rate limits

### "No products found"
→ Try a broader niche (e.g., "headphones" instead of "left-handed bluetooth headphones for cats")

### Affiliate links don't have my tag
→ Update `amazon_tag` in `amazon_pipeline_settings` table

---

## 📞 Need Help?

- Full documentation: `AMAZON_ARTICLE_GENERATOR_SETUP.md`
- Check logs: `supabase functions logs amazon-article-pipeline`
- Test individual APIs using their playground tools
- Verify secrets: `supabase secrets list`

---

## 🎉 Ready to Generate!

Once all keys are configured, trigger your first article:

**Via Supabase Dashboard:**
1. Go to Edge Functions → amazon-article-pipeline
2. Click "Invoke function"
3. Watch the magic happen!

**Expected time:**
- Product discovery: 2-5 seconds
- AI article generation: 10-30 seconds
- Total: ~30-60 seconds for a complete article

You should see a new article in your `articles` table with full affiliate links ready to earn commissions! 🚀
