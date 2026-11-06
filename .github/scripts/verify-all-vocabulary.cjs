const {chromium,webkit,devices}=require("playwright");
const url="https://asl-2b-one-pass-coach.onrender.com/?full-vocab-check=20261106";
const cases=[
 {name:"desktop Chrome",engine:chromium,launch:{headless:true,channel:"chrome"},context:{viewport:{width:1365,height:900}}},
 {name:"iPhone WebKit",engine:webkit,launch:{headless:true},context:{...devices["iPhone 13"]}}
];
const summary=[];
(async()=>{
for(const c of cases){
 const errors=[],results=[],failed=[];
 const browser=await c.engine.launch(c.launch);
 const context=await browser.newContext({...c.context,ignoreHTTPSErrors:true});
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 const check=async(name,fn)=>{
  try{const val=await fn();if(val===false)throw Error("Check returned false");results.push(name);console.log("PASS "+c.name+" "+name)}
  catch(e){failed.push({name,error:e.message});console.error("FAIL "+c.name+" "+name+" "+e.message)}
 };
 await check("original site responds",async()=>{
  const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
  return response&&response.status()===200;
 });
 await page.locator("#tabs .tab").first().waitFor({timeout:12000});
 let manifest=await page.evaluate(()=>{
  const list=[],seen=new Set();
  for(let task=2;task<4;task++){
   for(const row of DATA[task].rows){
    const item=VERIFIED_VOCABULARY[row.label];
    if(!item||!item.clips?.length)throw Error("Missing mapping for "+row.label);
    for(let j=0;j<item.clips.length;j++){
     const src=item.clips[j];
     if(!seen.has(src)){seen.add(src);list.push({task,word:row.label,part:j,src})}
    }
   }
  }
  return {sourceCount:list.length,list,stepCounts:DATA.slice(2).map(t=>t.rows.length)};
 });
 console.log("MANIFEST "+c.name+" clips="+manifest.sourceCount+" steps="+manifest.stepCounts.join(","));
 await check("58 vocabulary steps mapped",()=>manifest.stepCounts.join(",")==="30,28");
 await check("all vocabulary clips hosted on mirrored video site",()=>manifest.list.every(x=>x.src.startsWith("https://asl-2b-mobile-reliable.onrender.com/media/")));
 for(const [i,label] of [[2,"FUTURE"],[3,"ONE"]]){
  await check("assignment "+(i+1)+" opens",async()=>{
   await page.locator("#tabs .tab").nth(i).click();
   return (await page.locator("#word").textContent()).trim()===label;
  });
  await check("assignment "+(i+1)+" first video plays",async()=>{
   await page.locator("#toggle").click();
   await page.waitForFunction(()=>{const v=document.querySelector("video");return v&&v.readyState>=2&&!v.paused&&v.currentTime>.06},null,{timeout:18000});
   await page.locator("#toggle").click();
   return true;
  });
 }
 // Verify all unique MP4s in a real HTML5 video player, not just their HTTP status.
 // Parallelism is deliberately limited to avoid overwhelming iOS media decoders.
 let pointer=0,good=0,failures=[];
 const jobs=manifest.list;
 async function worker(){
  while(pointer<jobs.length){
   const current=jobs[pointer++];
   const result=await page.evaluate(async ({src})=>{
    return await new Promise(resolve=>{
     const video=document.createElement("video");
     video.muted=true;video.autoplay=false;video.playsInline=true;video.preload="auto";
     video.style.cssText="position:absolute;width:1px;height:1px;opacity:0.01;pointer-events:none";
     document.body.append(video);
     let completed=false;
     const finish=(pass,why)=>{
      if(completed)return;completed=true;
      clearTimeout(timer);video.pause();video.removeAttribute("src");video.load();video.remove();
      resolve({pass,why});
     };
     const timer=setTimeout(()=>finish(false,"Timeout at readyState="+video.readyState+" currentTime="+video.currentTime+" error="+video.error?.message),14000);
     const check=()=>{if(video.currentTime>.055&&video.readyState>=2)finish(true,"time="+video.currentTime.toFixed(2))};
     video.addEventListener("timeupdate",check);
     video.addEventListener("playing",check);
     video.addEventListener("error",()=>finish(false,"Media error="+video.error?.message));
     video.src=src;video.load();
     video.play().then(check).catch(e=>finish(false,"play rejection="+e.name+" "+e.message));
    });
   },{src:current.src});
   if(result.pass)good++;
   else failures.push({...current,why:result.why});
   console.log((result.pass?"PLAYED ":"BROKEN ")+c.name+" ["+(current.task+1)+"] "+current.word+" "+current.part+" "+result.why);
  }
 }
 await Promise.all(Array.from({length:3},worker));
 console.log("MEDIA_SUMMARY "+c.name+" "+good+"/"+jobs.length+" played");
 await check("every assignment 3 and 4 video plays in browser",()=>{
  if(failures.length)throw Error(JSON.stringify(failures.slice(0,20)));
  return good===jobs.length;
 });
 // Check F-L-A step sequence and repeat behavior, preserving actual player controls.
 await check("Florida clips F L A play in order and repeat twice",async()=>{
  await page.locator("#tabs .tab").nth(2).click();
  await page.locator("#toggle").click();
  await page.locator("#steps .step").nth(4).click();
  const names=[];
  for(let i=0;i<6;i++){
   names.push(await page.locator("video").evaluate(v=>v.currentSrc.split("/").pop()));
   await page.locator("video").evaluate(v=>v.dispatchEvent(new Event("ended")));
  }
  await page.waitForTimeout(850);
  const next=(await page.locator("#word").textContent()).trim();
  if(next!=="TRAVEL")throw Error("next="+next);
  return names[0]===names[3]&&names[1]===names[4]&&names[2]===names[5]&&new Set(names.slice(0,3)).size===3;
 });
 await check("next/back and task switch still work",async()=>{
  await page.locator("#tabs .tab").nth(3).click();
  await page.locator("#next").click();
  if((await page.locator("#word").textContent()).trim()!=="ME")throw Error("next");
  await page.locator("#prev").click();
  return (await page.locator("#word").textContent()).trim()==="ONE";
 });
 await check("no Javascript page errors",()=>{if(errors.length)throw Error(errors.join(" | "));return true});
 await page.screenshot({path:c.name==="desktop Chrome"?"vocabulary-desktop.png":"vocabulary-iphone.png",fullPage:false}).catch(()=>{});
 summary.push({browser:c.name,total:jobs.length,good,failures,checksPassed:results.length,failedChecks:failed,pageErrors:errors});
 await browser.close();
}
 console.log("RESULTS_JSON="+JSON.stringify(summary));
 if(summary.some(x=>x.failedChecks.length||x.failures.length))process.exitCode=1;
})().catch(e=>{console.error("FATAL "+e.stack);process.exitCode=1});
