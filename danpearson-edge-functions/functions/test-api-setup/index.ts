import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Test API Setup
 *
 * This function tests all required API integrations for the Amazon article generator.
 * Use this to verify your API keys are configured correctly before running the pipeline.
 */

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const results: any = {
    timestamp: new Date().toISOString(),
    overall_status: 'unknown',
    tests: []
  };

  // Test 1: SerpAPI
  try {
    const serpApiKey = Deno.env.get('SERPAPI_KEY');

    if (!serpApiKey) {
      results.tests.push({
        name: 'SerpAPI',
        status: 'not_configured',
        message: 'SERPAPI_KEY environment variable not set',
        required: 'recommended'
      });
    } else {
      // Test a simple search
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('api_key', serpApiKey);
      url.searchParams.append('engine', 'google_shopping');
      url.searchParams.append('q', 'wireless headphones amazon');
      url.searchParams.append('num', '1');

      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        results.tests.push({
          name: 'SerpAPI',
          status: 'success',
          message: 'API key is valid and working',
          sample_results: data.shopping_results?.length || 0,
          required: 'recommended'
        });
      } else {
        const errorText = await response.text();
        results.tests.push({
          name: 'SerpAPI',
          status: 'error',
          message: `API returned error: ${response.status}`,
          details: errorText,
          required: 'recommended'
        });
      }
    }
  } catch (error) {
    results.tests.push({
      name: 'SerpAPI',
      status: 'error',
      message: 'Failed to test SerpAPI',
      error: (error as Error).message,
      required: 'recommended'
    });
  }

  // Test 2: Google Custom Search API
  try {
    const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

    if (!googleApiKey || !searchEngineId) {
      results.tests.push({
        name: 'Google Custom Search',
        status: 'not_configured',
        message: 'GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID not set',
        required: 'fallback'
      });
    } else {
      // Test a simple search
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('key', googleApiKey);
      url.searchParams.append('cx', searchEngineId);
      url.searchParams.append('q', 'best wireless headphones site:amazon.com');
      url.searchParams.append('num', '1');

      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        results.tests.push({
          name: 'Google Custom Search',
          status: 'success',
          message: 'API key and Search Engine ID are valid',
          sample_results: data.items?.length || 0,
          required: 'fallback'
        });
      } else {
        const errorText = await response.text();
        results.tests.push({
          name: 'Google Custom Search',
          status: 'error',
          message: `API returned error: ${response.status}`,
          details: errorText,
          required: 'fallback'
        });
      }
    }
  } catch (error) {
    results.tests.push({
      name: 'Google Custom Search',
      status: 'error',
      message: 'Failed to test Google Custom Search',
      error: (error as Error).message,
      required: 'fallback'
    });
  }

  // Test 3: Lovable AI
  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      results.tests.push({
        name: 'Lovable AI',
        status: 'not_configured',
        message: 'LOVABLE_API_KEY environment variable not set',
        required: 'required'
      });
    } else {
      // Test with a simple completion
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'user', content: 'Say "API test successful" if you can read this.' }
          ],
          max_tokens: 20
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.tests.push({
          name: 'Lovable AI',
          status: 'success',
          message: 'API key is valid and AI is responding',
          sample_response: data.choices[0]?.message?.content?.substring(0, 100),
          required: 'required'
        });
      } else {
        const errorText = await response.text();
        results.tests.push({
          name: 'Lovable AI',
          status: 'error',
          message: `API returned error: ${response.status}`,
          details: errorText,
          required: 'required'
        });
      }
    }
  } catch (error) {
    results.tests.push({
      name: 'Lovable AI',
      status: 'error',
      message: 'Failed to test Lovable AI',
      error: (error as Error).message,
      required: 'required'
    });
  }

  // Test 4: DataForSEO (Optional)
  try {
    const login = Deno.env.get('DATAFORSEO_API_LOGIN');
    const password = Deno.env.get('DATAFORSEO_API_PASSWORD');

    if (!login || !password) {
      results.tests.push({
        name: 'DataForSEO',
        status: 'not_configured',
        message: 'DATAFORSEO_API_LOGIN or DATAFORSEO_API_PASSWORD not set (optional)',
        required: 'optional'
      });
    } else {
      const auth = btoa(`${login}:${password}`);

      // Test with ping endpoint
      const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        results.tests.push({
          name: 'DataForSEO',
          status: 'success',
          message: 'API credentials are valid',
          required: 'optional'
        });
      } else {
        const errorText = await response.text();
        results.tests.push({
          name: 'DataForSEO',
          status: 'error',
          message: `API returned error: ${response.status}`,
          details: errorText,
          required: 'optional'
        });
      }
    }
  } catch (error) {
    results.tests.push({
      name: 'DataForSEO',
      status: 'error',
      message: 'Failed to test DataForSEO (optional)',
      error: (error as Error).message,
      required: 'optional'
    });
  }

  // Test 5: ASIN Extraction
  try {
    const testUrls = [
      'https://www.amazon.com/dp/B08N5WRWNW',
      'https://www.amazon.com/product-name/dp/B08N5WRWNW',
      'https://www.amazon.com/gp/product/B08N5WRWNW'
    ];

    const extractASIN = (url: string): string | null => {
      const patterns = [
        /\/dp\/([A-Z0-9]{10})/,
        /\/gp\/product\/([A-Z0-9]{10})/,
        /\/product\/([A-Z0-9]{10})/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    };

    const asins = testUrls.map(url => extractASIN(url));
    const allValid = asins.every(asin => asin === 'B08N5WRWNW');

    results.tests.push({
      name: 'ASIN Extraction',
      status: allValid ? 'success' : 'error',
      message: allValid ? 'ASIN extraction logic working correctly' : 'ASIN extraction has issues',
      sample_asins: asins,
      required: 'internal'
    });
  } catch (error) {
    results.tests.push({
      name: 'ASIN Extraction',
      status: 'error',
      message: 'Failed to test ASIN extraction',
      error: (error as Error).message,
      required: 'internal'
    });
  }

  // Determine overall status
  const hasRequiredApis = results.tests.some(
    (t: any) => t.name === 'Lovable AI' && t.status === 'success'
  );

  const hasProductDiscovery = results.tests.some(
    (t: any) => (t.name === 'SerpAPI' || t.name === 'Google Custom Search') && t.status === 'success'
  );

  if (hasRequiredApis && hasProductDiscovery) {
    results.overall_status = 'ready';
    results.message = '✅ All required APIs are configured and working! You can run the pipeline.';
  } else if (hasRequiredApis && !hasProductDiscovery) {
    results.overall_status = 'partial';
    results.message = '⚠️ AI is working but no product discovery API configured. Configure SerpAPI or Google Search.';
  } else {
    results.overall_status = 'not_ready';
    results.message = '❌ Required APIs are missing. Check configuration and documentation.';
  }

  // Add recommendations
  results.recommendations = [];

  const serpApiTest = results.tests.find((t: any) => t.name === 'SerpAPI');
  const googleTest = results.tests.find((t: any) => t.name === 'Google Custom Search');

  if (serpApiTest?.status !== 'success' && googleTest?.status !== 'success') {
    results.recommendations.push(
      'Configure at least one product discovery API (SerpAPI recommended)'
    );
  }

  if (serpApiTest?.status !== 'success' && serpApiTest?.status !== 'not_configured') {
    results.recommendations.push(
      'SerpAPI error detected. Check your API key and rate limits at https://serpapi.com/dashboard'
    );
  }

  const lovableTest = results.tests.find((t: any) => t.name === 'Lovable AI');
  if (lovableTest?.status !== 'success') {
    results.recommendations.push(
      'Lovable AI is required for article generation. Configure LOVABLE_API_KEY'
    );
  }

  if (results.recommendations.length === 0) {
    results.recommendations.push('All systems operational! 🚀');
  }

  return new Response(
    JSON.stringify(results, null, 2),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    }
  );
};
