import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { relay } from './relay.mjs';

export function createApp() {
  return createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url || '/', 'http://relay.local');
      if (url.pathname === '/healthz' && ['GET','HEAD'].includes(incoming.method)) {
        outgoing.writeHead(200, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
        outgoing.end(incoming.method === 'HEAD' ? undefined : 'ok');
        return;
      }
      if (!['GET','HEAD'].includes(incoming.method)) {
        outgoing.writeHead(405, {'allow':'GET, HEAD','content-type':'text/plain; charset=utf-8'});
        outgoing.end('Only public game downloads are supported.');
        return;
      }
      const headers = new Headers();
      for (const key of ['accept','range']) {
        const value = incoming.headers[key];
        if (typeof value === 'string') headers.set(key,value);
      }
      const response = await relay(new Request(url,{method:incoming.method,headers}));
      outgoing.writeHead(response.status,Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body),outgoing);
      else outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(502, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
      outgoing.end('The game relay could not complete this request.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 10000);
  createApp().listen(port,'0.0.0.0',()=>console.log(`TransportIt relay listening on ${port}`));
}
