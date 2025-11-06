import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId, isTest = false } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook settings
    const { data: webhookSettings, error: webhookError } = await supabaseClient
      .from('webhook_settings')
      .select('*')
      .single();

    if (webhookError || !webhookSettings || !webhookSettings.enabled) {
      throw new Error('Webhook not configured or disabled');
    }

    let payload;

    if (isTest) {
      // Send test payload with example data
      payload = {
        articleTitle: "Example Article: Best Productivity Tools for 2025",
        articleUrl: "https://yourdomain.com/article/best-productivity-tools-2025",
        shortForm: "🚀 Just published: Best Productivity Tools for 2025! Discover game-changing apps that will transform your workflow. #Productivity #Tech #Tools2025",
        longForm: "We've just published an in-depth guide to the Best Productivity Tools for 2025! 📊\n\nAfter extensive testing and research, we've compiled a comprehensive list of tools that can revolutionize how you work. From AI-powered assistants to smart automation platforms, these tools are designed to save you time and boost your efficiency.\n\n👉 Check out our full guide and find the perfect tools for your workflow!",
        imageUrl: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800",
        isTest: true
      };
    } else {
      // Fetch article details
      const { data: article, error: articleError } = await supabaseClient
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (articleError || !article) {
        throw new Error('Article not found');
      }

      // Check if social content exists, if not generate it first
      if (!article.social_short_form || !article.social_long_form) {
        console.log('Social content not found, generating...');
        
        const generateResponse = await supabaseClient.functions.invoke('generate-social-content', {
          body: { articleId }
        });

        if (generateResponse.error) {
          throw new Error('Failed to generate social content');
        }

        // Fetch updated article with social content
        const { data: updatedArticle } = await supabaseClient
          .from('articles')
          .select('*')
          .eq('id', articleId)
          .single();

        if (updatedArticle) {
          article.social_short_form = updatedArticle.social_short_form;
          article.social_long_form = updatedArticle.social_long_form;
          article.social_image_url = updatedArticle.social_image_url;
        }
      }

      // Construct article URL with production domain
      const articleUrl = `https://danpearson.net/article/${article.slug}`;

      payload = {
        articleTitle: article.title,
        articleUrl: articleUrl,
        shortForm: article.social_short_form,
        longForm: article.social_long_form,
        imageUrl: article.social_image_url || article.image_url,
        isTest: false
      };
    }

    console.log('Sending webhook payload:', payload);

    // Send to webhook
    const webhookResponse = await fetch(webhookSettings.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Webhook error:', errorText);
      throw new Error(`Webhook failed: ${webhookResponse.status}`);
    }

    console.log('Webhook sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isTest ? 'Test webhook sent successfully' : 'Article webhook sent successfully',
        payload 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});