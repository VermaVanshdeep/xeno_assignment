# Xeno CRM

An AI-powered, developer-friendly Customer Relationship Management (CRM) system.
Xeno CRM combines dynamic customer segmentation, multi-channel campaign management, and a robust AI copilot to automate audience discovery and optimize marketing ROI.

---

## Overview

Modern marketing requires deep, targeted segmentation and fast campaign iteration. However, querying large datasets usually requires SQL expertise or complex UI builders, and optimizing message copy is often a manual guess-work process.

Xeno CRM solves this by offering an intelligent, dynamic CRM platform:
* **Natural Language Segmentation:** Convert plain English into complex Postgres queries via an AI Copilot.
* **Multi-Channel Orchestration:** Create, manage, and dispatch campaigns across WhatsApp, SMS, Email, and RCS.
* **Real-time Analytics:** Measure delivery rates, open rates, CTR, and revenue impact in real-time.
* **AI-Driven Optimization:** Receive automated insights and channel recommendations based on live performance data.

---

## Key Features

### Customer Management
* Comprehensive customer profiles including order history, spending metrics, and demographics.
* Scalable PostgreSQL backend built to handle large datasets efficiently.

### Audience Segmentation
* **Dynamic Rule Engine:** Build complex AST-based (Abstract Syntax Tree) segmentation rules (e.g., total spend > $500 AND days since last purchase < 30).
* **Live Audience Preview:** Calculate exact audience sizes before saving segments.

### Campaign Management
* Multi-channel support (WhatsApp, SMS, Email, RCS).
* Campaign lifecycle management (Draft, Scheduled, Running, Completed, Failed, Cancelled).
* Automated simulated campaign dispatch with a robust background processing worker.

### Analytics
* **Dashboard Metrics:** Track total revenue, active campaigns, order trends, and customer growth.
* **Funnel Analysis:** Measure Send → Delivery → Open → Click conversion rates.
* **Revenue Tracking:** Correlate campaign engagement with actual customer purchases.

### AI Copilot
* **Audience Discovery:** Generate complex JSON segment filters from natural text queries.
* **Campaign Generator:** Automatically generate high-converting message templates and objectives.
* **Insights & Optimization:** AI-driven analysis of campaign ROI and channel-specific performance optimization.

### Multi Channel Communication
* Extensible channel service simulating delivery, open, and click events.
* Retry mechanisms and failure handling for communication jobs.

### Authentication & Workspaces
* Secure protected routes with basic local authentication (`xeno_auth`).

---

## Product Walkthrough

The platform is designed around a seamless, end-to-end marketing workflow:

```mermaid
flowchart LR
    A[Customer Data Integration] --> B[Audience Segments]
    B --> C[Campaign Builder]
    C --> D[Multi-Channel Delivery]
    D --> E[Analytics Dashboard]
    E --> F[AI Optimization]
    F -.-> B
```

1. **Customer Creation:** Ingest customer and order data.
2. **Segmentation:** Create dynamic segments via the visual builder or AI Copilot.
3. **Campaign Creation:** Assign a segment, write a template (or generate via AI), and select a channel.
4. **Campaign Dispatch:** The backend queue processes pending jobs and generates communication events.
5. **Analytics:** View real-time funnel conversion metrics.
6. **Optimization:** Ask the Copilot why a campaign underperformed and apply suggestions to the next segment.

---

## System Architecture

The system utilizes a decoupled client-server architecture with a relational database and background processing queues.

```mermaid
flowchart TD
    Client[React Frontend]
    API[Express API]
    Services[Business Logic & AI Services]
    DB[(PostgreSQL)]
    Worker[Background Queue Worker]
    LLM[Groq AI Llama-3.3-70b]

    Client -->|HTTP / REST| API
    API --> Services
    Services --> DB
    Services <-->|Intent Routing & Generation| LLM
    Worker -->|Process Communication Jobs| DB
```

---

## Tech Stack

### Frontend
* **React 19**
* **Vite** (Build Tool)
* **Tailwind CSS** (Styling)
* **Framer Motion** (Animations)
* **Recharts** (Data Visualization)
* **React Router DOM** (Routing)

### Backend
* **Node.js** with **Express**
* **TypeScript**
* **Groq SDK** (AI Integration)
* **Background Worker** (setInterval-based job queue processing)

### Database & ORM
* **PostgreSQL**
* **Drizzle ORM** (Schema definition and migrations)

---

## Database Design

The relational schema is optimized for fast analytical queries and robust relational integrity.

```mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : "places"
    CUSTOMERS ||--o{ CAMPAIGN_AUDIENCE : "targeted in"
    CUSTOMERS ||--o{ COMMUNICATION_EVENTS : "generates"
    CUSTOMERS ||--o{ COMMUNICATION_JOBS : "has pending"
    SEGMENTS ||--o{ CAMPAIGNS : "used by"
    CAMPAIGNS ||--o{ CAMPAIGN_AUDIENCE : "targets"
    CAMPAIGNS ||--o{ COMMUNICATION_EVENTS : "generates"
    CAMPAIGNS ||--o{ COMMUNICATION_JOBS : "has pending"

    CUSTOMERS {
        uuid id PK
        varchar email
        varchar phone
        varchar city
    }
    ORDERS {
        uuid id PK
        numeric amount
        varchar category
        timestamp orderDate
    }
    SEGMENTS {
        uuid id PK
        varchar name
        jsonb rulesJson
    }
    CAMPAIGNS {
        uuid id PK
        varchar channel
        varchar status
        integer audienceSize
    }
```

---

## AI Features

Powered by `llama-3.3-70b-versatile` via the Groq API, the Copilot features sophisticated intent routing and zero-shot generation:

* **Intent Routing:** A hybrid classifier (local heuristic + LLM fallback) accurately routes queries into 6 categories (Greeting, General Chat, Segment Generation, Campaign Generation, Analytics Insight, Optimization Suggestion).
* **Audience Discovery:** Translates natural language into a highly structured JSON Abstract Syntax Tree (AST) for segment execution.
* **Campaign Generator:** Generates campaign titles, objectives, message copy, and recommends the optimal channel based on intent.
* **Analytics Insights:** Analyzes live campaign metrics (Open rates, CTR, ROI) to provide human-readable performance explanations.
* **Optimization Suggestions:** Evaluates aggregated channel performance to provide concrete, actionable recommendations to improve delivery and engagement.

---

## Analytics Engine

The platform features a multi-layered analytics engine tracing from raw SQL to UI charts:

* **Dashboard Metrics:** Aggregates total customers, orders, and revenue trends.
* **Campaign Funnel:** Analyzes `communication_events` to build a conversion funnel (Sent → Delivered → Opened → Clicked).
* **Revenue Attribution:** Calculates campaign ROI by tracking overall spend behavior against targeted cohorts.
* **Channel Performance:** Compares WhatsApp, SMS, Email, and RCS across delivery rates and CTRs.

---

## API Overview

### Segments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/segments/preview` | Calculate live audience size for an AST rule |
| POST | `/api/segments` | Create a new segment |
| GET | `/api/segments` | List all segments |
| GET | `/api/segments/:id` | Get a specific segment |

### Campaigns
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/campaigns` | Create a new campaign |
| POST | `/api/campaigns/:id/launch` | Dispatch a campaign and queue jobs |
| POST | `/api/campaigns/:id/cancel` | Cancel a running or scheduled campaign |
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign details |

### Analytics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/dashboard` | Get high-level KPI metrics |
| GET | `/api/analytics/campaigns-summary`| Get summary of all campaign performances |
| GET | `/api/analytics/campaigns/:id` | Get detailed funnel analytics for a campaign |
| GET | `/api/analytics/channels` | Get aggregate channel performance metrics |
| GET | `/api/analytics/revenue-trend` | Get time-series revenue data |

### AI Copilot
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/route` | Classify user prompt intent |
| POST | `/api/ai/segment` | Generate an AST segment rule |
| POST | `/api/ai/segment-enrich` | Generate marketer-friendly metadata for a segment |
| POST | `/api/ai/campaign` | Generate campaign content |
| POST | `/api/ai/insights` | Generate analytics insights |
| POST | `/api/ai/optimize` | Generate optimization suggestions |

### Customers & Orders
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/customers` | List customers |
| POST | `/api/orders` | Create an order |
| POST | `/api/orders/ocr` | Import orders via OCR (Implementation placeholder) |

*(Includes standard CRUD routes for Customers and Orders).*

---

## Feature Demonstration

This section presents high-resolution screenshots of the live Xeno CRM application.

### Login
![Login](docs/screenshots/login-page.png)

### Dashboard
![Dashboard](docs/screenshots/dashboard-page.png)

### Customer Management
![Customers](docs/screenshots/customers-page.png)

### Audience Segmentation
![Segments](docs/screenshots/segments-page.png)

### Campaign Builder
![Campaigns](docs/screenshots/campaigns-page.png)

### Analytics
![Analytics](docs/screenshots/analytics-page.png)

### AI Copilot
![AI Copilot](docs/screenshots/ai-copilot-page.png)

---

## Installation

### 1. Clone the repository
```bash
git clone <repository_url>
cd xeno-assignment
```

### 2. Install dependencies
Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

### 3. Environment Setup
Create a `.env` file in the `backend` directory:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/xeno"
GROQ_API_KEY="your_groq_api_key_here"
PORT=5000
```

### 4. Database Setup & Seed
```bash
cd backend
npm run db:verify
npm run seed
npm run seed:analytics
```

### 5. Start the Services
Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string used by Drizzle ORM. |
| `GROQ_API_KEY` | API key for the Groq LLM service (Llama 3.3). |
| `PORT` | The port the Express API listens on (default: 5000). |
| `NODE_ENV` | Environment identifier (e.g., `test`, `development`). |

---

## Project Structure

```
├── backend/
│   ├── drizzle/               # Database migrations
│   ├── src/
│   │   ├── controllers/       # Express route controllers
│   │   ├── db/                # Drizzle schema, seeding, and connection
│   │   ├── middleware/        # Error handlers and loggers
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic (AI, Analytics, Campaigns)
│   │   └── types/             # TypeScript definitions
│   └── package.json
└── frontend/
    ├── public/                # Static assets
    ├── src/
    │   ├── components/        # Reusable UI components
    │   ├── hooks/             # Custom React hooks
    │   ├── layouts/           # Page layouts (e.g., DashboardLayout)
    │   ├── pages/             # Route views (Dashboard, Campaigns, Copilot, etc.)
    │   └── services/          # API integration clients
    ├── index.html
    ├── tailwind.config.js
    └── package.json
```

---

## Engineering Decisions

* **PostgreSQL & Drizzle ORM:** Chosen for strict type safety and performance. The normalized schema ensures data integrity while allowing complex analytical queries (e.g., recursive JSON AST segment compilation directly to SQL).
* **Express & Node.js:** Provides a lightweight, unopinionated framework perfectly suited for building highly customized API endpoints and background workers (like the Channel Service event simulator).
* **Groq SDK (Llama 3.3 70B):** Utilized for ultra-low latency AI inference, ensuring the Copilot feels instantaneous and responsive compared to traditional OpenAI APIs.
* **React & Vite:** Vite provides incredibly fast HMR, while React paired with Framer Motion ensures a modern, highly interactive, and responsive user experience.
* **Tailwind CSS:** Allows for rapid UI prototyping and strict design system adherence without the bloat of traditional CSS frameworks.

---

## Known Limitations

* **Simulated Communications:** The `ChannelService` currently simulates message dispatches, deliveries, and clicks. External providers (Twilio, SendGrid) are not actively integrated.
* **Authentication:** Authentication is currently a lightweight client-side mock (`xeno_auth` in localStorage). Production JWT/OAuth flows are not implemented.
* **OCR Import:** The `/api/orders/ocr` endpoint is routed but serves as a placeholder for future ingestion capabilities.

---

## Future Improvements

* **External Integrations:** Integrate real providers like Twilio for SMS/WhatsApp and SendGrid for Emails.
* **Advanced Scheduling:** Implement CRON-based scheduling for recurring campaigns.
* **OAuth Authentication:** Implement NextAuth or Supabase Auth for robust workspace and user management.
* **CSV / OCR Ingestion:** Complete the pipeline for bulk importing offline customer receipts and lists.

---

## Production Readiness

* **Robust Database:** Fully typed Drizzle migrations are implemented and verified.
* **Background Processing:** The custom campaign dispatcher handles retries and async event simulation to prevent API blocking.
* **Dynamic Query Compilation:** The `segmentCompiler` safely converts nested JSON ASTs into parameterized SQL, preventing injection attacks.
* **Comprehensive Testing:** Included robust test suite (`test:segment`, `test:campaign`, `test:ai`, etc.) validating core business logic.
