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
const COPY_SOURCES = new Set(['card', 'inspector']);
const MARKUP_TOOLS = new Set(['crop', 'arrow', 'number', 'highlight', 'blur']);

export const imageCopyEvent = (item = {}, outcome = {}) => {
    const source = COPY_SOURCES.has(outcome.source) ? outcome.source : 'card';
    const tools = Array.isArray(outcome.toolsUsed) ? outcome.toolsUsed : [];
    const toolsUsed = [...new Set(tools)]
        .filter((tool) => MARKUP_TOOLS.has(tool))
        .slice(0, MARKUP_TOOLS.size)
        .join(',');
    return {
        ...screenshotEvent(item, { source }),
        method: outcome.ok ? 'clipboard' : 'failed',
        success: outcome.ok ? 'true' : 'false',
        edited: outcome.edited ? 'true' : 'false',
        toolsUsed,
        failureReason: outcome.ok ? '' : (COPY_FAILURES.has(outcome.reason) ? outcome.reason : 'write'),
    };
};
