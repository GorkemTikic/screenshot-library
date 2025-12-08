import { v4 as uuidv4 } from 'uuid';

const TRACKING_URL = "https://script.google.com/macros/s/AKfycbxOnxP_MmAisAATfNTr1O-Qx_4cjT2Yt-svUyUuCotbsuUNToZy2lV77c0GtEOjgq_w/exec";

// Device ID Management
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

    const deviceId = getDeviceId();
    const params = new URLSearchParams({
        event: eventType,
        uid: deviceId,
        title: data.title || '',
        lang: data.language || '',
        topic: data.topic || '',
        image: data.image || '',
        ...data // specific extras like user feedback
    });

    // Fire and forget (no-cors means we can't read response, but it sends)
    fetch(`${TRACKING_URL}?${params.toString()}`, { mode: 'no-cors' })
        .then(() => console.log(`[Analytics] Sent: ${eventType}`, data))
        .catch(err => console.error("[Analytics] Error:", err));
};

// Calculate Library Stats for Dashboard
export const getLibraryStats = (items) => {
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
    }));

    return {
        totalItems,
        topicData,
        langData
    };
};
