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

const COPY_FAILURES = new Set(['permission', 'unsupported', 'decode', 'encode', 'write']);

export const imageCopyEvent = (item = {}, outcome = {}) => ({
    ...screenshotEvent(item, { source: outcome.source || 'card' }),
    method: outcome.ok ? 'clipboard' : 'failed',
    success: outcome.ok ? 'true' : 'false',
    edited: outcome.edited ? 'true' : 'false',
    toolsUsed: [...new Set(outcome.toolsUsed || [])].filter(Boolean).slice(0, 5).join(','),
    failureReason: outcome.ok ? '' : (COPY_FAILURES.has(outcome.reason) ? outcome.reason : 'write'),
});
