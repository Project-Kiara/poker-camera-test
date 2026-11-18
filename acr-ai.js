/* Optional ONNX card-pip fallback for ACR, loaded once when the page opens.
 * LGD Cards Gen 3: https://huggingface.co/sroot/lgd-cards-gen3 (AGPL-3.0).
 * Detects corner pips, NOT whole cards. Geometry remains the local ACR detector's job.
 * Never overwrites a confirmed OCR card, a temporal lock, or an existing hand.
 */
(function(root){
 'use strict';
 var MODEL='https://huggingface.co/sroot/lgd-cards-gen3/resolve/main/model.onnx';
 var CLASSES='https://huggingface.co/sroot/lgd-cards-gen3/resolve/main/model.classes.json';
 var RUNTIME='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
 var RUNTIME_FALLBACK='https://unpkg.com/onnxruntime-web@1.22.0/dist/';
 // From the upstream Gen 3 model card, in the exact ONNX class order.
 var BASE_RANKS=['10','2','3','4','5','6','7','8','9','A','J','K','Q'];
 var BASE_SUITS=['C','D','H','S'];
 var BASE_CLASSES=[];
 BASE_RANKS.forEach(function(r){BASE_SUITS.forEach(function(s){BASE_CLASSES.push(r+s);});});
 var labelSource='remote';
 var MIN_CONFIDENCE=.86, MAX_ATTEMPTS=1, RETRY_MS=1900;
 var session=null, classes=null, state='idle', message='', loadPromise=null;
 var listeners=[], attempts=Object.create(null), sourceCanvas=null, sourceContext=null;
 var stage='not-started';
 var inputCanvas=null, inputContext=null;
 function notify(next,detail){
  state=next;message=detail||'';
  listeners.forEach(function(fn){try{fn({state:state,message:message});}catch(_){}});
 }
 function subscribe(fn){
  if(typeof fn==='function'){listeners.push(fn);fn({state:state,message:message});}
 }
 function loadRuntime(){
  if(root.ort&&root.ort.InferenceSession)return Promise.resolve(root.ort);
  return new Promise(function(resolve,reject){
   if(typeof document==='undefined'){reject(new Error('Browser required'));return;}
   function tryCdn(url,alternate){
    var script=document.createElement('script');
    script.src=url+'ort.wasm.min.js';script.async=true;script.crossOrigin='anonymous';
    script.onload=function(){
     if(root.ort&&root.ort.InferenceSession){RUNTIME=url;resolve(root.ort);}
     else if(alternate)tryCdn(RUNTIME_FALLBACK,false);
     else reject(new Error('ONNX Runtime JavaScript did not initialize'));
    };
    script.onerror=function(){
     if(alternate)tryCdn(RUNTIME_FALLBACK,false);
     else reject(new Error('ONNX Runtime download failed from both CDNs'));
    };
    document.head.appendChild(script);
   }
   tryCdn(RUNTIME,true);
  });
 }
 function namesFromJson(data){
  var source=data&&typeof data==='object'&&data.names?data.names:data;
  var values=Array.isArray(source)?source:
    source&&typeof source==='object'?Object.keys(source).sort(function(a,b){return Number(a)-Number(b);}).map(function(k){return source[k];}):[];
  if(values.length!==52||!values.every(function(v){return typeof v==='string'&&/^(?:10|[2-9AJQK])[CDHS]$/.test(v);}))
   throw new Error('Invalid 52-card label metadata');
  return values;
 }
 function loadLabels(){
  stage='списък карти';
  return fetch(CLASSES).then(function(response){
   if(!response.ok)throw new Error('HTTP '+response.status);
   return response.json().then(namesFromJson);
  }).then(function(values){
   labelSource='remote';return values;
  },function(err){
   // If only the external labels fail, retain the verified official class order.
   labelSource='embedded ('+String(err&&err.message||err).slice(0,55)+')';
   return BASE_CLASSES.slice();
  });
 }
 function start(){
  if(loadPromise)return loadPromise;
  stage='JS библиотека и списък карти';
  notify('loading','Подготвям резервния AI…');
  loadPromise=Promise.all([loadRuntime(),loadLabels()]).then(function(parts){
   var ort=parts[0];classes=parts[1];
   stage='ONNX/WASM модел';
   notify('loading','Изтеглям и стартирам ONNX модела…');
   ort.env.wasm.wasmPaths=RUNTIME;ort.env.wasm.numThreads=1;
   if('proxy' in ort.env.wasm)ort.env.wasm.proxy=false;
   return ort.InferenceSession.create(MODEL,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  }).then(function(model){
   session=model;
   if(!session.inputNames||session.inputNames.length!==1||!session.outputNames||!session.outputNames.length)
    throw new Error('Unexpected ONNX inputs or outputs');
   stage='готов';notify('ready','52 класа; етикети: '+labelSource);
   return true;
  }).catch(function(err){
   session=null;
   var detail=String(err&&err.message||err).slice(0,220);
   notify('unavailable',stage+': '+detail);
   // Permit an explicit retry when the network is restored.
   loadPromise=null;
   return false;
  });
  return loadPromise;
 }
 function ensureCanvas(){
  if(!sourceCanvas){
   sourceCanvas=document.createElement('canvas');
   sourceContext=sourceCanvas.getContext('2d',{willReadFrequently:true});
   inputCanvas=document.createElement('canvas');inputCanvas.width=640;inputCanvas.height=640;
   inputContext=inputCanvas.getContext('2d',{willReadFrequently:true});
  }
  return !!(sourceContext&&inputContext);
 }
 // Crop the visible upper card: avoid player avatars below the personal pair.
 // Letterbox to 640x640 RGB CHW, as expected by YOLO11.
 function makeInput(img,box){
  if(!ensureCanvas())throw new Error('Canvas unavailable');
  if(sourceCanvas.width!==img.width||sourceCanvas.height!==img.height){
   sourceCanvas.width=img.width;sourceCanvas.height=img.height;
  }
  sourceContext.putImageData(img,0,0);
  var x=Math.max(0,Math.floor(box.x)),y=Math.max(0,Math.floor(box.y));
  var w=Math.min(img.width-x,Math.ceil(box.width));
  var h=Math.min(img.height-y,Math.ceil(box.height*.76));
  if(w<12||h<14)throw new Error('Card box too small for AI');
  var size=640,scale=Math.min(size/w,size/h);
  var dw=Math.round(w*scale),dh=Math.round(h*scale);
  var dx=Math.floor((size-dw)/2),dy=Math.floor((size-dh)/2);
  inputContext.fillStyle='#727272';inputContext.fillRect(0,0,size,size);
  inputContext.drawImage(sourceCanvas,x,y,w,h,dx,dy,dw,dh);
  var rgba=inputContext.getImageData(0,0,size,size).data;
  var a=new Float32Array(3*size*size),pixels=size*size;
  for(var i=0;i<pixels;i++){
   a[i]=rgba[i*4]/255;a[i+pixels]=rgba[i*4+1]/255;a[i+2*pixels]=rgba[i*4+2]/255;
  }
  return new root.ort.Tensor('float32',a,[1,3,size,size]);
 }
 // Standard unmodified YOLO11 detector output: [1, 4+classes, anchors]
 // or [1, anchors, 4+classes]. Reject unknown shapes instead of guessing.
 function rankOutput(output,names){
  if(!output||!output.dims||!output.data||!names||names.length!==52)return null;
  var dims=output.dims,features=56,n=0,channelsFirst=false;
  if(dims.length===3&&dims[1]===features){n=dims[2];channelsFirst=true;}
  else if(dims.length===3&&dims[2]===features){n=dims[1];channelsFirst=false;}
  else return null;
  if(n<1||n>50000||output.data.length!==n*features)return null;
  var arr=output.data,top=-1,second=-1,idx=-1;
  for(var p=0;p<n;p++){
   var best=0,label=-1;
   for(var c=0;c<52;c++){
    var val=channelsFirst?arr[(c+4)*n+p]:arr[p*features+c+4];
    if(val>best){best=val;label=c;}
   }
   if(best>top){
    if(idx!==label)second=Math.max(second,top);
    top=best;idx=label;
   }else if(label!==idx&&best>second)second=best;
  }
  return idx>=0?{code:names[idx].slice(0,-1)+names[idx].slice(-1).toLowerCase(),
   confidence:top,margin:Math.max(0,top-second)}:null;
 }
 function maybeAttach(card,candidate,already){
  if(!card||card.code||card.reused||card.locked||!candidate)return false;
  var code=candidate.code;
  if(candidate.confidence<MIN_CONFIDENCE||candidate.margin<.18||already.has(code))return false;
  if(!/^(?:10|[2-9AJQK])[cdhs]$/.test(code))return false;
  // A confident AI vote must not contradict independently visible OCR glyphs.
  if(card.rank&&card.rank!==code.slice(0,-1))return false;
  if(card.suit&&card.suit!==code.slice(-1))return false;
  card.code=code;card.rank=code.slice(0,-1);card.suit=code.slice(-1);
  card.rankScore=Math.round(candidate.confidence*100);
  card.suitScore=Math.round(candidate.confidence*100);
  card.rankSource='AI ONNX';card.suitSource='AI ONNX';
  card.ai=true;card.aiConfidence=Math.round(candidate.confidence*100);
  card.reason='Резервен AI: предварително разпознаване; изчаква потвърждение от кадри';
  already.add(code);return true;
 }
 function summarize(result){
  var cards=(result.board||[]).concat(result.hero||[]);
  var codes=cards.filter(function(c){return !!c.code;}).map(function(c){return c.code;});
  result.uniqueCards=new Set(codes).size===codes.length;
  result.boardComplete=result.board.length>=3&&
   result.board.every(function(c){return !!c.code;})&&result.uniqueCards;
 }
 async function enrich(img,result){
  if(state!=='ready'||!session||!result||!img||!img.data)return result;
  var unrecognized=(result.hero||[]).filter(function(c){return c.box&&!c.code&&!c.reused;})
   .concat((result.board||[]).filter(function(c){return c.box&&!c.code&&!c.reused;}));
  if(!unrecognized.length)return result;
  var used=new Set(result.visible.filter(function(c){return !!c.code;}).map(function(c){return c.code;}));
  var now=Date.now(),updated=0,tried=0;
  for(var i=0;i<unrecognized.length&&tried<MAX_ATTEMPTS;i++){
   var card=unrecognized[i],box=card.box;
   var key=((result.hero||[]).indexOf(card)!==-1?'hero:':'board:')+
    Math.round(box.x/12)+':'+Math.round(box.y/12)+':'+Math.round(box.width/12)+':'+Math.round(box.height/12);
   if(now-(attempts[key]||0)<RETRY_MS)continue;
   attempts[key]=now;tried++;
   try{
    var tensor=makeInput(img,box),inputs={};
    inputs[session.inputNames[0]]=tensor;
    var outputs=await session.run(inputs);
    var match=rankOutput(outputs[session.outputNames[0]],classes);
    if(maybeAttach(card,match,used))updated++;
   }catch(err){
    // Bad crops or unsupported inference cannot interfere with the original OCR.
    result.aiError=String(err&&err.message||err);
   }
  }
  if(updated){summarize(result);result.aiAssisted=updated;}
  result.aiAttempted=tried;
  return result;
 }
 function resetHand(){attempts=Object.create(null);}
 root.ACRAI={
  start:start,subscribe:subscribe,enrich:enrich,resetHand:resetHand,
  status:function(){return {state:state,message:message,stage:stage,labelSource:labelSource};},
  rankOutput:rankOutput,namesFromJson:namesFromJson
 };
}(typeof window!=='undefined'?window:globalThis));
