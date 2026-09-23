import Fuse from 'fuse.js';

const SEARCH_FIELDS = ['title', 'text', 'text_tr', 'topic', 'language', 'owner', 'platform'];
const UNSEGMENTED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

function normalize(value) {
    return String(value ?? '').normalize('NFKD').toLowerCase()
        .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
        .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}

function matchesWord(words, term, prefix = false) {
    return words.some((word) => word === term
        || (prefix && word.startsWith(term))
        || (UNSEGMENTED_SCRIPT.test(term) && word.includes(term)));
}

function relevance(document, query, terms) {
    const { title, titleWords, words } = document;
    if (title === query) return 0;
    if (` ${title} `.includes(` ${query} `)) return 1;
    if (terms.every((term) => matchesWord(titleWords, term))) return 2;
    if (terms.every((term) => matchesWord(titleWords, term, true))) return 3;
    if (terms.every((term) => matchesWord(words, term))) return 4;
    if (terms.every((term) => matchesWord(words, term, true))) return 5;
    return Infinity;
}

// Input is already filtered and sorted newest-first. Stable sorting keeps that
// order only for equally relevant hits, never ahead of a better title match.
export function searchCatalog(items, query = '') {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return items;
    const terms = [...new Set(normalizedQuery.split(' '))];
    const documents = items.map((item) => {
        const fields = SEARCH_FIELDS.map((field) => normalize(item[field]));
        return { item, title: fields[0], titleWords: fields[0].split(' '), words: fields.join(' ').split(' ') };
    });
    const direct = documents.map((document) => ({
        item: document.item, score: relevance(document, normalizedQuery, terms),
    })).filter(({ score }) => Number.isFinite(score));
    if (direct.length) return direct.sort((a, b) => a.score - b.score).map(({ item }) => item);

    // Typos are a fallback within the active filters, restricted to titles.
    // Fuzzy matching long response text makes "funding" match "running" etc.
    const fuse = new Fuse(documents, {
        keys: ['titleWords'], threshold: 0.25, ignoreLocation: true,
        ignoreFieldNorm: true, includeScore: true,
    });
    const matches = terms.map((term) => {
        const scores = new Map();
        if (term.length >= 4) {
            for (const result of fuse.search(term)) scores.set(result.item, result.score);
        }
        for (const document of documents) {
            if (matchesWord(document.titleWords, term, true)) scores.set(document, 0);
        }
        return scores;
    });
    return documents.filter((document) => matches.every((scores) => scores.has(document)))
        .map((document) => ({ item: document.item, score: matches.reduce((sum, scores) => sum + scores.get(document), 0) }))
        .sort((a, b) => a.score - b.score)
        .map(({ item }) => item);
}
