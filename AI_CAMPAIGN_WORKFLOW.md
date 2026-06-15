# Xeno AI Campaign Workflow

## Architecture Overview

The Xeno CRM Campaign Creation module has transitioned from a standard form-based entry to an intelligent, **AI-first workflow**. Instead of typing messages manually, marketers provide the *context* and *intent*, and the AI generates data-backed, personalized campaign drafts.

### No Hardcoded Data
The application completely removes all hardcoded seeded strings (e.g., "Mumbai Monsoon Offer"). During database seeding, generic but structurally realistic names are injected. Real AI copy is **only** generated when requested by a real user through the interface.

---

## The 4-Phase Generation Flow

### Phase 1: Context & Intent
The marketer selects:
1. **Target Segment** (e.g., "High Spenders in Delhi").
2. **Channel** (WhatsApp, SMS, Email, RCS).
3. **Campaign Goal**, using a preset library (e.g., "Customer Retention", "Win Back Dormant Users", "Festival Promotion") or entering a custom free-text goal.

### Phase 2: Editable AI Draft
The system calls Groq via the `/api/ai/campaign/draft` endpoint. The LLM generates a structured JSON object containing:
- **Campaign Name:** A punchy, internal title.
- **Objective:** The strategic purpose.
- **Message Copy:** The actual personalized body copy.
- **CTA Text:** Short call-to-action button label.
- **Recommended Send Time:** Optimal timing (e.g., "Saturday 10:00 AM IST").
- **Reasoning:** Rationale for these choices.

**Per-Field Regeneration:** 
If the marketer likes the message but dislikes the CTA, they can click ↻ next to the CTA field. The `/api/ai/campaign/regenerate-field` endpoint evaluates the current draft context and regenerates *only* the CTA.

### Phase 3: "Why This Audience?" & Live Preview
Before saving, the marketer sees two intelligent panels:
1. **Live Device Mockup:** A phone/email interface showing the actual generated `messageCopy` injected with preview data.
2. **Why This Audience?:** An AI-generated rationale explaining *why* the selected segment fits the campaign goal, accompanied by mathematically estimated **Expected Conversion Rate** and **Expected Revenue**.

### Phase 4: Launch & Insights
After a campaign runs, marketers can view:
1. **Campaign Timeline:** A real-time drawer showing exact timestamps for Queued → Delivered → Read → Orders.
2. **Post-Launch Insights:** The AI analyzes the actual delivery, open, and click rates against baseline channel performance, generating:
   - A plain-English Performance Summary.
   - Specific Optimization Recommendations for next time.
   - The Next Best Campaign to run.
   - Audience Expansion suggestions.

These insights are stored as a snapshot in the database (`metadata_json`) but can be refreshed via a button.

---

## Database Implementation (Migration-Only)

We avoided dropping the database or destroying existing historical events.
A raw SQL migration was executed to attach AI features to existing tables:

```sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS metadata_json jsonb DEFAULT '{}'::jsonb;
```

This single `JSONB` column flexibly houses the initial AI draft attributes and the post-launch AI insights snapshot.

## Graceful Failure Handling
If the LLM fails (e.g., rate limits, hallucinated schema):
1. **No Silent Fallbacks:** The system does not silently insert hardcoded mock strings.
2. **Error Boundary:** The UI displays a clear error banner.
3. **Retry Mechanism:** The user is provided a "Retry" button.
4. **Preserved Edits:** If regeneration fails on a single field, the rest of the draft is safely preserved in React state.
