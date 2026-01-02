# 📸 Screenshot Library Assistant

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-222222?logo=github&logoColor=white)](https://pages.github.com/)
[![License-MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **Senior Technical Architecture Map | Version 1.5.0**  
> A premium, high-performance dashboard for institutional screenshot management. Featuring glassmorphism aesthetics, automated GitHub synchronization, and advanced identity resolution.

---

## ✨ Core Features

*   **💎 Premium UI/UX**: Built with a "Modern Dark" aesthetic using glassmorphism, neon accents, and smooth Framer Motion animations.
*   **🔄 Automated Sync**: Seamless integration with the GitHub REST API for real-time data updates and image uploads directly from the Admin Panel.
*   **🔍 Semantic Search**: Instant results powered by Fuse.js for high-performance fuzzy matching across titles and content.
*   **📊 Insightful Analytics**: Interactive data visualization using Recharts, tracking trends in content distribution and user interactions.
*   **🧠 Identity Resolution v7.0**: Advanced canvas fingerprinting and hardware telemetry to track unique physical devices across sessions.
*   **🌍 Intelligent Localization**: Dynamic language handling with automated timezone offsets (e.g., UTC+8 for Chinese entries).

---

## 🗺️ Project Structure

```text
support-screenshot-library-main/
├── .github/                # CI/CD Workflows & GitHub Actions
├── public/                 # Static Assets
│   ├── screenshots/        # Screenshot Repository (Auto-synced)
│   └── fd-logo.svg         # Platform Branding
├── src/                    # Source Code
│   ├── components/         # Modular UI Components
│   │   ├── Layout.jsx      # Core Application Shell
│   │   ├── Lightbox.jsx    # Immersive Image Preview
│   │   ├── ScreenshotCard.jsx# Item Display & Interaction Logic
│   │   └── ...             # Specialized sub-components
│   ├── contexts/           # State Management (Data, Theme)
│   ├── data/               # Persistent Storage
│   │   └── data.json       # Centralized JSON Database
│   ├── pages/              # View Layers (Home, Admin, Analytics)
│   ├── services/           # Integration Layer (GitHub, Analytics)
│   └── utils/              # Helper Libraries (Time, Image, Language)
├── backfill.cjs            # Maintenance script for timestamp population
├── DEPLOYMENT.md           # Engineering Playbook for Production
└── package.json            # Deployment Manifest & Dependencies
```

---

## 🧠 Technical Architecture

### 1. Dual-Source Synchronization Engine
The platform implements a sophisticated data fetching strategy:
-   **Client Mode**: Pulls `data.json` from `raw.githubusercontent.com` leveraging the raw CDN for maximum speed and global availability.
-   **Admin Mode**: Switches to direct **GitHub API** calls to bypass CDN caching (approx. 5-minute TTL), ensuring that management actions are reflected immediately without ghosting.

### 2. Identity Resolution Engine (v7.0)
Beyond simple cookies, the system employs **Heuristic Fingerprinting**:
-   **Canvas Rendering**: Generates unique signatures based on GPU and internal browser rendering variations.
-   **Hardware Telemetry**: Incorporates screen specs, platform identifiers, and environment variables into a persistent `deviceHash`.
-   **Stability**: Successfully merges identities across different browsers on the same physical machine.

### 3. Automated Filename Sanitization
To prevent filesystem conflicts on Windows environments, the **GitHub Service** automatically sanitizes all uploaded filenames:
-   Replaces illegal characters (`:`, `<`, `>`, etc.) with hyphens (`-`).
-   Ensures compatibility for all developers during `git pull` operations.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/GorkemTikic/screenshot-library.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### GitHub Integration
To enable the **Admin Panel** sync features:
1.  Generate a **GitHub Personal Access Token (Classic)** with `repo` scopes.
2.  Navigate to **Admin > Settings** in the dashboard and input your token.
3.  Changes will now commit directly to your repository.

---

## 🛠️ Maintenance & Deployment

### Data Backfilling
After bulk importing or manual JSON edits, run the backfill utility to normalize timestamps:
```bash
node backfill.cjs
```

### Production Build
```bash
# Build & Deploy to GitHub Pages
npm run deploy
```

---
*Architected and documented with precision by Antigravity 🚀*
