# CLAUDE.md

Twilio Flex UI 2.x plugin that embeds into **Dynamics 365 Customer Service** via
**CIF 2.0** (Channel Integration Framework). It screen-pops the caller's contact,
logs each call as a `phonecall` activity linked to that contact, enables
click-to-dial from Dynamics, and writes wrap-up disposition + notes back onto the
activity.

- Design spec: `docs/superpowers/specs/2026-07-08-flex-dynamics-cif-design.md`
- Implementation plan (full task-by-task, with code): `docs/superpowers/plans/2026-07-08-flex-dynamics-cif.md`
- Status: Tasks 1–11 implemented, reviewed, merged to `main`. Task 12 = manual
  end-to-end verification in a real D365 org (the user runs it).

## Architecture

Single Flex plugin; all `Microsoft.CIFramework.*` calls isolated behind one
adapter. Data flow: **Flex Action listener → CifClient (adapter) → CIF API →
Dynamics → Dataverse.** The plugin never talks to Dataverse directly.

- `src/config/integrationConfig.ts` — typed config + `getConfig(overrides)`
  (deep-merges nested `attr`/`dispositionMap`). Search fields, disposition
  option-set map, and task-attribute paths all come from here — **never hardcode.**
- `src/cif/cifGlobal.ts` — typed accessor `getCif()` for `window.Microsoft.CIFramework`.
- `src/cif/loadCifLibrary.ts` — presence-poll loader (gates on CIF global presence,
  not the `CIFInitDone` event — deliberate deviation, documented in-file).
- `src/cif/CifClient.ts` — the adapter: `isAvailable`, `screenPop`,
  `quickCreateContact`, `logCall` (never throws), `onClickToDial`.
- `src/mappers/contactSearch.ts`, `src/mappers/phonecall.ts` — pure payload builders.
- `src/listeners/screenPop.ts` (`afterAcceptTask`), `src/listeners/logCall.ts`
  (`afterCompleteTask`) — thin; both **guard voice-only** via `cfg.voiceChannelName`.
- `src/actions/clickToDial.ts` — CIF `onclicktoact` → Flex `StartOutboundCall`.
- `src/state/callContext.ts` — in-memory `Map` keyed by task SID; correlates the
  screen-popped contact id from accept → complete, then `clearTask()`.
- `src/DynamicsCifPlugin.tsx` — `init()` wires everything. `src/index.ts` loads it.

## Where interactions are stored

| What | Where | Lifetime |
|------|-------|----------|
| Call media / recording / TaskRouter task | Twilio Flex | Twilio retention |
| Interaction summary (`phonecall` activity, linked to contact) | Dataverse | Permanent CRM record |
| task-SID → contact-id link | plugin memory (`callContext` Map) | cleared after logging |

## Credentials / auth model

The plugin needs **no Microsoft credentials.** It runs inside the authenticated
Dynamics session (the CIF iframe); every CIF call executes as the logged-in agent,
authorized by that agent's security role. No keys/tokens in the bundle (it's
client-side JS — treat anything in it as public).

Entra ID (Azure AD) app registration + client secret/certificate is required
**only** for calling the Dataverse Web API *outside* CIF (server-side sync,
agent-less background jobs). Not needed for the current design.

## Config over code

Runtime overrides come from Flex account config at
`manager.serviceConfiguration.ui_attributes.dynamicsCif` and deep-merge over
`DEFAULTS` in `init()`. Tune disposition map, field name, and attribute paths
there — **no rebuild/redeploy needed.** Example:

```json
{ "ui_attributes": { "dynamicsCif": {
  "dispositionFieldName": "new_disposition",
  "dispositionMap": { "resolved": 100000001 },
  "attr": { "callerNumber": "caller" }
} } }
```

## Microsoft-side setup (prereqs for Task 12, done in D365 admin)

1. **Dataverse** (`make.powerapps.com` → Tables → Phone Call): add a **Choice**
   column resolving to logical name `new_disposition` (prefix depends on the
   solution publisher — confirm the real name, feed it to `dispositionFieldName`).
   Record each choice's **integer value** → that's what `dispositionMap` sends. Publish.
2. **CIF 2.0** channel provider: Channel URL = the Flex UI URL that loads the
   released plugin; **Enable Outbound Communication = Yes** (this is ClickToAct —
   `setClickToAct` is deprecated, never call it); assign to agent security roles.
3. Grant **microphone** permission in the CIF iframe (WebRTC softphone).
4. **Studio Flow** must put the caller's E.164 on task attributes (default path `caller`).

## Toolchain

- `npx tsc --noEmit` — type-check (must be clean).
- `npx jest` — full suite (currently 39/39). Config is a hand-written standalone
  `jest.config.js` (jsdom env); the `flex-plugin test` CLI is broken (leaks
  `--run-script` into jest), so use `npx jest` directly.
- `twilio flex:plugins:build` — must emit a **single bundle** under `build/`, no
  numbered chunks. **Constraint: static top-of-file imports only, never dynamic
  `import()`** — it breaks the single-bundle requirement.
- Deploy/release: `twilio flex:plugins:deploy` / `twilio flex:plugins:release`.

## CIF facts (verified, don't re-derive)

- Every CIF call must occur after `CIFInitDone`; API timeout is **100 s**.
- `createRecord(entity, JSON.stringify(data))`; `phonecall` link field is
  `"regardingobjectid_contact@odata.bind": "/contacts(<id>)"`.
- `onclicktoact` payload: `{ value, name, format, entityLogicalName }`.
- `phonecall`: `directioncode` 0=incoming/1=outgoing; `statecode`=1 Completed;
  `statuscode`=4 Received (inbound) / 2 Made (outbound).
