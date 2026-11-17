/* Adaptive equity calculation off the UI thread. No network; uses local PokerMath. */
'use strict';
importScripts('./poker-engine.js?v=adaptive-equity-r16');
var runningJob=0;
self.onmessage=function(event){
  var payload=event.data||{};
  if(payload.type!=='calculate')return;
  var jobId=payload.jobId,simulator;
  runningJob=jobId;
  try{simulator=self.PokerMath.simulator(payload.input);}
  catch(err){self.postMessage({type:'error',jobId:jobId,message:String(err&&err.message||err)});return;}
  var started=performance.now(),lastUpdate=started,firstPreview=false;
  function step(){
    if(jobId!==runningJob)return;
    var finished;
    try{finished=simulator.batch(700);}
    catch(err){
      self.postMessage({type:'error',jobId:jobId,message:String(err&&err.message||err)});
      return;
    }
    var now=performance.now(),elapsedMs=Math.max(0,now-started),state=simulator.result();
    if(finished){
      self.postMessage({type:'final',jobId:jobId,result:state,elapsedMs:elapsedMs});
      return;
    }
    // A partial exact enumeration is not a representative sample. Never show
    // a provisional win percentage from its lexicographic traversal.
    var shouldReport=state.exact ? now-lastUpdate>=300 :
      (!firstPreview&&state.done>=240)||(now-lastUpdate>=160&&state.done>=240);
    if(shouldReport){
      self.postMessage({type:'progress',jobId:jobId,result:state,elapsedMs:elapsedMs});
      lastUpdate=now;
      if(!state.exact)firstPreview=true;
    }
    setTimeout(step,0);
  }
  setTimeout(step,0);
};
