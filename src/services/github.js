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

    // 3. General Update JSON helper (INTERNAL USE ONLY)
    _updateJsonFileInternal: async (path, newContent, message = "Update file via Admin Panel") => {
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

    /**
     * UNIFIED ATOMIC SYNC (Tree API)
     * Handles image upload and data.json update in ONE single commit.
     * This is multi-user safe (Atomic) and twice as fast.
     */
    unifiedAtomicSync: async (action, item, imageFile = null) => {
        if (!githubService.isConfigured()) throw new Error("Config missing");
        const { owner, repo } = githubService.getConfig();

        // 1. Get the latest commit SHA from the main branch (to ensure we are up to date)
        const refResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/main`, {
            headers: githubService.getHeaders(),
            cache: 'no-store'
        });
        if (!refResponse.ok) throw new Error("Failed to fetch branch reference");
        const refData = await refResponse.json();
        const baseCommitSha = refData.object.sha;

        // 2. Get the latest data.json content from that commit
        const dataPath = 'src/data/data.json';
        const dataUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${dataPath}?ref=${baseCommitSha}`;
        const dataResponse = await fetch(dataUrl, {
            headers: githubService.getHeaders(),
            cache: 'no-store'
        });
        if (!dataResponse.ok) throw new Error("Failed to fetch current data.json");
        const dataFileData = await dataResponse.json();

        let currentItems;
        try {
            currentItems = JSON.parse(decodeURIComponent(escape(atob(dataFileData.content))));
        } catch (e) {
            throw new Error("Local data.json is corrupted on remote.");
        }

        // 3. Prepare the New Tree
        const treeItems = [];

        // A. Handle Image if provided
        let finalItem = { ...item };
        if (imageFile) {
            const base64Content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(imageFile);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
            });

            const sanitizedName = imageFile.name.replace(/[^a-z0-9.]/gi, '-').replace(/-+/g, '-');
            const fileName = `screenshots/${Date.now()}_${sanitizedName}`;
            const fullPath = `public/${fileName}`;

            // Add image to tree
            treeItems.push({
                path: fullPath,
                mode: '100644',
                type: 'blob',
                content: atob(base64Content) // The API prefers raw string or blob SHA, but for small files content works if encoded correctly
                // Note: Content field is actually limited. Better to use Blobs for larger files.
            });

            // Re-encode content as base64 blob if needed, but for simplicity let's use the blob API for the image
            const blobResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/blobs`, {
                method: 'POST',
                headers: githubService.getHeaders(),
                body: JSON.stringify({ content: base64Content, encoding: 'base64' })
            });
            const blobData = await blobResponse.json();

            // Correct way: Add blob SHA to tree
            treeItems[0] = {
                path: fullPath,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha
            };

            finalItem.image = `screenshots/${fileName.split('/').pop()}`;
        }

        // B. Apply Data Change
        let newItems;
        if (action === 'ADD') {
            newItems = [finalItem, ...currentItems];
        } else if (action === 'UPDATE') {
            newItems = currentItems.map(i => i.id === finalItem.id ? { ...i, ...finalItem } : i);
        } else if (action === 'DELETE') {
            newItems = currentItems.filter(i => i.id !== finalItem.id);
        }

        // Add updated JSON to tree
        const jsonContent = JSON.stringify(newItems, null, 2);
        treeItems.push({
            path: dataPath,
            mode: '100644',
            type: 'blob',
            content: jsonContent
        });

        // 4. Create the new Tree
        const newTreeResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/trees`, {
            method: 'POST',
            headers: githubService.getHeaders(),
            body: JSON.stringify({
                base_tree: dataFileData.sha, // We use the file's tree or the commit's tree? Better use the commit's tree.
                // Actually, let's get the commit tree first.
                base_tree: (await (await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { headers: githubService.getHeaders() })).json()).tree.sha,
                tree: treeItems
            })
        });
        const newTreeData = await newTreeResponse.json();

        // 5. Create the Commit
        const commitResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/commits`, {
            method: 'POST',
            headers: githubService.getHeaders(),
            body: JSON.stringify({
                message: `${action}: ${finalItem.title || finalItem.id} via Admin Unified Sync`,
                tree: newTreeData.sha,
                parents: [baseCommitSha]
            })
        });
        const newCommitData = await commitResponse.json();

        // 6. Update the Reference (Force check concurrency)
        const updateRefResponse = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/main`, {
            method: 'PATCH',
            headers: githubService.getHeaders(),
            body: JSON.stringify({
                sha: newCommitData.sha,
                force: false // IF FALSE, it will fail if someone else moved main! (This is our safety lock)
            })
        });

        if (!updateRefResponse.ok) {
            if (updateRefResponse.status === 422) {
                throw new Error("Concurrency Conflict: Someone else updated the database. Please REFRESH the page to get the latest data before saving.");
            }
            throw new Error(`Commit failed: ${updateRefResponse.statusText}`);
        }

        return newItems;
    },

    // Legacy support or fallback
    atomicUpdateDataJson: async (action, item) => {
        return await githubService.unifiedAtomicSync(action, item);
    }
};
