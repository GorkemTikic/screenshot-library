export const screenshotEvent = (item = {}, extra = {}) => ({
    title: item.title || '',
    topic: item.topic || '',
    contentLanguage: item.language || '',
    owner: item.owner || '',
    contentPlatform: item.platform === 'web' ? 'web' : 'mobile',
    ...extra,
});

export const discoveryEvent = (value, resultCount) => ({
    value: String(value || ''),
    resultCount: Number(resultCount) || 0,
});
