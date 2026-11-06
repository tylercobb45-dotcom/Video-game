const {chromium,webkit,devices}=require("playwright");
const base="https://asl-2b-one-pass-coach.onrender.com/?live-verification=20261106b";
const out=[],issues=[];
async function verify(browserName,kind){
 const browser=await (browserName==="webkit"?webkit:chromium).launch({headless:true});
 const ctx=await browser.newContext(browserName==="webkit"?{...devices["iPhone 13"]}:{viewport:{width:390,height:844}});
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 async function check(name,fn){
  try{const ok=await fn();if(ok===false)throw Error("Condition false");out.push({browser:browserName,name,status:"PASS"});console.log("PASS "+browserName+" "+name)}
  catch(e){out.push({browser:browserName,name,status:"FAIL",detail:e.message});issues.push(browserName+" "+name+" "+e.message);console.log("FAIL "+browserName+" "+name+" "+e.message)}
 }
 await check("page load",async()=>{const r=await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});return r.status()===200});
 await page.locator("#tabs .tab").first().waitFor({timeout:10000});
 await check("four assignment buttons",()=>page.locator("#tabs .tab").count().then(x=>x===4));
 for(const [id,label] of [[0,"S"],[1,"A"],[2,"FUTURE"],[3,"ONE"]]){
  await check("assignment "+(id+1)+" opens",async()=>{await page.locator("#tabs .tab").nth(id).click();return (await page.locator("#word").textContent()).trim()===label});
  if(browserName==="webkit"){
   await check("assignment "+(id+1)+" video actually plays",async()=>{
    await page.locator("#toggle").click();
    try{
     await page.waitForFunction(()=>{let v=document.querySelector("video");return v&&v.readyState>=2&&!v.paused&&v.currentTime>0.05},null,{timeout:20000});
     return true;
    }catch(e){
     const state=await page.evaluate(()=>{const v=document.querySelector("video");return{src:v.currentSrc,time:v.currentTime,paused:v.paused,ready:v.readyState,network:v.networkState,mediaError:v.error?.message,notice:document.querySelector("#status")?.textContent}});
     throw Error(JSON.stringify(state));
    }
   });
  }
 }
 await check("next button",async()=>{await page.locator("#next").click();return (await page.locator("#word").textContent()).trim()==="ME"});
 await check("back button",async()=>{await page.locator("#prev").click();return (await page.locator("#word").textContent()).trim()==="ONE"});
 await check("no JavaScript exceptions",()=>errors.length===0||("Browser exceptions "+JSON.stringify(errors)));
 console.log("ERRORS_"+browserName+"="+JSON.stringify(errors));
 await page.screenshot({path:"verify-"+browserName+".png",fullPage:false});
 await browser.close();
}
(async()=>{
 await verify("chromium","ui");
 await verify("webkit","video");
 console.log("RESULTS_JSON="+JSON.stringify({out,issues}));
 if(issues.length)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
