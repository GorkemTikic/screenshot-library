import { describe, expect, it } from 'vitest';
import { contributorIdFromName, validateContributorInput } from '../src/contributors';

describe('contributor management', () => {
  it('builds stable code-safe contributor ids', () => {
    expect(contributorIdFromName('CS Görkem T', 'abc123')).toBe('cs-gorkem-t-abc123');
  });

  it('accepts clean contributor data and rejects invalid roles', () => {
    expect(validateContributorInput({ displayName: 'CS Enzo', role: 'contributor' })).toEqual({ displayName: 'CS Enzo', role: 'contributor' });
    expect(() => validateContributorInput({ displayName: 'E', role: 'admin' })).toThrow();
  });
});
