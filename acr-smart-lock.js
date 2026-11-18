/* Smart Recognition Lock (live camera only).
 * Full OCR for new/unconfirmed cards, geometry + cheap corner fingerprint for
 * known cards, periodic complete audits to discover a new deal. Never use
 * image-derived fingerprints as proof of card identity.
 */
(function(root){
 'use strict';
 var AUDIT_FRAMES=6,AUDIT_MS=2400,FORCE_FRAMES=4;
 function valid(code){return typeof code==='string'&&/^(?:10|[2-9JQKA])[cdhs]$/.test(code);}
 function near(a,b){
  if(!a||!b)return false;
  var w=Math.max(1,b.width),h=Math.max(1,b.height);
  return Math.abs(a.x+a.width/2-b.x-b.width/2)<w*.25&&
    Math.abs(a.y+a.height/2-b.y-b.height/2)<h*.25&&
    Math.abs(a.width-b.width)<w*.26&&
    Math.abs(a.height-b.height)<h*.26;
 }
 // The upper-left 45% of each card contains its printed rank and small suit.
 // Avoid the avatar covering the lower third of the player's two cards.
 function signature(img,box){
  if(!img||!img.data||!box)return null;
  var data=img.data, cols=12,rows=15,mask=new Uint8Array(cols*rows);
  for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){
   var px=Math.round(box.x+box.width*(.075+(x+.5)/cols*.44));
   var py=Math.round(box.y+box.height*(.045+(y+.5)/rows*.51));
   px=Math.max(0,Math.min(img.width-1,px));
   py=Math.max(0,Math.min(img.height-1,py));
   var idx=(py*img.width+px)*4;
   var r=data[idx],g=data[idx+1],b=data[idx+2];
   // 0: background 1: dark 2: red 3: blue 4: green
   var value=0,bright=Math.max(r,g,b);
   if(r-g>27&&r-b>24&&r>80)value=2;
   else if(b-r>28&&b-g>20&&b>80)value=3;
   else if(g-r>25&&g-b>19&&g>80)value=4;
   else if(bright<170)value=1;
   mask[y*cols+x]=value;
  }
  return mask;
 }
 function difference(a,b){
  if(!a||!b||a.length!==b.length)return 0;
  var diff=0,ink=0;
  for(var i=0;i<a.length;i++){
   if(a[i]||b[i]){
    ink++;
    if(a[i]!==b[i])diff++;
   }
  }
  return ink>=9?diff/ink:0;
 }
 function create(){
  var frames=0,lastAudit=0,forced=0,baseline=Object.create(null);
  var stats={scans:0,reused:0,mode:'pending',totalFrames:0};
  function reset(){
   frames=0;lastAudit=0;forced=0;baseline=Object.create(null);
   stats={scans:0,reused:0,mode:'pending',totalFrames:0};
  }
  function process(img,vision,temporal,now){
   if(!vision||!temporal||typeof temporal.lockedSlots!=='function')
    throw new Error('Липсва OCR или памет за заключените карти.');
   now=typeof now==='number'?now:Date.now();
   frames++;
   var locks=temporal.lockedSlots(now),fresh={},fingerprints={},suspect=false;
   var scheduled=forced>0||frames===1||frames%AUDIT_FRAMES===0||
     now-lastAudit>=AUDIT_MS;
   if(scheduled){lastAudit=now;if(forced>0)forced--;}
   var scanned=0,reused=0;
   var result=vision.analyze(img,{priorSlots:locks,reuseCard:function(kind,index,box,image){
    if(kind!=='board'&&kind!=='hero')return null;
    var key=kind+':'+index,lock=locks[kind][index],sig=signature(image,box);
    fingerprints[key]=sig;
    if(scheduled||!lock||!valid(lock.code)||!near(lock.box,box)){
     fresh[key]=true;
     return null;
    }
    var ref=baseline[key];
    if(ref&&ref.code===lock.code&&difference(ref.mask,sig)>.68){
     // A changed rank/suit or strong scene transition: full OCR now and
     // for several subsequent frames to establish a safe hand boundary.
     suspect=true;forced=FORCE_FRAMES;
     fresh[key]=true;
     return null;
    }
    return {code:lock.code};
   }});
   scanned=result.ocrReads||0;reused=result.reusedReads||0;
   if(suspect){
    result.temporalConflict=true;
    result.temporalReason='visual-change';
    result.boardComplete=false;
   }
   temporal.observe(result,now);
   // Update the cheap reference only for independently verified matching OCR
   // and freshly established locks. Never train on a reused/guessed card.
   var next=temporal.lockedSlots(now);
   ['board','hero'].forEach(function(kind){
    (result[kind]||[]).forEach(function(card,i){
     var key=kind+':'+i,lock=next[kind][i];
     if(!lock||!valid(lock.code)){delete baseline[key];return;}
     if(card.code===lock.code&&!card.reused&&
        !card.temporalConflict&&!result.temporalConflict){
      baseline[key]={code:lock.code,mask:fingerprints[key]||signature(img,card.box)};
     }else if(!baseline[key]||baseline[key].code!==lock.code){
      // A lock was established by multiple prior frames and is already in
      // the current image. Capture its geometry, not its identity.
      if(card.code===lock.code&&!result.temporalConflict)
       baseline[key]={code:lock.code,mask:fingerprints[key]||signature(img,card.box)};
     }
    });
   });
   Object.keys(baseline).forEach(function(key){
    var parts=key.split(':'),arr=result[parts[0]],i=Number(parts[1]);
    if(!arr||!arr[i]||!near((next[parts[0]][i]||{}).box,arr[i].box))delete baseline[key];
   });
   if(result.temporalConflict||result.forceNewHand){
    forced=Math.max(forced,FORCE_FRAMES);
    // A confirmed new deal must start with genuinely new OCR, never inherit
    // the previous hand's fingerprints.
    if(result.forceNewHand)baseline=Object.create(null);
   }
   var confirmed=temporal.lockedSlots(now),locked=0;
   ['hero','board'].forEach(function(kind){
     confirmed[kind].forEach(function(v){if(v&&v.code)locked++;});
   });
   stats={scans:scanned,reused:reused,locked:locked,
    mode:reused>0?'lock':scheduled?'audit':'discovery',
    totalFrames:frames};
   result.smartLock={scanned:scanned,reused:reused,locked:locked,
    mode:stats.mode,periodicAudit:scheduled,visualChange:suspect};
   return result;
  }
  return {process:process,reset:reset,status:function(){return stats;}};
 }
 root.ACRSmartLock={create:create,near:near,signature:signature,difference:difference};
}(typeof window!=='undefined'?window:globalThis));