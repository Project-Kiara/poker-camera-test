/* Connects the OCR hand memory to the poker simulator without guessing an opponent's status. */
(function(root){'use strict';
var memory=root.PokerHandTracker,math=root.PokerMath;
if(!memory||!math)return;
var tracker=memory.createTracker({confirmations:3});
var unresolved=false;
function snapshot(){return tracker.snapshot();}
function observe(frame){
 var previous=snapshot(),now=tracker.observe(frame),hero=(frame&&frame.hero||[]).map(function(x){return x.code;});
 var key=hero.length===2&&hero.every(Boolean)?hero.slice().sort().join('|'):'';
 var inconsistent=!!(frame&&frame.stageConfirmed&&frame.uniqueCards&&
   frame.board&&frame.board.length>=3&&key&&now.heroIdentity&&key!==now.heroIdentity);
 unresolved=!!(!frame||frame.stageConfirmed!==true||frame.uniqueCards!==true||
   frame.temporalConflict||inconsistent);
 if(now.hand!==previous.hand)unresolved=false;
 return {state:now,handChanged:now.hand!==previous.hand,
   pending:now.resetPending>0,inconsistent:inconsistent,unstable:unresolved};
}
function context(){
 var state=snapshot();
 if(state.resetPending)throw Error('Проверява се ново раздаване; изчислението е временно спряно.');
 if(unresolved)throw Error('OCR разпознаването е противоречиво; изчислението е временно спряно.');
 function id(code){
  var id=math.idFromCode(code);
  if(id<0)throw Error('Невалиден запомнен код на карта.');
  return id;
 }
 return {dead:state.dead.map(id),
   knownOpponents:state.knownOpponents.map(function(pair){return pair.map(id);}),
   hand:state.hand};
}
function confirmOpponent(pair,status){return tracker.confirmOpponent(pair,status);}
function nextHand(){unresolved=false;return tracker.startNextHand();}
root.PokerDealBridge={observe:observe,snapshot:snapshot,context:context,
  confirmOpponent:confirmOpponent,nextHand:nextHand};
}(typeof window!=='undefined'?window:globalThis));
