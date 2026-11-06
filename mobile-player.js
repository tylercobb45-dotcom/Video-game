"use strict";
/*APP_DATA_INJECT*/
const $=id=>document.getElementById(id);
const v=$("video");
const state={task:0,index:0,active:false,stepToken:0,part:0,pass:0,sceneAccum:0,sceneStarted:null,sceneTimer:null,cueTimer:null,inCue:false,meta:false,loadTimeout:null,failed:false};
const tasks=APP_DATA.lessons;
const nfmt=sec=>{const n=Math.max(0,Math.round(sec));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")};
const isStory=()=>state.task<2;
const getStep=()=>tasks[state.task].rows[state.index];
const getMedia=()=>{
 const w=getStep().label;
 return isStory()?{urls:[APP_DATA.alphabet[w]],kind:"alphabet",parts:[w]}:APP_DATA.clips[w];
};
function say(message,error=false){
 $("status").textContent=message;
 $("status").className=error?"error":"good";
}
function storyTotal(){return tasks[state.task].rows.reduce((n,x)=>n+(x.seconds||0),0)}
function sceneElapsed(){return state.sceneAccum+(state.sceneStarted===null?0:(performance.now()-state.sceneStarted)/1000)}
function clearTimers(){
 if(state.sceneTimer!==null){clearInterval(state.sceneTimer);state.sceneTimer=null}
 if(state.cueTimer!==null){clearTimeout(state.cueTimer);state.cueTimer=null}
 if(state.loadTimeout!==null){clearTimeout(state.loadTimeout);state.loadTimeout=null}
}
function stopPlayback(){
 clearTimers();state.active=false;
 if(state.sceneStarted!==null){state.sceneAccum+=(performance.now()-state.sceneStarted)/1000;state.sceneStarted=null}
 v.pause();
 $("play").textContent="▶ Play all";
 $("pauseCue").style.display="none";
}
function updateTimeline(){
 if(!isStory()){
   $("elapsed").textContent="Vocabulary practice";
   $("target").textContent="Full sign sequence";
   $("progress").style.width="0%";return;
 }
 const steps=tasks[state.task].rows;
 const total=storyTotal();
 const done=steps.slice(0,state.index).reduce((n,x)=>n+x.seconds,0);
 const current=state.inCue?getStep().seconds:Math.min(getStep().seconds,sceneElapsed());
 const elapsed=done+current;
 $("elapsed").textContent=nfmt(elapsed)+" elapsed";
 $("target").textContent=nfmt(total)+" target";
 $("progress").style.width=Math.min(100,elapsed/total*100).toFixed(2)+"%";
}
function render(){
 const t=tasks[state.task],x=getStep(),source=getMedia();
 $("stepTitle").textContent=isStory()?x.label+" — story handshape":x.section+" · "+x.label;
 $("emoji").textContent=x.emoji||"👐";
 $("expression").textContent="Facial expression: "+(x.face||"Focused, natural.");
 $("storyInstruction").textContent=x.act||x.tip||"Watch, then make the sign.";
 $("meaning").textContent=isStory()?(x.beat?"Act it out: "+x.beat:"Make a continuous story."):"Complete thought: "+(x.meaning||x.section);
 $("currentLabel").textContent=x.label;
 $("position").textContent=(state.index+1)+" / "+t.rows.length;
 $("taskHeading").textContent=t.title+" — signing order";
 $("sourceNote").textContent=source.kind==="direct"?"Complete vocabulary sign.":source.kind==="alphabet"?"The video demonstrates the letter shape. Act out the scene using that handshape.":source.kind+" — "+(source.note||"This is a multi-clip teaching sequence.");
 $("direct").href=source.urls[state.part]||source.urls[0];
 $("play").textContent=state.active?"❚❚ Pause":"▶ Play all";
 $("tabs").querySelectorAll("button").forEach((b,i)=>{
   b.classList.toggle("sel",i===state.task);
   b.setAttribute("aria-pressed",String(i===state.task));
 });
 $("steps").replaceChildren();
 t.rows.forEach((r,i)=>{
   const b=document.createElement("button");
   b.className="step"+(i===state.index?" sel":"");
   b.type="button";
   const left=document.createElement("span"),right=document.createElement("span");
   left.textContent=(i+1)+". "+(r.emoji||"👐")+" "+r.label;
   right.textContent=isStory()?r.seconds+"s":r.section||"";
   b.append(left,right);
   b.onclick=()=>beginStep(i,state.active);
   $("steps").append(b);
 });
 updateTimeline();
}
function prepareSource(source,autoStart){
 const token=state.stepToken;
 if(state.loadTimeout!==null){clearTimeout(state.loadTimeout);state.loadTimeout=null}
 state.meta=false;state.failed=false;
 const url=source||"";
 v.pause();v.muted=true;v.playsInline=true;v.loop=isStory();
 v.playbackRate=Number($("speed").value);
 v.src=url;
 $("direct").href=url;
 $("videoState").textContent="Loading this sign video…";
 if(!url){say("No video exists for this step. Playback stopped.",true);stopPlayback();return}
 v.load();
 state.loadTimeout=setTimeout(()=>{
  if(token!==state.stepToken||state.meta||state.failed)return;
  say("The video is taking too long to load. Try the 'Open this video directly' link underneath.",true);
  $("videoState").textContent="Video not ready — check connection or open clip directly.";
 },12000);
 if(autoStart){
  const attempt=v.play();
  if(attempt&&typeof attempt.catch==="function")attempt.catch(e=>{
   if(token!==state.stepToken||e.name==="AbortError")return;
   state.active=false;
   $("play").textContent="▶ Try again";
   say("Safari could not start this video ("+(e.message||e.name)+"). Tap Try again or open the video directly.",true);
  });
 }
}
function beginStep(index,play){
 if(index>=tasks[state.task].rows.length){
  stopPlayback();say("Finished "+tasks[state.task].title+". You reached the end!",false);return;
 }
 state.stepToken++;clearTimers();v.pause();
 state.active=Boolean(play);state.index=Math.max(0,index);
 state.part=0;state.pass=0;state.sceneAccum=0;state.sceneStarted=null;state.inCue=false;
 $("pauseCue").style.display="none";
 render();
 const clip=getMedia();
 say("Ready: "+getStep().label+(play?" — starting playback…":" — tap Play all to begin."),false);
 prepareSource(clip.urls[0],play);
}
function chooseTask(i){stopPlayback();state.task=i;beginStep(0,false)}
function beginSceneClock(){
 if(!state.active||!isStory()||state.sceneTimer!==null||state.inCue)return;
 state.sceneStarted=performance.now();
 state.sceneTimer=setInterval(()=>{
  if(!state.active||!isStory())return;
  updateTimeline();
  const x=getStep(),pause=Math.min(x.pause||1,x.seconds/2);
  if(!state.inCue&&sceneElapsed()>=x.seconds-pause){
    state.inCue=true;
    if(state.sceneStarted!==null){
      state.sceneAccum+=(performance.now()-state.sceneStarted)/1000;state.sceneStarted=null;
    }
    v.pause();
    $("pauseCue").style.display="block";
    $("pauseCue").textContent="⏸ Hold this facial expression for "+pause+" second(s)";
    $("videoState").textContent="End-of-scene pause";
    clearInterval(state.sceneTimer);state.sceneTimer=null;
    state.cueTimer=setTimeout(()=>{state.cueTimer=null;if(state.active)beginStep(state.index+1,true)},pause*1000);
  }
 },120);
}
function playClicked(){
 if(state.active){stopPlayback();say("Paused. Tap Play all to restart this sign.",false);return}
 state.stepToken++;clearTimers();
 state.sceneAccum=0;state.sceneStarted=null;state.inCue=false;
 state.active=true;state.part=0;state.pass=0;
 $("pauseCue").style.display="none";render();
 say("Playing "+getStep().label+"…",false);
 prepareSource(getMedia().urls[0],true);
}
function videoEnded(){
 if(!state.active)return;
 if(isStory()){
  // Safari normally loops natively; fallback only when it does not.
  if(!state.inCue){v.currentTime=0;v.play().catch(()=>{})}return;
 }
 const source=getMedia();
 if(state.part<source.urls.length-1){
  state.part++;
  $("videoState").textContent="Part "+(state.part+1)+"/"+source.urls.length+" of "+getStep().label;
  prepareSource(source.urls[state.part],true);
  return;
 }
 const repeats=Math.max(1,Number($("repeats").value)||1);
 if(state.pass+1<repeats){
  state.pass++;state.part=0;
  $("videoState").textContent="Repeat "+(state.pass+1)+"/"+repeats+": "+getStep().label;
  prepareSource(source.urls[0],true);return;
 }
 state.part=0;state.pass=0;
 say("Completed "+getStep().label+"; next sign.",false);
 state.cueTimer=setTimeout(()=>{state.cueTimer=null;if(state.active)beginStep(state.index+1,true)},450);
}
const names=["🚌 SCHOOLBUS","🔤 ABC Story","✈️ Trip Plan","🎓 Five Lessons"];
names.forEach((label,i)=>{
 const b=document.createElement("button");
 b.type="button";b.className="tab";b.textContent=label;
 b.onclick=()=>chooseTask(i);$("tabs").append(b);
});
$("play").onclick=playClicked;
$("previous").onclick=()=>beginStep(state.index-1,state.active);
$("next").onclick=()=>beginStep(state.index+1,state.active);
$("speed").onchange=()=>{v.playbackRate=Number($("speed").value);say("Playback speed changed.",false)};
$("repeats").onchange=()=>say("Vocabulary repetitions set to "+$("repeats").value+"×.",false);
v.addEventListener("loadedmetadata",()=>{
 state.meta=true;
 if(state.loadTimeout!==null){clearTimeout(state.loadTimeout);state.loadTimeout=null}
 const duration=v.duration;
 $("videoState").textContent="Video loaded"+(Number.isFinite(duration)?" · "+nfmt(duration):"")+" · "+$("speed").value+"×";
});
v.addEventListener("playing",()=>{
 if(!state.active)return;
 $("videoState").textContent="Playing "+getStep().label+" · "+$("speed").value+"×";
 if(isStory()){
  if(state.sceneTimer===null&&!state.inCue)beginSceneClock();
  else if(state.sceneStarted===null&&!state.inCue)state.sceneStarted=performance.now();
 }
});
v.addEventListener("waiting",()=>{
 if(!state.active)return;
 if(isStory()&&state.sceneStarted!==null){
  state.sceneAccum+=(performance.now()-state.sceneStarted)/1000;
  state.sceneStarted=null;
 }
 $("videoState").textContent="Buffering video…";
});
v.addEventListener("canplay",()=>{
 if(!state.active)$("videoState").textContent="Video ready. Tap Play all.";
});
v.addEventListener("ended",videoEnded);
v.addEventListener("error",()=>{
 if(!v.src)return;
 state.failed=true;
 if(state.loadTimeout!==null){clearTimeout(state.loadTimeout);state.loadTimeout=null}
 stopPlayback();
 say("This video failed to load or could not be decoded by Safari. Try the 'Open this video directly' link. I stopped here rather than skipping.",true);
 $("videoState").textContent="Video error: "+getStep().label;
});
beginStep(0,false);
say("Ready. Select an assignment from the buttons pinned to the top, then tap Play all.",false);
