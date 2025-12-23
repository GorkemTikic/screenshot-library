# 📸 Screenshot Library Assistant

> **Last Updated:** 2025-12-23  
> **Version:** 1.0.0  
> **Role:** Senior Technical Architecture Map

A premium dashboard for managing and viewing project screenshots, featuring automated GitHub synchronization, real-time analytics, and a high-performance filtering system.

---

## 🗺️ Project Structure Map

```text
support-screenshot-library-main/
├── .github/                # GitHub Actions & Workflows
├── legacy/                 # Relics from previous versions (Safe to ignore)
├── public/                 # Static assets
│   ├── screenshots/        # Local screenshot storage (synced via Git)
│   └── fd-logo.svg         # Brand assets
├── src/                    # Source code
│   ├── assets/             # Component-specific styles/images
│   ├── components/         # Reusable UI components
│   │   ├── Layout.jsx      # Main application frame
│   │   ├── Lightbox.jsx    # Full-screen image preview
│   │   ├── MarketTicker.jsx# Real-time ticker simulation
│   │   ├── PlatformIcons.jsx# SVG-based platform identifiers
│   │   ├── ScreenshotCard.jsx# Individual item display logic
│   │   └── ScreenshotGallery.jsx# Main grid and filtering logic
│   ├── contexts/           # Global state management
│   │   ├── DataContext.jsx # Screenshot data & sync state
│   │   └── ThemeContext.jsx# Dark/Light mode management
│   ├── data/               # Local JSON database
│   │   └── data.json       # Source of truth for all entries
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Top-level view components
│   │   ├── AdminPage.jsx   # Data management & GitHub Sync
│   │   ├── AnalyticsPage.jsx# Visual data insights (Recharts)
│   │   └── HomePage.jsx    # Entry point
│   ├── services/           # External API integrations
│   │   ├── github.js       # GitHub API interaction logic
│   │   └── analytics.js    # Data processing for charts
│   ├── utils/              # Helper functions
│   │   └── imageUtils.js   # Image path resolution
│   ├── App.jsx             # Root router and logic
│   ├── index.css           # Global design system & animations
│   └── main.jsx            # React entry point
├── DEPLOYMENT.md           # Step-by-step CI/CD & Sync guide
├── index.html              # HTML template
├── package.json            # Dependencies & Scripts
└── vite.config.js          # Build configuration
```

---

## 🛠️ File-Level Mapping & Logic

| Component / File | Responsibility | Core Dependencies |
| :--- | :--- | :--- |
| `AdminPage.jsx` | Management UI for adding/editing screenshots. Handles GitHub token auth. | `github.js`, `lucide-react` |
| `ScreenshotGallery.jsx` | High-performance grid with multi-level filtering (Platform, Type, Category). | `fuse.js`, `framer-motion` |
| `github.js` | Service layer for communicating with GitHub REST API for file commits. | Native `fetch` |
| `DataContext.jsx` | Centralized data provider. Hydrates app from `data.json`. | React Context API |
| `AnalyticsPage.jsx` | Real-time visualization of screenshot trends and platform distribution. | `recharts` |
| `index.css` | Implements the **Premium Design System** (Glassmorphism, Neon Accents, Smooth Transitions). | Vanilla CSS |

---

## 🧠 Architecture Logic

1.  **Data Flow**: The application uses a "Local-First, Cloud-Synced" approach.
    *   **Read**: Data is loaded from `src/data/data.json`.
    *   **Write**: The Admin Panel uses a GitHub Personal Access Token (PAT) to commit changes directly to the repository via the `github.js` service.
2.  **State Management**: `DataContext` acts as a global store, ensuring that when a user adds a screenshot via the Admin Panel, the Gallery and Analytics update instantly without page reloads.
3.  **Synchronization**: Since the Admin Panel bypasses local file systems and writes to GitHub, users must run `git pull` locally to synchronize their visual data with the GitHub repository state.

---

## 🚀 Setup & Execution

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Setup**:
    *   Generate a GitHub Personal Access Token (Classic) with `repo` permissions.
    *   Navigate to the **Admin > Settings** button to save the token.
3.  **Local Development**:
    ```bash
    npm run dev
    ```
4.  **Deployment**:
    ```bash
    npm run deploy
    ```

---

## 📜 Maintenance Protocol (Sync-on-Change)

To ensure this documentation remains a perfect map for both humans and AI:

1.  **Automatic Updates**: Every time a file is added, moved, or deleted, or a major logic flow is changed, the `README.md` must be updated.
2.  **Architecture Integrity**: If a new service or context is added, describe its interaction in the **Architecture Logic** section.
3.  **Tagging**: Always update the `Last Updated` header at the top.

---

## 🤖 AI Context & Instructions

If you are an AI processing this project:
- **Primary Data Source**: `src/data/data.json`.
- **Primary UI Style**: Glassmorphism with neon accents (defined in `index.css`).
- **Core Workflow**: Admin entries -> GitHub API commit -> CI/CD deploy.
- **Rules**: Never modify `data.json` directly without checking for potential merge conflicts with the GitHub state.

---
*Created with care by Antigravity Senior Architect 🚀*
