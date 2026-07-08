# Flex ↔ Dynamics 365 (CIF 2.0) Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Twilio Flex UI 2.x plugin that embeds into Dynamics 365 Customer Service via CIF 2.0 — screen-popping the caller's contact, logging each call as a `phonecall` activity, enabling click-to-dial from Dynamics, and writing wrap-up disposition + notes back onto the activity.

**Architecture:** Approach B — a single Flex plugin with all `Microsoft.CIFramework.*` calls isolated behind one `CifClient` adapter. Flex Actions listeners are thin and delegate to the adapter; pure `mappers` build the Dataverse payloads. See spec: `docs/superpowers/specs/2026-07-08-flex-dynamics-cif-design.md`.

**Tech Stack:** TypeScript, `@twilio/flex-ui` 2.x, `@twilio/flex-plugin`, Jest (bundled with the Flex plugin scaffold), Twilio CLI (`twilio flex:plugins:*`).

## Global Constraints

- **Language:** TypeScript only (`.ts`/`.tsx`), never plain JS.
- **Tooling:** Twilio CLI (`twilio flex:plugins:create|start|build|deploy|release`), not `create-flex-plugin`.
- **Single bundle:** static top-of-file imports only; never dynamic `import()`.
- **Verify with BOTH** `npx tsc --noEmit` **and** `twilio flex:plugins:build` before considering any task done.
- **CIF facts (verified 2026, do not re-derive):**
  - Every CIF call must occur after the `CIFInitDone` event; API timeout is **100 seconds**.
  - `searchAndOpenRecords(entityLogicalName: string, queryParameters: string, searchOnly: boolean, correlationId?: string, searchType?: number): Promise<string>` — returns a JSON string; `searchOnly=true` returns results without opening. Query string starts with `?` and uses OData `$select`/`$filter`.
  - `createRecord(entityLogicalName: string, data: string): Promise<string>` — `data` is a **JSON-stringified** object; lookups via `"field@odata.bind": "/contacts(<guid>)"`; resolves to a JSON string containing the new record's `id`.
  - `openForm(...)` opens an entity/quick-create form.
  - `addHandler(eventName: string, handler: (eventData) => Promise<void>)` — `onclicktoact` payload shape: `{ value: string, name: string, format: string, entityLogicalName: string }`.
  - `setClickToAct` is **deprecated (2025-10-31)** — enable ClickToAct via admin settings, do NOT call it.
- **phonecall fields:** `subject` (required), `phonenumber`, `description`, `actualdurationminutes` (int), `directioncode` (0=incoming,1=outgoing), `statecode`=1 (Completed), `statuscode`=4 (Received/inbound) or 2 (Made/outbound), `new_disposition` (custom option-set — schema prereq), `"regardingobjectid_contact@odata.bind": "/contacts(<id>)"`.
- **Config, never hardcode:** search fields, disposition option-set name + value map, and task-attribute paths come from a config module reading plugin/env config.

---

## Prerequisites (manual, outside code — confirm before Task 6 integration)

1. D365: add `new_disposition` option-set field to `phonecall`; map option values to Flex disposition codes.
2. CIF 2.0: register channel with the Twilio-hosted Flex Channel URL; enable outbound (ClickToAct) via admin settings.
3. CIF panel iframe: microphone/speaker permission granted (WebRTC softphone).
4. Twilio CLI profile active (`twilio profiles:list` / `twilio profiles:use <name>`).
5. Studio Flow routes inbound to TaskRouter/Flex with caller E.164 on task attributes.

---

## File Structure

- `src/FlexDynamicsPlugin.tsx` — plugin class, `init()`, wires everything.
- `src/config/integrationConfig.ts` — typed config (search fields, disposition map, attribute paths).
- `src/cif/cifGlobal.ts` — typed accessor + presence check for `window.Microsoft.CIFramework`.
- `src/cif/CifClient.ts` — the adapter: `screenPop`, `quickCreateContact`, `logCall`, `onClickToDial`; owns init-gate + timeout.
- `src/mappers/contactSearch.ts` — pure: caller number → OData query string; parse search result → contact id(s).
- `src/mappers/phonecall.ts` — pure: call context → `phonecall` payload object.
- `src/listeners/screenPop.ts` — `afterAcceptTask` → CifClient.
- `src/listeners/logCall.ts` — `afterCompleteTask` → CifClient.
- `src/actions/clickToDial.ts` — CIF `onclicktoact` → `StartOutboundCall`.
- `src/state/callContext.ts` — per-task-SID store for resolved contact id.
- `test/**` — one test file per module above.

---

### Task 1: Scaffold the TypeScript Flex plugin

**Files:**
- Create: whole plugin scaffold under repo root (via CLI).

- [ ] **Step 1: Confirm an active Twilio CLI profile**

Run: `twilio profiles:list`
Expected: at least one profile marked active. If none, `twilio profiles:use <name>`.

- [ ] **Step 2: Scaffold the plugin (TypeScript)**

Run from repo root:
```bash
twilio flex:plugins:create plugin-dynamics-cif --install --typescript
```
Expected: creates a `plugin-dynamics-cif/` (or in-place) scaffold with `src/`, `package.json`, `jest` configured.

- [ ] **Step 3: Verify baseline typecheck and build**

Run: `npx tsc --noEmit` then `twilio flex:plugins:build`
Expected: both succeed with the untouched scaffold.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold TypeScript Flex plugin"
```

---

### Task 2: Integration config module

**Files:**
- Create: `src/config/integrationConfig.ts`
- Test: `test/config/integrationConfig.test.ts`

**Interfaces:**
- Produces: `interface IntegrationConfig { contactSearchFields: string[]; dispositionFieldName: string; dispositionMap: Record<string, number>; attr: { callerNumber: string; disposition: string; notes: string; direction: string; } }` and `getConfig(overrides?: Partial<IntegrationConfig>): IntegrationConfig`.

- [ ] **Step 1: Write the failing test**

```ts
import { getConfig } from '../../src/config/integrationConfig';

describe('getConfig', () => {
  it('returns sane defaults', () => {
    const c = getConfig();
    expect(c.contactSearchFields).toContain('telephone1');
    expect(c.dispositionFieldName).toBe('new_disposition');
    expect(c.attr.callerNumber).toBeTruthy();
  });
  it('applies overrides shallowly per key', () => {
    const c = getConfig({ contactSearchFields: ['mobilephone'] });
    expect(c.contactSearchFields).toEqual(['mobilephone']);
    expect(c.dispositionFieldName).toBe('new_disposition');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/config/integrationConfig.test.ts`
Expected: FAIL — cannot find module `integrationConfig`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface IntegrationConfig {
  contactSearchFields: string[];
  dispositionFieldName: string;
  dispositionMap: Record<string, number>;
  attr: { callerNumber: string; disposition: string; notes: string; direction: string };
}

const DEFAULTS: IntegrationConfig = {
  contactSearchFields: ['telephone1', 'mobilephone', 'telephone2'],
  dispositionFieldName: 'new_disposition',
  dispositionMap: {},
  attr: {
    callerNumber: 'caller',
    disposition: 'disposition',
    notes: 'wrapUpNotes',
    direction: 'direction',
  },
};

export function getConfig(overrides: Partial<IntegrationConfig> = {}): IntegrationConfig {
  return { ...DEFAULTS, ...overrides };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/config/integrationConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config test/config && git commit -m "feat: add integration config module"
```

---

### Task 3: Contact-search mapper (pure)

**Files:**
- Create: `src/mappers/contactSearch.ts`
- Test: `test/mappers/contactSearch.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `buildContactQuery(phone: string, fields: string[]): string` — returns an OData query string beginning with `?$select=...&$filter=...`.
  - `interface ContactMatch { id: string; fullname?: string }`
  - `parseContactResults(rawJson: string): ContactMatch[]` — parses the JSON string returned by `searchAndOpenRecords`, reading `contactid` as `id`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildContactQuery, parseContactResults } from '../../src/mappers/contactSearch';

describe('buildContactQuery', () => {
  it('selects contactid + fullname and ORs each field on the phone', () => {
    const q = buildContactQuery('+15551234567', ['telephone1', 'mobilephone']);
    expect(q.startsWith('?$select=')).toBe(true);
    expect(q).toContain('contactid');
    expect(q).toContain('fullname');
    expect(q).toContain("telephone1 eq '+15551234567'");
    expect(q).toContain(' or ');
    expect(q).toContain("mobilephone eq '+15551234567'");
  });
  it("escapes single quotes in the phone value", () => {
    const q = buildContactQuery("O'+1", ['telephone1']);
    expect(q).toContain("telephone1 eq 'O''+1'");
  });
});

describe('parseContactResults', () => {
  it('maps contactid to id', () => {
    const raw = JSON.stringify([{ contactid: 'abc', fullname: 'Jane' }]);
    expect(parseContactResults(raw)).toEqual([{ id: 'abc', fullname: 'Jane' }]);
  });
  it('returns [] for empty or non-array payloads', () => {
    expect(parseContactResults('[]')).toEqual([]);
    expect(parseContactResults('{}')).toEqual([]);
    expect(parseContactResults('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mappers/contactSearch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ContactMatch { id: string; fullname?: string }

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

export function buildContactQuery(phone: string, fields: string[]): string {
  const filter = fields.map((f) => `${f} eq '${esc(phone)}'`).join(' or ');
  return `?$select=contactid,fullname&$filter=${filter}`;
}

export function parseContactResults(rawJson: string): ContactMatch[] {
  if (!rawJson) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(rawJson); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((r: any) => ({ id: r.contactid, fullname: r.fullname }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/mappers/contactSearch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mappers/contactSearch.ts test/mappers/contactSearch.test.ts && git commit -m "feat: add contact-search mapper"
```

---

### Task 4: Phonecall payload mapper (pure)

**Files:**
- Create: `src/mappers/phonecall.ts`
- Test: `test/mappers/phonecall.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `interface CallContext { direction: 'inbound' | 'outbound'; phoneNumber?: string; durationMinutes?: number; notes?: string; dispositionCode?: string; contactId?: string; subject?: string; }`
  - `buildPhonecall(ctx: CallContext, cfg: { dispositionFieldName: string; dispositionMap: Record<string, number> }): Record<string, unknown>` — returns the object to be `JSON.stringify`'d for `createRecord`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildPhonecall } from '../../src/mappers/phonecall';

const cfg = { dispositionFieldName: 'new_disposition', dispositionMap: { resolved: 100000001 } };

describe('buildPhonecall', () => {
  it('sets inbound direction/status and completed state', () => {
    const p = buildPhonecall({ direction: 'inbound', phoneNumber: '+1555' }, cfg);
    expect(p.directioncode).toBe(0);
    expect(p.statecode).toBe(1);
    expect(p.statuscode).toBe(4);
    expect(p.phonenumber).toBe('+1555');
    expect(p.subject).toBeTruthy();
  });
  it('sets outbound direction/status', () => {
    const p = buildPhonecall({ direction: 'outbound' }, cfg);
    expect(p.directioncode).toBe(1);
    expect(p.statuscode).toBe(2);
  });
  it('binds regardingobjectid to the contact when contactId present', () => {
    const p = buildPhonecall({ direction: 'inbound', contactId: 'abc' }, cfg);
    expect(p['regardingobjectid_contact@odata.bind']).toBe('/contacts(abc)');
  });
  it('omits the regarding bind when no contactId', () => {
    const p = buildPhonecall({ direction: 'inbound' }, cfg);
    expect('regardingobjectid_contact@odata.bind' in p).toBe(false);
  });
  it('maps a known disposition code to its option-set value', () => {
    const p = buildPhonecall({ direction: 'inbound', dispositionCode: 'resolved' }, cfg);
    expect(p.new_disposition).toBe(100000001);
  });
  it('omits disposition field for an unknown code', () => {
    const p = buildPhonecall({ direction: 'inbound', dispositionCode: 'nope' }, cfg);
    expect('new_disposition' in p).toBe(false);
  });
  it('passes notes as description and rounds duration', () => {
    const p = buildPhonecall({ direction: 'inbound', notes: 'hi', durationMinutes: 3.7 }, cfg);
    expect(p.description).toBe('hi');
    expect(p.actualdurationminutes).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mappers/phonecall.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface CallContext {
  direction: 'inbound' | 'outbound';
  phoneNumber?: string;
  durationMinutes?: number;
  notes?: string;
  dispositionCode?: string;
  contactId?: string;
  subject?: string;
}

export function buildPhonecall(
  ctx: CallContext,
  cfg: { dispositionFieldName: string; dispositionMap: Record<string, number> },
): Record<string, unknown> {
  const inbound = ctx.direction === 'inbound';
  const p: Record<string, unknown> = {
    subject: ctx.subject ?? `${inbound ? 'Inbound' : 'Outbound'} call${ctx.phoneNumber ? ` — ${ctx.phoneNumber}` : ''}`,
    directioncode: inbound ? 0 : 1,
    statecode: 1,
    statuscode: inbound ? 4 : 2,
  };
  if (ctx.phoneNumber) p.phonenumber = ctx.phoneNumber;
  if (ctx.notes) p.description = ctx.notes;
  if (typeof ctx.durationMinutes === 'number') p.actualdurationminutes = Math.round(ctx.durationMinutes);
  if (ctx.contactId) p['regardingobjectid_contact@odata.bind'] = `/contacts(${ctx.contactId})`;
  if (ctx.dispositionCode && ctx.dispositionCode in cfg.dispositionMap) {
    p[cfg.dispositionFieldName] = cfg.dispositionMap[ctx.dispositionCode];
  }
  return p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/mappers/phonecall.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mappers/phonecall.ts test/mappers/phonecall.test.ts && git commit -m "feat: add phonecall payload mapper"
```

---

### Task 5: CIF global typing + per-task call-context store

**Files:**
- Create: `src/cif/cifGlobal.ts`, `src/state/callContext.ts`
- Test: `test/state/callContext.test.ts`

**Interfaces:**
- Produces (`cifGlobal.ts`):
  - `interface CifApi { searchAndOpenRecords(e: string, q: string, s: boolean, c?: string, t?: number): Promise<string>; createRecord(e: string, d: string): Promise<string>; addHandler(name: string, fn: (data: any) => Promise<void>): void; openForm(p: string, formParams?: string): Promise<string>; }`
  - `getCif(): CifApi | undefined` — returns `window.Microsoft?.CIFramework` typed, or `undefined`.
- Produces (`callContext.ts`):
  - `setContactForTask(taskSid: string, contactId: string): void`
  - `getContactForTask(taskSid: string): string | undefined`
  - `clearTask(taskSid: string): void`

- [ ] **Step 1: Write the failing test (callContext)**

```ts
import { setContactForTask, getContactForTask, clearTask } from '../../src/state/callContext';

describe('callContext', () => {
  it('stores and retrieves a contact id by task sid', () => {
    setContactForTask('WT1', 'c1');
    expect(getContactForTask('WT1')).toBe('c1');
  });
  it('returns undefined for unknown or cleared tasks', () => {
    setContactForTask('WT2', 'c2');
    clearTask('WT2');
    expect(getContactForTask('WT2')).toBeUndefined();
    expect(getContactForTask('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/state/callContext.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementations**

`src/cif/cifGlobal.ts`:
```ts
export interface CifApi {
  searchAndOpenRecords(entityLogicalName: string, queryParameters: string, searchOnly: boolean, correlationId?: string, searchType?: number): Promise<string>;
  createRecord(entityLogicalName: string, data: string): Promise<string>;
  addHandler(eventName: string, handler: (eventData: any) => Promise<void>): void;
  openForm(entityFormOptions: string, formParameters?: string): Promise<string>;
}

export function getCif(): CifApi | undefined {
  return (window as any)?.Microsoft?.CIFramework as CifApi | undefined;
}
```

`src/state/callContext.ts`:
```ts
const contactByTask = new Map<string, string>();

export function setContactForTask(taskSid: string, contactId: string): void {
  contactByTask.set(taskSid, contactId);
}
export function getContactForTask(taskSid: string): string | undefined {
  return contactByTask.get(taskSid);
}
export function clearTask(taskSid: string): void {
  contactByTask.delete(taskSid);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/state/callContext.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cif/cifGlobal.ts src/state/callContext.ts test/state/callContext.test.ts && git commit -m "feat: add CIF global typing and per-task call-context store"
```

---

### Task 6: CifClient adapter

**Files:**
- Create: `src/cif/CifClient.ts`
- Test: `test/cif/CifClient.test.ts`

**Interfaces:**
- Consumes: `getCif` / `CifApi` (Task 5), `buildContactQuery`/`parseContactResults`/`ContactMatch` (Task 3), `buildPhonecall`/`CallContext` (Task 4), `IntegrationConfig` (Task 2).
- Produces a class `CifClient` constructed as `new CifClient(cfg: IntegrationConfig, getCifFn?: () => CifApi | undefined)` (default `getCifFn = getCif`) with methods:
  - `isAvailable(): boolean` — true when the CIF global is present.
  - `screenPop(phone: string): Promise<{ action: 'opened' | 'list' | 'quickCreate' | 'skipped'; contactId?: string }>` — retrieves via `searchOnly=true`; on exactly 1 match calls `searchAndOpenRecords(...,false)` and returns `opened` + id; 0 → `quickCreateContact` + `quickCreate`; 2+ → opens list (`searchOnly=false`) + `list`; missing phone or no CIF → `skipped`.
  - `quickCreateContact(phone: string): Promise<void>` — `openForm` for a contact quick-create prefilled with the phone (uses first configured search field).
  - `logCall(ctx: CallContext): Promise<string | undefined>` — `createRecord('phonecall', JSON.stringify(buildPhonecall(ctx, cfg)))`; resolves to the new id (parsed from result), or `undefined` on failure (never throws).
  - `onClickToDial(handler: (phone: string) => void): void` — registers an `onclicktoact` handler that extracts `eventData.value` and calls `handler`.

- [ ] **Step 1: Write the failing test**

```ts
import { CifClient } from '../../src/cif/CifClient';
import { getConfig } from '../../src/config/integrationConfig';
import type { CifApi } from '../../src/cif/cifGlobal';

function fakeCif(overrides: Partial<CifApi> = {}): CifApi {
  return {
    searchAndOpenRecords: jest.fn().mockResolvedValue('[]'),
    createRecord: jest.fn().mockResolvedValue(JSON.stringify({ id: 'pc1' })),
    addHandler: jest.fn(),
    openForm: jest.fn().mockResolvedValue(''),
    ...overrides,
  };
}
const cfg = getConfig({ dispositionMap: { resolved: 100000001 } });

describe('CifClient.isAvailable', () => {
  it('is false when the CIF global is absent', () => {
    expect(new CifClient(cfg, () => undefined).isAvailable()).toBe(false);
  });
});

describe('CifClient.screenPop', () => {
  it('opens the single matching contact and returns its id', async () => {
    const cif = fakeCif({
      searchAndOpenRecords: jest.fn()
        .mockResolvedValueOnce(JSON.stringify([{ contactid: 'c1', fullname: 'Jane' }])) // searchOnly=true
        .mockResolvedValueOnce('[]'), // open
    });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res).toEqual({ action: 'opened', contactId: 'c1' });
    expect((cif.searchAndOpenRecords as jest.Mock).mock.calls[0][2]).toBe(true);
    expect((cif.searchAndOpenRecords as jest.Mock).mock.calls[1][2]).toBe(false);
  });
  it('quick-creates a contact on zero matches', async () => {
    const cif = fakeCif({ searchAndOpenRecords: jest.fn().mockResolvedValue('[]') });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res.action).toBe('quickCreate');
    expect(cif.openForm).toHaveBeenCalled();
  });
  it('opens a list on multiple matches', async () => {
    const cif = fakeCif({
      searchAndOpenRecords: jest.fn()
        .mockResolvedValueOnce(JSON.stringify([{ contactid: 'a' }, { contactid: 'b' }]))
        .mockResolvedValueOnce('[]'),
    });
    const res = await new CifClient(cfg, () => cif).screenPop('+1555');
    expect(res.action).toBe('list');
  });
  it('skips when phone is empty', async () => {
    const cif = fakeCif();
    const res = await new CifClient(cfg, () => cif).screenPop('');
    expect(res.action).toBe('skipped');
    expect(cif.searchAndOpenRecords).not.toHaveBeenCalled();
  });
  it('skips when CIF is unavailable', async () => {
    const res = await new CifClient(cfg, () => undefined).screenPop('+1555');
    expect(res.action).toBe('skipped');
  });
});

describe('CifClient.logCall', () => {
  it('creates a phonecall and returns the new id', async () => {
    const cif = fakeCif();
    const id = await new CifClient(cfg, () => cif).logCall({ direction: 'inbound', contactId: 'c1' });
    expect(id).toBe('pc1');
    const [entity, data] = (cif.createRecord as jest.Mock).mock.calls[0];
    expect(entity).toBe('phonecall');
    expect(JSON.parse(data)['regardingobjectid_contact@odata.bind']).toBe('/contacts(c1)');
  });
  it('returns undefined and does not throw on createRecord failure', async () => {
    const cif = fakeCif({ createRecord: jest.fn().mockRejectedValue(new Error('boom')) });
    const id = await new CifClient(cfg, () => cif).logCall({ direction: 'inbound' });
    expect(id).toBeUndefined();
  });
});

describe('CifClient.onClickToDial', () => {
  it('registers an onclicktoact handler that forwards the value', async () => {
    const cif = fakeCif();
    const client = new CifClient(cfg, () => cif);
    const spy = jest.fn();
    client.onClickToDial(spy);
    expect((cif.addHandler as jest.Mock).mock.calls[0][0]).toBe('onclicktoact');
    const handler = (cif.addHandler as jest.Mock).mock.calls[0][1];
    await handler({ value: '+1999', name: 'telephone1', format: 'phone', entityLogicalName: 'contact' });
    expect(spy).toHaveBeenCalledWith('+1999');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/cif/CifClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { CifApi, getCif } from './cifGlobal';
import { IntegrationConfig } from '../config/integrationConfig';
import { buildContactQuery, parseContactResults } from '../mappers/contactSearch';
import { buildPhonecall, CallContext } from '../mappers/phonecall';

export type ScreenPopAction = 'opened' | 'list' | 'quickCreate' | 'skipped';

export class CifClient {
  constructor(
    private readonly cfg: IntegrationConfig,
    private readonly getCifFn: () => CifApi | undefined = getCif,
  ) {}

  isAvailable(): boolean {
    return !!this.getCifFn();
  }

  async screenPop(phone: string): Promise<{ action: ScreenPopAction; contactId?: string }> {
    const cif = this.getCifFn();
    if (!cif || !phone) return { action: 'skipped' };
    const query = buildContactQuery(phone, this.cfg.contactSearchFields);
    let matches;
    try {
      matches = parseContactResults(await cif.searchAndOpenRecords('contact', query, true));
    } catch {
      return { action: 'skipped' };
    }
    if (matches.length === 1) {
      await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
      return { action: 'opened', contactId: matches[0].id };
    }
    if (matches.length === 0) {
      await this.quickCreateContact(phone);
      return { action: 'quickCreate' };
    }
    await cif.searchAndOpenRecords('contact', query, false).catch(() => undefined);
    return { action: 'list' };
  }

  async quickCreateContact(phone: string): Promise<void> {
    const cif = this.getCifFn();
    if (!cif) return;
    const field = this.cfg.contactSearchFields[0] ?? 'telephone1';
    const entityFormOptions = JSON.stringify({ entityName: 'contact', useQuickCreateForm: true });
    const formParameters = JSON.stringify({ [field]: phone });
    await cif.openForm(entityFormOptions, formParameters).catch(() => undefined);
  }

  async logCall(ctx: CallContext): Promise<string | undefined> {
    const cif = this.getCifFn();
    if (!cif) return undefined;
    const payload = buildPhonecall(ctx, {
      dispositionFieldName: this.cfg.dispositionFieldName,
      dispositionMap: this.cfg.dispositionMap,
    });
    try {
      const raw = await cif.createRecord('phonecall', JSON.stringify(payload));
      return JSON.parse(raw)?.id;
    } catch {
      return undefined;
    }
  }

  onClickToDial(handler: (phone: string) => void): void {
    const cif = this.getCifFn();
    if (!cif) return;
    cif.addHandler('onclicktoact', async (eventData: { value?: string }) => {
      if (eventData?.value) handler(eventData.value);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/cif/CifClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cif/CifClient.ts test/cif/CifClient.test.ts && git commit -m "feat: add CifClient adapter"
```

---

### Task 7: Screen-pop listener

**Files:**
- Create: `src/listeners/screenPop.ts`
- Test: `test/listeners/screenPop.test.ts`

**Interfaces:**
- Consumes: `CifClient` (Task 6), `IntegrationConfig` (Task 2), `setContactForTask` (Task 5).
- Produces: `handleAcceptTask(payload: { task: { sid: string; attributes: Record<string, any> } }, deps: { client: Pick<CifClient,'screenPop'>; cfg: IntegrationConfig; store: (sid: string, id: string) => void }): Promise<void>` — reads the caller number from `task.attributes[cfg.attr.callerNumber]`, calls `client.screenPop`, and on `opened` stores the contact id via `store`.

- [ ] **Step 1: Write the failing test**

```ts
import { handleAcceptTask } from '../../src/listeners/screenPop';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig();

describe('handleAcceptTask', () => {
  it('pops using the caller attribute and stores the resolved contact id', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'opened', contactId: 'c1' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT1', attributes: { [cfg.attr.callerNumber]: '+1555' } } }, { client, cfg, store });
    expect(client.screenPop).toHaveBeenCalledWith('+1555');
    expect(store).toHaveBeenCalledWith('WT1', 'c1');
  });
  it('does not store when no contact was opened', async () => {
    const client = { screenPop: jest.fn().mockResolvedValue({ action: 'quickCreate' }) };
    const store = jest.fn();
    await handleAcceptTask({ task: { sid: 'WT2', attributes: { [cfg.attr.callerNumber]: '+1555' } } }, { client, cfg, store });
    expect(store).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/listeners/screenPop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';

export async function handleAcceptTask(
  payload: { task: { sid: string; attributes: Record<string, any> } },
  deps: { client: Pick<CifClient, 'screenPop'>; cfg: IntegrationConfig; store: (sid: string, id: string) => void },
): Promise<void> {
  const phone = payload.task.attributes?.[deps.cfg.attr.callerNumber];
  if (!phone) return;
  const res = await deps.client.screenPop(String(phone));
  if (res.action === 'opened' && res.contactId) deps.store(payload.task.sid, res.contactId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/listeners/screenPop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/listeners/screenPop.ts test/listeners/screenPop.test.ts && git commit -m "feat: add screen-pop listener"
```

---

### Task 8: Log-call listener

**Files:**
- Create: `src/listeners/logCall.ts`
- Test: `test/listeners/logCall.test.ts`

**Interfaces:**
- Consumes: `CifClient` (Task 6), `IntegrationConfig` (Task 2), `getContactForTask`/`clearTask` (Task 5), `CallContext` (Task 4).
- Produces: `handleCompleteTask(payload: { task: { sid: string; attributes: Record<string, any> } }, deps: { client: Pick<CifClient,'logCall'>; cfg: IntegrationConfig; getContact: (sid: string) => string | undefined; clear: (sid: string) => void }): Promise<void>` — builds a `CallContext` from task attributes + stored contact id, calls `client.logCall`, then `clear`s the task from the store.

- [ ] **Step 1: Write the failing test**

```ts
import { handleCompleteTask } from '../../src/listeners/logCall';
import { getConfig } from '../../src/config/integrationConfig';

const cfg = getConfig();

describe('handleCompleteTask', () => {
  it('logs a call with attributes + stored contact, then clears the task', async () => {
    const client = { logCall: jest.fn().mockResolvedValue('pc1') };
    const clear = jest.fn();
    const attributes = {
      [cfg.attr.callerNumber]: '+1555',
      [cfg.attr.direction]: 'inbound',
      [cfg.attr.disposition]: 'resolved',
      [cfg.attr.notes]: 'all good',
    };
    await handleCompleteTask({ task: { sid: 'WT1', attributes } }, { client, cfg, getContact: () => 'c1', clear });
    const ctx = (client.logCall as jest.Mock).mock.calls[0][0];
    expect(ctx).toMatchObject({ direction: 'inbound', phoneNumber: '+1555', dispositionCode: 'resolved', notes: 'all good', contactId: 'c1' });
    expect(clear).toHaveBeenCalledWith('WT1');
  });
  it('defaults direction to inbound when attribute missing', async () => {
    const client = { logCall: jest.fn().mockResolvedValue(undefined) };
    await handleCompleteTask({ task: { sid: 'WT2', attributes: {} } }, { client, cfg, getContact: () => undefined, clear: jest.fn() });
    expect((client.logCall as jest.Mock).mock.calls[0][0].direction).toBe('inbound');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/listeners/logCall.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { CifClient } from '../cif/CifClient';
import { IntegrationConfig } from '../config/integrationConfig';
import { CallContext } from '../mappers/phonecall';

export async function handleCompleteTask(
  payload: { task: { sid: string; attributes: Record<string, any> } },
  deps: {
    client: Pick<CifClient, 'logCall'>;
    cfg: IntegrationConfig;
    getContact: (sid: string) => string | undefined;
    clear: (sid: string) => void;
  },
): Promise<void> {
  const a = payload.task.attributes ?? {};
  const direction = a[deps.cfg.attr.direction] === 'outbound' ? 'outbound' : 'inbound';
  const ctx: CallContext = {
    direction,
    phoneNumber: a[deps.cfg.attr.callerNumber],
    dispositionCode: a[deps.cfg.attr.disposition],
    notes: a[deps.cfg.attr.notes],
    contactId: deps.getContact(payload.task.sid),
  };
  await deps.client.logCall(ctx);
  deps.clear(payload.task.sid);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/listeners/logCall.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/listeners/logCall.ts test/listeners/logCall.test.ts && git commit -m "feat: add log-call listener"
```

---

### Task 9: Click-to-dial action wiring

**Files:**
- Create: `src/actions/clickToDial.ts`
- Test: `test/actions/clickToDial.test.ts`

**Interfaces:**
- Consumes: `CifClient` (Task 6).
- Produces: `wireClickToDial(deps: { client: Pick<CifClient,'onClickToDial'>; invokeAction: (name: string, payload: Record<string, unknown>) => void }): void` — registers a CIF click-to-dial handler that invokes `StartOutboundCall` with `{ destination: <phone> }`.

- [ ] **Step 1: Write the failing test**

```ts
import { wireClickToDial } from '../../src/actions/clickToDial';

describe('wireClickToDial', () => {
  it('invokes StartOutboundCall with the clicked number', () => {
    let captured: (phone: string) => void = () => {};
    const client = { onClickToDial: (h: (p: string) => void) => { captured = h; } };
    const invokeAction = jest.fn();
    wireClickToDial({ client, invokeAction });
    captured('+1999');
    expect(invokeAction).toHaveBeenCalledWith('StartOutboundCall', { destination: '+1999' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/actions/clickToDial.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { CifClient } from '../cif/CifClient';

export function wireClickToDial(deps: {
  client: Pick<CifClient, 'onClickToDial'>;
  invokeAction: (name: string, payload: Record<string, unknown>) => void;
}): void {
  deps.client.onClickToDial((phone) => {
    deps.invokeAction('StartOutboundCall', { destination: phone });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/actions/clickToDial.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/clickToDial.ts test/actions/clickToDial.test.ts && git commit -m "feat: add click-to-dial action wiring"
```

---

### Task 10: CIF library loader (waits for CIFInitDone)

**Files:**
- Create: `src/cif/loadCifLibrary.ts`
- Test: `test/cif/loadCifLibrary.test.ts`

**Interfaces:**
- Produces: `loadCifLibrary(deps?: { getCrmUrl?: () => string | undefined; injectScript?: (src: string) => Promise<void>; isReady?: () => boolean; timeoutMs?: number }): Promise<boolean>` — resolves `true` once `window.Microsoft.CIFramework` is present (already-present short-circuits), else injects `<crmUrl>/webresources/Widget/msdyn_ciLibrary.js` and polls `isReady` until `timeoutMs`; resolves `false` if the CRM URL can't be derived or it times out. Default `getCrmUrl` reads `document.referrer` / `window.location.ancestorOrigins?.[0]`.

- [ ] **Step 1: Write the failing test**

```ts
import { loadCifLibrary } from '../../src/cif/loadCifLibrary';

describe('loadCifLibrary', () => {
  it('short-circuits true when CIF is already present', async () => {
    const inject = jest.fn();
    const ok = await loadCifLibrary({ isReady: () => true, injectScript: inject, getCrmUrl: () => 'https://x' });
    expect(ok).toBe(true);
    expect(inject).not.toHaveBeenCalled();
  });
  it('injects the library from the CRM origin and resolves true when it becomes ready', async () => {
    let ready = false;
    const inject = jest.fn().mockImplementation(async () => { ready = true; });
    const ok = await loadCifLibrary({
      isReady: () => ready,
      injectScript: inject,
      getCrmUrl: () => 'https://org.crm.dynamics.com',
      timeoutMs: 1000,
    });
    expect(ok).toBe(true);
    expect(inject).toHaveBeenCalledWith('https://org.crm.dynamics.com/webresources/Widget/msdyn_ciLibrary.js');
  });
  it('resolves false when the CRM url cannot be derived', async () => {
    const ok = await loadCifLibrary({ isReady: () => false, injectScript: jest.fn(), getCrmUrl: () => undefined });
    expect(ok).toBe(false);
  });
  it('resolves false on timeout', async () => {
    const ok = await loadCifLibrary({
      isReady: () => false,
      injectScript: jest.fn().mockResolvedValue(undefined),
      getCrmUrl: () => 'https://org.crm.dynamics.com',
      timeoutMs: 50,
    });
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/cif/loadCifLibrary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
function defaultGetCrmUrl(): string | undefined {
  const anc = (window as any)?.location?.ancestorOrigins?.[0];
  if (anc) return anc;
  if (document.referrer) return new URL(document.referrer).origin;
  return undefined;
}

function defaultInject(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function loadCifLibrary(deps: {
  getCrmUrl?: () => string | undefined;
  injectScript?: (src: string) => Promise<void>;
  isReady?: () => boolean;
  timeoutMs?: number;
} = {}): Promise<boolean> {
  const getCrmUrl = deps.getCrmUrl ?? defaultGetCrmUrl;
  const injectScript = deps.injectScript ?? defaultInject;
  const isReady = deps.isReady ?? (() => !!(window as any)?.Microsoft?.CIFramework);
  const timeoutMs = deps.timeoutMs ?? 15000;

  if (isReady()) return true;
  const crmUrl = getCrmUrl();
  if (!crmUrl) return false;

  try {
    await injectScript(`${crmUrl}/webresources/Widget/msdyn_ciLibrary.js`);
  } catch {
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isReady()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
```

> **Note for implementer:** the scaffold's Jest may need fake timers or a low `timeoutMs` (tests already pass `timeoutMs: 50`). `Date.now()`/`setTimeout` are fine in Jest. If `document.referrer` is empty in jsdom, the injected-path test still passes because it supplies `getCrmUrl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/cif/loadCifLibrary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cif/loadCifLibrary.ts test/cif/loadCifLibrary.test.ts && git commit -m "feat: add CIF library loader"
```

---

### Task 11: Plugin class — wire everything in init()

**Files:**
- Modify: `src/FlexDynamicsPlugin.tsx` (rename/replace the scaffold's plugin class file; keep `src/index.ts` loader pointing at it).

**Interfaces:**
- Consumes: `loadCifLibrary` (Task 10), `getConfig` (Task 2), `CifClient` (Task 6), `handleAcceptTask` (Task 7), `handleCompleteTask` (Task 8), `wireClickToDial` (Task 9), `setContactForTask`/`getContactForTask`/`clearTask` (Task 5).

- [ ] **Step 1: Replace the plugin class**

```tsx
import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';

import { getConfig } from './config/integrationConfig';
import { CifClient } from './cif/CifClient';
import { loadCifLibrary } from './cif/loadCifLibrary';
import { handleAcceptTask } from './listeners/screenPop';
import { handleCompleteTask } from './listeners/logCall';
import { wireClickToDial } from './actions/clickToDial';
import { setContactForTask, getContactForTask, clearTask } from './state/callContext';

const PLUGIN_NAME = 'DynamicsCifPlugin';

export default class DynamicsCifPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  async init(flex: typeof Flex, _manager: Flex.Manager): Promise<void> {
    const cfg = getConfig();
    const ready = await loadCifLibrary();
    const client = new CifClient(cfg);

    if (!ready || !client.isAvailable()) {
      // Not running inside a CIF host (e.g. standalone Flex) — degrade gracefully.
      // eslint-disable-next-line no-console
      console.warn(`${PLUGIN_NAME}: CIF not available; screen pop / call logging disabled.`);
      return;
    }

    flex.Actions.addListener('afterAcceptTask', (payload) =>
      handleAcceptTask(payload as any, { client, cfg, store: setContactForTask }),
    );

    flex.Actions.addListener('afterCompleteTask', (payload) =>
      handleCompleteTask(payload as any, { client, cfg, getContact: getContactForTask, clear: clearTask }),
    );

    wireClickToDial({
      client,
      invokeAction: (name, p) => { void flex.Actions.invokeAction(name, p as any); },
    });
  }
}
```

- [ ] **Step 2: Point `src/index.ts` at the class**

Ensure `src/index.ts` reads (adjust filename if the scaffold used a different one):
```ts
import { FlexPlugin } from '@twilio/flex-plugin';
import DynamicsCifPlugin from './FlexDynamicsPlugin';

FlexPlugin.loadPlugin(DynamicsCifPlugin);
```
Delete the scaffold's original demo plugin file if it differs.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all tests from Tasks 2–10 PASS.

- [ ] **Step 5: Build the bundle**

Run: `twilio flex:plugins:build`
Expected: success; a single `<name>.js` bundle emitted, no numbered chunks.

- [ ] **Step 6: Commit**

```bash
git add src/FlexDynamicsPlugin.tsx src/index.ts && git commit -m "feat: wire Dynamics CIF plugin init()"
```

---

### Task 12: Manual end-to-end verification (real org)

**Prereqs:** all items in the "Prerequisites" section above are complete.

- [ ] **Step 1: Deploy and release**

```bash
twilio flex:plugins:deploy --changelog "Dynamics CIF integration v1"
twilio flex:plugins:release --plugin plugin-dynamics-cif@<version> --name "Dynamics CIF" --description "Flex↔D365 CIF 2.0"
```

- [ ] **Step 2: Verify in the CIF panel**

In Dynamics 365 Customer Service, open the app with the Flex CIF channel. Confirm the Flex panel loads and the softphone registers (mic permission granted).

- [ ] **Step 3: Inbound screen pop**

Place a test inbound call from a number that matches exactly one contact → accept in Flex → confirm the contact record opens. Repeat from an unknown number → confirm a pre-filled quick-create contact form opens.

- [ ] **Step 4: Call logging**

Complete the call with a disposition + notes → confirm a `phonecall` activity is created on the contact with `directioncode=0`, `statuscode=4`, `description`=notes, and `new_disposition` set.

- [ ] **Step 5: Click-to-dial**

Click a phone number field in Dynamics → confirm Flex places the outbound call; complete it → confirm a `phonecall` activity with `directioncode=1`, `statuscode=2`.

- [ ] **Step 6: Record findings**

Note any attribute-path or option-set-value mismatches and reconcile `integrationConfig.ts` accordingly; commit any config corrections.

---

## Self-Review

**Spec coverage:**
- Embed via CIF 2.0 + Twilio-hosted Flex → Tasks 1, 10, 11. ✅
- Inbound screen pop (single/zero/multi, quick-create on no match) → Tasks 3, 6, 7. ✅
- Log phonecall activity linked to contact → Tasks 4, 6, 8. ✅
- Click-to-dial from D365 → Tasks 6, 9. ✅
- Disposition → custom field + notes → description → Tasks 2, 4, 8. ✅
- No hardcoded config → Task 2. ✅
- Error handling / graceful degradation (no CIF host, logCall failure never blocks completion) → Tasks 6, 11. ✅
- Contact-id hand-off across accept→complete → Task 5 store, used in 7 & 8. ✅
- CIFInitDone gate + 100s timeout awareness → Task 10 loader; adapter tolerant of failures. ✅
- Testing strategy (pure mappers, mocked CIF, mocked client) → Tasks 3–9. ✅

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `CifClient` method names (`screenPop`, `quickCreateContact`, `logCall`, `onClickToDial`) match usage in Tasks 7–9 and 11; `CallContext`/`ContactMatch`/`IntegrationConfig` shapes are consistent across producers/consumers; `getConfig`, `setContactForTask`/`getContactForTask`/`clearTask` signatures match call sites.

