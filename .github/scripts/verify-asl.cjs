const { chromium,webkit,devices }=require("playwright");
const base="https://asl-2b-one-pass-coach.onrender.com/?live-verification=20261106-repeat-desktop";
const results=[],errors=[];
async function testBrowser(name,engine,contextOptions){
 const browser=await engine.launch(name==="desktop-chrome"?{headless:true,channel:"chrome"}:{headless:true});
 const context=await browser.newContext(contextOptions);
 const page=await context.newPage();
 const pageErrors=[];
 page.on("pageerror",e=>pageErrors.push(e.message));
 async function check(label,run){
  try{if(await run()===false)throw Error("Check returned false");results.push({browser:name,label,status:"PASS"});console.log("PASS "+name+" "+label)}
  catch(e){results.push({browser:name,label,status:"FAIL",error:e.message});errors.push(name+" "+label+": "+e.message);console.log("FAIL "+name+" "+label+": "+e.message)}
 }
 await check("live page loads",async()=>{const response=await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});return response?.status()===200});
 await page.locator("#tabs .tab").first().waitFor({timeout:9000});
 await check("four assignments selectable",()=>page.locator("#tabs .tab").count().then(n=>n===4));
 const labels=["S","A","FUTURE","ONE"];
 for(let idx=0;idx<4;idx++){
  await check("assignment "+(idx+1)+" opens",async()=>{
   await page.locator("#tabs .tab").nth(idx).click();
   return (await page.locator("#word").textContent()).trim()===labels[idx];
  });
  await check("assignment "+(idx+1)+" video plays",async()=>{
   await page.locator("#toggle").click();
   try{
    await page.waitForFunction(()=>{
      const v=document.querySelector("video");
      return v&&v.readyState>=2&&!v.paused&&v.currentTime>0.08;
    },null,{timeout:14000});
    return true;
   }catch(e){
    const details=await page.evaluate(()=>{
     const v=document.querySelector("video");
     return {src:v.currentSrc,readyState:v.readyState,networkState:v.networkState,paused:v.paused,currentTime:v.currentTime,err:v.error?.message,notice:document.querySelector("#status")?.textContent};
    });
    throw Error(JSON.stringify(details));
   }
  });
  if(idx<2){
   await check("story "+(idx+1)+" loops natively with scene timer",async()=>{
    return await page.locator("video").evaluate(v=>v.loop===true)&&await page.locator("#paced").isChecked();
   });
   await check("story "+(idx+1)+" 2-minute target remains",async()=>{
    const time=await page.locator("#storytarget").textContent();
    return idx===0?time.includes("2:37"):time.includes("2:43");
   });
  }else{
   await check("vocabulary replay selector defaults to twice",async()=>page.locator("#repeats").inputValue().then(v=>v==="2"));
  }
 }
 await check("next button works on fourth assignment",async()=>{
  await page.locator("#next").click();return (await page.locator("#word").textContent()).trim()==="ME";
 });
 await check("previous button works on fourth assignment",async()=>{
  await page.locator("#prev").click();return (await page.locator("#word").textContent()).trim()==="ONE";
 });
 await check("no JavaScript exceptions",async()=>{if(pageErrors.length)throw Error(JSON.stringify(pageErrors));return true});
 console.log("PAGE_ERRORS_"+name+"="+JSON.stringify(pageErrors));
 await page.screenshot({path:"verify-"+name+".png",fullPage:false});
 await browser.close();
}
(async()=>{
 await testBrowser("desktop-chrome",chromium,{viewport:{width:1365,height:850},ignoreHTTPSErrors:true});
 await testBrowser("iphone-webkit",webkit,{...devices["iPhone 13"],ignoreHTTPSErrors:true});
 console.log("RESULTS_JSON="+JSON.stringify({results,errors}));
 if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
