import { describe, expect, it } from 'vitest';
import { contributorIdFromName, ownerKeyForContributor, validateContributorInput } from '../src/contributors';

describe('contributor management', () => {
  it('builds stable code-safe contributor ids', () => {
    expect(contributorIdFromName('CS Görkem T', 'abc123')).toBe('cs-gorkem-t-abc123');
  });

  it('accepts clean contributor data and rejects invalid roles', () => {
    expect(validateContributorInput({ displayName: 'CS Enzo', role: 'contributor' })).toEqual({ displayName: 'CS Enzo', role: 'contributor' });
    expect(() => validateContributorInput({ displayName: 'E', role: 'admin' })).toThrow();
  });

  it('derives an immutable owner key from contributor identity rather than display name', () => {
    expect(ownerKeyForContributor('owner-bootstrap')).toBe('cs-gorkem-t');
    expect(ownerKeyForContributor('cs-ada-abc123')).toBe('contributor-cs-ada-abc123');
  });
});
