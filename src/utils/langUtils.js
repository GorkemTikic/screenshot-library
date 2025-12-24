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
