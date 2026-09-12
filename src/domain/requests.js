export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'already_exists', 'cannot_be_done'];

export const REQUEST_STATUS_META = {
    new: { label: 'New', icon: 'Sparkles' },
    in_progress: { label: 'In progress', icon: 'LoaderCircle' },
    done: { label: 'Done', icon: 'CheckCircle2' },
    already_exists: { label: 'Already exists', icon: 'CopyCheck' },
    cannot_be_done: { label: 'Cannot be done', icon: 'CircleSlash2' },
};

const text = (value) => String(value ?? '').trim();

export function normalizeRequest(input = {}) {
    const createdAt = text(input.createdAt || input.created_at || input.submitted_at || input.timestamp);
    const status = REQUEST_STATUSES.includes(input.status) ? input.status : 'new';
    return {
        id: text(input.id),
        status,
        createdAt,
        requestedLanguage: text(input.requestedLanguage || input.requested_language || input.req_language || input.language),
        requestedPlatform: text(input.requestedPlatform || input.requested_platform || input.req_platform || input.platform),
        description: text(input.description || input.req_description || input.title),
        context: text(input.context || input.req_context),
        searchTerms: text(input.searchTerms || input.search_terms || input.req_search_terms),
        topic: text(input.topic),
        assigneeContributorId: text(input.assigneeContributorId || input.assignee_contributor_id),
        assigneeName: text(input.assigneeName || input.assignee_name),
        resolutionNote: text(input.resolutionNote || input.resolution_note),
        linkedRecordId: text(input.linkedRecordId || input.linked_record_id),
        version: Math.max(1, Number(input.version) || 1),
        updatedAt: text(input.updatedAt || input.updated_at) || createdAt,
        updatedByName: text(input.updatedByName || input.updated_by_name),
        syncState: input.syncState === 'pending' || input.sync_state === 'pending' ? 'pending' : 'synced',
        history: Array.isArray(input.history) ? input.history : [],
    };
}

export function requestDraft(request = {}) {
    return {
        requestId: text(request.id),
        status: REQUEST_STATUSES.includes(request.status) ? request.status : 'new',
        assigneeContributorId: text(request.assigneeContributorId),
        resolutionNote: text(request.resolutionNote),
        linkedRecordId: text(request.linkedRecordId),
        baseVersion: Math.max(1, Number(request.version) || 1),
    };
}

export function mergeConflictDraft(draft = {}, latest = {}) {
    return { ...draft, baseVersion: Math.max(1, Number(latest.version) || 1) };
}

export function validateRequestResolution(request = {}) {
    if (['done', 'already_exists'].includes(request.status) && !text(request.linkedRecordId)) return 'Select a published screenshot.';
    if (request.status === 'cannot_be_done' && text(request.resolutionNote).length < 10) return 'Add a resolution note of at least 10 characters.';
    return '';
}

export function countRequestsByStatus(requests = []) {
    const counts = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0]));
    for (const request of requests) if (REQUEST_STATUSES.includes(request.status)) counts[request.status] += 1;
    return { all: requests.length, ...counts };
}

export function filterRequests(requests = [], filters = {}) {
    const query = text(filters.query).toLowerCase();
    return requests.filter((request) => {
        if (filters.status && filters.status !== 'all' && request.status !== filters.status) return false;
        if (filters.topic && filters.topic !== 'all' && request.topic !== filters.topic) return false;
        if (filters.language && filters.language !== 'all' && request.requestedLanguage !== filters.language) return false;
        if (filters.assignee === 'unassigned' && request.assigneeContributorId) return false;
        if (filters.assignee && !['all', 'unassigned'].includes(filters.assignee) && request.assigneeContributorId !== filters.assignee) return false;
        if (!query) return true;
        return [request.id, request.description, request.context, request.searchTerms, request.topic, request.assigneeName]
            .some((value) => text(value).toLowerCase().includes(query));
    });
}
