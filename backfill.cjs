const fs = require('fs');
const path = require('path');

try {
    const dataPath = path.join(__dirname, 'src', 'data', 'data.json');
    console.log('Reading from:', dataPath);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    function formatTime(timestamp, language) {
        const date = new Date(timestamp);
        const tzOffset = language === 'Chinese' ? 8 : 0;

        // Adjust for timezone
        const adjustedDate = new Date(date.getTime() + (tzOffset * 60 * 60 * 1000));

        const Y = adjustedDate.getUTCFullYear();
        const M = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
        const D = String(adjustedDate.getUTCDate()).padStart(2, '0');
        const h = String(adjustedDate.getUTCHours()).padStart(2, '0');
        const m = String(adjustedDate.getUTCMinutes()).padStart(2, '0');

        return `${Y}-${M}-${D} ${h}:${m} UTC+${tzOffset}`;
    }

    const updatedData = data.map(item => {
        if (!item.updatedAt) {
            // Use ID as initial timestamp if available, else current time
            const initialTimestamp = (item.id && item.id > 1000000000000) ? item.id : Date.now();
            item.updatedAt = formatTime(initialTimestamp, item.language);
        }
        return item;
    });

    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2), 'utf8');
    console.log('Backfill complete.');
} catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
}
