# 🚀 Maintenance & Deployment Guide

This guide ensures your local computer stays in sync with the GitHub repository and explains how to publish updates to the live website.

---

## 📁 Environment Setup

All commands below should be run from inside the project folder. 

**Quick Navigation:**
Open your terminal and enter:
```bash
cd support-screenshot-library-main
```

> [!IMPORTANT]
> If you are already inside the `support-screenshot-library-main` folder, you don't need to run `cd` again. Always verify your position with `pwd` (PowerShell) or `cd` (CMD).

---

## 🔄 Daily Maintenance Workflow

Follow these steps in order whenever you want to update the project or save your work.

### 1. Synchronize (Pull)
If you added images or resolved feedbacks on the live website (Admin Panel), those changes are on GitHub but NOT on your computer yet. Run this to get them:

```bash
git pull origin main
```

### 2. Save Local Work (Commit)
If you changed some code or data files on your computer, save them to the repository:

```bash
# Stage all changes
git add .

# Save with a message
git commit -m "Update: Brief description of what you changed"

# Upload to GitHub
git push origin main
```

### 3. Publish to Live Site (Deploy)
To update the actual website that everyone sees, run the deployment script:

```bash
npm run deploy
```

---

## 🔑 Admin Token Setup

To enable the **Save & Sync** feature in the Admin Panel:
1. Create a **GitHub Personal Access Token (Classic)** on GitHub.com.
2. Grant the **`repo`** permission.
3. Paste this token into the **Settings** modal on your Admin Page.

---

## 🚨 Troubleshooting

| Scenario | Solution |
| :--- | :--- |
| **"not a git repository"** | You are in the wrong folder. Use the `cd` command above. |
| **"merge conflict"** | This happens if you modified the same file locally and on GitHub. Usually, `git add .` and `git commit` followed by `git pull` will resolve it. |
| **Changes not showing live** | Wait 1-2 minutes for GitHub Pages to refresh, then hard refresh your browser (Ctrl+F5). |
| **Sync failed on Admin Page** | Check your GitHub Token. If it's a "Conflict (409)", someone else updated the data; refresh the page and try again. |

---
*Senior Architecture Standard*
