/* Connect ACR screenshot/video recognition to the existing one-page poker calculator. */
(function(){
 'use strict';
 var vision=window.ACRVision,video=document.getElementById('camera');
 var analysis=document.getElementById('analysisPanel'),bridge=window.PokerDealBridge;
 if(!vision||!analysis||!window.PokerMath||!window.PokerCardDetector||!video||!bridge)return;
 var section=document.createElement('section');
 section.className='panel';section.id='autoRecognition';
 section.innerHTML=[
  '<h2>Автоматично разпознаване · ACR Poker</h2>',
  '<p class="hint">Поддържа 10 и T за десетка. След снимка вероятностите се обновяват автоматично само при потвърдени карти.</p>',
  '<div class="reading-summary">',
  '<p id="visionStage">Етап: —</p>',
  '<p id="visionCards" style="color:#e1f8ee">Общи карти: —</p>',
  '<p id="visionHero" style="color:#a8dcff">Моите карти: —</p>',
  '<p id="visionSeats">Активни ръце: —</p>',
  '</div>',
  '<p class="hint" id="dealMemoryLine" aria-live="polite" style="margin:3px 0 6px;font-size:11px">Раздаване 1 · видени 0 карти</p>',
  '<div id="probabilityMount"></div>',
  '<div class="capture-actions">',
  '<button type="button" class="start" id="captureFrame" disabled>📷 Снимай</button>',
  '<button type="button" class="secondary" id="uploadPhoto">Качи снимка</button>',
  '<button type="button" class="secondary" id="nativePhoto" style="grid-column:1/-1;min-height:35px">📸 Пълна снимка (до 12 MP)</button>',
  '</div>',
  '<input id="recognitionFile" type="file" accept="image/*" hidden aria-label="Качи снимка от ACR Poker">',
  '<input id="nativeCameraFile" type="file" accept="image/*" capture="environment" hidden aria-label="Снимай с максималната фотографска резолюция на задната камера">',
  '<p class="analysis-message" id="visionStatus" role="status" aria-live="polite">Включи камерата или качи снимка.</p>',
  '<details class="extra-settings">',
  '<summary>Допълнителни данни и OCR диагностика</summary>',
  '<p class="hint" id="ocrVersion">Интерфейс r17 · OCR r11 (лични карти и UI) · 17.11.2026</p>',
  '<p class="hint" id="ocrCoverage">Проверявам наличните OCR образци…</p>',
  '<p class="hint"><a href="./ocr-selftest.html?v=r8">Тест на 52 синтетични карти</a> · <a href="./ocr-regression.html?v=r8">Разширена ACR диагностика</a> · <a href="./ocr-shaded-tests.html?v=r11">Тестове за личните карти и бутоните</a></p>',
  '<div class="config-row">',
  '<label><input id="autoHero" type="checkbox" checked style="width:auto;margin-right:5px">Моите карти са долу</label>',
  '<label><input id="autoPlayers" type="checkbox" checked style="width:auto;margin-right:5px">Автоматичен брой играчи</label>',
  '</div>',
  '<p class="hint" id="visionOthers">Други открити карти: —</p>',
  '<p class="hint"><a href="./hand-memory-tests.html?v=r17">Тестове на паметта и математиката</a> · <a href="./math-benchmark.html?v=r17">Измерване на скоростта на iPhone</a></p>',
  '<p class="hint">Чуждите открити карти не са автоматично фолднали. Потвърди само двойка карти от един играч:</p>',
  '<div class="config-row"><div><label for="memoryCardA">Чужда карта 1</label><select id="memoryCardA"></select></div><div><label for="memoryCardB">Чужда карта 2</label><select id="memoryCardB"></select></div></div>',
  '<div class="capture-actions"><button type="button" class="secondary" id="confirmMemoryFold">Потвърди фолд</button><button type="button" class="secondary" id="confirmMemoryShowdown">Потвърди шоудаун</button></div>',
  '<p class="hint" id="memoryActionStatus" role="status" aria-live="polite">Няма потвърдени чужди ръце.</p>',
  '<button type="button" class="secondary" id="manualNextHand" style="width:100%;min-height:36px;font-size:12px">Ново раздаване (ръчно)</button>',
  '<div id="technicalMount"></div>',
  '<canvas id="visionDebug" hidden aria-label="Открити карти в снимката" style="width:100%;height:auto;margin-top:8px;border-radius:9px"></canvas>',
  '<details id="ocrReport"><summary>Подробна диагностика на всяка карта</summary>',
  '<div id="ocrCardReports" style="white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.4 monospace;padding:8px;background:#0d1b2b;border-radius:8px;margin-top:7px">Качи снимка, за да видиш отчета.</div>',
  '</details>',
  '<p class="fineprint">Оценката за активни играчи е по видимите ръце. Без лични карти няма надежден личен шанс. Снимките остават в браузъра.</p>',
  '</details>'
 ].join('');
 analysis.parentNode.insertBefore(section,analysis);
 var coverage=vision.templateCoverage&&vision.templateCoverage();
 var coverageLabel=document.getElementById('ocrCoverage');
 if(coverageLabel&&coverage){
  coverageLabel.textContent='OCR образци: '+coverage.ranks+'/13 стойности × '+coverage.suits+'/4 бои = '+coverage.combinations+'/52 комбинации. ACR калибрирани: '+coverage.calibratedRanks+'/13 стойности, '+coverage.calibratedSuits+'/4 бои. Останалите са резервни шрифтови образци.';
 }
 // The calculator inputs stay mounted for the existing engine but the user
 // sees one combined auto-recognition + probability panel.
 var summaryGrid=analysis.querySelector('.result-grid');
 var summaryDetails=document.getElementById('analysisDetails');
 var summaryMessage=document.getElementById('analysisMessage');
 var summaryActions=analysis.querySelector('.actions');
 var summaryNotes=analysis.querySelector('.fineprint');
 var probabilityMount=document.getElementById('probabilityMount');
 var technicalMount=document.getElementById('technicalMount');
 [summaryGrid,summaryActions,summaryMessage].forEach(function(el){
  if(el&&probabilityMount)probabilityMount.appendChild(el);
 });
 [summaryDetails,summaryNotes].forEach(function(el){
  if(el&&technicalMount)technicalMount.appendChild(el);
 });
 // Let the player correct the uncertain automatic player count and Monte Carlo strength
 // without exposing the manual card-entry form.
 var playerSettings=analysis.querySelector('.config-row');
 if(playerSettings&&technicalMount)technicalMount.appendChild(playerSettings);
 analysis.hidden=true;
 var file=document.getElementById('recognitionFile'),nativeFile=document.getElementById('nativeCameraFile'),status=document.getElementById('visionStatus');
 var captureButton=document.getElementById('captureFrame');
 var uploadButton=document.getElementById('uploadPhoto');
 uploadButton.addEventListener('click',function(){file.click();});
 document.getElementById('nativePhoto').addEventListener('click',function(){nativeFile.click();});
 var cardLine=document.getElementById('visionCards'),seatLine=document.getElementById('visionSeats');
 var heroLine=document.getElementById('visionHero'),othersLine=document.getElementById('visionOthers'),stageLine=document.getElementById('visionStage');
 var debugCanvas=document.getElementById('visionDebug');
 var ocrReports=document.getElementById('ocrCardReports');
 var contextCanvas=document.createElement('canvas'),ctx=contextCanvas.getContext('2d',{willReadFrequently:true});
 var lastSignature='',repeats=0,lastApplied='',frameWorking=false;
 var ownCodes=[],boardCodes=[],previousHeroWasAuto=false;
 var memoryLine=document.getElementById('dealMemoryLine');
 var memoryA=document.getElementById('memoryCardA'),memoryB=document.getElementById('memoryCardB');
 var memoryStatus=document.getElementById('memoryActionStatus');
 var memoryOptionsSignature=null;
 var suitSymbols={c:'♣',d:'♦',h:'♥',s:'♠'};
 function shown(code){return code?code.slice(0,-1)+suitSymbols[code.slice(-1)]:'?';}
 function notifyMemory(){document.dispatchEvent(new Event('poker:deal-changed'));}
 function clearAutoInputs(){
  var modified=false;
  ['hero0','hero1','board0','board1','board2','board3','board4','deadCards','pot','callAmount'].forEach(function(id){
   modified=changeField(id,'')||modified;
  });
  boardCodes=[];ownCodes=[];previousHeroWasAuto=false;lastApplied='';
  if(!modified)notifyMemory();
 }
 function selectMemoryOptions(el,available){
  var value=el.value;el.textContent='';
  var first=document.createElement('option');first.value='';first.textContent='— избери —';el.appendChild(first);
  available.forEach(function(code){
   var x=document.createElement('option');x.value=code;x.textContent=shown(code);el.appendChild(x);
  });
  if(available.indexOf(value)>=0)el.value=value;
 }
 function renderMemory(snap){
  var showdownCards=[].concat.apply([],snap.knownOpponents);
  var available=snap.revealedOther.filter(function(code){return snap.dead.indexOf(code)<0&&showdownCards.indexOf(code)<0;});
  memoryLine.textContent='Раздаване '+snap.hand+' · видени '+snap.seen.length+
   ' карти · фолд '+snap.dead.length+' · известни чужди ръце '+snap.knownOpponents.length+
   (snap.resetPending?' · ново раздаване? '+snap.resetPending+'/3':'');
  var signature=available.join('|');
  if(memoryOptionsSignature!==signature){
   selectMemoryOptions(memoryA,available);selectMemoryOptions(memoryB,available);
   memoryOptionsSignature=signature;
  }
 }
 function refreshMath(){
  notifyMemory();
  if(bridge.snapshot().resetPending)return;
  var run=document.getElementById('runAnalysis');
  if(run&&getField('hero0')!==''&&getField('hero1')!==''&&!run.disabled)run.click();
 }
 function confirmMemory(kind){
  var a=memoryA.value,b=memoryB.value;
  if(!a||!b||a===b){
   memoryStatus.textContent='Избери две различни карти от една и съща чужда ръка.';return;
  }
  try{
   var now=bridge.confirmOpponent([a,b],kind);renderMemory(now);
   memoryStatus.textContent=kind==='folded'?'Фолд: '+shown(a)+' '+shown(b):
     'Шоудаун: '+shown(a)+' '+shown(b);
   refreshMath();
  }catch(err){memoryStatus.textContent='Неуспешно потвърждение: '+err.message;}
 }
 document.getElementById('confirmMemoryFold').addEventListener('click',function(){confirmMemory('folded');});
 document.getElementById('confirmMemoryShowdown').addEventListener('click',function(){confirmMemory('showdown');});
 document.getElementById('manualNextHand').addEventListener('click',function(){
  var now=bridge.nextHand();clearAutoInputs();renderMemory(now);
  memoryStatus.textContent='Ново раздаване: старата памет е изчистена.';
  status.textContent='Паметта е нулирана за ново раздаване.';
  lastSignature='';repeats=0;
 });
 function ingestMemory(result){
  var update=bridge.observe(result);
  if(result.stageConfirmed!==true||result.uniqueCards!==true){
   clearAutoInputs();renderMemory(update.state);
   status.textContent='Непотвърдено разпознаване — изчисленията са спрени.';
   return false;
  }
  if(update.handChanged){
   clearAutoInputs();
   memoryStatus.textContent='Ново раздаване е потвърдено; паметта е нулирана.';
  }
  renderMemory(update.state);
  if(update.pending){
   clearAutoInputs();
   status.textContent='Проверка за ново раздаване ('+update.state.resetPending+'/3). Изчисленията са спрени.';
   return false;
  }
  if(update.inconsistent){
   clearAutoInputs();
   status.textContent='Неочаквана смяна на личните карти на ривъра. Изчислението е спряно.';
   return false;
  }
  return true;
 }
 renderMemory(bridge.snapshot());
 document.addEventListener('poker:camera-stopped',function(){
  lastSignature='';repeats=0;lastApplied='';
  clearAutoInputs();
 });
 function readRank(c){return c.rank?c.rank:'непотвърдена';}
 function readSuit(c){return c.suit?(suitSymbols[c.suit]||c.suit):'непотвърдена';}
 function diagnostics(result,sourceInfo){
  var regions={};result.board.forEach(function(c){regions[c.box.x+','+c.box.y]='Борд';});
  result.hero.forEach(function(c){regions[c.box.x+','+c.box.y]='Лични';});
  result.others.forEach(function(c){regions[c.box.x+','+c.box.y]='Други';});
  var cards=result.visible.slice().sort(function(a,b){return a.box.y-b.box.y||a.box.x-b.box.x;});
  var lines=['OCR версия: r11 | '+(vision.templateCoverage?'13 стойности и 4 бои са представени в образците':'проверка на образците недостъпна'),
    sourceInfo?'Източник: '+sourceInfo.originalWidth+'×'+sourceInfo.originalHeight+' → OCR: '+sourceInfo.ocrWidth+'×'+sourceInfo.ocrHeight+(sourceInfo.canonical?' (каноничен мащаб ACR)':' (общ мащаб)'):'Източник: видео кадър',
    'Открити правоъгълници: '+cards.length,
    'Игнорирани обекти от областта на бутоните: '+(result.ignoredUiBoxes||0),
    'Потвърдени стойност+боя: '+cards.filter(function(c){return !!c.code;}).length,
    'Непотвърдени: '+cards.filter(function(c){return !c.code;}).length];
  cards.forEach(function(c,i){
   var x=c.box.x,y=c.box.y;
   var scoreRank=typeof c.rankScore==='number'?c.rankScore+'%':'няма';
   var scoreSuit=typeof c.suitScore==='number'?c.suitScore+'%':'няма';
   lines.push('#'+(i+1)+' '+(regions[x+','+y]||'Неуточнена')+
    ' | рамка ('+Math.round(x)+','+Math.round(y)+') '+Math.round(c.box.width)+'×'+Math.round(c.box.height)+
    (c.box.shaded?' | възстановена затъмнена карта':'') );
   lines.push('  Стойност: '+readRank(c)+' | сходство '+scoreRank+
    ' | разлика '+(c.rankMargin==null?'—':c.rankMargin+' пункта'));
   lines.push('  Боя: '+readSuit(c)+' | сходство '+scoreSuit+
    ' | разлика '+(c.suitMargin==null?'—':c.suitMargin+' пункта'));
   lines.push('  Източник на образците: стойност '+(c.rankSource||'неизвестен')+', боя '+(c.suitSource||'неизвестен'));
   lines.push('  Крайно: '+(c.code?shown(c.code):'НЕПОТВЪРДЕНА')+
    (c.code?'':' | най-близък образец '+(c.guess?shown(c.guess):'няма'))+
    ' | '+(c.reason||'потвърдено'));
  });
  ocrReports.textContent=lines.join('\n');
 }
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
  var previousBoard=boardCodes.slice();
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
  } else if(boardCodes.length){
   // Invalidate stale auto-recognized community cards as soon as the new screenshot is incomplete.
   // Never leave a previous board in the calculator while displaying '?' in the recognition panel.
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
   // At showdown animations often obscure one corner. Preserve the last
   // confirmed own hand ONLY on the same board and the same tracked deal.
   // Never infer a missing card from its large suit or from the winning hand.
   var memory=bridge.snapshot();
   var stableHero=ownCodes.length===2&&
     memory.heroIdentity===ownCodes.slice().sort().join('|');
   var boardMatches=previousBoard.length>=3&&result.boardComplete&&
     board.length>=previousBoard.length&&
     previousBoard.every(function(code,i){return board[i].code===code;});
   if(stableHero&&boardMatches){
    heroLine.textContent='Моите карти (запомнени от предишен четлив кадър): '+
      ownCodes.map(shown).join(' ');
    status.textContent='Част от личните карти е закрита. Запазвам по-рано потвърдената ръка за същото раздаване.';
   }else{
    changed=changeField('hero0','')||changed;
    changed=changeField('hero1','')||changed;
    previousHeroWasAuto=false;
    ownCodes=[];
   }
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
 function inspect(img,confirmed,sourceInfo){
  var start=Date.now();
  var result=vision.analyze(img);
  emitText(result,confirmed);
  diagnostics(result,sourceInfo);
  seatLine.textContent+=' · обработка '+(Date.now()-start)+' ms';
  if(confirmed&&ingestMemory(result)){
   applyResult(result);
   // A still photograph is an independent analysis request: recalculate even
   // when the cards match the previous video frame.
   if(sourceInfo && sourceInfo.originalWidth &&
      getField('hero0')!=='' && getField('hero1')!==''){
     var run=document.getElementById('runAnalysis');
     if(run && !run.disabled)run.click();
   }
  }
  return result;
 }
 function canvasImage(element,fullResolution){
  var w=element.videoWidth||element.naturalWidth,h=element.videoHeight||element.naturalHeight;
  if(!w||!h)throw new Error('Няма изображение');
  // The calibrated ACR glyph masks were made at approximately 709px screenshot width.
  // A 1179px iPhone screenshot used to be reduced only to the 2MP cap (~961px).
  // This changes a small "5" glyph enough to make its rank margin fail.
  // Normalize ACR portrait screenshots to the template's reference scale BEFORE OCR.
  var isAcrPortrait=!!fullResolution&&w>=709&&h/w>=1.9&&h/w<=2.45;
  var factor=isAcrPortrait?709/w:
    Math.min(1,fullResolution?1:1280/w,Math.sqrt(2000000/(w*h)));
  contextCanvas.width=Math.max(1,Math.round(w*factor));
  contextCanvas.height=Math.max(1,Math.round(h*factor));
  ctx.imageSmoothingEnabled=true;
  if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
  ctx.clearRect(0,0,contextCanvas.width,contextCanvas.height);
  ctx.drawImage(element,0,0,contextCanvas.width,contextCanvas.height);
  return ctx.getImageData(0,0,contextCanvas.width,contextCanvas.height);
 }
 // Freeze the CURRENT already-authorized video frame, without reopening camera.
 captureButton.addEventListener('click',function(){
  if(video.readyState<2||!video.videoWidth||!video.videoHeight||video.paused){
   status.textContent='Първо включи камерата и изчакай картината.';
   return;
  }
  try{
   var frame=canvasImage(video,true);
   var result=inspect(frame,true,{
    originalWidth:video.videoWidth,originalHeight:video.videoHeight,
    ocrWidth:frame.width,ocrHeight:frame.height,canonical:false
   });
   drawDebug(video,frame,result);
   lastSignature='';repeats=0;lastApplied='';
   status.textContent='Видео кадър: '+video.videoWidth+' × '+video.videoHeight+'; OCR: '+frame.width+' × '+frame.height+'. '+result.faceCount+' открити карти; '+result.visible.filter(function(c){return !!c.code;}).length+' разчетени.';
  }catch(err){
   status.textContent='Кадърът не можа да се обработи: '+err.message;
  }
 });

 function processImageInput(sourceInput){
  if(!sourceInput.files||!sourceInput.files[0])return;
  var source=URL.createObjectURL(sourceInput.files[0]),img=new Image();
  status.textContent='Обработвам снимката…';
  img.onload=function(){
   try{
    // Keep original resolution when possible for reading small glyphs.
    var frame=canvasImage(img,true),result=inspect(frame,true,{
     originalWidth:img.naturalWidth,originalHeight:img.naturalHeight,
     ocrWidth:frame.width,ocrHeight:frame.height,
     canonical:img.naturalWidth>=709&&img.naturalHeight/img.naturalWidth>=1.9&&img.naturalHeight/img.naturalWidth<=2.45
    });
    drawDebug(img,frame,result);
    lastSignature='';repeats=0;lastApplied='';
    var sourceDimensions=img.naturalWidth+' × '+img.naturalHeight+' ('+
      (img.naturalWidth*img.naturalHeight/1000000).toFixed(1)+' MP)';
    if(!bridge.snapshot().resetPending&&result.faceCount&&result.visible.every(function(c){return !!c.code;}))
      status.textContent='Оригинална снимка: '+sourceDimensions+'. '+result.faceCount+
        ' разчетени карти. OCR обработва оптимизирано копие.';
    else
      status.textContent='Оригинална снимка: '+sourceDimensions+'. '+result.faceCount+
        ' открити карти; има неясни или непотвърдени символи. OCR обработва оптимизирано копие.';
   }catch(err){status.textContent='Неуспешно разчитане: '+err.message;}
   URL.revokeObjectURL(source);
   sourceInput.value=''; // Enable retesting the same image without a full page reload.
  };
  img.onerror=function(){status.textContent='Снимката не може да се отвори.';URL.revokeObjectURL(source);sourceInput.value='';};
  img.src=source;
 }
 file.addEventListener('change',function(){processImageInput(file);});
 nativeFile.addEventListener('change',function(){processImageInput(nativeFile);});
 function tick(){
  captureButton.disabled=!(video.readyState>=2&&video.videoWidth&&!video.paused);
  if(frameWorking){setTimeout(tick,650);return;}
  if(video.readyState>=2&&video.videoWidth&&!video.paused){
   frameWorking=true;
   try{
    var startedAt=Date.now();
    var frame=canvasImage(video,true);
    var result=vision.analyze(frame);
    var signature=result.stage+','+result.board.map(function(c){return c.code||'?';}).join('|')+','+
       result.hero.map(function(c){return c.code||'?';}).join('|')+','+result.coveredHands;
    repeats=signature===lastSignature?repeats+1:1;
    lastSignature=signature;
    var isStable=repeats>=2;
    emitText(result,isStable);
    document.dispatchEvent(new CustomEvent('poker:vision-frame',{detail:{
     result:result,confirmed:isStable,frameWidth:frame.width,frameHeight:frame.height
    }}));
    if(isStable)diagnostics(result);
    seatLine.textContent+=' · обработка '+(Date.now()-startedAt)+' ms';
    if(isStable){
     var accept=ingestMemory(result);
     if(accept&&lastApplied!==signature){applyResult(result);lastApplied=signature;}
    }
   }catch(err){status.textContent='Грешка при разпознаване: '+err.message;}
   frameWorking=false;
  }
  setTimeout(tick,650);
 }
 setTimeout(tick,650);
})();
