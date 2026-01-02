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
                const sanitizedName = file.name.replace(/[^a-z0-9.]/gi, '-').replace(/-+/g, '-');
                const fileName = `screenshots/${Date.now()}_${sanitizedName}`;
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

    // 3. General Update JSON helper
    updateJsonFile: async (path, newContent, message = "Update file via Admin Panel") => {
        if (!githubService.isConfigured()) throw new Error("Config missing");
        const { owner, repo } = githubService.getConfig();
        const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;

        // Step A: Get current SHA (with cache busting)
        let sha = null;
        try {
            const getResponse = await fetch(`${url}?t=${Date.now()}`, {
                headers: githubService.getHeaders(),
                cache: 'no-store'
            });

            if (getResponse.ok) {
                const currentFile = await getResponse.json();
                sha = currentFile.sha;
            } else if (getResponse.status !== 404) {
                const err = await getResponse.json().catch(() => ({}));
                throw new Error(`Could not fetch ${path} (Status: ${getResponse.status}): ${err.message || ''}`);
            }
        } catch (e) {
            console.warn(`File ${path} may not exist yet, or fetch failed:`, e);
            // If it's not a 404, we might want to rethrow, but here 404 is allowed for initial creation
        }

        // Step B: Commit Update
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(newContent, null, 2))));

        const putResponse = await fetch(url, {
            method: 'PUT',
            headers: githubService.getHeaders(),
            body: JSON.stringify({
                message,
                content: content,
                sha: sha || undefined
            })
        });

        if (!putResponse.ok) {
            const err = await putResponse.json().catch(() => ({}));
            console.error("GitHub Sync Error:", err);
            throw new Error(`Update Failed (Status: ${putResponse.status}): ${err.message || 'Unknown error'}`);
        }

        return await putResponse.json();
    },

    // Bridge for existing code
    updateDataJson: async (newItems) => {
        return githubService.updateJsonFile('src/data/data.json', newItems, "Update data.json via Admin Panel");
    }
};
