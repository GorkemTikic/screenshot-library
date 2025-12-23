# 📸 Screenshot Library Assistant

> **Last Updated:** 2025-12-24  
> **Version:** 1.1.0  
> **Role:** Senior Technical Architecture Map

A premium dashboard for managing and viewing project screenshots, featuring automated GitHub synchronization, real-time feedback processing, and a high-performance filtering system.

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
│   │   ├── ScreenshotCard.jsx# Individual item display & feedback logic
│   │   └── ScreenshotGallery.jsx# Main grid and filtering logic
│   ├── contexts/           # Global state management
│   │   ├── DataContext.jsx # Centralized data, API fetching & sync state
│   │   └── ThemeContext.jsx# Theme management
│   ├── data/               # Local JSON database
│   │   ├── data.json       # Source of truth for all entries
│   │   └── feedbacks.json  # Separate storage for user reports
│   ├── pages/              # Top-level view components
│   │   ├── AdminPage.jsx   # Content management & Feedback resolution
│   │   ├── AnalyticsPage.jsx# Data insights and trends
│   │   └── HomePage.jsx    # User entry point
│   ├── services/           # Service layer
│   │   ├── github.js       # GitHub API integration (Rest/Content)
│   │   └── analytics.js    # Data processing logic
│   ├── utils/              # Helper functions
│   │   └── imageUtils.js   # Image path resolution
│   ├── App.jsx             # Root router
│   ├── index.css           # Design system (Glassmorphism & Neon)
│   └── main.jsx            # Entry point
├── DEPLOYMENT.md           # Maintenance & Deployment guide
├── index.html              # HTML template
├── package.json            # Scripts & Dependencies
└── vite.config.js          # Build configuration
```

---

## 🛠️ Technical Breakdown

| Component / File | Responsibility | Key Feature |
| :--- | :--- | :--- |
| `AdminPage.jsx` | Management UI for content and feedbacks. | Integrated resolving flow |
| `ScreenshotCard.jsx` | Item display + Interactive Feedback popover. | Instant reporting |
| `github.js` | Direct communication with GitHub REST API. | SHA-aware commits |
| `DataContext.jsx` | Data hydration with GitHub API bypass. | Cache-free live updates |
| `AnalyticsPage.jsx` | Visualization of library trends and distribution. | Recharts integration |
| `index.css` | Premium Design System with smooth animations. | Neon & Glassmorphism |

---

## 🧠 Core Architecture Logic

1.  **Dual-Source Fetching**: 
    *   The app uses `raw.githubusercontent.com` for public read-only access (fast CDN).
    *   In the **Admin Panel**, it switches to the **GitHub API** for fetching `data.json` and `feedbacks.json`, bypassing the 2-5 minute CDN cache to ensure zero data loss.
2.  **Decoupled Feedback**: User reports are stored in `src/data/feedbacks.json` to keep the main library data clean and optimized.
3.  **State Protection**: The `DataProvider` implements an "Initialization" state that prevents user interactions until the latest data from GitHub is fully synchronized locally.
4.  **Premium Design**: The UI follows modern aesthetics using CSS variables for a consistent theme across all components.

---

## 🚀 Setup & Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **GitHub Configuration**:
    *   Generate a GitHub PAT (Classic) with `repo` scope.
    *   Apply it in **Admin > Settings** to enable synchronization.
3.  **Local Development**:
    ```bash
    npm run dev
    ```
4.  **Production Deployment**:
    ```bash
    npm run deploy
    ```

---

## 🤖 AI & Developer Instructions

- **Main Registry**: `src/data/data.json`.
- **Feedback Loop**: Entries in `feedbacks.json` should be resolved via the Admin Page to ensure status updates are committed correctly.
- **Rules**: Do not modify JSON files directly in the `dist/` folder; always use the Admin Panel or update the `src/data/` source files.

---
*Created with care by Antigravity Senior Architect 🚀*
