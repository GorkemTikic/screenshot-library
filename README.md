# 📸 Screenshot Library Assistant

> **Last Updated:** 2025-12-30  
> **Version:** 1.3.0  
> **Role:** Senior Technical Architecture Map

A premium dashboard for managing and viewing project screenshots, featuring automated GitHub synchronization and a high-performance filtering system.

---

## 🗺️ Project Structure Map

```text
support-screenshot-library-main/
├── .github/                # GitHub Actions & Workflows
├── legacy/                 # Legacy assets (Safe to ignore)
├── public/                 # Static assets
│   ├── screenshots/        # Local screenshot storage (synced via Git)
│   └── fd-logo.svg         # Library logo
├── src/                    # Source code
│   ├── assets/             # Component-specific styles/images
│   ├── components/         # Reusable UI components
│   │   ├── Layout.jsx      # Main application frame
│   │   ├── Lightbox.jsx    # Full-screen image preview
│   │   ├── MarketTicker.jsx# Real-time data ticker
│   │   ├── PlatformIcons.jsx# Platform identifiers
│   │   ├── ScreenshotCard.jsx# Individual item display and timestamps
│   │   └── ScreenshotGallery.jsx# Main grid and filtering logic
│   ├── contexts/           # Global state management
│   │   ├── DataContext.jsx # Centralized data, API fetching & sync state
│   │   └── ThemeContext.jsx# Theme management
│   │   └── data.json       # Source of truth for all entries
│   ├── pages/              # Top-level view components
│   │   ├── AdminPage.jsx   # Content management / Settings
│   │   ├── AnalyticsPage.jsx# Data insights and trends (Recharts)
│   │   └── HomePage.jsx    # User entry point
│   ├── services/           # Service layer
│   │   ├── github.js       # GitHub API integration (Rest/Content)
│   │   └── analytics.js    # Google Apps Script tracking bridge
│   ├── utils/              # Helper functions
│   │   ├── imageUtils.js   # Image path resolution
│   │   └── langUtils.js    # Language code mapping (CN, RU, etc.)
│   ├── App.jsx             # Root router
│   ├── index.css           # Design system (Glassmorphism & Neon)
│   └── main.jsx            # Entry point
├── backfill.cjs            # Maintenance script for data timestamp backfilling
├── DEPLOYMENT.md           # Maintenance & Deployment guide
├── index.html              # HTML template
├── package.json            # Scripts & Dependencies (Vite, React 19)
└── vite.config.js          # Build configuration
```

---

## 🛠️ Technical Breakdown

| Component / File | Responsibility | Key Feature |
| :--- | :--- | :--- |
| `AdminPage.jsx` | Management UI for content and settings. | Centralized configuration |
| `ScreenshotCard.jsx` | Item display + Interactive Feedback + Timestamps. | Multi-lang text toggle |
| `github.js` | Direct communication with GitHub REST API. | SHA-aware commits |
| `analytics.js` | Event logging pipeline via Google Apps Script. | Persistent Device UID |
| `backfill.cjs` | CLI tool to populate `updatedAt` metadata. | Timezone-aware formatting |
| `index.css` | Premium Design System with smooth animations. | Neon & Glassmorphism |

---

## 🧠 Core Architecture Logic

1.  **Dual-Source Fetching**: 
    *   The app uses `raw.githubusercontent.com` for public read-only access (fast CDN).
    *   In the **Admin Panel**, it switches to the **GitHub API** for fetching `data.json`, bypassing the CDN cache (approx. 5 min) to ensure real-time consistency.
2.  **Timezone-Aware Metadata**: 
    *   The system tracks `updatedAt` for every entry. 
    *   **Logic**: Chinese screenshots use **UTC+8**, while all other languages default to **UTC+0**. 
    *   Maintenance is handled by `backfill.cjs` to ensure legacy data remains compliant.
3.  **Analytics Pipeline**: 
    *   Events (clicks, copies, views) are piped to a Google Apps Script endpoint.
    *   Uses `no-cors` mode for fire-and-forget logging to minimize UI latency.
    *   Assigns a unique `uuid` stored in `localStorage` to distinguish unique users.
4.  **State Protection**: The `DataProvider` implements an "Initialization" state that prevents user interactions until the latest data from GitHub is fully synchronized locally.

---

## 🚀 Setup & Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **GitHub Configuration**:
    *   Generate a GitHub PAT (Classic) with `repo` scope.
    *   Apply it in **Admin > Settings** to enable synchronization.
3.  **Data Maintenance**:
    ```bash
    node backfill.cjs
    ```
4.  **Local Development**:
    ```bash
    npm run dev
    ```
5.  **Production Deployment**:
    ```bash
    npm run deploy
    ```

---

## 🤖 AI & Developer Instructions

- **Main Registry**: `src/data/data.json`.
- **Filename Restrictions**: Avoid using special characters like colons `:` or parentheses `()` in screenshot filenames, as these cause loading issues in certain environments.
- **Backfill Rule**: Always run `node backfill.cjs` after bulk importing data to ensure the `updatedAt` field is populated with the correct timezone offset.
- **Analytics**: To update the tracking endpoint, modify the `TRACKING_URL` in `src/services/analytics.js`.

---
*Created with care by Antigravity Senior Architect 🚀*

