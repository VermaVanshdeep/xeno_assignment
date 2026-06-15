# Changelog

All notable changes to the Xeno CRM application made during the production upgrade audit.

## [Unreleased] - 2026-06-15

### Added
- **Analytics Service:** Added `getCRMHealth` calculating holistic health score, audience quality, top converting city, and revenue attribution.
- **AI Campaign Advisor:** Added a pre-launch panel to `Campaigns.tsx` showing predicted reach, predicted CTR, predicted revenue, and suggested send times.
- **Live Progress Polling:** Added `pollCampaignAnalytics` to track real-time delivery funnels for `RUNNING` campaigns in the UI.
- **Database Schema:** Altered `campaigns` table to include `metadata_json` (JSONB) to store AI objectives, CTA texts, and reasoning.
- **AI Copilot Upgrades:** Added Quick Actions to the `AICopilot.tsx` page to "Summarize Best Campaign", "Recommend Next Campaign", "Find Best Audience", and "Explain Performance".

### Changed
- **Dashboard Refactor:** Replaced static, hardcoded placeholder cards with a responsive, animated KPI grid backed by real Drizzle ORM SQL queries.
- **Campaign Workflow:** Refactored campaign creation into a 3-step AI-first workflow (Context -> Review/Refine -> Launch) instead of manual form filling.
- **CSS Architecture:** Refactored `index.css` with major responsive breakpoints (`@media (max-width: 1400px)`, etc.) and robust grid wrappers to fix overflow clipping.
- **Data Tables:** Enriched the campaign table to display real ROI, Generated Revenue, and CTR calculations instead of plain delivery metrics.

### Removed
- **Seed Data:** Removed hardcoded placeholder campaigns ("Mumbai Monsoon Offer") from application source code.
- **Fake UI:** Removed static "Dashboard Screenshot" placeholders and fake chart SVGs.
