export const emptySurvey = {
    usageFrequency: '',
    satisfaction: 0,
    searchEase: 0,
    underCoveredTopic: '',
    customTopic: '',
    languagesNeeded: [],
    platformPreference: '',
    requestExperience: '',
    topFeature: '',
    biggestFrustration: '',
    otherFeedback: '',
};

const FIELDS = Object.keys(emptySurvey);

export function sanitizeSurveyDraft(value = {}) {
    const draft = { ...emptySurvey };
    for (const field of FIELDS) {
        if (field === 'languagesNeeded') {
            draft[field] = Array.isArray(value[field]) ? value[field].filter((entry) => typeof entry === 'string') : [];
        } else if (typeof value[field] === typeof emptySurvey[field]) {
            draft[field] = value[field];
        }
    }
    return draft;
}

export function validateSurveySection(section, survey) {
    const topic = survey.underCoveredTopic === 'Other' ? survey.customTopic.trim() : survey.underCoveredTopic;
    if (section === 0) {
        if (!survey.usageFrequency) return 'Please select your usage frequency.';
        if (!survey.satisfaction) return 'Please rate your satisfaction.';
        if (!survey.searchEase) return 'Please rate how easy search feels.';
    }
    if (section === 1) {
        if (!topic) return 'Please select the most under-covered topic.';
        if (!survey.languagesNeeded.length) return 'Please select at least one language.';
        if (!survey.platformPreference) return 'Please select a platform preference.';
        if (!survey.requestExperience) return 'Please share your Request Screenshot experience.';
    }
    if (section === 2) {
        if (survey.topFeature.trim().length < 3) return 'Please share a feature idea using at least 3 characters.';
        if (survey.topFeature.length > 300) return 'Feature idea must be 300 characters or fewer.';
        if (survey.biggestFrustration.trim().length < 3) return 'Please describe your biggest frustration using at least 3 characters.';
        if (survey.biggestFrustration.length > 300) return 'Frustration must be 300 characters or fewer.';
        if (survey.otherFeedback.length > 500) return 'Other feedback must be 500 characters or fewer.';
    }
    return '';
}

export function createRequestReference(date = new Date(), random = Math.random) {
    const day = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('');
    const suffix = Math.floor(random() * 10000).toString(16).toUpperCase().padStart(4, '0');
    return `FDSL-${day}-${suffix}`;
}
