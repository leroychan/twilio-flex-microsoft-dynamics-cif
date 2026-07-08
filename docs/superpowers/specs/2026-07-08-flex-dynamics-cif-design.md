# Twilio Flex ↔ Microsoft Dynamics 365 Integration (CIF 2.0) — Design

**Date:** 2026-07-08
**Status:** Approved design, pre-implementation

## 1. Objective

Embed Twilio Flex into Microsoft Dynamics 365 Customer Service (multi-session
workspace) using Channel Integration Framework (CIF) 2.0, so that agents:

- accept live inbound voice calls in the embedded Flex panel (WebRTC softphone);
- get an automatic screen pop of the caller's contact record;
- have each call logged as a Dynamics `phonecall` activity linked to the contact;
- can click-to-dial phone numbers from within Dynamics;
- have their Flex wrap-up disposition + notes written back onto the activity.

## 2. Target stack (confirmed)

- **Flex UI 2.x** (latest), Actions/UI Actions framework.
- **Voice:** WebRTC browser softphone (`voice-javascript-sdk`) inside the CIF panel iframe.
- **Dynamics 365 Customer Service** (Hub/workspace, multi-session).
- **CIF 2.0** (`Microsoft.CIFramework`), NOT CIF 1.0.
- **Hosting:** Twilio-hosted Flex UI; the CIF Channel URL points at the hosted
  Flex URL. The Flex plugin is uploaded to the Twilio Flex Plugins service.
- **Scope:** production-lean — real error handling, proper auth, no hardcoded
  config, deployable to a real org. No managed-solution packaging, no multi-tenant.

## 3. Why not the 2020 Twilio blog / CIF 1.0

The 2020 Twilio blog post uses **CIF 1.0** (single-session; Channel URL
`flex.twilio.com/agent-desktop`; `raiseEvent(WIDGET_CALL_STARTED/ENDED)`). CIF 1.0
is single-session and mismatched with Customer Service workspace. Microsoft's
separate "conversation intelligence" Flex integration is also CIF 1.0 and is a
preview Microsoft plans to deprecate (as of May 2026). We use **CIF 2.0** and take
Microsoft's official `TwilioSampleInteg_version2`
(github.com/microsoft/Dynamics365-Apps-Samples) as the reference for the CIF 2.0
channel setup and library load path.

## 4. Architecture — Approach B (plugin + isolated CIF adapter)

Single Flex plugin, with all CIF calls isolated behind one adapter module.

```
Twilio-hosted Flex UI 2.x   ◄── CIF Channel URL (HTTPS) points here
│
└─ FlexDynamicsPlugin (uploaded to Flex Plugins service)
   ├─ index (init)          loads CIF lib, waits CIFInitDone, registers listeners
   ├─ CifClient (adapter)   wraps ALL Microsoft.CIFramework.* calls
   │                        screenPop() · quickCreate() · logCall() · onClickToDial()
   │                        owns CIFInitDone gate + timeout + OData-bind quirks
   ├─ listeners/            thin Flex Actions wiring; delegates to CifClient
   │    ├─ afterAcceptTask     → screenPop / quickCreate
   │    └─ afterCompleteTask   → logCall (disposition + notes)
   ├─ actions/
   │    └─ clickToDial         → Actions.invokeAction('StartOutboundCall')
   └─ mappers/              pure functions: task attrs → phonecall payload; number → OData filter
```

### Component responsibilities

| Unit | Does | Depends on | Tested via |
|---|---|---|---|
| `CifClient` | Every CIF API call; `CIFInitDone` gate; timeout wrapping; error normalization | `window.Microsoft.CIFramework` | mock the global |
| `listeners/*` | Register Flex Action hooks, read task data, call `CifClient` | `CifClient`, `mappers` | mock `CifClient` |
| `mappers/*` | Pure transforms: Flex task attrs → Dataverse `phonecall` JSON; caller # → OData `$filter` | none | pure unit tests |
| `actions/clickToDial` | Handle CIF click-to-dial, invoke `StartOutboundCall` | Flex Actions, `CifClient` | mock Actions |
| `index` | Plugin lifecycle, load CIF lib script, register listeners | all above | integration |

**Isolation wins:** `CifClient` is the only file that references CIF. `mappers`
are pure (no I/O), so the tricky Dataverse shaping (`@odata.bind`, `directioncode`,
`statuscode`) is unit-tested with no browser/CIF mock.

## 5. Data flow

### Flow 1 — Inbound call → screen pop
```
Inbound → Studio Flow → TaskRouter → reservation → Flex
  → afterAcceptTask
    → mapper: extract caller E.164 from task.attributes
    → CifClient.screenPop(number):
        searchAndOpenRecords('contact', $filter on telephone1/mobilephone, searchOnly=false)
    → 1 match  → CIF opens the contact ✅
    → 0 match  → CifClient.quickCreate('contact', { telephone1: number })
    → 2+ match → CIF opens Contact list (native multi-match behavior)
  → resolved contact id stashed in plugin state keyed by task SID
```

### Flow 2 — Call complete → log phonecall activity
```
afterCompleteTask
  → mapper builds phonecall payload:
      subject, phonenumber, description (= wrap-up notes),
      directioncode (0 inbound / 1 outbound),
      actualdurationminutes,
      statecode = 1, statuscode = 4 (Received, inbound) | 2 (Made, outbound),
      new_disposition (custom option-set),
      "regardingobjectid_contact@odata.bind": "/contacts(<id>)"   (if resolved in Flow 1)
  → CifClient.logCall(payload): createRecord('phonecall', JSON.stringify(payload))
```
If no contact resolved, activity is created without `regardingobjectid`.

### Flow 3 — Click-to-dial from Dynamics → outbound
```
Agent clicks a phone number in D365
  → CIF click-to-dial handler (registered by CifClient) receives the number
  → Actions.invokeAction('StartOutboundCall', { destination: number })
  → outbound call placed; afterCompleteTask later logs it (directioncode = 1)
```

## 6. Key CIF 2.0 API facts (verified 2026)

- `searchAndOpenRecords(entityLogicalName, queryParameters, searchOnly, correlationId, searchType)`
  — `searchOnly=false` opens a single match; multi-match opens only
  Account/Contact/Activity lists; max 5000 records; searchType 1 = categorized (default).
- `createRecord(entityLogicalName, data)` — `data` is a JSON-stringified object;
  supports `field@odata.bind` for lookups; returns a Promise with the created record incl. id.
  Runs client-side, inherits the agent's Dataverse security.
- Quick create via `openForm` (quick-create form) pre-filled with the phone number.
- **Every CIF call must wait for the `CIFInitDone` event.** Post-init API timeout is
  documented as both 10s and 100s in different places — confirm against installed CIF version.
- `setClickToAct` was **deprecated 2025-10-31**; enable ClickToAct via admin
  "Enable outbound communication" settings, not the API.

## 7. Dynamics `phonecall` activity fields

- POST target (if ever server-side): `[org]/api/data/v9.2/phonecalls`; LogicalName
  `phonecall`, PrimaryId `activityid`.
- `subject` (ApplicationRequired), `phonenumber`, `description`, `actualdurationminutes` (Int32).
- `directioncode`: 0/False = Incoming, 1/True = Outgoing (default).
- `statecode`: 0 Open / 1 Completed / 2 Canceled. `statuscode`: 4 Received (inbound) / 2 Made (outbound).
- Link to customer: `regardingobjectid_contact@odata.bind` → `/contacts(<id>)`.
- `new_disposition`: **custom option-set field to be added to `phonecall`** in the
  D365 solution (schema change required — see Prereqs).

## 8. Configuration (no hardcoding)

Plugin reads config from Flex plugin configuration / environment, not source:
- CRM base URL (derived from CIF context / iframe ancestor origin).
- Contact search fields (default `telephone1`, `mobilephone`).
- Disposition option-set logical name + value mapping.
- Task-attribute paths for caller number, disposition, and wrap-up notes.

## 9. Error handling

- `CifClient` rejects clearly if `Microsoft.CIFramework` is absent (plugin loaded
  outside a CIF host) — plugin degrades gracefully, logs, does not crash Flex.
- All CIF calls wrapped with timeout + try/catch; failures logged to console/Flex
  telemetry and surfaced non-fatally (a failed screen pop never blocks call accept).
- `logCall` failure does not block task completion; it is logged and (optionally) retried once.
- Missing/invalid caller number → skip pop, log warning.

## 10. Testing strategy

- **Pure unit tests** for `mappers` (task attrs → phonecall payload; number → OData filter;
  direction/status derivation). No mocks needed.
- **Unit tests** for `CifClient` with a mocked `window.Microsoft.CIFramework`
  (verify correct args, CIFInitDone gating, timeout/error paths).
- **Unit tests** for `listeners` with a mocked `CifClient` (verify the right
  method is called with mapped data on each Action event).
- **Manual/integration**: verified end-to-end in a real Customer Service org with a
  test Twilio number (inbound pop, log, click-to-dial, disposition write-back).

## 11. Prerequisites & open items (confirm during planning)

1. **D365 schema change**: add `new_disposition` option-set field to `phonecall`
   (or reuse an existing field) + option values matching Flex dispositions.
2. **CIF 2.0 channel config**: register the channel with the Twilio-hosted Flex
   Channel URL; enable outbound (ClickToAct) via admin settings.
3. **CIF 2.0 library load path**: confirm how to load `Microsoft.CIFramework` for a
   Twilio-hosted (not Azure-self-hosted) page — reference `TwilioSampleInteg_version2`.
4. **Iframe permissions**: microphone/speaker must be allowed for the CIF panel
   iframe (WebRTC softphone).
5. **Disposition source**: confirm exact task-attribute path where the Flex wrap-up
   UI (native wrap-up notes component or custom tab) writes disposition + notes.
6. **CIF API timeout**: confirm 10s vs 100s for the installed CIF version.
7. **Studio Flow**: inbound Flow routes to TaskRouter/Flex and puts caller E.164 on
   the task attributes (assumed present; scope of Flow build TBD).

## 12. Out of scope (v1)

- Managed-solution packaging / multi-tenant distribution.
- Server-side call logging via Dataverse Web API (CIF `createRecord` is the default;
  the `CifClient` interface leaves room to swap transport later if durability is needed).
- Real-time transcription / recording (historically SIPREC fork, not CIF).
- AI wrap-up auto-summary generation (may feed `description` if enabled later).
