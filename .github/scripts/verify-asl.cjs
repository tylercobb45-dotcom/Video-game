const { chromium, webkit, devices } = require("playwright");
const url = "https://asl-2b-one-pass-coach.onrender.com/?browser-check=20261106";
(async ()=>{
 let failures=[],messages=[],results=[];
 for(const browserName of ["chromium","webkit"]){
  const browser=await ({chromium,webkit})[browserName].launch({headless:true});
  const context=await browser.newContext(browserName==="webkit"?{...devices["iPhone 13"],ignoreHTTPSErrors:true}:{viewport:{width:390,height:844},ignoreHTTPSErrors:true});
  const page=await context.newPage();
  page.on("pageerror",e=>messages.push(browserName+" script "+e.message));
  page.on("console",m=>{if(m.type()==="error")messages.push(browserName+" console "+m.text().slice(0,300))});
  const run=async(label,fn)=>{try{const val=await fn();if(val===false)throw Error("Condition was false");results.push({browser:browserName,test:label,status:"PASS"});console.log("PASS "+browserName+" "+label)}catch(e){results.push({browser:browserName,test:label,status:"FAIL",error:e.message});failures.push(browserName+" "+label+": "+e.message);console.log("FAIL "+browserName+" "+label+": "+e.message)}};
  await run("page-load",async()=>{const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});return response&&response.status()===200});
  await run("four-tabs",async()=>{await page.locator("#tabs .tab").first().waitFor({timeout:10000});return await page.locator("#tabs .tab").count()===4});
  await run("abc-tab",async()=>{await page.locator("#tabs .tab").nth(1).click();return (await page.locator("#word").textContent()).trim()==="A"});
  await run("trip-tab",async()=>{await page.locator("#tabs .tab").nth(2).click();return (await page.locator("#word").textContent()).trim()==="FUTURE"});
  await run("lessons-tab",async()=>{await page.locator("#tabs .tab").nth(3).click();return (await page.locator("#word").textContent()).trim()==="ONE"});
  await run("schoolbus-tab",async()=>{await page.locator("#tabs .tab").nth(0).click();return (await page.locator("#word").textContent()).trim()==="S"});
  await run("video-play",async()=>{
   await page.locator("#toggle").click();
   try{await page.waitForFunction(()=>{const v=document.querySelector("video");return v&&v.readyState>=2 && !v.paused && v.currentTime>0.05},{timeout:25000});return true}catch(e){
    const detail=await page.evaluate(()=>{const v=document.querySelector("video");return {src:v?.currentSrc,readyState:v?.readyState,networkState:v?.networkState,error:v?.error?.message,paused:v?.paused,currentTime:v?.currentTime,notice:document.querySelector("#status")?.textContent}});
    throw Error("No playback: "+JSON.stringify(detail))
   }
  });
  await run("next-control",async()=>{await page.locator("#next").click();return (await page.locator("#word").textContent()).trim()==="C"});
  await run("previous-control",async()=>{await page.locator("#prev").click();return (await page.locator("#word").textContent()).trim()==="S"});
  await page.screenshot({path:"verify-"+browserName+".png",fullPage:false}).catch(()=>{});
  await browser.close();
 }
 console.log("RESULTS_JSON="+JSON.stringify({results,failures,messages}));
 if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
