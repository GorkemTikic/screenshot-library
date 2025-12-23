# 🚀 Comprehensive Deployment & Workflow Guide

This guide provides step-by-step instructions for initial setup, daily updates, and synchronization between your local computer and GitHub.

---

## �️ Step 0: Terminal Navigation
Before running any commands, ensure your terminal (PowerShell or CMD) is in the correct project folder.

**1. Copy and paste this command:**
```powershell
cd "C:\Users\user\Desktop\Screenshot Assistant\FD SCREENSHOT V04 - EDIT\support-screenshot-library-main"
```

> [!TIP]
> If you get an error saying "not a git repository", it usually means you are in the wrong folder. Running the `cd` command above will fix this.

---

## 🔄 Daily Workflow (Updates)

### 1. Pull Updates from GitHub (Reverse Sync)
If changes were made via the Admin Panel on the live site, they exist only on GitHub. **Always run this first** before starting your work to avoid conflicts.

```bash
git pull origin main
```

### 2. Save Your Local Changes (Push)
When you modify code or files on your computer, run these commands to save them to GitHub:

```bash
# Prepare all changed files
git add .

# Save with a descriptive message
git commit -m "Update: [Describe your changes here]"

# Upload to GitHub
git push origin main
```

### 3. Update the Live Website (Deploy)
After pushing your code, run this command to build the project and publish it to GitHub Pages:

```bash
npm run deploy
```

---

## 🏗️ Initial Repository Setup
*Only follow these steps if you are setting up a NEW repository.*

1. **Create Repository**: Go to [github.com/new](https://github.com/new) and create a repo named `screenshot-library`.
2. **Link Local Code**:
   ```bash
   git init
   git remote add origin https://github.com/YOUR_USERNAME/screenshot-library.git
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```
3. **Automated Deployment**: Ensure `gh-pages` is installed (`npm install gh-pages --save-dev`).

---

## 🔑 GitHub Token Configuration (Admin)
To allow the Admin Panel to save data to GitHub:
1. Go to **GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (Classic)**.
2. Generate a token with the `repo` scope.
3. In your application, click the **Admin > Settings** button and enter this token.

---

## 🚨 Troubleshooting Checklist
| Issue | Solution |
| :--- | :--- |
| **"not a git repository"** | Run the `cd` command in Step 0. |
| **"permission denied"** | Ensure your GitHub Token is correct and hasn't expired. |
| **"merge conflict"** | Run `git pull origin main` BEFORE you make any local changes. |
| **Images not showing** | Run `git pull origin main` to download images uploaded via the Admin Panel. |

---
*Senior Architecture & Documentation Standard*
