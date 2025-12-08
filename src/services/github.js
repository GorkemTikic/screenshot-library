const GITHUB_API_URL = 'https://api.github.com';

// HARDCODED CONFIGURATION - UPDATE THESE!
const REPO_OWNER = 'GorkemTikic'; // Update with your GitHub Username
const REPO_NAME = 'screenshot-library'; // Update with your Repo Name

// LocalStorage Keys
const KEYS = {
    TOKEN: 'gh_token'
};

export const githubService = {
    // Configuration Management
    saveConfig: (token) => {
        localStorage.setItem(KEYS.TOKEN, token);
    },

    getConfig: () => ({
        token: localStorage.getItem(KEYS.TOKEN),
        owner: REPO_OWNER,
        repo: REPO_NAME
    }),

    isConfigured: () => {
        const { token } = githubService.getConfig();
        return !!token;
    },

    // Helper for Headers
    getHeaders: () => {
        const { token } = githubService.getConfig();
        return {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        };
    },

    // 1. Verify connection and get current user
    verifyConnection: async () => {
        if (!githubService.isConfigured()) throw new Error("Configuration missing");

        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: githubService.getHeaders()
        });

        if (!response.ok) throw new Error("Invalid Token");
        return await response.json();
    },

    // 2. Upload Image to public/screenshots/
    uploadImage: async (file) => {
        if (!githubService.isConfigured()) throw new Error("Config missing");

        const { owner, repo } = githubService.getConfig();
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = reader.result.split(',')[1];
                const fileName = `screenshots/${Date.now()}_${file.name.replace(/\s+/g, '-')}`;
                const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/public/${fileName}`;

                try {
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: githubService.getHeaders(),
                        body: JSON.stringify({
                            message: `Add screenshot: ${fileName}`,
                            content: base64Content
                        })
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.message || "Upload failed");
                    }

                    const data = await response.json();
                    // Return the RAW URL (via raw.githubusercontent or jsdelivr or pages)
                    // Usually: https://raw.githubusercontent.com/:owner/:repo/:branch/public/:path
                    // But for Pages, it might be relative. Let's return the relative path for now 
                    // or the absolute raw URL.
                    // Better: User wants it for GitHub Pages showing.
                    // If deployed at root: /screenshots/filename
                    resolve(`screenshots/${fileName.split('/').pop()}`);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
        });
    },

    // 3. Update data.json
    updateDataJson: async (newItems) => {
        if (!githubService.isConfigured()) throw new Error("Config missing");
        const { owner, repo } = githubService.getConfig();
        const path = 'src/data/data.json'; // Assuming this is where it lives
        const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;

        // Step A: Get current SHA
        const getResponse = await fetch(url, { headers: githubService.getHeaders() });
        if (!getResponse.ok) throw new Error("Could not fetch data.json to get SHA");

        const currentFile = await getResponse.json();
        const sha = currentFile.sha;

        // Step B: Commit Update
        // Encode content to Base64 (supporting UTF-8)
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(newItems, null, 2))));

        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: githubService.getHeaders(),
            body: JSON.stringify({
                message: "Update data.json via Admin Panel",
                content: content,
                sha: sha
            })
        });

        if (!putResponse.ok) throw new Error("Failed to update data.json");
        return await putResponse.json();
    }
};
