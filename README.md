# TransportIt browser relay

A host-neutral Node.js relay for the free OneMoreRoute / TransportIt browser game on the developer's official site, https://transportit.fabianbuilds.com/.

The game and its assets belong to FabianXR Builds. This package contains only relay code, tests and deployment configuration, not a copy of the game. It fixes the upstream to the developer's public game site; it is not an open web proxy.

## Status

Deployed at https://transportit-browser-relay.onrender.com/. The developer-host relay is being tested, and it has not been tested through the user's Lightspeed installation. No claim is made that it bypasses filtering, avoids categorization or remains accessible. A normal-looking homepage does not establish any of those properties.

## Deploy on Render

1. Connect a Render account and an appropriate source repository.
2. Put the files in the root of a repository you control.
3. Create a Blueprint from `render.yaml`, or a Node web service with build command `npm ci && npm run build && npm test`, start command `npm start`, and health check `/healthz`.
4. Keep the Free instance type selected. This package does not request paid resources or contain billing credentials.
5. Once the service is live, open its supplied URL, create a map and verify gameplay. Test the same URL separately on the target Chromebook. Deployment success alone is not a filter-access test.

Render reference: https://render.com/docs/blueprint-spec

## Local use

Requires Node.js 22 or newer. There are no third-party dependencies.

    npm ci
    npm test
    npm start

The local server uses port 10000 unless PORT is set. `/` opens the game, `/_gateway` shows information and `/_gateway/status` checks upstream availability. The last endpoint does not prove full gameplay works.

## Boundaries and limitations

- Only GET and HEAD are supported. No user cookies, authorization headers or request bodies are sent to the game host.
- Redirects are restricted to the developer's game site. Verification and access denials are reported rather than bypassed.
- Browser saves are tied to the new origin. Use the game's save-file export for a backup.
- External feedback, wiki or other services can still contact their own domains and may be unavailable.
- The developer can change the game site's asset paths or access rules. Those changes might require maintenance.
- Local tests use simulated upstream responses. Live server egress, game loading and device filtering need post-deployment verification.
