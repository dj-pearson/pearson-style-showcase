import { assertEquals, assert } from '../_shared/test-asserts.ts';
import { encrypt, decrypt, getEncryptionKey } from '../_shared/vault-crypto.ts';

// The vault's security rests on its AES-256-GCM encryption of secret values.
// The handler's MFA gate / CRUD routing depend on Supabase (imported via a URL
// that this sandbox blocks), so these tests exercise the extracted crypto core
// that protects every stored secret, plus its key-configuration guard.

function withKey(value: string) {
  Deno.env.set('VAULT_ENCRYPTION_KEY', value);
}

Deno.test('encrypt then decrypt round-trips a secret value', async () => {
  withKey('test-vault-key-0123456789');
  const secret = 'ghp_SUPER_secret_token_value';
  const ciphertext = await encrypt(secret);
  assert(ciphertext !== secret, 'ciphertext must not equal plaintext');
  assertEquals(await decrypt(ciphertext), secret);
});

Deno.test('each encryption uses a fresh IV (ciphertexts differ)', async () => {
  withKey('test-vault-key-0123456789');
  const a = await encrypt('same-input');
  const b = await encrypt('same-input');
  assert(a !== b, 'reusing the IV would make identical plaintexts encrypt identically');
  // But both still decrypt back to the same plaintext.
  assertEquals(await decrypt(a), 'same-input');
  assertEquals(await decrypt(b), 'same-input');
});

Deno.test('decrypting tampered ciphertext fails (integrity / auth tag)', async () => {
  withKey('test-vault-key-0123456789');
  const ciphertext = await encrypt('value');
  const tampered = ciphertext.slice(0, -4) + (ciphertext.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  let threw = false;
  try {
    await decrypt(tampered);
  } catch {
    threw = true;
  }
  assert(threw, 'GCM auth tag must reject tampered ciphertext');
});

Deno.test('getEncryptionKey throws when VAULT_ENCRYPTION_KEY is not configured', async () => {
  Deno.env.delete('VAULT_ENCRYPTION_KEY');
  let threw = false;
  try {
    await getEncryptionKey();
  } catch (err) {
    threw = true;
    assert(String((err as Error).message).includes('VAULT_ENCRYPTION_KEY'));
  }
  assert(threw, 'missing key must be rejected rather than silently degrading');
});
