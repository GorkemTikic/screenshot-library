# GitHub Deployment Guide

Follow these steps to upload your project to GitHub and deploy it as a live website for your team.

## 🔄 Daily Workflow (Updating the Site)

Whenever you make changes to the codes (like editing files on your computer), follow these 2 simple steps to update both your code repository and the live website.

### ⚡ Quick Start: Navigate to Folder
If you just opened PowerShell, copy and run this command first to go to your project folder:
```powershell
cd "C:\Users\user\Desktop\Screenshot Assistant\FD SCREENSHOT V04 - EDIT\support-screenshot-library-main"
```

### Step 1: Save Code to GitHub (Source Code)
Open your terminal (PowerShell or Command Prompt) in the project folder and run these 3 commands one by one:

```bash
# 1. Add all changed files to the 'staging area'
git add .

# 2. Save these changes with a message (describe what you did)
git commit -m "Update: Fixed bug in Admin page"

# 3. Upload (push) the changes to GitHub
git push origin main
```

### Step 2: Publish to Live Website
After saving your code, run this command to update the live link (`github.io`):

```bash
npm run deploy
```

### Step 3: Sync Local Files (Reverse Sync)
Since the Admin Panel pushes data directly to GitHub, your local `data.json` might get outdated. To pull those changes back to your computer (so you are not working on old data):

```bash
cd support-screenshot-library-main
git pull origin main
```
*Run this every time before you start coding/editing files locally.*

---

## Prerequisite: GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Create a new repository named **`screenshot-library`** (matches the code configuration).
   - **Public** or **Private** (Private is better for internal tools).
   - Do **not** initialize with README/gitignore yet.

## Step 1: Prepare the Project (Local)

### 1.1 Configure `vite.config.js`
We need to set the specific base URL for GitHub Pages.
Open `vite.config.js` and ensure it looks like this (I will apply this change for you momentarily):
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/screenshot-library/', // IMPORTANT: Must match your repo name!
})
```

### 1.2 Initialize Git
Open your terminal in the project folder and run:
```bash
git init
git add .
git commit -m "Initial commit"
```

### 1.3 Link and Push
Replace `YOUR_USERNAME` with your actual GitHub username (e.g., `FaikDogan`):
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/screenshot-library.git
git push -u origin main
```

## Step 2: Deploy to GitHub Pages

There are two ways to do this. The easiest for a simple React app is using `gh-pages`.

### Method A: Using `gh-pages` package (Recommended)

1. **Install the deploy tool:**
   ```bash
   npm install gh-pages --save-dev
   ```

2. **Update `package.json`:**
   Add these scripts to your `package.json` interactions:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist",
     ...
   }
   ```

3. **Deploy:**
   Run this command whenever you want to update the live site:
   ```bash
   npm run deploy
   ```

## Step 3: Configure Repository Settings
1. Go to your repository on GitHub.
2. Click **Settings** > **Pages** (sidebar).
3. Under **Source**, ensure it is set to `gh-pages` branch (this is created automatically by the command above).
4. Your site will be live at: `https://YOUR_USERNAME.github.io/screenshot-library/`

## Step 4: Token Configuration (For Admin Features)
Since your project uses the GitHub API to upload images:
1. Generate a **Personal Access Token** (Classic) on GitHub:
   - Settings > Developer Settings > Personal Access Tokens > Tokens (Classic).
   - Scopes: `repo` (Full control of private repositories).
2. Give this token to your team. They will enter it in the **Admin Panel > Settings** button you created.

---
**Note:** If you use a **Private** repository, your team members must also have access to the repo to view the images, or you need to use a separate image host. For a simple team tool, a **Public** repo is easiest if the data isn't sensitive. If it is private, GitHub Pages can be made private (requires GitHub Pro/Enterprise).
