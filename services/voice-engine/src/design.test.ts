import { describe, expect, it } from 'vitest';
import { HARD_RULES, hardRulesFromDesignDoc } from './design.js';

describe('hard rules', () => {
  it('match docs/voice-engine/DESIGN.md word for word', () => {
    const fromDoc = hardRulesFromDesignDoc();
    expect(fromDoc, 'DESIGN.md should be readable from the repo checkout').not.toBeNull();
    expect(HARD_RULES).toBe(fromDoc);
  });
});
