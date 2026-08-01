# ACED Fleet Man — Mechanic Network Expansion
## Implementation Spec for Coding Agent

**Repo:** `ACED-Fleet-Man` (branch: `Rogue-Enhance`)
**Author of spec:** Compiled from Avis Ejerenwa's requirements, July 2026
**Status:** Ready for agent execution — phased

---

## 0. Read This First (Agent Instructions)

1. This repo currently has **two frontends**: legacy EJS (`/views`, served by `app.js`) and a Next.js 14 app (`/frontend`, the "control room" redesign). `CONTEXT.md` claims EJS-only — that is now **stale**. Build all new UI in `/frontend`. Do not add new EJS views. Do not delete EJS yet (still in prod use) — just don't extend it.
2. The `.env`, MongoDB, Cloudinary, and Passenger/cPanel deployment rules in `CONTEXT.md` still apply and are **non-negotiable**: no rate limiters, `trust proxy` stays on, single Node entry point (`app.js`) stays the backend for API routes even though the frontend is now Next.js (i.e., this is likely evolving toward Next.js hitting the Express API, or Next.js API routes proxying to Express — confirm which before Phase 1, see Open Question #1).
3. Work in phases, in order. Each phase should be a separate PR/commit set with the app left in a working state at the end of each phase. Do not jump ahead to invoicing before the bonding relationship exists — the whole feature depends on that being solid first.
4. Every new model below follows the existing convention: Mongoose schema, `{ timestamps: true }`, `entityId` scoping where applicable, `ref` relationships instead of embedding.

---

## 1. Vision, Restated

Today, `Entity` is an undifferentiated concept — every entity is implicitly a delivery service provider (DSP). The platform only handles maintenance requests *inside* one DSP's own walls (their own admin/manager resolves their own drivers' requests).

The expansion turns this into a **two-sided network**:

- **DSPs** (delivery service providers — what the platform already serves) need trucks fixed and want visibility into repair status without having to call the shop.
- **Mechanic entities** (independently referred to by you as CSP — Contracted Service Provider, or MSP — Mechanical Service Provider; I'll standardize on **MSP** below, see Glossary) are auto shops or independent mechanics who want a queue of incoming work, organized by which DSP it came from and which truck, without phone tag.

Once a DSP and an MSP form a **bond** (your word — I'm keeping it, formalized below as a `Partnership`), every maintenance request the DSP raises against a vehicle can be routed to that MSP. The MSP works the job on their own dashboard, updates status, logs parts ordered/in-transit/received, marks the job done, and generates an **invoice** back to the DSP for that job. The DSP sees the whole lifecycle — not just "submitted" and "resolved," a real state machine — and receives and can act on the invoice.

This is the same web application. One `User` model, one `Entity` model (now typed), one auth system, one dashboard shell — just entity-type-aware routing to different dashboard views and a new relationship layer between entities.

---

## 2. Glossary (use these terms consistently in code, comments, and UI copy)

| Term | Meaning |
|---|---|
| **DSP** | Delivery Service Provider entity — existing entity type, unchanged in spirit. Owns vehicles, drivers, managers. |
| **MSP** | Mechanic/Maintenance Service Provider entity — new entity type. Owns mechanics, no vehicles of its own (unless you later want them to track shop equipment — out of scope). |
| **Partnership** (internal name for "the bond") | A many-to-many link between one DSP entity and one MSP entity, with a lifecycle: `requested → active → suspended/terminated`. This is the new model that replaces the informal "association." |
| **Job** | What a `MaintenanceRequest` becomes once it's assigned to an MSP. Same underlying document, extended fields (see §4.3). |
| **Part** | A tracked component ordered for a Job — has a status lifecycle (ordered → shipped → delivered → installed) and optional carrier tracking number. |
| **Invoice** | A billing document an MSP raises against a DSP for one or more completed Jobs. |

---

## 3. Entity Model Changes

### 3.1 Current state
```js
// models/Entity.js (current)
{
  name: String,
  description: String
}
```
Every `User.entityId` points here with no type distinction. `role` enum is `['admin','manager','driver','unassigned']`.

### 3.2 New schema

```js
// models/Entity.js (revised)
const entitySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    entityType: {
        type: String,
        enum: ['dsp', 'msp'],
        required: true,
        default: 'dsp' // backfill assumption for migration — see §12
    },
    contactEmail: { type: String },
    contactPhone: { type: String },

    // MSP-only fields (ignored/hidden in UI for DSPs)
    specialties: [{ type: String }], // e.g. ['diesel', 'hydraulics', 'electrical', 'body-work', 'tires']
    serviceRadius: { type: Number }, // miles, optional — for future geo-matching
    isVerified: { type: Boolean, default: false }, // admin-verified badge, manual toggle for now

    // Directory visibility toggle — an MSP can opt out of being discoverable
    listedInDirectory: { type: Boolean, default: true }
}, { timestamps: true });
```

**Do not** create a separate `MechanicEntity` model. One `Entity` collection, typed by `entityType`, keeps every existing query (`Entity.findOne`, populate calls, JoinRequest logic) working with minimal changes. This is the lowest-risk path and matches how `User.role` already works (single collection, enum-differentiated).

### 3.3 User model changes

```js
// models/User.js (revised)
role: {
    type: String,
    enum: ['admin', 'manager', 'driver', 'mechanic', 'unassigned'],
    default: 'unassigned'
}
```

Add `'mechanic'` as a role. A `mechanic` role only makes sense when `User.entityId` points to an `entityType: 'msp'` Entity — enforce this at the application layer (not schema-level; Mongoose doesn't do cross-field conditional enums cleanly). `admin` and `manager` roles are reused for MSPs too (an MSP admin manages their shop's mechanics the same way a DSP admin manages drivers) — **do not** invent `msp-admin`/`dsp-admin` as separate enum values, that duplicates logic. Instead, derive "what kind of admin" from `req.user.entityId.entityType` at render time.

---

## 4. New / Extended Models

### 4.1 `Partnership` model (the "bond") — NEW

```js
// models/Partnership.js
const mongoose = require('mongoose');

const partnershipSchema = new mongoose.Schema({
    dspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    mspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    status: {
        type: String,
        enum: ['requested', 'active', 'suspended', 'terminated'],
        default: 'requested'
    },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // which side sent the request
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date },
    terms: { type: String }, // free-text notes: rates, payment terms, SLA agreement — optional
    defaultAutoAssign: { type: Boolean, default: true } // see §5.3
}, { timestamps: true });

partnershipSchema.index({ dspEntityId: 1, mspEntityId: 1 }, { unique: true });

module.exports = mongoose.model('Partnership', partnershipSchema);
```

**Why a separate model instead of reusing `JoinRequest`:** `JoinRequest` is a user-joins-entity concept (identity/membership). A `Partnership` is an entity-to-entity business relationship. Conflating them would mean overloading `userId` with an entity reference, which breaks every existing `JoinRequest` query and the mental model. Keep them separate; they're structurally similar (both request→approve state machines) but semantically distinct.

### 4.2 `Part` model — NEW

```js
// models/Part.js
const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest', required: true },
    mspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    name: { type: String, required: true },
    partNumber: { type: String },
    quantity: { type: Number, default: 1 },
    unitCost: { type: Number },
    status: {
        type: String,
        enum: ['needed', 'ordered', 'shipped', 'delivered', 'installed', 'backordered', 'returned'],
        default: 'needed'
    },
    vendor: { type: String },
    trackingNumber: { type: String },
    carrier: { type: String, enum: ['ups', 'fedex', 'usps', 'other'] },
    orderedAt: { type: Date },
    expectedDelivery: { type: Date },
    installedAt: { type: Date },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Part', partSchema);
```

This directly satisfies your "past numbers or paths that I ordered or paths that are already on the way tracking numbers" ask — I read that as "parts numbers / parts ordered / parts on the way with tracking numbers," and built the field set around that reading. One `Part` document per line item so a job can have many parts, each independently tracked (one might be delivered while another is backordered).

### 4.3 `MaintenanceRequest` model — EXTENDED (this becomes "the Job")

```js
// models/MaintenanceRequest.js (additions — keep all existing fields)
{
    // ...existing fields unchanged (entityId, title, description, vehicleId, reportedBy, priority, photoUrl)...

    status: {
        type: String,
        enum: [
            'pending',          // raised by DSP, not yet routed to an MSP
            'assigned',         // routed to an MSP, not yet accepted
            'accepted',         // MSP accepted the job
            'in-progress',      // mechanic actively working it
            'awaiting-parts',   // blocked on a Part with status != installed
            'completed',        // mechanic marked work done
            'invoiced',         // invoice generated
            'closed',           // DSP confirmed/paid — terminal state
            'cancelled'
        ],
        default: 'pending'
    },

    assignedMspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
    assignedMechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // specific mechanic, optional — MSP admin can leave unassigned within their own shop
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    laborHours: { type: Number },
    laborRate: { type: Number },
    mechanicNotes: { type: String }, // "deeper details about the task" — internal MSP-side notes, separate from the DSP-facing description
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
}
```

**Important:** the existing `status` enum (`pending/in-progress/completed/cancelled`) is being replaced with a longer, more precise state machine. This is a breaking change to any existing frontend code that branches on those four values — audit `frontend/app` for every place `status` is read/rendered and update it in the same PR (see §12, migration).

### 4.4 `Invoice` model — NEW

```js
// models/Invoice.js
const mongoose = require('mongoose');

const invoiceLineItemSchema = new mongoose.Schema({
    description: { type: String, required: true },
    type: { type: String, enum: ['labor', 'part', 'fee', 'other'], default: 'other' },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest' } // which job this line traces back to
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true }, // e.g. auto-generated MSP-prefix + sequence
    mspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    dspEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    jobIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest' }], // supports batching multiple jobs into one invoice
    lineItems: [invoiceLineItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
        type: String,
        enum: ['draft', 'sent', 'viewed', 'disputed', 'paid', 'void'],
        default: 'draft'
    },
    dueDate: { type: Date },
    sentAt: { type: Date },
    paidAt: { type: Date },
    paymentMethod: { type: String }, // free text for now — "check", "ACH", "Zelle" — Stripe is Phase 6, not Phase 1
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
```

One invoice can cover multiple jobs (a mechanic doing three trucks for the same DSP in a week might batch-invoice), but always belongs to exactly one MSP→DSP direction — no split invoices across multiple DSPs.

### 4.5 `ActivityLog` model — NEW (recommended addition, not explicitly requested)

You already use an HMAC-tamper-detection pattern for CSV backups in TradeJournal — the same instinct applies here: transparency is the entire point of this feature, so the audit trail needs to be trustworthy, not just present.

```js
// models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceRequest', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorEntityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
    action: { type: String, required: true }, // 'status_change', 'part_added', 'note_added', 'invoice_generated', etc.
    fromValue: { type: String },
    toValue: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
```

Every status transition, part update, and invoice event writes one entry here. This is what feeds the "transparent progress tracking" timeline UI on both the DSP and MSP side — a single chronological feed per job, not two entities guessing what the other one did. Write-only from the app's perspective (no edit/delete endpoints), which is what makes it trustworthy as a record.

---

## 5. Onboarding Flow Redesign

### 5.1 Current flow
Registration → user is `unassigned` → either `create-entity` (becomes `admin` of a brand-new `Entity`) or `request-join` (sends a `JoinRequest` to an existing named entity, approved by that entity's `admin`).

### 5.2 New flow
Insert **one new step** before entity create/join: **"What are you?"**

```
Registration → Choose path:
  ○ I run/work for a Delivery Service Provider (DSP)
  ○ I'm a Mechanic / I run a repair shop (MSP)
       ↓
  Then, same as today: Create New Entity  OR  Join Existing Entity
       ↓ (if Create)
  entityType is set based on the choice above, locked at creation — an entity's
  type does not change after creation (an MSP can't later "become" a DSP; if
  someone needs both, they operate two separate entities and two separate
  logins, or Phase 2's multi-role idea below).
       ↓ (if Join)
  Search/select existing entity — filter the search by entityType matching
  their choice, so an MSP-track user can't accidentally request to join a DSP.
```

### 5.3 API changes

`POST /api/onboarding/create-entity` — add `entityType` to the request body, required, validated against `['dsp','msp']`. Reject `entityName` collisions across both types (name is globally unique already, fine as-is).

`POST /api/onboarding/request-join` — validate that the requesting user's implied type matches the target entity's `entityType` (pass `entityType` from the frontend selection, or better: just look up the target entity's type and don't ask the user to redundantly declare it for the join path — simpler and less error-prone).

### 5.4 New endpoints for Partnerships (the bond itself)

This is separate from user-onboarding — it's entity-to-entity, initiated by an `admin`/`manager` on either side, after both entities already exist.

```
GET  /api/msp/directory
  → List discoverable MSP entities (listedInDirectory: true), for a DSP admin/manager
    to browse and initiate a partnership request. Support query params: specialty,
    isVerified. Auth: any authenticated dsp-side admin/manager.

POST /api/partnerships
  body: { targetEntityId }
  → Creates a Partnership with status 'requested', initiatedBy = req.user.entityId.
    Works both directions — a DSP can request an MSP, or an MSP can pitch a DSP
    (e.g. cold outreach from a new shop). Auth: admin or manager, either entity type.

GET  /api/partnerships
  → List partnerships for the current user's entity, both directions, all statuses.
    Auth: admin or manager.

POST /api/partnerships/:id/respond
  body: { action: 'accept' | 'reject' }
  → Only the non-initiating side can respond. Sets status to 'active' or 'terminated'.
    Auth: admin or manager on the receiving entity.

PATCH /api/partnerships/:id
  body: { status: 'suspended' | 'active' | 'terminated', terms, defaultAutoAssign }
  → Either side can suspend/terminate an active partnership. Auth: admin only
    (higher bar than initiating — ending a business relationship shouldn't be a
    manager-level action).
```

**`defaultAutoAssign` behavior:** when true, a new `MaintenanceRequest` from a DSP entity with exactly one active Partnership auto-sets `assignedMspEntityId` and status `assigned` on creation. When a DSP has *multiple* active partnerships, auto-assign is skipped and the DSP admin/manager picks the MSP manually at request-creation time (dropdown of active partners) — don't guess which shop should get the job when there's more than one option.

---

## 6. Role & Permission Matrix

| Action | DSP driver | DSP manager | DSP admin | MSP mechanic | MSP manager | MSP admin |
|---|---|---|---|---|---|---|
| Submit maintenance request | ✅ | ✅ | ✅ | — | — | — |
| View own DSP's requests | ✅ (own only) | ✅ (all) | ✅ (all) | — | — | — |
| Browse MSP directory | — | ✅ | ✅ | — | — | — |
| Initiate/respond to Partnership | — | ✅ | ✅ | — | ✅ | ✅ |
| Suspend/terminate Partnership | — | — | ✅ | — | — | ✅ |
| Accept a Job | — | — | — | ✅ | ✅ | ✅ |
| Assign Job to specific mechanic (within shop) | — | — | — | — | ✅ | ✅ |
| Update Job status / add mechanic notes | — | — | — | ✅ (own jobs) | ✅ (all shop jobs) | ✅ (all shop jobs) |
| Add/update Parts | — | — | — | ✅ (own jobs) | ✅ | ✅ |
| Generate Invoice | — | — | — | — | ✅ | ✅ |
| View/pay Invoice | — | ✅ (view) | ✅ (view+pay) | — | — | — |
| View directory listing settings | — | — | — | — | — | ✅ |

Enforce this server-side in middleware, not just hidden UI — same pattern the existing `role !== 'admin'` checks already use in `app.js`. Add an `entityType` check alongside the `role` check wherever an endpoint is MSP-only or DSP-only (e.g., `req.user.entityId.entityType !== 'msp'` for `/api/jobs/:id/accept`).

---

## 7. Job (MaintenanceRequest) State Machine

```
pending ──(DSP/system auto-assigns to MSP)──▶ assigned
assigned ──(mechanic/MSP admin accepts)──▶ accepted
accepted ──(mechanic starts work)──▶ in-progress
in-progress ──(a Part is logged with status < installed)──▶ awaiting-parts
awaiting-parts ──(all Parts reach 'installed' or job resumes)──▶ in-progress
in-progress ──(mechanic marks done)──▶ completed
completed ──(MSP generates invoice)──▶ invoiced
invoiced ──(DSP confirms/pays)──▶ closed

Any non-terminal state ──(either side cancels, requires reason)──▶ cancelled
```

Every transition writes an `ActivityLog` entry. `awaiting-parts` is **derived automatically**, not manually set — when a `Part` status changes, run a check: if any Part tied to this job has status in `['needed','ordered','shipped','backordered']`, force job status to `awaiting-parts` (unless already `completed`/`invoiced`/`closed`); if all Parts are `installed` or there are no Parts, allow it back to `in-progress`. This is what gives you real "transparent progress tracking" instead of a mechanic having to remember to update two things.

---

## 8. Mechanic (MSP) Dashboard — Page Spec

**Decision: single `/dashboard` route, not a separate route group.** The server/session already knows `req.user.entityId.entityType` at request time — use that to render `<DspDashboard />` or `<MspDashboard />` from the same route rather than forking into `/dashboard/dsp` and `/dashboard/msp`. This keeps bookmarks, nav links, auth redirects, and layout chrome (sidebar, header) all pointing at one place regardless of entity type, and avoids a second copy of route-guard logic. Sub-pages (job detail, invoices, parts, directory) follow the same pattern — one route, component chosen by `entityType`, e.g. `/dashboard/jobs/[id]` renders `<MspJobDetail />` or `<DspJobDetail />` depending on who's viewing it, since the two sides see different fields on the same underlying `MaintenanceRequest` (MSP sees mechanic notes + status controls; DSP sees a read-mostly view + dispute/pay actions on the linked invoice).

Implementation note: put the branch at the top-level page component, not scattered through child components — one `if (entityType === 'msp')` per route file, not per-widget. Scattering it makes the eventual EJS-removal and any future third entity type (should one ever exist) much harder to reason about.

**MSP Dashboard home** — the pieces you explicitly asked for:
- **Pending requests** — jobs with status `assigned` (needs accept) — this shop's queue.
- **Completed requests** — status `completed`/`invoiced`/`closed`, filterable by DSP and date range.
- **Progress / in-flight** — status `accepted`/`in-progress`/`awaiting-parts`, each showing truck number, DSP name, and current blocking reason if `awaiting-parts`.
- **Parts to order / on the way** — cross-job view of all `Part` documents with status `needed`/`ordered`/`shipped`, sorted by `expectedDelivery`, tracking number and carrier shown inline (this is the "past numbers, paths that are already on the way, tracking numbers" view you described — pulled out as its own tab rather than buried per-job, since a shop juggling many trucks needs to see parts across all jobs at once).

**Job detail view** (click into any job):
- DSP name, truck number, title/description (driver's original report), photo.
- Status control (dropdown/buttons respecting the state machine above).
- Mechanic notes field (your "deeper details" field) — MSP-internal, not shown to DSP by default. Add a checkbox "share note with DSP" per note if you want selective transparency later — Phase 1 can just make all mechanic notes DSP-visible and simplify; flagging as an open question (§13).
- Parts sub-panel: add part, edit status/tracking, per-job.
- "Generate Invoice" button — only enabled once status is `completed`.
- Activity timeline (from `ActivityLog`) — full chronological history.

**Invoicing view** — list of draft/sent/paid invoices, create-invoice flow that lets the mechanic select one or more `completed` jobs for the same DSP, auto-populates line items from `laborHours × laborRate` and each `Part.unitCost × quantity`, editable before sending.

**Shop settings** (MSP admin only) — specialties, service radius, directory visibility toggle, verified badge is view-only (you or a platform admin sets that manually for now).

---

## 9. DSP-Side Additions

The existing DSP dashboard needs new surfaces, not a rebuild:

- **Job status visibility** on the existing maintenance requests list — replace the current 4-state badge with the new state machine, plus which MSP it's assigned to.
- **MSP Directory + Partnerships tab** — browse/request/manage bonds (admin/manager only).
- **Invoices received** — list, view detail, mark-as-paid action (updates `Invoice.status` to `paid`, `paidAt` set) or dispute action (`status: 'disputed'`, requires a note — this writes to `ActivityLog` and should probably notify the MSP, see §10).
- **Per-vehicle repair history** — nice extension of the existing `Vehicle` model: a tab on a vehicle's detail page listing every Job ever raised against it, which becomes genuinely useful once MSPs are logging real completion data (ties into §11 analytics ideas).

---

## 10. Notifications Layer

You didn't explicitly ask for real-time notifications, but "bridge pinpoints of lack of communication" is the whole thesis of this feature — a dashboard nobody checks isn't a bridge. Recommend:

- **Phase 1:** in-app notification bell, backed by a simple `Notification` model (`userId`, `entityId`, `type`, `message`, `link`, `read: Boolean`), written alongside `ActivityLog` entries for the events that matter to the *other* side: job assigned → notify MSP; job accepted/status changed → notify DSP; parts backordered → notify DSP; job completed → notify DSP; invoice sent → notify DSP; invoice paid → notify MSP.
- **Phase 2 (optional, not required for launch):** email digest via existing infrastructure (you likely already have an email path for auth — reuse it, don't add a new provider) for anything that sits unread more than 24h. Avoid SMS/push complexity until the in-app + email loop proves out.

---

## 11. Additional Recommendations (beyond what you asked for)

These are things I'd flag as high-value given the shape of what you're building — take or leave individually:

1. **MSP performance metrics, DSP-facing.** Average turnaround time (accepted→completed), job volume, on-time rate. This is the natural end-state of the `ActivityLog` data and it's what actually helps a DSP pick between multiple bonded MSPs, not just a directory listing. Cheap to compute once the state machine is solid — don't build it until Phase 4+, but design the ActivityLog schema (already done above) so it's a query, not a migration, later.
2. **SLA field on Partnership.** Optional agreed turnaround time per job type. Purely informational at first (no enforcement), but sets up the metrics above to show "on-time vs. SLA" rather than a bare number.
3. **Reuse the tamper-evident pattern from TradeJournal for Invoices specifically**, not the whole activity log — an invoice is a financial document and "the mechanic says X, the DSP remembers Y" is exactly the kind of dispute this platform should prevent. A simple HMAC-SHA256 hash of the invoice's line items + total, stored at generation time, re-verified on view, is low-effort given you've already built this once.
4. **Multi-entity mechanics** (a freelance mechanic bonded to several DSPs, not tied to one shop) — your spec described entity-based bonding (shop-to-DSP), which is the right default. If you also want a *solo* mechanic with no shop entity to work directly, model them as an MSP entity of one (themselves as `admin`) rather than inventing a separate "freelancer" concept — keeps the data model uniform. Worth stating explicitly so nobody builds a second parallel system later.
5. **Parts backorder visibility should be proactive, not just a status.** Since `awaiting-parts` already blocks the job automatically (§7), surface a "stalled >48h" flag on the DSP dashboard — turns passive tracking into an actual early-warning system, which is closer to what "constant mechanic work with barely transparent progress" is really complaining about.

Explicitly **not recommended for now**, to avoid scope creep: payment processing (Stripe) integration, SMS notifications, a public-facing (non-authenticated) mechanic marketplace, geo-matching/auto-suggest of nearby MSPs. All plausible later, none needed to solve the communication-gap problem you described.

---

## 12. Migration Plan

1. **Entity backfill:** every existing `Entity` document gets `entityType: 'dsp'` (matches current real-world usage — nothing today is a mechanic entity). One-time script, run before deploying the new schema as `required`.
2. **MaintenanceRequest status backfill:** map old→new enum values: `pending→pending`, `in-progress→in-progress`, `completed→completed`, `cancelled→cancelled`. These four are a subset of the new enum, so no data is lost — but every place in `/frontend` that switches on these four literal strings needs a pass to also handle the new intermediate states (`assigned`, `accepted`, `awaiting-parts`, `invoiced`, `closed`), or those requests will render in an "unknown status" limbo. **Do this audit explicitly in Phase 3, not as an afterthought.**
3. No changes needed to `User`, `Vehicle`, `Task`, `JoinRequest` — additive only.

---

## 13. Open Questions (resolve before/during Phase 1 — don't guess silently on these, they change the data model)

1. **Is the Next.js frontend calling the existing Express `app.js` API routes directly (same origin, reverse-proxied), or does it have its own `/frontend/app/api` route handlers that then call out to a separate backend?** This determines whether new endpoints in this spec get added to `app.js` or to Next.js API routes. I assumed `app.js` stays canonical since that's the Passenger entry point per `CONTEXT.md`, but confirm.
2. **Mechanic notes visibility:** all DSP-visible by default, or private-unless-flagged? I defaulted to "keep it simple, make them visible" in §8 — confirm before building the field.
3. **Invoice payment tracking:** is "mark as paid" purely a manual DSP action (no real payment processing), at least for v1? Spec above assumes yes.
4. **Can one physical person hold logins at both a DSP and an MSP** (e.g., you personally, running ACED Division's delivery ops *and* wanting to also operate a mechanic shop entity)? Current design assumes one `User` → one `entityId`, so this would need two separate accounts/emails. Flagging since it's plausible given your own dual role in delivery ops.

---

## 14. Phased Rollout Plan

| Phase | Scope | Depends on |
|---|---|---|
| **1** | Entity/User schema changes, onboarding flow with entity-type selection, migration script | — |
| **2** | Partnership model + endpoints, MSP directory, request/accept/suspend flow | Phase 1 |
| **3** | MaintenanceRequest state machine expansion, ActivityLog, full frontend status-handling audit | Phase 1, 2 |
| **4** | Mechanic dashboard (pending/progress/completed views), job accept/assign/status-update UI, mechanic notes | Phase 3 |
| **5** | Part model + parts tracking UI (per-job and cross-job views), awaiting-parts auto-derivation | Phase 3, 4 |
| **6** | Invoice model + generation flow, DSP-side invoice view/pay/dispute | Phase 4, 5 |
| **7** | Notification model + in-app bell, event wiring across all state transitions | Phase 3–6 |
| **8 (optional)** | Performance metrics, SLA fields, invoice HMAC integrity, stalled-job flag | Phase 6, 7 |

Each phase is independently shippable and leaves the app functional — a DSP-only user sees nothing different until Phase 4+ actually surfaces MSP-facing UI.

---

## 15. Safe EJS Removal Plan

The two-frontend situation (`/views` EJS + `/frontend` Next.js) is debt, not a feature, and it gets worse the longer new logic gets built once in Next.js and never ported/retired on the EJS side. This is a **separate workstream from the mechanic-network build** — don't block Phase 1–7 above on it, but run it in parallel starting around Phase 2–3, once the team isn't still actively deciding frontend architecture. Goal: remove EJS without a day where the app is more fragile than it is today.

### 15.1 Why this has to be careful, not fast
`app.js` currently serves EJS views directly (`res.render(...)` routes) *and* is (per Open Question #1) likely the API the Next.js frontend calls. Ripping out EJS carelessly risks: breaking any bookmarked/linked EJS URLs still in use, losing functionality that exists in EJS but was never rebuilt in Next.js, and breaking `app.js` routes that mix page-rendering and API logic in the same handler. The fix is inventory-first, not delete-first.

### 15.2 Step-by-step

1. **Inventory every EJS page and cross-reference against Next.js.** Build a simple table: EJS route → does an equivalent Next.js page exist? → is it at feature parity? Use the file list already in `CONTEXT.md`'s "What Has Been Built So Far" as a starting checklist (`index.ejs`, `dashboard.ejs`, `maintenance_new.ejs`, `walkthrough_new.ejs`, plus anything under `/views/pages` not yet logged there — `views/pages` currently has more files than that list reflects, so regenerate the list from disk, don't trust the doc). Do not remove any EJS page whose Next.js equivalent is missing or incomplete.
2. **Separate page-rendering routes from API routes in `app.js`.** Any `app.get('/some-page', (req,res) => res.render(...))` is a page route and is what's being retired. Any `/api/*` route stays — those are shared infrastructure the Next.js frontend depends on, not part of the EJS UI. Confirm this split explicitly; if any route currently does both (renders a page on GET, but the same path is also hit for data), split it into a clean `/api/...` JSON endpoint before touching anything else.
3. **Add a feature flag / traffic switch, not a hard cutover.** Simplest option given the no-rate-limiter, no-extra-infra constraints in `CONTEXT.md`: an environment variable (e.g. `LEGACY_UI_ENABLED=true`) that, when false, makes the EJS page routes 404 or redirect to the Next.js equivalent instead of removing the route handlers or view files. This lets you flip it off in a low-stakes moment (off-hours, or for yourself first) and flip it back on instantly if something's missing, without a redeploy-and-rollback cycle.
4. **Run both in parallel for a defined window, not indefinitely.** Once the flag exists, pick a real end date (e.g. two weeks) where EJS is reachable only via the flag and Next.js is the default for everyone. Treat any bug report during that window as a parity gap to fix, not a reason to extend the window indefinitely — an open-ended "we'll remove it eventually" is how repos end up with permanent dead code.
5. **Remove, don't just disable, once the window closes clean.** Delete `/views`, the `res.render` routes and their `res.render` handler bodies in `app.js`, the `ejs` dependency from `package.json`, and anything in `/public` that only existed to support EJS pages (check `public/login`, `public/onboarding`, `public/records`, `public/roster`, `public/settings`, `public/weekend` individually — some of these may be static assets Next.js also references, don't assume the whole folder is EJS-only). Remove the `LEGACY_UI_ENABLED` flag itself last, once you're confident nobody needs the escape hatch.
6. **Update `CONTEXT.md` as part of this same PR** (see §16 below) so the next agent or contributor isn't told a stale architecture rule.

### 15.3 What NOT to do
- Don't delete EJS files "since they're unused now" without step 1's inventory — "unused" and "not yet rebuilt" look identical from the file tree.
- Don't do the removal in the same PR as any mechanic-network feature work above. Keep them independently revertable.
- Don't skip the flag step to save time. The whole point of doing this "safely" is a reversible middle state, not a faster deletion.

### 15.4 `CONTEXT.md` correction (apply now, not at the end of §15.2)

The line below is already stale today — Next.js exists and is the active direction — so don't wait for the full EJS removal to fix the doc; fix it now so no agent reading `CONTEXT.md` in the meantime is misled into avoiding `/frontend`.

Current text:
```
- **Architecture:** Single-folder, full-stack Node.js application. NO separate frontend/backend split. NO Vite/React/Next.
```

Replace with:
```
- **Architecture:** Express/Mongoose API in `app.js` (single Node entry point, Passenger-compatible) serving a Next.js 14 frontend in `/frontend`. Legacy EJS views in `/views` are being phased out — see EJS Removal Plan for status; do not extend EJS with new pages.
```

Also update the "Views" line further down, since it currently states EJS-only as fact:

Current text:
```
- **Views:** EJS templates only (`/views`). Tailwind CSS is loaded via Play CDN in the `header.ejs`. The theme is **Blue & White**.
```

Replace with:
```
- **Views:** Next.js (`/frontend`) is the active UI. Legacy EJS templates (`/views`, Tailwind via Play CDN, Blue & White theme) remain for now but are frozen — no new EJS pages, no EJS feature work. See EJS Removal Plan for the retirement process.
```
