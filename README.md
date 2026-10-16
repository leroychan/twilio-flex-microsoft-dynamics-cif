# Twilio Flex × Dynamics 365 (CIF 2.0)

A Twilio Flex UI 2.x plugin that runs Flex inside **Dynamics 365 Copilot Service workspace**
as a Channel Integration Framework (CIF) 2.0 channel provider.

- **Screen pop** — on accept, searches Contacts by the caller's number and opens the match.
- **Interaction Note** — on wrap-up, writes a Note to the contact's timeline with call/
  conversation SID, metadata, disposition, wrap-up notes and the full transcript
  (voice: RTT Sync list `rtt-<call_sid>`; WhatsApp: conversation history).
- **Create Case** — a task-header button that opens a pre-filled, unsaved Case form.
- **Click-to-dial** — clicking a phone number in Dynamics starts an outbound call in Flex.

Handles the **voice** and **WhatsApp** channels. All Dataverse access goes through the CIF
API as the signed-in agent; the plugin never calls the Dataverse Web API directly.

## No `.env` or Microsoft credentials

The plugin reads no environment variables and holds no keys. The Dynamics org URL is
detected at runtime from the hosting frame, and every CIF call runs under the agent's
Dynamics session and security role. Optional tuning comes from Flex configuration (see
[Configuration](#configuration)).

For local `npm start` only, copy `public/appConfig.example.js` to `public/appConfig.js`.

## Prerequisites

- Node.js and npm
- [Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart) with the Flex plugin:

  ```bash
  brew tap twilio/brew && brew install twilio
  twilio plugins:install @twilio-labs/plugin-flex
  twilio profiles:list          # confirm the right account is active
  ```

## Build, test, deploy

```bash
npm install
npx tsc --noEmit                # type-check
npx jest                        # tests (don't use `flex-plugin test`, it's broken here)
twilio flex:plugins:build       # must produce a single bundle in build/

twilio flex:plugins:deploy --patch --changelog "<what changed>"
twilio flex:plugins:release --plugin plugin-dynamics-cif@<version> \
  --name "<release name>" --description "<description>"
```

- Use static imports only — dynamic `import()` breaks the single-bundle requirement.
- `deploy` may report validator warnings about `channelType`. They refer to the task
  attribute the plugin reads to detect WhatsApp, not the deprecated Flex API; pass
  `--bypass-validation` to continue non-interactively.
- `release` without `--new` copies the active configuration and swaps only this plugin's
  version, so other active plugins are kept. Check with `twilio flex:plugins:list:plugins`.

## Dynamics 365 setup

Copilot Service workspace is multisession, so it only supports **CIF 2.0** (CIF 1.0 is
for single-session apps such as Customer Service Hub). That's why API Version is locked
to 2 when you create the provider from the admin center.

1. **Channel provider** — Copilot Service admin center → Support experience → Workspaces →
   Third party voice channel provider → Manage → New:
   - **Unique Name:** `<prefix>_<name>`, prefix of 3–8 alphanumerics, e.g. `twlo_flex`
   - **Channel URL:** your Flex URL, e.g. `https://flex.twilio.com/agent-desktop/`
   - **Enable Outbound Communication:** Yes (click-to-dial)
   - **API Version:** 2 (locked)
   - **Trusted Domain:** `https://flex.twilio.com`
2. **Experience profile** — add the provider to the profile your agents use and add the
   agents to the profile. Sign out and back in after changes.
3. **Click-to-dial** — add the Channel Communication Control to the phone fields on the
   Contact main form and publish.
4. **Security role** for agents:

   | Table | Privileges | Scope |
   |---|---|---|
   | Contact | Read, Append To | Organization (or Business Unit) — User scope only finds the agent's own contacts |
   | Note | Create, Read, Append | User or higher |
   | Case | Create, Read, Append | User or higher |

5. **Microphone** — allow it for the Dynamics site (WebRTC softphone).

## Flex / Twilio setup

- **Studio flow** — the Send to Flex widget must put the caller's E.164 number on the task,
  e.g. `{"caller": "{{trigger.call.From}}"}`.
- **Voice transcripts** — come from the real-time transcription plugin (`rtt-<call_sid>`
  Sync list). Without it the Note is written without a transcript.

## Contact matching

The screen pop searches **Contact** with exact equality on:

| Logical name | Form label |
|---|---|
| `telephone1` | Business Phone |
| `mobilephone` | Mobile Phone |
| `telephone2` | Home Phone |

The number must match character-for-character (e.g. `+14242316524`; spaces, dashes or a
missing country code won't match). One match opens the record and enables Create Case;
zero or several matches open the search results and leave Create Case disabled.

## Configuration

Override defaults without a rebuild via Flex configuration at
`ui_attributes.dynamicsCif`:

```json
{ "ui_attributes": { "dynamicsCif": {
  "contactSearchFields": ["mobilephone", "telephone1"],
  "dispositionMap": { "resolved": "Resolved" },
  "attr": { "disposition": "disposition", "notes": "wrapUpNotes", "direction": "direction" },
  "channels": {
    "voice":    { "identifierAttr": "caller",          "transcriptSource": "sync-rtt" },
    "whatsapp": { "identifierAttr": "customerAddress", "transcriptSource": "conversation" }
  }
} } }
```

`channels` replaces the whole map, so list every channel you want handled.
`identifierAttr` is the task attribute holding the customer's number.

## Troubleshooting

Filter the Flex frame's console on `[DynamicsCif]`. To target the Flex frame in DevTools,
right-click inside the Flex panel → Inspect.

| Symptom | Likely cause |
|---|---|
| No side panel | Provider not in the agent's experience profile, or wrong app (must be Copilot Service workspace itself) |
| `screen-pop for: …` but no `search query:` line; calls end in `#<Map>` after ~100 s | CIF host isn't answering the Flex frame. Fixed in 0.0.11 by loading `msdyn_ciLibrary.js` with `data-crmurl` / `data-cifid` |
| `skip: no identifier on attribute "caller"` | Studio isn't setting `caller` on the task |
| `parsed matches: 0` | Number format on the contact differs, or Contact Read scope is too narrow |
| Create Case greyed out | No single contact matched (see above) |

`tools/cif-test-widget/` is a standalone CIF test page (`npm start`, port 3000) for
checking whether the CIF host answers a widget at all, independent of Flex.
