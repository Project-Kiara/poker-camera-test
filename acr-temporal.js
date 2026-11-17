/* ACR temporal OCR: combine independently verified partial rank/suit readings
 * across nearby video frames. Never infer a symbol from an unreadable frame.
 */
(function(root){
 'use strict';
 function createTracker(){
  var stage='',tracks={board:[],hero:[]};
  function reset(){tracks={board:[],hero:[]};stage='';}
  function observe(result,now){
   now=typeof now==='number'?now:Date.now();
   if(!result||!result.stageConfirmed||!result.uniqueCards){
    reset();return result;
   }
   if(stage&&result.stage!==stage)reset();
   stage=result.stage;
   var changes=[];
   function reconcile(kind,cards){
    var old=tracks[kind],next=[],used=[];
    cards.forEach(function(card){
     if(!card||!card.box)return;
     var b=card.box,cx=b.x+b.width/2,cy=b.y+b.height/2;
     var nearest=null,distance=Infinity;
     old.forEach(function(track){
      if(used.indexOf(track)!==-1||now-track.last>2800)return;
      var dx=Math.abs(cx-track.cx)/Math.max(1,b.width);
      var dy=Math.abs(cy-track.cy)/Math.max(1,b.height);
      var dw=Math.abs(b.width-track.w)/Math.max(1,b.width);
      var dh=Math.abs(b.height-track.h)/Math.max(1,b.height);
      var diff=dx+dy+dw+dh;
      if(dx<.28&&dy<.30&&dw<.30&&dh<.30&&diff<distance){
       nearest=track;distance=diff;
      }
     });
     var track=nearest||{samples:[]};
     if(nearest)used.push(nearest);
     track.cx=cx;track.cy=cy;track.w=b.width;track.h=b.height;track.last=now;
     var rank=card.rank||null,suit=card.suit||null;
     // Invalidate observations when a new visible identity conflicts with
     // the old evidence at the same seat/location (e.g., next deal).
     if(track.samples.some(function(sample){
      return (rank&&sample.rank&&sample.rank!==rank)||
       (suit&&sample.suit&&sample.suit!==suit);
     }))track.samples=[];
     if(rank||suit)track.samples.push({rank:rank,suit:suit,t:now});
     track.samples=track.samples.filter(function(s){return now-s.t<=2800;}).slice(-4);
     next.push(track);
     // Never bypass contradictory ink-colour validation.
     if(card.code||!(rank||suit)||card.reason==='Несъответствие между цвят и боя')return;
     var ranks={},suits={};
     track.samples.forEach(function(s){
      if(s.rank)ranks[s.rank]=(ranks[s.rank]||0)+1;
      if(s.suit)suits[s.suit]=(suits[s.suit]||0)+1;
     });
     var rk=Object.keys(ranks),sk=Object.keys(suits);
     if(rk.length!==1||sk.length!==1||ranks[rk[0]]<2||suits[sk[0]]<2)return;
     // One of the two symbols must be visible in the current frame.
     if(rank&&rank!==rk[0]||suit&&suit!==sk[0])return;
     card.code=rk[0]+sk[0];
     card.rank=rk[0];card.suit=sk[0];card.temporal=true;
     card.reason='Стойността и боята са потвърдени в няколко кадъра';
     changes.push(card);
    });
    tracks[kind]=next;
   }
   reconcile('board',result.board||[]);
   reconcile('hero',result.hero||[]);
   var codes=(result.board||[]).concat(result.hero||[])
     .filter(function(x){return !!x.code;}).map(function(x){return x.code;});
   if(new Set(codes).size!==codes.length){
    // On any collision, discard temporal completions, not the underlying OCR.
    changes.forEach(function(card){card.code=null;card.temporal=false;
      card.reason='Конфликт между разпознати карти';});
    codes=(result.board||[]).concat(result.hero||[])
      .filter(function(x){return !!x.code;}).map(function(x){return x.code;});
   }
   result.uniqueCards=new Set(codes).size===codes.length;
   result.boardComplete=(result.board||[]).length>=3&&
     result.board.every(function(c){return !!c.code;})&&result.uniqueCards;
   return result;
  }
  return {observe:observe,reset:reset};
 }
 root.ACRTemporal={createTracker:createTracker};
}(typeof window!=='undefined'?window:globalThis));
