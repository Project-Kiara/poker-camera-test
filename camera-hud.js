/* Immersive camera HUD. Presentation only: all recognition stays in ACRVision,
   and probability calculations stay in PokerMath. */
(function(){
 'use strict';
 var preview=document.getElementById('preview'),video=document.getElementById('camera');
 var section=document.getElementById('autoRecognition');
 var canvas=document.getElementById('cardOverlay');
 if(!preview||!video||!section||!canvas)return;
 var top=document.getElementById('hudTop'),bottom=document.getElementById('hudBottom');
 var reading=section.querySelector('.reading-summary');
 var probabilities=section.querySelector('.result-grid');
 var visionStatus=document.getElementById('visionStatus');
 if(reading)top.appendChild(reading);
 if(visionStatus)top.appendChild(visionStatus);
 if(probabilities)bottom.appendChild(probabilities);
 // Advanced tools remain available but never obstruct the live preview.
 var advanced=document.createElement('details');
 advanced.className='advanced-diagnostics';
 var caption=document.createElement('summary');
 caption.textContent='Снимка, настройки и диагностика';
 section.parentNode.insertBefore(advanced,section);
 advanced.appendChild(caption);
 advanced.appendChild(section);
 var ctx=canvas.getContext('2d');
 if(!ctx)return;
 var last=null;
 function fitCanvas(){
  var rect=preview.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  var w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  return {width:rect.width,height:rect.height};
 }
 function drawFrame(detail){
  var size=fitCanvas();
  if(!detail||!detail.result||!detail.frameWidth||!detail.frameHeight)return;
  var imageW=video.videoWidth||detail.frameWidth,imageH=video.videoHeight||detail.frameHeight;
  var fit=Math.min(size.width/imageW,size.height/imageH);
  var displayedW=imageW*fit,displayedH=imageH*fit;
  var ox=(size.width-displayedW)/2,oy=(size.height-displayedH)/2;
  var scaleX=displayedW/detail.frameWidth,scaleY=displayedH/detail.frameHeight;
  function mark(card,color,group){
   if(!card||!card.box)return;
   var b=card.box,x=ox+b.x*scaleX,y=oy+b.y*scaleY;
   var w=b.width*scaleX,h=b.height*scaleY;
   if(w<=0||h<=0)return;
   var confirmed=!!detail.confirmed&&!!card.code;
   ctx.strokeStyle=confirmed?color:'#ffd17a';
   ctx.lineWidth=confirmed?2.5:1.8;
   ctx.setLineDash(confirmed?[]:[5,4]);
   ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
   var label=group+': '+(confirmed?window.PokerMath.label(window.PokerMath.idFromCode(card.code)):'?');
   var font=Math.max(10,Math.min(14,size.width/32));
   ctx.font='bold '+font+'px -apple-system, sans-serif';
   var lw=ctx.measureText(label).width+9,ly=y>font+7?y-4:y+font+4;
   var lx=Math.max(0,Math.min(size.width-lw,x));
   ctx.fillStyle='rgba(4,16,29,.86)';
   ctx.fillRect(lx,ly-font-2,lw,font+6);
   ctx.fillStyle=confirmed?color:'#ffd17a';
   ctx.fillText(label,lx+4,ly+1);
  }
  (detail.result.board||[]).forEach(function(c){mark(c,'#69baff','Борд');});
  (detail.result.hero||[]).forEach(function(c){mark(c,'#54f9a2','Моя');});
 }
 document.addEventListener('poker:vision-frame',function(e){
  last=e.detail||null;drawFrame(last);
 });
 document.addEventListener('poker:camera-stopped',function(){
  last=null;fitCanvas();
  var stage=document.getElementById('visionStage'),hero=document.getElementById('visionHero');
  var board=document.getElementById('visionCards'),seats=document.getElementById('visionSeats');
  if(stage)stage.textContent='Етап: —';
  if(hero)hero.textContent='Моите карти: —';
  if(board)board.textContent='Общи карти: —';
  if(seats)seats.textContent='Активни ръце: —';
  if(visionStatus)visionStatus.textContent='Камерата е спряна.';
 });
 window.addEventListener('resize',function(){drawFrame(last);});
})();
