import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';

test('HTTP server exposes health and blocks writes without requiring the game host',async()=>{
  const server=createApp();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const health=await fetch(origin+'/healthz');
    assert.equal(health.status,200);
    assert.equal(await health.text(),'ok');
    const head=await fetch(origin+'/healthz',{method:'HEAD'});
    assert.equal(head.status,200);
    assert.equal(await head.text(),'');
    const denied=await fetch(origin+'/',{method:'POST',body:'private'});
    assert.equal(denied.status,405);
    assert.equal(denied.headers.get('allow'),'GET, HEAD');
    const landing=await fetch(origin+'/_gateway');
    assert.equal(landing.status,200);
    assert.match(await landing.text(),/One more route/);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
