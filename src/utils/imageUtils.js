/**
 * Resolves the correct URL for an image based on the environment.
 * 
 * @param {string} url - The image path or URL from the data source.
 * @returns {string} - The fully resolved URL safe for the current environment.
 */
export const resolveImageUrl = (url) => {
    if (!url) return '';

    // If it's already an absolute URL or data URI, return as is
    if (url.startsWith('http') || url.startsWith('data:')) {
        return url;
    }

    // In all environments (Dev & Prod), use the configured BASE_URL.
    // Vite serves from the base path in dev if it is configured.
    const baseUrl = import.meta.env.BASE_URL;

    // Ensure no double slashes if base ends with / and url starts with /
    if (baseUrl.endsWith('/') && url.startsWith('/')) {
        return `${baseUrl}${url.slice(1)}`;
    }

    // Ensure we don't duplicate the base URL if it's already included
    if (url.startsWith(baseUrl)) {
        return url;
    }

    return `${baseUrl}${url}`;
};
