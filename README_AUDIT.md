# Xeno CRM README Audit

This document verifies that every claim, feature, and architectural diagram in `README.md` is strictly traceable to actual code in the repository. No features, APIs, or architectural elements were invented.

## Audit Strategy
The repository was audited using the following checks:
1. `package.json` inspection for tech stack definitions.
2. Drizzle ORM schema inspection for database tables and relations.
3. Express router inspection for API coverage.
4. Business logic service review (`aiService.ts`, `segmentCompiler.ts`, `analyticsService.ts`, `channelService.ts`).
5. Frontend UI routing review (`App.tsx`).

---

## 1. Project Overview & Features
**Claim:** AI-powered, dynamic customer segmentation, multi-channel campaign management, live analytics.
**Verification:**
* Segmentation: Verified in `backend/src/services/segmentCompiler.ts` which translates AST JSON to SQL.
* Multi-channel: Verified in `backend/src/services/channelService.ts` which simulates `WHATSAPP`, `SMS`, `EMAIL`, and `RCS` events.
* AI Copilot: Verified in `backend/src/services/aiService.ts`.
* Live Analytics: Verified in `backend/src/services/analyticsService.ts`.

## 2. Tech Stack Verification
**Claim:** React 19, Vite, Tailwind CSS, Framer Motion, Recharts, Express, Drizzle ORM, PostgreSQL, Groq.
**Verification:**
* **Frontend:** Checked `/frontend/package.json`. Validated dependencies: `react` (^19.2.6), `vite` (^8.0.12), `tailwindcss` (^3.4.3), `framer-motion` (^12.40.0), `recharts` (^3.8.1).
* **Backend:** Checked `/backend/package.json`. Validated dependencies: `express` (^4.19.2), `drizzle-orm` (^0.45.2), `pg` (^8.21.0), `groq-sdk` (^1.2.1).

## 3. Database Design
**Claim:** Tables: `customers`, `orders`, `segments`, `campaigns`, `campaign_audience`, `communication_events`, `communication_jobs`.
**Verification:**
* Extracted directly from `/backend/src/db/schema.ts`.
* Verified all relationships (one-to-many from customers to orders, campaigns to jobs, etc.).

## 4. AI Features
**Claim:** Intent routing (6 categories), Audience Discovery, Campaign Generator, Analytics Insights, Optimization Suggestions.
**Verification:**
* Inspected `/backend/src/services/aiService.ts`.
* Verified the exact 6 intents in `routeIntent` (`GREETING`, `GENERAL_CHAT`, `SEGMENT_GENERATION`, `CAMPAIGN_GENERATION`, `ANALYTICS_INSIGHT`, `OPTIMIZATION_SUGGESTION`).
* Verified `generateSegmentRules` function handles AST generation.
* Verified `generateCampaignContent` returns JSON with title, objective, message, channel.
* Verified `generateAnalyticsInsights` and `generateOptimizationSuggestions` utilizing `groq.chat.completions`.

## 5. System Architecture
**Claim:** Express API, Postgres DB, Background worker.
**Verification:**
* Checked `/backend/src/index.ts`.
* Identified `setInterval` background worker executing `processPendingJobs()` every 5 seconds.
* Verified Drizzle migrations running on boot in `runMigrations()`.

## 6. API Routing
**Claim:** Listed 22+ specific endpoints.
**Verification:**
Traced through `/backend/src/routes/*.ts`:
* `/api/segments`: Found `previewSegment`, `createSegment`, `listSegments`, `getSegment` in `segmentRoutes.ts`.
* `/api/campaigns`: Found `createCampaign`, `launchCampaign`, `cancelCampaign`, `listCampaigns`, `getCampaign` in `campaignRoutes.ts`.
* `/api/ai`: Found `/route`, `/segment`, `/segment-enrich`, `/campaign`, `/insights`, `/optimize` in `aiRoutes.ts`.
* `/api/analytics`: Found `/dashboard`, `/campaigns-summary`, `/campaigns/:id`, `/channels`, `/customers`, `/revenue-trend` in `analyticsRoutes.ts`.
* `/api/orders`: Found `/ocr` (noted as implementation placeholder based on comments), `/`, `/:id` in `orderRoutes.ts`.
* `/api/customers`: Found standard CRUD routes in `customerRoutes.ts`.

## 7. Frontend Architecture
**Claim:** React Router with Protected Routes, specific dashboard pages.
**Verification:**
* Inspected `/frontend/src/App.tsx`.
* Verified routes: `/`, `/customers`, `/segments`, `/campaigns`, `/copilot`, `/analytics`.
* Verified `xeno_auth` localStorage mock authentication check in `ProtectedRoute`.

## 8. Known Limitations
**Claim:** Simulated channels, Mock Auth.
**Verification:**
* Verified `channelService.ts` manually simulates delays and probabilistic failures (e.g., `Math.random() < failureRate`) rather than calling external APIs.
* Verified `App.tsx` checks `localStorage.getItem("xeno_auth")` instead of full JWT verification.

---
**Audit Conclusion:** The `README.md` accurately represents the current state of the repository. No features or implementations were fabricated.
