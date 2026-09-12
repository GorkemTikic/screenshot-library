import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createRequestReference,
    emptySurvey,
    sanitizeSurveyDraft,
    validateSurveySection,
} from '../src/domain/survey.js';

test('survey section validation advances only when required answers are present', () => {
    assert.match(validateSurveySection(0, emptySurvey), /frequency/i);
    assert.equal(validateSurveySection(0, { ...emptySurvey, usageFrequency: 'Daily', satisfaction: 4, searchEase: 5 }), '');
    assert.match(validateSurveySection(1, emptySurvey), /topic/i);
    assert.equal(validateSurveySection(1, {
        ...emptySurvey,
        underCoveredTopic: 'General',
        languagesNeeded: ['EN'],
        platformPreference: 'Web',
        requestExperience: 'did_not_need',
    }), '');
    assert.match(validateSurveySection(2, emptySurvey), /feature/i);
    assert.equal(validateSurveySection(2, { ...emptySurvey, topFeature: 'Better search', biggestFrustration: 'Old images' }), '');
});

test('survey draft sanitizer keeps only known serializable fields', () => {
    const draft = sanitizeSurveyDraft({ ...emptySurvey, satisfaction: 5, unknown: 'remove me', languagesNeeded: 'bad' });
    assert.equal(draft.satisfaction, 5);
    assert.equal('unknown' in draft, false);
    assert.deepEqual(draft.languagesNeeded, []);
});

test('request reference is date-prefixed and deterministic with injected random value', () => {
    assert.equal(createRequestReference(new Date('2026-09-12T12:00:00Z'), () => 0.1234), 'FDSL-20260912-04D2');
});
