export const screenshotEvent = (item = {}, extra = {}) => ({
    title: item.title || '',
    recordId: item.id == null ? '' : String(item.id),
    topic: item.topic || '',
    contentLanguage: item.language || '',
    owner: item.owner || '',
    ownerKey: item.ownerKey || '',
    contentPlatform: item.platform === 'web' ? 'web' : 'mobile',
    ...extra,
});

export const discoveryEvent = (value, resultCount) => ({
    value: String(value || ''),
    resultCount: Number(resultCount) || 0,
});
