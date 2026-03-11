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
