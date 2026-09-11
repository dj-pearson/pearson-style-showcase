import { describe, it, expect } from 'vitest';
import { contactSchema } from '../ContactForm';

const valid = {
  name: 'Dan Pearson',
  email: 'dan@example.com',
  subject: 'About a project',
  message: 'I would like to talk about a project.',
};

const nameError = (name: string) => {
  const result = contactSchema.safeParse({ ...valid, name });
  return result.success ? null : result.error.issues[0].message;
};

describe('contact form name validation', () => {
  it.each([
    ["O'Brien", 'a straight apostrophe'],
    ['O’Brien', 'the curly apostrophe a phone keyboard inserts'],
    ['Mary-Jane Watson', 'a hyphen'],
    ['José García', 'accents'],
    ['Müller', 'an umlaut'],
    ['J. R. Smith', 'initials'],
    ['山田太郎', 'a name written in another script'],
  ])('accepts %s (%s)', (name) => {
    expect(nameError(name)).toBeNull();
  });

  it.each([
    ['Agent007', 'digits'],
    ['<script>alert(1)</script>', 'markup'],
    ['buy@cheap.example', 'an email address'],
    ["'quoted", 'a leading apostrophe'],
  ])('rejects %s (%s)', (name) => {
    expect(nameError(name)).not.toBeNull();
  });

  it('still enforces the length bounds', () => {
    expect(nameError('D')).toBe('Name must be at least 2 characters');
    expect(nameError('D'.repeat(51))).toBe('Name must be less than 50 characters');
  });
});
