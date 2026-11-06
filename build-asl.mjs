import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
const source=readFileSync("index.html","utf8");
function extract(begin,end){
 const p=source.indexOf(begin),q=source.indexOf(end,p+begin.length);
 if(p<0||q<0)throw Error("Missing input data: "+begin);
 return JSON.parse(source.slice(p+begin.length,q));
}
const lessons=extract("const DATA=",";const SECTION_COACH=");
const sectionCoach=extract("const SECTION_COACH=",";const SIGN_COACH=");
const signCoach=extract("const SIGN_COACH=",";DATA.slice(2)");
const vocab=extract("const VERIFIED_VOCABULARY=",";\nlet subclip=");
for(const task of lessons.slice(2)){
 for(const row of task.rows){
  const guide=sectionCoach[row.section]||["👐","Use a natural expression.","Communicate the idea clearly."];
  row.emoji=guide[0]; row.face=guide[1];row.meaning=guide[2];
  row.act=signCoach[row.label]||"Watch the demonstration carefully, then sign "+row.label+" yourself.";
 }
}
const alphabetBase="https://raw.githubusercontent.com/mohamedboukari/sign-language/main/Speech_to_ASL/assets/";
const allUrls=new Set();
for(const l of "ABCDEFGHIJKLMNOPQRSTUVWXYZ")allUrls.add(alphabetBase+l+".mp4");
for(const task of lessons.slice(2)){
 for(const row of task.rows){
  if(!vocab[row.label]?.clips?.length)throw Error("Missing vocabulary: "+row.label);
  for(const url of vocab[row.label].clips)allUrls.add(url);
 }
}
const alphabet={},clips={};
const mapping={};
for(const url of allUrls){
 const id=createHash("sha256").update(url).digest("hex").slice(0,20);
 mapping[url]="/media/"+id+".mp4";
}
for(const l of "ABCDEFGHIJKLMNOPQRSTUVWXYZ")alphabet[l]=mapping[alphabetBase+l+".mp4"];
for(const task of lessons.slice(2))for(const row of task.rows){
 const entry=vocab[row.label];
 clips[row.label]={kind:entry.kind,parts:entry.parts,urls:entry.clips.map(u=>mapping[u]),note:entry.note};
}
mkdirSync("publicsite",{recursive:true});
mkdirSync("publicsite/media",{recursive:true});
const entries=Object.entries(mapping);
let next=0;let ok=0;let bytes=0;let avc1=0;
async function fetchVideo(url,local){
 const candidates=[url];
 if(url.startsWith("https://raw.githubusercontent.com/")){
  candidates.push(url.replace("https://raw.githubusercontent.com/","https://cdn.jsdelivr.net/gh/").replace(/\/main\//,"@main/"));
 }
 let lastError;
 for(let round=0;round<2;round++){
  for(const candidate of candidates){
   try{
    const c=new AbortController();
    const timer=setTimeout(()=>c.abort(),27000);
    let res;
    try{res=await fetch(candidate,{signal:c.signal,headers:{"User-Agent":"ASL-Study-Builder/1.0"}})}
    finally{clearTimeout(timer)}
    if(!res.ok)throw Error("HTTP "+res.status);
    const b=Buffer.from(await res.arrayBuffer());
    if(b.byteLength<3500 || b.toString("ascii",4,8)!=="ftyp")throw Error("Not a valid MP4 header ("+b.length+" bytes)");
    writeFileSync(join("publicsite",local),b);
    bytes+=b.length;ok++;
    if(b.includes(Buffer.from("avc1")))avc1++;
    console.log("ASSET "+ok+"/"+entries.length+" "+local+" "+b.length+"b");
    return;
   }catch(e){lastError=e;}
  }
 }
 throw Error("Media failed for "+url+" -> "+String(lastError));
}
async function worker(){
 while(next<entries.length){
  const item=entries[next++];
  if(!item)break;
  await fetchVideo(item[0],item[1]);
 }
}
await Promise.all(Array.from({length:Math.min(6,entries.length)},worker));
if(ok!==entries.length)throw Error("Missing video downloads "+ok+"/"+entries.length);
const template=readFileSync("mobile-player.html","utf8");
const code=readFileSync("mobile-player.js","utf8");
const payload="const APP_DATA="+JSON.stringify({lessons,clips,alphabet})+";";
if(!code.includes("/*APP_DATA_INJECT*/"))throw Error("No data insertion marker");
writeFileSync("publicsite/index.html",template);
writeFileSync("publicsite/app.js",code.replace("/*APP_DATA_INJECT*/",payload));
writeFileSync("publicsite/manifest.json",JSON.stringify({mediaCount:ok,bytes,avc1,assignments:lessons.map(t=>t.title),source:"ASL learning resources",generatedAt:new Date().toISOString()}));
console.log("BUILD VERIFIED: "+ok+" MP4 files; "+bytes+" total bytes; "+avc1+" with avc1 marker; "+lessons.length+" lessons; output is served entirely same-origin.");
