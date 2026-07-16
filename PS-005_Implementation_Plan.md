# PS-005 Implementation Plan
## Website Defacement Detection & Vulnerability Assessment Platform
**Team size:** 4 | **Time budget:** 5 hours | **Event:** System Siege

---

## 1. Scope Decision (lock this first — 5 min)

Build ONE coherent pipeline: **Add Site → Snapshot → Diff → AI Risk Score → Alert → Dashboard (RBAC + Audit Log)**

Explicitly cut for time (mention as "future work" in README, don't build):
- Multi-region/geo distribution
- Real-time WebSocket push (poll every 10-15s instead)
- Email/SMS alerts (in-app alert feed is enough)
- Historical trend charts (just show latest + last flagged event)

---

## 2. Tech Stack (fastest path, not "best" path)

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python) or Express (Node) | Fast to scaffold, team likely knows one |
| DB | SQLite (file-based) or Postgres via Supabase | SQLite = zero setup time |
| Snapshotting | Playwright (headless Chromium) | Screenshot + HTML in one call |
| Visual diff | `pixelmatch` (JS) or `Pillow` + `imagehash` (Python) | Mature, drop-in |
| DOM/text diff | `diff` (JS) or Python `difflib` | Standard library-level tool |
| Auth | JWT, 2 roles: `admin`, `viewer` | Simple middleware check |
| AI risk scoring | Groq (Llama 3.1/3.3, free & fast) or Gemini Flash | BYOK — disclose key provider + model in README |
| Frontend | React + Vite + Tailwind | Fast to style, team likely knows it |
| Deploy | Backend: Render/Railway. Frontend: Vercel/Netlify. DB: same as backend host or Supabase | Free tier, fast deploy |

---

## 3. Data Model (agree on this in first 30 min — everything depends on it)

```
users
  id, email, password_hash, role ('admin' | 'viewer'), created_at

assets (monitored websites)
  id, url, label, owner_id, created_at, status ('clean' | 'flagged' | 'checking')

snapshots
  id, asset_id, screenshot_path, dom_hash, dom_text, captured_at

alerts
  id, asset_id, snapshot_id_before, snapshot_id_after,
  diff_score (float), severity ('low'|'medium'|'high'),
  ai_explanation (text), status ('open'|'reviewed'|'dismissed'),
  created_at

audit_logs
  id, user_id, action (text), target_type, target_id, timestamp
```

---

## 4. API Contract (lock in first hour — enables parallel work)

```
POST   /auth/register          { email, password }              -> user
POST   /auth/login             { email, password }              -> { token, role }

POST   /assets                 { url, label }        [admin]     -> asset
GET    /assets                                                    -> asset[]
DELETE /assets/:id                                    [admin]     -> 204

POST   /assets/:id/snapshot                            (internal/cron trigger) -> snapshot
GET    /assets/:id/snapshots                                      -> snapshot[]

GET    /alerts                 ?status=open                      -> alert[]
POST   /alerts/:id/dismiss                            [admin]     -> alert
POST   /alerts/:id/review                             [admin]     -> alert

GET    /audit-logs                                    [admin]     -> log[]
```

All admin-only routes must reject `viewer` role with 403 — this is your main RBAC attack surface, implement it correctly and consistently.

---

## 5. Team Split (4 workstreams, run in parallel from Hour 1)

### Person 1 — Snapshot Engine
- Playwright script: given a URL, capture full-page screenshot + serialize DOM text
- Compute a content hash (SHA-256 of normalized DOM text) for cheap "did anything change" pre-check
- Store snapshot to disk/S3-equivalent + insert DB row
- Wrap as a callable function/endpoint + a simple interval scheduler (setInterval / APScheduler) that snapshots every asset every N minutes
- **Deliverable by hour 3:** given an asset ID, produces a new snapshot row + files

### Person 2 — Diff Engine + AI Risk Scoring
- Visual diff: compare current screenshot vs previous (pixelmatch or Pillow pixel diff) → produces a numeric diff score (% pixels changed)
- Text/DOM diff: diff previous vs current DOM text → produces a change summary (added/removed text blocks)
- If diff score crosses threshold (e.g. >5% pixels changed OR major DOM structural change) → create an `alert` row
- Call AI (BYOK) with: diff summary + change type + before/after text excerpts → get back `{ severity, explanation, recommended_action }`
  - `recommended_action` matters — the PS explicitly asks the AI to "recommend remediation actions," not just classify risk. A one-line suggestion (e.g. "Rotate CMS admin credentials and check recent login IPs") is enough.
- **Deliverable by hour 3:** given two snapshot IDs, returns diff score + creates alert with AI explanation

### Person 3 — Backend API, Auth, RBAC, Audit Log
- Implement all endpoints in the API contract above
- JWT auth with role claim; middleware that checks role per-route
- Every state-changing action (add asset, dismiss alert, delete asset, login) writes an `audit_logs` row
- Wire Person 1's snapshot function and Person 2's diff function into the scheduler/endpoint flow
- **Deliverable by hour 3:** full API running locally, testable via Postman/curl

### Person 4 — Frontend Dashboard
- Login/register screen
- Asset list view (add asset — admin only; status badge clean/flagged)
- Alert feed, **sorted by severity (high → low)** — this is what demonstrates "prioritize risks" from the PS, not just a flat list (before/after screenshot side-by-side, AI explanation + recommended action, severity badge, dismiss/review buttons — admin only)
- Audit log table (admin only)
- Role-aware UI: hide admin controls for `viewer` role (but backend must ALSO enforce it — never trust frontend-only checks)
- **Deliverable by hour 3:** working UI hitting mocked/local API

---

## 6. Timeline

| Time | Activity |
|---|---|
| 0:00–0:30 | Lock data model + API contract together as a team. Set up repo, branches, shared `.env.example` |
| 0:30–3:00 | Parallel build (each person on their workstream above). Commit often, push early |
| 3:00–3:45 | Integration: wire snapshot → diff → alert → AI → frontend end-to-end. Fix contract mismatches |
| 3:45–4:15 | Seed 2-3 real target sites (use your own test sites or intentionally-vulnerable demo sites you control — never scan sites you don't own/have permission for) |
| 4:15–4:45 | Deploy: backend to Render/Railway, frontend to Vercel, verify public URLs work |
| 4:45–5:00 | Write README (setup instructions, AI provider/model disclosure per BYOK rule, known limitations), final smoke test, submit |

Build 15 minutes of slack into hour 4 — deployment/env issues are the #1 time sink in hackathons.

---

## 7. README Must Include (per rulebook requirements)

- GitHub repo link, clear setup instructions
- Deployed app link
- 1-2 sentence project description + domain (Cyber Security & Web Mining)
- **AI disclosure:** provider + model version used (e.g. "Groq API, llama-3.3-70b-versatile") — mandatory per BYOK rule, flagged as violation if missing/faked
- Known limitations (be honest — this reads as engineering maturity to judges, and volunteering it is safer than an attacker finding it first)

---

## 8. Where You're Likely to Get Attacked in Phase 2 (defend these proactively)

- **RBAC bypass:** viewer hitting admin endpoints directly (not through UI) — test this yourselves before going live
- **Audit log gaps:** an action that changes state but isn't logged — audit every mutating endpoint
- **Diff logic edge cases:** dynamic content (ads, timestamps, rotating banners) causing false-positive alerts — normalize/ignore known-dynamic regions if time allows
- **Auth issues:** weak password hashing, missing token expiry, no rate limiting on login

Test these yourself in the last 30 minutes if time allows — free points you deny attackers.
