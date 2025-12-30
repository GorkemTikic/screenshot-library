import { v4 as uuidv4 } from 'uuid';

const TRACKING_URL = "https://script.google.com/macros/s/AKfycby3ao6x_jhu7xMW32LiUqt2Vx6uIsezpJRNhhqQcpcbxxmhsAdSd6MIxg6i6gwDvVN0/exec";

/**
 * Generates a stable Device Hash using Canvas Fingerprinting and Hardware Specs.
 * This identifies the "Physical Device" rather than just the browser session.
 */
const generateDeviceHash = () => {
    // 1. Canvas Fingerprinting (Identifies GPU/Driver variation)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const txt = 'AntigravityID_v1';
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText(txt, 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText(txt, 4, 17);
    const canvasHash = canvas.toDataURL().slice(-50); // Get unique tail of the image data

    // 2. Hardware & Environment Specs
    const specs = [
        navigator.platform,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.language
    ].join('|');

    // 3. Combine and Generate Hash
    const raw = canvasHash + specs;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
};

// Persistent Cache for Device Hash
let cachedHash = null;
const getDeviceHash = () => {
    if (!cachedHash) {
        cachedHash = localStorage.getItem("fd_device_hash");
        if (!cachedHash) {
            cachedHash = generateDeviceHash();
            localStorage.setItem("fd_device_hash", cachedHash);
        }
    }
    return cachedHash;
};

export const getDeviceId = () => {
    let id = localStorage.getItem("fd_device_id");
    if (!id) {
        id = uuidv4();
        localStorage.setItem("fd_device_id", id);
    }
    return id;
};

// Log Event to Google Script
export const logEvent = (eventType, data = {}) => {
    if (!TRACKING_URL) return;

    const deviceHash = getDeviceHash();
    const params = new URLSearchParams({
        event: eventType,
        hash: deviceHash,
        uid: getDeviceId(), // Keep legacy UID for backward compatibility
        platform: navigator.platform,
        ua: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lang: navigator.language,
        title: data.title || '',
        topic: data.topic || '',
        ...data
    });

    fetch(`${TRACKING_URL}?${params.toString()}`, { mode: 'no-cors' })
        .then(() => console.log(`[Analytics] Sent (Hash: ${deviceHash}): ${eventType}`, data))
        .catch(err => console.error("[Analytics] Error:", err));
};

export const fetchInteractionStats = async () => {
    if (!TRACKING_URL) return null;
    try {
        const response = await fetch(`${TRACKING_URL}?getStats=true`);
        if (response.ok) return await response.json();
    } catch (err) {
        console.warn("[Analytics] Stats fetch failed:", err);
    }
    return null;
};

export const getLibraryStats = (items, interactionData = null) => {
    const totalItems = items.length;

    // Topics Distribution
    const topicCounts = {};
    items.forEach(item => {
        const t = item.topic || 'Uncategorized';
        topicCounts[t] = (topicCounts[t] || 0) + 1;
    });
    const topicData = Object.keys(topicCounts).map(key => ({
        name: key,
        value: topicCounts[key]
    }));

    // Language Distribution
    const langCounts = {};
    items.forEach(item => {
        const l = item.language || 'Unknown';
        langCounts[l] = (langCounts[l] || 0) + 1;
    });
    const langData = Object.keys(langCounts).map(key => ({
        name: key,
        count: langCounts[key]
    })).sort((a, b) => b.count - a.count);

    const interactionStats = interactionData || {
        uniqueUsers: 0,
        topScreenshot: 'N/A',
        totalEvents: 0
    };

    return {
        totalItems,
        topicData,
        langData,
        ...interactionStats
    };
};
