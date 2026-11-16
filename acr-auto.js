/* Connect ACR screenshot/video recognition to the existing one-page poker calculator. */
(function(){
 'use strict';
 var vision=window.ACRVision,video=document.getElementById('camera');
 var analysis=document.getElementById('analysisPanel');
 if(!vision||!analysis||!window.PokerMath||!window.PokerCardDetector||!video)return;
 var section=document.createElement('section');
 section.className='panel';section.id='autoRecognition';
 section.innerHTML=
 '<h2>Автоматично разпознаване · ACR Poker</h2>'+
 '<p class="hint">Пробен режим: разчитане на видимите карти от камерата или от снимка. Неразпознатите карти не се отгатват.</p>'+
 '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">'+
 '<label style="margin:0"><input id="autoHero" type="checkbox" checked style="width:auto;margin-right:5px">Моите карти са долу</label>'+
 '<label style="margin:0"><input id="autoPlayers" type="checkbox" checked style="width:auto;margin-right:5px">Автоматичен брой играчи</label></div>'+
 '<label for="recognitionFile">Тест със снимка от ACR Poker</label>'+
 '<input id="recognitionFile" type="file" accept="image/*" style="width:100%">'+
 '<canvas id="visionDebug" hidden aria-label="Преглед на откритите зони в снимката" style="width:100%;height:auto;margin-top:10px;border-radius:9px"></canvas>'+
 '<p class="analysis-message" id="visionStatus" role="status" aria-live="polite">Камерата не е стартирана. Можеш да избереш снимка.</p>'+
 '<p class="hint" id="visionStage" style="margin:6px 0">Етап: —</p>'+
 '<p id="visionCards" style="font-size:16px;font-weight:700;color:#e1f8ee;word-break:break-word;margin:7px 0">Общи карти: —</p>'+
 '<p id="visionHero" style="font-size:16px;font-weight:700;color:#a8dcff;word-break:break-word;margin:7px 0">Моите карти: —</p>'+
 '<p class="hint" id="visionOthers" style="margin:6px 0">Други открити карти: —</p>'+
 '<p class="hint" id="visionSeats">Активни ръце: —</p>'+
 '<p class="fineprint">Снимките и видеокадрите не се изпращат. Оценката за броя активни играчи е по видимите покрити ръце, а не по всички места на масата. При скрити лични карти няма достатъчно информация за личен шанс.</p>';
 analysis.parentNode.insertBefore(section,analysis);
 // Keep the calculated probabilities directly below the camera/recognition area.
 var summaryGrid=analysis.querySelector('.result-grid');
 var summaryDetails=document.getElementById('analysisDetails');
 var summaryMessage=document.getElementById('analysisMessage');
 var seats=document.getElementById('visionSeats');
 if(summaryGrid&&summaryDetails&&summaryMessage&&seats){
   seats.insertAdjacentElement('afterend',summaryMessage);
   summaryMessage.insertAdjacentElement('afterend',summaryGrid);
   summaryGrid.insertAdjacentElement('afterend',summaryDetails);
 }
 var css=document.createElement('style');
 css.textContent='#autoRecognition input[type="file"]{background:#203247;color:#f4f7fb;border:1px solid #52647b;padding:9px;border-radius:10px;font-size:14px}'+
 '.preview{aspect-ratio:auto;height:clamp(140px,32vh,240px)}#autoRecognition{margin-top:10px}';
 document.head.appendChild(css);
 var file=document.getElementById('recognitionFile'),status=document.getElementById('visionStatus');
 var cardLine=document.getElementById('visionCards'),seatLine=document.getElementById('visionSeats');
 var heroLine=document.getElementById('visionHero'),othersLine=document.getElementById('visionOthers'),stageLine=document.getElementById('visionStage');
 var debugCanvas=document.getElementById('visionDebug');
 var contextCanvas=document.createElement('canvas'),ctx=contextCanvas.getContext('2d',{willReadFrequently:true});
 var lastSignature='',repeats=0,lastApplied='',frameWorking=false;
 var ownCodes=[],boardCodes=[],previousHeroWasAuto=false;
 var suitSymbols={c:'♣',d:'♦',h:'♥',s:'♠'};
 function shown(code){return code?code.slice(0,-1).replace('T','10')+suitSymbols[code.slice(-1)]:'?';}
 function getField(id){var e=document.getElementById(id);return e?e.value:'';}
 function changeField(id,value){
  var e=document.getElementById(id);if(!e||e.value===String(value))return false;
  e.value=String(value);e.dispatchEvent(new Event('change',{bubbles:true}));return true;
 }
 function emitText(result,confirmed){
  function list(cards){return cards.map(function(c){return c.code?shown(c.code):'?';}).join(' ')||'няма';}
  cardLine.textContent='Общи карти (борд): '+list(result.board);
  heroLine.textContent='Моите две карти: '+list(result.hero);
  othersLine.textContent='Други открити карти (не се смесват с борда): '+list(result.others);
  stageLine.textContent='Етап: '+result.stage+
    (result.stageConfirmed?'':' · не е потвърден')+
    ' · '+result.board.length+'/5 общи карти';
  seatLine.textContent='Активни ръце по видимите карти: '+result.activePlayers+
   ' (покрити двойки: '+result.coveredHands+', открита лична ръка: '+(result.hero.length===2?1:0)+')'+
   (confirmed?' · стабилен кадър':' · проверява се');
  var unknown=result.visible.filter(function(c){return !c.code;}).length;
  if(!result.uniqueCards)status.textContent='Повтаряща се карта между личната ръка и борда. Не обновявам анализа.';
  else if(unknown)status.textContent='Нечетливи символи: '+unknown+'. Не попълвам непотвърдените карти.';
  else if(!result.stageConfirmed)status.textContent='Не мога да потвърдя дали има общи карти. Нужна е по-ясна снимка.';
  else if(result.boardComplete)status.textContent='Разчетен '+result.stage.toLowerCase()+' с '+result.board.length+' общи карти.'+
    (getField('hero0')!==''&&getField('hero1')!==''?' Анализът може да се обнови.':' Личните карти още не са известни.');
  else if(result.hero.length===2)status.textContent='Разпознати лични карти; '+result.stage.toLowerCase()+'.';
  else status.textContent='Личните карти не са потвърдени; не гадая тяхната стойност.';
 }
 function drawDebug(img,frame,result){
  var maxW=660,scale=Math.min(1,maxW/frame.width),w=Math.round(frame.width*scale),h=Math.round(frame.height*scale);
  if(!w||!h)return;
  debugCanvas.width=w;debugCanvas.height=h;debugCanvas.hidden=false;
  var dc=debugCanvas.getContext('2d');dc.drawImage(img,0,0,w,h);
  function mark(box,color,text){
   dc.strokeStyle=color;dc.lineWidth=2.5;dc.strokeRect(box.x*scale,box.y*scale,box.width*scale,box.height*scale);
   dc.font='bold 12px sans-serif';
   var x=box.x*scale,y=Math.max(15,box.y*scale-3);
   var mw=dc.measureText(text).width+8;
   dc.fillStyle='rgba(5,13,20,.85)';dc.fillRect(x,y-13,mw,16);
   dc.fillStyle=color;dc.fillText(text,x+4,y-1);
  }
  result.others.forEach(function(c){mark(c.box,'#b9b4c6','Друга');});
  result.board.forEach(function(c){mark(c.box,'#79edab','Борд');});
  result.hero.forEach(function(c){mark(c.box,'#85cbff','Моя');});
  (result.backPairs||[]).forEach(function(pair){pair.forEach(function(b){mark(b,'#ffd483','Активен');});});
 }
 function applyResult(result){
  var changed=false;
  var board=result.board,hero=result.hero;
  // Only write complete, consistently recognized face-up groups.
  if(result.uniqueCards&&result.boardComplete&&board.length>=3&&board.length<=5){
   var newBoard=board.map(function(c){return c.code;});
   if(newBoard.join('|')!==boardCodes.join('|')){
    for(var b=0;b<5;b++){
      var id=b<newBoard.length?window.PokerMath.idFromCode(newBoard[b]):'';
      changed=changeField('board'+b,id)||changed;
    }
    boardCodes=newBoard;
   }
  } else if(result.stageConfirmed&&board.length===0&&result.others.length===0&&boardCodes.length){
   for(var q=0;q<5;q++)changed=changeField('board'+q,'')||changed;
   boardCodes=[];
  }
  // The bottom face-up pair is attributed to hero only if the user chooses that rule.
  var hasHero=hero.length===2&&hero.every(function(c){return !!c.code;});
  if(result.uniqueCards&&document.getElementById('autoHero').checked&&hasHero){
   ownCodes=hero.map(function(c){return c.code;});
   changed=changeField('hero0',window.PokerMath.idFromCode(ownCodes[0]))||changed;
   changed=changeField('hero1',window.PokerMath.idFromCode(ownCodes[1]))||changed;
   previousHeroWasAuto=true;
  } else if(!hasHero&&previousHeroWasAuto){
   // Do not leave a stale automatically-recognized hole hand after it disappears.
   changed=changeField('hero0','')||changed;
   changed=changeField('hero1','')||changed;
   previousHeroWasAuto=false;
  }
  // Only count known distinct visible pairs; never infer unseen occupied seats.
  if(document.getElementById('autoPlayers').checked&&result.hero.length===2&&
      getField('hero0')!==''&&getField('hero1')!==''&&result.activePlayers>=2){
   changed=changeField('players',Math.min(9,result.activePlayers))||changed;
  }
  if(changed&&result.uniqueCards&&result.stageConfirmed&&
     getField('hero0')!==''&&getField('hero1')!==''&&
     (board.length===0||result.boardComplete)){
    var run=document.getElementById('runAnalysis');
    if(run&&!run.disabled)run.click();
  }
 }
 function inspect(img,confirmed){
  var start=Date.now();
  var result=vision.analyze(img);
  emitText(result,confirmed);
  seatLine.textContent+=' · обработка '+(Date.now()-start)+' ms';
  if(confirmed)applyResult(result);
  return result;
 }
 function canvasImage(element,fullResolution){
  var w=element.videoWidth||element.naturalWidth,h=element.videoHeight||element.naturalHeight;
  if(!w||!h)throw new Error('Няма изображение');
  var factor=Math.min(1,fullResolution?1:1280/w,Math.sqrt(2000000/(w*h)));
  contextCanvas.width=Math.max(1,Math.round(w*factor));
  contextCanvas.height=Math.max(1,Math.round(h*factor));
  ctx.drawImage(element,0,0,contextCanvas.width,contextCanvas.height);
  return ctx.getImageData(0,0,contextCanvas.width,contextCanvas.height);
 }
 file.addEventListener('change',function(){
  if(!file.files||!file.files[0])return;
  var source=URL.createObjectURL(file.files[0]),img=new Image();
  status.textContent='Обработвам снимката…';
  img.onload=function(){
   try{
    // Keep original resolution when possible for reading small glyphs.
    var frame=canvasImage(img,true),result=inspect(frame,true);
    drawDebug(img,frame,result);
    lastSignature='';repeats=0;lastApplied='';
    if(result.faceCount&&result.visible.every(function(c){return !!c.code;}))
       status.textContent='Снимката е обработена: '+result.faceCount+' четливи открити карти. '+(getField('hero0')!==''?'':'Личните карти не се виждат.');
   }catch(err){status.textContent='Неуспешно разчитане: '+err.message;}
   URL.revokeObjectURL(source);
  };
  img.onerror=function(){status.textContent='Снимката не може да се отвори.';URL.revokeObjectURL(source);};
  img.src=source;
 });
 function tick(){
  if(frameWorking){setTimeout(tick,650);return;}
  if(video.readyState>=2&&video.videoWidth&&!video.paused){
   frameWorking=true;
   try{
    var startedAt=Date.now();
    var result=vision.analyze(canvasImage(video,false));
    var signature=result.stage+','+result.board.map(function(c){return c.code||'?';}).join('|')+','+
       result.hero.map(function(c){return c.code||'?';}).join('|')+','+result.coveredHands;
    repeats=signature===lastSignature?repeats+1:1;
    lastSignature=signature;
    var isStable=repeats>=2;
    emitText(result,isStable);
    seatLine.textContent+=' · обработка '+(Date.now()-startedAt)+' ms';
    if(isStable&&lastApplied!==signature){applyResult(result);lastApplied=signature;}
   }catch(err){status.textContent='Грешка при разпознаване: '+err.message;}
   frameWorking=false;
  }
  setTimeout(tick,650);
 }
 setTimeout(tick,650);
})();
