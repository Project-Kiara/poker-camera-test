/* Deal-scoped memory for recognized poker cards. No automatic fold inference. */
(function(root){'use strict';
function createTracker(options){
  var required=Math.max(3,(options&&options.confirmations)||3);
  var hand=1,seen={},other={},protectedCards={},dead={},showdown={},sawBoard=false,heroId='',boardIdentity=[];
  var pending='',pendingFrames=0;
  function keys(obj){return Object.keys(obj);}
  function codes(cards){return (cards||[]).filter(function(c){return c&&typeof c.code==='string'&&/^(?:10|[2-9JQKA])[cdhs]$/.test(c.code);}).map(function(c){return c.code;});}
  function clear(){seen={};other={};protectedCards={};dead={};showdown={};sawBoard=false;heroId='';boardIdentity=[];pending='';pendingFrames=0;}
  function snapshot(){return {hand:hand,seen:keys(seen),revealedOther:keys(other),
      dead:keys(dead),knownOpponents:keys(showdown).map(function(k){return showdown[k].slice();}),
      boardSeen:sawBoard,heroIdentity:heroId,boardIdentity:boardIdentity.slice(),resetPending:pendingFrames};}
  function observe(result){
    if(!result||result.stageConfirmed!==true||result.uniqueCards!==true){pending='';pendingFrames=0;return snapshot();}
    var board=codes(result.board),hero=codes(result.hero),outs=codes(result.others);
    var hasHero=(result.hero||[]).length===2&&hero.length===2&&hero[0]!==hero[1];
    var key=hasHero?hero.slice().sort().join('|'):'';
    var preflop=result.stage==='Префлоп'&&(result.board||[]).length===0;
    var isNew=preflop&&hasHero&&(sawBoard||(heroId&&key!==heroId));
    var forced=!!(result.forceNewHand&&hasHero&&board.length>=3);
   if(forced){
     hand++;clear();
   }else if(isNew){
      pendingFrames=(pending===key)?pendingFrames+1:1;pending=key;
      // Do not put pending new cards into the previous deal before confirmation.
      if(pendingFrames<required)return snapshot();
      hand++;clear();
    }else{
      pending='';pendingFrames=0;
      // A different hero during a non-preflop stage is an inconsistent read.
      if(hasHero&&heroId&&key!==heroId)return snapshot();
    }
    if((result.board||[]).length>=3){
     sawBoard=true;
     // Store verified original board positions without changing earlier cards
     // because of an isolated OCR error.
     if(board.length===(result.board||[]).length){
       if(!boardIdentity.length)boardIdentity=board.slice();
       else for(var bi=0;bi<board.length;bi++)
         if(!boardIdentity[bi])boardIdentity[bi]=board[bi];
     }
   }
    if(hasHero&&!heroId)heroId=key;
    board.concat(hero).forEach(function(c){seen[c]=true;protectedCards[c]=true;delete other[c];});
    outs.forEach(function(c){if(!protectedCards[c]){seen[c]=true;other[c]=true;}});
    return snapshot();
  }
  function confirmOpponent(pair,kind){
    if(kind!=='folded'&&kind!=='showdown')throw Error('Invalid opponent state');
    if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||
      !other[pair[0]]||!other[pair[1]]||protectedCards[pair[0]]||protectedCards[pair[1]])
      throw Error('Two distinct observed opponent cards required');
    var key=pair.slice().sort().join('|');
    if(kind==='folded'){
      if(keys(showdown).some(function(k){return showdown[k].some(function(c){return pair.indexOf(c)>=0;});}))
        throw Error('Already assigned to showdown');
      pair.forEach(function(c){dead[c]=true;});
    }else{
      if(pair.some(function(c){return dead[c];})||keys(showdown).some(function(k){return k!==key&&showdown[k].some(function(c){return pair.indexOf(c)>=0;});}))
        throw Error('Conflicting revealed opponent hand');
      showdown[key]=pair.slice();
    }
    return snapshot();
  }
  return {observe:observe,snapshot:snapshot,confirmOpponent:confirmOpponent,
    startNextHand:function(){hand++;clear();return snapshot();}};
}
root.PokerHandTracker={createTracker:createTracker};
}(typeof window!=='undefined'?window:globalThis));
