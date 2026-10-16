# CIF test widget

A minimal channel-provider page for checking whether the Dynamics CIF host answers API
calls, with Flex and the plugin out of the picture.

## Run

```bash
cd tools/cif-test-widget
npm install
npm start          # http://localhost:3000
```

## Use in Dynamics

1. Create a second channel provider (Copilot Service admin center → Workspaces →
   Third party voice channel provider → New):
   - Channel URL: `http://localhost:3000`
   - Trusted Domain: `http://localhost:3000`
2. Add it to the same experience profile, sign out and back in.
3. In its panel: the library auto-loads. Click **getEnvironment()**, then the search.

The log shows the frame's origin/ancestors, whether `CIFInitDone` fires, any
`postMessage` traffic from the host, and how long each call takes. CIF's `Map`
rejections are unpacked. By default the library loads without `data-crmurl` /
`data-cifid`, the same way the plugin does; tick "add data-crmurl / data-cifid" to add them.

If Dynamics won't frame `http://localhost`, expose it over HTTPS (e.g.
`ngrok http 3000`) and use that URL as the Channel URL and Trusted Domain.
