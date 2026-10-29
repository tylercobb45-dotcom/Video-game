// Fixed public browser game on the developer's own site.
// Never forwards user credentials or accepts arbitrary upstream hosts.
export const UPSTREAM = new URL('https://transportit.fabianbuilds.com/');
export function upstreamURL(path, search) {
    const url = new URL(UPSTREAM);
    url.pathname = path === '/' ? UPSTREAM.pathname : UPSTREAM.pathname + path.replace(/^\/+/, '');
    url.search = search;
    return url;
}
export function rewritePublicURLs(text) {
    return text.replaceAll(UPSTREAM.href, '/').replaceAll(UPSTREAM.href.replace('https:', ''), '/').replaceAll(UPSTREAM.href.replaceAll('/', '\\/'), '\\/');
}
function screen(title, message, status = 200) {
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TransportIt Gateway</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#102521;color:#eef5df;font:17px/1.6 system-ui,sans-serif;padding:28px}main{max-width:640px}small{color:#b6d87b;text-transform:uppercase;letter-spacing:.14em}h1{font-size:clamp(32px,7vw,52px);line-height:1.1;margin:20px 0}p{color:#c2d2c8}nav{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0}a{color:#d0eaa9}nav a{padding:12px 20px;border:1px solid #54715a;border-radius:10px;text-decoration:none}nav a:first-child{background:#c2df86;color:#15291f;font-weight:700}footer{font-size:13px;border-top:1px solid #385047;padding-top:20px;color:#a6b9ad}</style><main><small>TransportIt browser relay · Experimental</small><h1>${title}</h1><p>${message}</p><nav><a href="/">Launch game</a><a href="/_gateway/status" target="_blank">Check connection</a><a href="https://fabianxr.itch.io/transportit" target="_blank" rel="noopener noreferrer">Creator's page ↗</a></nav><footer>Game by FabianXR Builds. This independent gateway relays the free browser version. It does not handle itch.io accounts, paid downloads, or verification checks. Device restrictions and network filters may still prevent access.</footer></main></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
export async function relay(request) {
    const local = new URL(request.url);
    if (local.pathname === '/_gateway')
        return screen('One more route.', 'Open the free browser game through a game-specific relay. No installation or Chromebook developer mode is needed. Saves belong to this site’s browser storage; use the game’s save-file download to keep a backup.');
    if (!['GET', 'HEAD'].includes(request.method))
        return new Response('Only public game downloads are supported.', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const isStatus = local.pathname === '/_gateway/status';
    let target = upstreamURL(isStatus ? '/' : local.pathname, isStatus ? '' : local.search);
    try {
        let response;
        for (let attempt = 0; attempt < 4; attempt++) {
            const headers = new Headers();
            headers.set('accept', request.headers.get('accept') || '*/*');
            if (request.headers.has('range'))
                headers.set('range', request.headers.get('range'));
            response = await fetch(target, { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(18000) });
            if (![301, 302, 303, 307, 308].includes(response.status))
                break;
            const location = response.headers.get('location');
            if (!location)
                break;
            const next = new URL(location, target);
            if (next.origin !== UPSTREAM.origin || !next.pathname.startsWith(UPSTREAM.pathname))
                return screen('The source moved.', 'The game redirected outside the developer’s game site. Open the creator’s page for the current version.', 502);
            target = next;
        }
        if (!response || [301, 302, 303, 307, 308].includes(response.status))
            throw new Error('No completed upstream response');
        if (isStatus) {
            const type = response.headers.get('content-type') || '';
            const body = await response.text();
            const reachable = response.ok && type.includes('text/html') && /create map|map seed|OneMoreRoute|TransportIt/i.test(body) && !/cf-chl-|Just a moment\.\.\./i.test(body);
            return Response.json({ reachable, upstreamStatus: response.status, message: reachable ? 'The public game page is reachable. Gameplay and your Chromebook network still need a browser test.' : 'The public game page was unavailable or returned an unexpected response.' }, { status: reachable ? 200 : 502, headers: { 'cache-control': 'no-store' } });
        }
        if ([401, 403, 429].includes(response.status))
            return screen('The source declined the request.', 'The game host requires access or verification, or has rate-limited this relay. No access or verification checks were bypassed. Try the creator’s page.', 502);
        const headers = new Headers();
        for (const key of ['content-type', 'content-range', 'accept-ranges', 'last-modified']) {
            const value = response.headers.get(key);
            if (value)
                headers.set(key, value);
        }
        headers.set('cache-control', 'private, max-age=300');
        headers.set('x-content-type-options', 'nosniff');
        const type = headers.get('content-type') || '';
        if (request.method === 'HEAD' || [204, 304].includes(response.status))
            return new Response(null, { status: response.status, headers });
        if (/text\/html|javascript|text\/css|application\/json|image\/svg\+xml/i.test(type) && response.status !== 206) {
            const text = await response.text();
            if (/text\/html/i.test(type) && /cf-chl-|<title>Just a moment/i.test(text))
                return screen('Verification is required.', 'The upstream host returned a verification page. This relay does not bypass it.', 502);
            if (/text\/html/i.test(type))
                headers.set('cache-control', 'no-store');
            return new Response(rewritePublicURLs(text), { status: response.status, headers });
        }
        return new Response(response.body, { status: response.status, headers });
    }
    catch {
        if (isStatus)
            return Response.json({ reachable: false, message: 'The relay could not reach the game host.' }, { status: 502, headers: { 'cache-control': 'no-store' } });
        return screen('The game could not connect.', 'The relay could not reach the public game host. Try again, or check the connection before launching.', 502);
    }
}
