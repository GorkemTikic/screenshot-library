import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.resolve(__dirname, 'src/data/data.json');
let content = fs.readFileSync(dataFile, 'utf8');

// The regex matches https://github.com/GorkemTikic/support-screenshot-library/blob/<COMMIT_OR_MAIN>/images/<FILENAME>?raw=true
// and replaces it with https://raw.githubusercontent.com/GorkemTikic/support-screenshot-library/main/images/<FILENAME>

const newContent = content.replace(
    /https:\/\/github\.com\/GorkemTikic\/support-screenshot-library\/blob\/[^\/]+\/images\/([^?]+)\?raw=true/g,
    'https://raw.githubusercontent.com/GorkemTikic/support-screenshot-library/main/images/$1'
);

fs.writeFileSync(dataFile, newContent, 'utf8');

console.log("Successfully replaced wrong GitHub URLs.");
