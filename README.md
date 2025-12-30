# 📸 Screenshot Library Assistant

> **Last Updated:** 2025-12-31  
> **Version:** 1.4.0  
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
│   │   ├── ScreenshotCard.jsx# Item display, Eye-button preview & timestamps
│   │   └── ScreenshotGallery.jsx# Main grid, filtered BOTS/LOAN logic
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
│   │   └── analytics.js    # Identity Resolution (v7.0) tracking bridge
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
| `ScreenshotCard.jsx` | Item display + Macro Text Preview + Timestamps. | Multi-lang text toggle |
| `github.js` | Direct communication with GitHub REST API. | SHA-aware commits |
| `analytics.js` | Advanced Identity Resolution & Event Logging. | Canvas Fingerprinting |
| `backfill.cjs` | CLI tool to populate `updatedAt` metadata. | Timezone-aware (CN vs EN) |
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
3.  **Identity Resolution Engine (v7.0)**: 
    *   **Heuristic Fingerprinting**: Instead of simple cookies, the app generates a stable `deviceHash` using Canvas rendering, GPU signatures, screen specs, and environment variables.
    *   **Relational Storage**: Logs are piped to a relational Google Sheets backend containing dedicated tabs:
        *   `DB_Users`: Stores unique "Physical Users" with IP history and cross-browser identity.
        *   `DB_Logs`: Stores the raw event stream linked by `Device_ID`.
    *   **Accuracy**: Successfully merges sessions from different browsers (e.g., Chrome, Opera) into a single user identity.
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

