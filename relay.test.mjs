import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relay,upstreamURL,UPSTREAM,rewritePublicURLs} from './relay.mjs';

test('root resolves to the developer site, assets and query stay on its host',()=>{
  assert.equal(upstreamURL('/','').href, UPSTREAM.href);
  assert.equal(upstreamURL('/assets/game.js','?v=3').href,UPSTREAM.href+'assets/game.js?v=3');
  assert.equal(upstreamURL(UPSTREAM.pathname+'assets/a.png','').href,UPSTREAM.href+'assets/a.png');
  assert.equal(upstreamURL('//evil.example/a','').origin,UPSTREAM.origin);
});
test('explicit developer-host references become local paths',()=>{
  assert.equal(rewritePublicURLs(UPSTREAM.href+'assets/a.js'),'/assets/a.js');
});
test('relay rewrites HTML without sending browser credentials',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url.origin,UPSTREAM.origin);
    assert.equal(options.headers.has('cookie'),false);
    assert.equal(options.headers.has('authorization'),false);
    return new Response('<script src="'+UPSTREAM.href+'assets/game.js"></script>',{headers:{'content-type':'text/html','set-cookie':'sensitive=1'}});
  };
  try{
    const result=await relay(new Request('https://local.test/',{headers:{cookie:'private=1',authorization:'Bearer private'}}));
    assert.equal(result.status,200);
    assert.match(await result.text(),/src="\/assets\/game.js"/);
    assert.equal(result.headers.has('set-cookie'),false);
  }finally{globalThis.fetch=original;}
});
test('binary game assets pass through unchanged',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(new Uint8Array([0,255,42]),{headers:{'content-type':'application/wasm'}});
  try{const result=await relay(new Request('https://local.test/game.wasm'));assert.deepEqual([...new Uint8Array(await result.arrayBuffer())],[0,255,42]);}finally{globalThis.fetch=original;}
});
test('cross-host redirects are not followed',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://other.example/'}});
  try{assert.equal((await relay(new Request('https://local.test/'))).status,502);}finally{globalThis.fetch=original;}
});
test('verification denial returns an honest error',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('Verify',{status:403});
  try{const result=await relay(new Request('https://local.test/'));assert.equal(result.status,502);assert.match(await result.text(),/declined/);}finally{globalThis.fetch=original;}
});
test('write requests never reach the upstream',async()=>{
  const result=await relay(new Request('https://local.test/',{method:'POST',body:'private'}));
  assert.equal(result.status,405);
});
test('connection failures are surfaced',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('offline');};
  try{const result=await relay(new Request('https://local.test/_gateway/status'));assert.equal(result.status,502);assert.equal((await result.json()).reachable,false);}finally{globalThis.fetch=original;}
});
