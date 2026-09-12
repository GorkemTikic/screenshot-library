import fs from 'node:fs';
import path from 'node:path';

const dataFile = path.resolve('src/data/data.json');
let content = fs.readFileSync(dataFile, 'utf8');

// The regex matches https://github.com/GorkemTikic/support-screenshot-library/blob/<COMMIT_OR_MAIN>/images/<FILENAME>?raw=true
// and replaces it with https://raw.githubusercontent.com/GorkemTikic/support-screenshot-library/main/images/<FILENAME>

const newContent = content.replace(
    /https:\/\/github\.com\/GorkemTikic\/support-screenshot-library\/blob\/[^/]+\/images\/([^?]+)\?raw=true/g,
    'https://raw.githubusercontent.com/GorkemTikic/support-screenshot-library/main/images/$1'
);

fs.writeFileSync(dataFile, newContent, 'utf8');

console.log("Successfully replaced wrong GitHub URLs.");
