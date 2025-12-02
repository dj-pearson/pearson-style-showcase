import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AES-256-GCM encryption/decryption
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get('VAULT_ENCRYPTION_KEY');
  if (!keyMaterial) {
    throw new Error('VAULT_ENCRYPTION_KEY not configured');
  }
  
  // Derive a proper 256-bit key from the secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and encrypted data
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Verify user is authenticated and admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log(`Vault action: ${action} by user: ${user.id}`);

    switch (action) {
      case 'encrypt': {
        const { value, name, typeId, notes } = body;
        if (!value || !name) {
          return new Response(
            JSON.stringify({ error: 'Value and name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const encryptedValue = await encrypt(value);
        
        // Insert into database
        const { data: item, error: insertError } = await supabaseClient
          .from('secure_vault_items')
          .insert({
            user_id: user.id,
            name,
            encrypted_value: encryptedValue,
            type_id: typeId || null,
            notes: notes || null
          })
          .select('id, name, type_id, notes, created_at, updated_at')
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save vault item' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log access
        await supabaseClient.from('secure_vault_access_log').insert({
          user_id: user.id,
          vault_item_id: item.id,
          action: 'create',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        });

        return new Response(
          JSON.stringify({ success: true, item }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'decrypt': {
        const { itemId } = body;
        if (!itemId) {
          return new Response(
            JSON.stringify({ error: 'Item ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch the encrypted item
        const { data: item, error: fetchError } = await supabaseClient
          .from('secure_vault_items')
          .select('*')
          .eq('id', itemId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !item) {
          return new Response(
            JSON.stringify({ error: 'Vault item not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const decryptedValue = await decrypt(item.encrypted_value);

        // Update last accessed
        await supabaseClient
          .from('secure_vault_items')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', itemId);

        // Log access
        await supabaseClient.from('secure_vault_access_log').insert({
          user_id: user.id,
          vault_item_id: itemId,
          action: 'decrypt',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        });

        return new Response(
          JSON.stringify({ success: true, value: decryptedValue }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { itemId, value, name, typeId, notes } = body;
        if (!itemId) {
          return new Response(
            JSON.stringify({ error: 'Item ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (typeId !== undefined) updateData.type_id = typeId;
        if (notes !== undefined) updateData.notes = notes;
        if (value) {
          updateData.encrypted_value = await encrypt(value);
        }

        const { data: item, error: updateError } = await supabaseClient
          .from('secure_vault_items')
          .update(updateData)
          .eq('id', itemId)
          .eq('user_id', user.id)
          .select('id, name, type_id, notes, created_at, updated_at')
          .single();

        if (updateError) {
          console.error('Update error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update vault item' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log access
        await supabaseClient.from('secure_vault_access_log').insert({
          user_id: user.id,
          vault_item_id: itemId,
          action: 'update',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        });

        return new Response(
          JSON.stringify({ success: true, item }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { itemId } = body;
        if (!itemId) {
          return new Response(
            JSON.stringify({ error: 'Item ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log before delete
        await supabaseClient.from('secure_vault_access_log').insert({
          user_id: user.id,
          vault_item_id: itemId,
          action: 'delete',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        });

        const { error: deleteError } = await supabaseClient
          .from('secure_vault_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ error: 'Failed to delete vault item' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Vault error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
