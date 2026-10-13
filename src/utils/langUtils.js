export const getLangCode = (languageName) => {
    if (!languageName) return 'EN';

    const mapping = {
        'English': 'EN',
        'Chinese': 'CN',
        'Russian': 'RU',
        'Arabic': 'AR',
        'Vietnamese': 'VI',
        'Turkish': 'TR'
    };

    return mapping[languageName] || languageName.substring(0, 2).toUpperCase();
};

export const formatDate = (timestamp, language) => {
    if (!timestamp) return 'N/A';

    // items.id is a timestamp
    const date = new Date(Number(timestamp));
    if (isNaN(date.getTime())) return 'N/A';

    const tzOffset = language === 'Chinese' ? 8 : 0;
    const adjustedDate = new Date(date.getTime() + (tzOffset * 60 * 60 * 1000));

    const Y = adjustedDate.getUTCFullYear();
    const M = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const D = String(adjustedDate.getUTCDate()).padStart(2, '0');
    const h = String(adjustedDate.getUTCHours()).padStart(2, '0');
    const m = String(adjustedDate.getUTCMinutes()).padStart(2, '0');

    return `${Y}-${M}-${D} ${h}:${m} UTC+${tzOffset}`;
};

// Content Studio stores updatedAt as an ISO timestamp; older records already hold the display form
// ("2026-09-02 19:36 UTC+0"). Show both the same way, falling back to the id timestamp.
export const formatUpdatedAt = (updatedAt, id, language) => {
    const value = String(updatedAt || '');
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const parsed = Date.parse(value);
        if (!isNaN(parsed)) return formatDate(parsed, language);
    }
    return value || formatDate(id, language);
};
