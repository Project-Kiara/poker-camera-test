/* ACR OCR temporal tracker: positional memory within a confirmed deal.
 * A slot is stable only after repeated independent rank/suit observations.
 * Never fabricate cards when no actual card rectangle is visible.
 * Conflicting OCR cannot silently replace a locked card mid-hand.
 */
(function(root){
 'use strict';
 var WINDOW_MS=6500,LOCK_MS=12000;
 function createTracker(){
  var slots={board:[],hero:[]},stage='',preflopFrames=0;
  var newCandidate='',newCandidateFrames=0;
  function reset(){
   slots={board:[],hero:[]};stage='';preflopFrames=0;
   newCandidate='';newCandidateFrames=0;
  }
  function validCode(c){return typeof c==='string'&&/^(?:10|[2-9JQKA])[cdhs]$/.test(c);}
  function sameBox(track,b){
   if(!track||!b)return false;
   var w=Math.max(1,b.width),h=Math.max(1,b.height);
   return Math.abs((b.x+b.width/2)-track.cx)<w*.85&&
    Math.abs((b.y+b.height/2)-track.cy)<h*.85&&
    Math.abs(w-track.w)<w*.55&&Math.abs(h-track.h)<h*.55;
  }
  function rawKey(cards){
   return cards.length===2&&cards.every(function(c){return c&&validCode(c.code);})?
    cards.map(function(c){return c.code;}).sort().join('|'):'';
  }
  function observe(result,now){
   now=typeof now==='number'?now:Date.now();
   if(!result||result.stageConfirmed!==true||result.uniqueCards!==true){
    // A bad frame is not evidence of a new hand; retain internal memory, but
    // do not emit a completed board from this untrusted frame.
    if(result)result.boardComplete=false;
    // Never combine evidence separated by an untrusted/ambiguous frame.
    // Completed locks survive, but partial votes are invalidated.
    ['board','hero'].forEach(function(kind){slots[kind].forEach(function(t){
      if(t)t.samples=[];
    });});
    return result;
   }
   var board=result.board||[],hero=result.hero||[];
   var rawHero=rawKey(hero);
   var lockedHero=rawKey(slots.hero.map(function(x){
    return x?{code:x.locked}:null;
   }));
   var boardChanged=0,recognizedBoard=0;
   for(var u=0;u<Math.min(3,board.length);u++){
    if(validCode(board[u].code)){
     recognizedBoard++;
     if(slots.board[u]&&slots.board[u].locked&&
       board[u].code!==slots.board[u].locked)boardChanged++;
    }
   }
   // A mid-street replacement of BOTH personal cards plus multiple community
   // cards is stronger evidence of a new deal than a single OCR glitch.
   var ownChanges=rawHero&&lockedHero&&rawHero!==lockedHero&&
     hero.every(function(c,i){return slots.hero[i]&&slots.hero[i].locked&&
       c.code!==slots.hero[i].locked;});
   var newFullBoard=recognizedBoard===3&&board.length>=3;
   var oldBoardSize=slots.board.filter(function(x){return x&&x.locked;}).length;
   var lateDeal=ownChanges&&newFullBoard&&
      (boardChanged>=2||oldBoardSize<2);
   var preflop=result.stage==='Префлоп'&&board.length===0;
   // A new board may become visible before both personal cards become
   // legible. Otherwise one obscured corner can lock the old deal forever.
   var anyNewHero=hero.some(function(c,i){
    return validCode(c.code)&&slots.hero[i]&&slots.hero[i].locked&&
      c.code!==slots.hero[i].locked;
   });
   var newBoardOnly=newFullBoard&&oldBoardSize>=3&&boardChanged>=2&&
      (anyNewHero||board.length<oldBoardSize||boardChanged===3);
   var missingOldCommunity=oldBoardSize>=4&&board.length>=3&&
      board.length<oldBoardSize&&!newBoardOnly;
   // When the camera missed the old flop/river, both deals can appear as
   // consecutive preflops. Previously the old hero was locked forever:
   // every correctly read new hero was discarded as a contradiction.
   var preflopReplacement=preflop&&stage==='Префлоп'&&
      ownChanges&&hero.length===2&&hero.every(function(c){return validCode(c.code);});
   if(lateDeal||preflopReplacement||newBoardOnly){
    var signature=(preflopReplacement?'P:':'B:')+
      (rawHero||hero.map(function(c){return validCode(c.code)?c.code:'?';}).join('|'))+
      '|'+(preflopReplacement?'':board.slice(0,3).map(function(c){return c.code;}).join('|'));
    newCandidateFrames=signature===newCandidate?newCandidateFrames+1:1;
    newCandidate=signature;
    result.temporalPending=newCandidateFrames;
    // Without two confirmed personal cards require stronger board evidence.
    var requiredFrames=newBoardOnly&&!rawHero&&board.length>=oldBoardSize?4:3;
    if(newCandidateFrames>=requiredFrames){
     // The new OCR identity has independently persisted for 3 frames;
     // reset both card slots and the deal memory as one transition.
     reset();
     result.forceNewHand=true;
     result.temporalConflict=false;
    }else{
     // Do not present the tentative cards as confirmed, and do not
     // overwrite any old slot while the new deal is being verified.
     hero.forEach(function(card){
      if(validCode(card.code)){card.pendingCode=card.code;card.code=null;}
     });
     result.temporalConflict=true;
     result.boardComplete=false;
     result.temporalReason='new-deal-candidate';
     return result;
    }
   }else{newCandidate='';newCandidateFrames=0;}
   if(missingOldCommunity){
    // The previously confirmed turn/river cannot become a flop merely
    // because its last card escaped a single frame's rectangle detector.
    result.temporalConflict=true;
    result.temporalReason='missing-board-card';
    result.boardComplete=false;
    return result;
   }
   // Preflop following a street is a potential new hand. Do not carry locked
   // board/hero cards over that boundary, but require repeated observations.
   if(preflop&&stage&&stage!=='Префлоп'&&hero.length===2){
    preflopFrames++;
    result.temporalPending=preflopFrames;
    if(preflopFrames<2){
     result.temporalConflict=true;
     result.boardComplete=false;
     return result;
    }
    reset();
   }else if(!preflop)preflopFrames=0;
   if(!stage||!result.temporalConflict)stage=result.stage;
   var touched=[];
   function reconcile(kind,cards){
    for(var i=0;i<cards.length;i++){
     var card=cards[i],b=card&&card.box;
     if(!b)continue;
     var tr=slots[kind][i];
     if(tr&&!sameBox(tr,b))tr=null;
     if(!tr)tr={samples:[],locked:null,lockedAt:0,conflict:'',conflicts:0};
     tr.cx=b.x+b.width/2;tr.cy=b.y+b.height/2;
     tr.w=b.width;tr.h=b.height;tr.last=now;
     slots[kind][i]=tr;
     touched.push({card:card,track:tr});
     var code=validCode(card.code)?card.code:null;
     var rank=card.rank||null,suit=card.suit||null;
     var colorError=card.reason==='Несъответствие между цвят и боя';
     if(code){rank=code.slice(0,-1);suit=code.slice(-1);}
     tr.samples=tr.samples.filter(function(s){return now-s.time<=WINDOW_MS;});
     if(tr.locked){
      var lockRank=tr.locked.slice(0,-1),lockSuit=tr.locked.slice(-1);
      if((code&&code!==tr.locked)||(rank&&rank!==lockRank)||(suit&&suit!==lockSuit)){
       tr.conflicts=tr.conflict===code||(!code&&tr.conflict===rank+suit)?
         tr.conflicts+1:1;
       tr.conflict=code||rank+suit;
       // Keep a contradictory card undecided, never overwrite a confirmed
       // identity with a guessed replacement in the same hand.
       card.code=null;card.rank=null;card.suit=null;
       card.temporalConflict=true;
       result.temporalConflict=true;
       continue;
      }
      tr.conflicts=0;tr.conflict='';
      if(colorError){card.code=null;continue;}
      // The rectangle is still visible and no recognized glyph contradicts
      // the previous locked identity. Keep that card briefly while OCR blurs.
      if(now-tr.lockedAt<=LOCK_MS){
       card.code=tr.locked;card.rank=lockRank;card.suit=lockSuit;
       if(!code){
        card.temporal=true;card.remembered=true;
        card.reason='Запомнена карта от същата позиция в раздаването';
       }
       // A remembered placeholder must not extend the time-to-live of
       // its own evidence. Only a fresh complete OCR reading does that.
       if(code===tr.locked&&!card.reused)tr.lockedAt=now;
      }
      continue;
     }
     if(colorError)continue;
     if(rank||suit)tr.samples.push({rank:rank,suit:suit,time:now});
     tr.samples=tr.samples.slice(-6);
     var r={},s={};
     tr.samples.forEach(function(p){
      if(p.rank)r[p.rank]=(r[p.rank]||0)+1;
      if(p.suit)s[p.suit]=(s[p.suit]||0)+1;
     });
     var ranks=Object.keys(r).filter(function(k){return r[k]>=2;});
     var suits=Object.keys(s).filter(function(k){return s[k]>=2;});
     // Mixed observations can be fused only when there is ONE unambiguous
     // candidate for each symbol, with at least two supporting frames each.
     if(ranks.length===1&&suits.length===1&&
        Object.keys(r).length===1&&Object.keys(s).length===1){
      tr.locked=ranks[0]+suits[0];tr.lockedAt=now;
      if(!code){
       card.code=tr.locked;card.rank=ranks[0];card.suit=suits[0];
       card.temporal=true;
       card.reason='Два потвърдени кадъра за стойност и боя';
      }
     }
    }
   }
   reconcile('board',board);
   reconcile('hero',hero);
   var combined=board.concat(hero),counts={};
   combined.forEach(function(c){
    if(validCode(c.code))counts[c.code]=(counts[c.code]||0)+1;
   });
   if(Object.keys(counts).some(function(k){return counts[k]>1;})){
    // Reject only entries inferred from memory; if the raw OCR itself sees a
    // duplicated card the whole frame remains invalid.
    combined.forEach(function(c){
     if(counts[c.code]>1&&c.temporal){
      c.code=null;c.temporalConflict=true;result.temporalConflict=true;
     }
    });
    counts={};combined.forEach(function(c){
     if(validCode(c.code))counts[c.code]=(counts[c.code]||0)+1;
    });
   }
   result.uniqueCards=!Object.keys(counts).some(function(k){return counts[k]>1;});
   if(result.temporalConflict){
    result.boardComplete=false;
    return result;
   }
   result.boardComplete=board.length>=3&&board.length<=5&&
     board.every(function(c){return validCode(c.code);})&&result.uniqueCards;
   return result;
  }
  function lockedSlots(now){
   now=typeof now==='number'?now:Date.now();
   var output={board:[],hero:[]};
   ['board','hero'].forEach(function(kind){
    slots[kind].forEach(function(track,i){
     if(!track||!track.locked||now-track.lockedAt>LOCK_MS||
        now<track.lockedAt)return;
     output[kind][i]={code:track.locked,at:track.lockedAt,
      box:{x:track.cx-track.w/2,y:track.cy-track.h/2,
       width:track.w,height:track.h}};
    });
   });
   return output;
  }
  return {observe:observe,reset:reset,lockedSlots:lockedSlots};
 }
 root.ACRTemporal={createTracker:createTracker};
}(typeof window!=='undefined'?window:globalThis));