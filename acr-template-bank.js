/* ACR 52-card template library.
 * Rank/suit symbols are independent; 13 × 4 = all 52 card identities.
 * Verified ACR glyph masks are used when available, otherwise generic fonts
 * are flagged as synthetic (not verified photographs of all 52 cards).
 * Distortions are generated locally and cached; no uploads or network calls.
 */
(function(root){
 'use strict';
 var RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
 var SUITS='cdhs',W=24,H=24;
 var settings=[
  {angle:-9,shiftX:0,shiftY:0,skew:0,scale:1},
  {angle:9,shiftX:0,shiftY:0,skew:0,scale:1},
  {angle:-5,shiftX:0,shiftY:0,skew:.08,scale:1},
  {angle:5,shiftX:0,shiftY:0,skew:-.08,scale:1},
  {angle:0,shiftX:-1,shiftY:0,skew:0,scale:1},
  {angle:0,shiftX:1,shiftY:0,skew:0,scale:1},
  {angle:0,shiftX:0,shiftY:-1,skew:0,scale:1},
  {angle:0,shiftX:0,shiftY:1,skew:0,scale:1},
  {angle:0,shiftX:0,shiftY:0,skew:0,scale:.94},
  {angle:0,shiftX:0,shiftY:0,skew:0,scale:1.06}
 ];
 function warp(mask,opts) {
  if(!mask||mask.length!==W*H)throw new Error('Невалиден OCR образец.');
  var angle=(opts.angle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  var scale=opts.scale||1,skew=opts.skew||0,dx=opts.shiftX||0,dy=opts.shiftY||0;
  var out=new Uint8Array(W*H);
  for(var y=0;y<H;y++)for(var x=0;x<W;x++){
   var xp=(x-11.5-dx)/scale,yp=(y-11.5-dy)/scale;
   xp-=skew*yp;
   var sx=Math.round(c*xp+s*yp+11.5),sy=Math.round(-s*xp+c*yp+11.5);
   if(sx>=0&&sx<W&&sy>=0&&sy<H)out[y*W+x]=mask[sy*W+sx];
  }
  return out;
 }
 function similarity(a,b){
  if(!a||!b||a.length!==576||b.length!==576)return 0;
  var common=0,union=0;
  for(var i=0;i<576;i++)if(a[i]||b[i]){
   union++;
   if(a[i]&&b[i])common++;
  }
  return union?common/union:0;
 }
 function create(base) {
  var lists={rank:[],suit:[]},byKey={rank:Object.create(null),suit:Object.create(null)};
  var rankKeys=Object.create(null),suitKeys=Object.create(null),realRank=Object.create(null),realSuit=Object.create(null);
  ['rank','suit'].forEach(function(kind){
   var keys=kind==='rank'?RANKS:SUITS.split('');
   keys.forEach(function(key){
    var found=(base[kind]||[]).filter(function(e){return e.key===key&&e.mask&&e.mask.length===576;});
    var verified=found.filter(function(e){return e.provenance==='acr';}).slice(0,3);
    var synthetic=found.filter(function(e){return e.provenance!=='acr';}).slice(0,2);
    var selected=verified.concat(synthetic);
    if(kind==='rank'){rankKeys[key]=!!selected.length;realRank[key]=verified.length>0;}
    else{suitKeys[key]=!!selected.length;realSuit[key]=verified.length>0;}
    var arr=[];
    selected.forEach(function(e){
     settings.forEach(function(options){
      arr.push({key:key,mask:warp(e.mask,options),
       provenance:e.provenance==='acr'?'acr-variant':'synthetic-variant'});
     });
    });
    byKey[kind][key]=arr;
    lists[kind]=lists[kind].concat(arr);
   });
  });
  var cards=[];
  RANKS.forEach(function(rank){
   for(var i=0;i<SUITS.length;i++){
    var suit=SUITS.charAt(i);
    cards.push({code:rank+suit,rank:rank,suit:suit,
     styles:['standard','four-color'],
     calibrated:!!realRank[rank]&&!!realSuit[suit],
     synthetic:!realRank[rank]||!realSuit[suit]});
   }
  });
  function match(mask,kind){
   if(!mask||mask.length!==576||!byKey[kind])return {first:null,second:null};
   var best=null,next=null,keys=kind==='rank'?RANKS:SUITS.split('');
   keys.forEach(function(key){
    var value=null,refs=byKey[kind][key];
    for(var i=0;i<refs.length;i++){
     var e=refs[i],score=similarity(mask,e.mask);
     // A rotated synthetic font is weaker evidence than an ACR screenshot.
     if(e.provenance==='synthetic-variant')score-=.065;
     else score-=.025;
     if(!value||score>value.score)value={
       key:key,score:score,provenance:e.provenance
     };
    }
    if(!value)return;
    if(!best||value.score>best.score){next=best;best=value;}
    else if(!next||value.score>next.score)next=value;
   });
   return {first:best,second:next};
  }
  return {cards:cards,match:match,
   overview:function(){
    return {cards:cards.length,ranks:RANKS.length,suits:SUITS.length,
     variantsPerReference:settings.length,rankVariants:lists.rank.length,
     suitVariants:lists.suit.length,
     screenshotCalibratedCards:cards.filter(function(c){return c.calibrated;}).length,
     syntheticCards:cards.filter(function(c){return c.synthetic;}).length,
     warning:'Синтетичните комбинации не са проверени със снимки на всички 52 карти.'};
   }
  };
 }
 root.ACRTemplateBank={create:create,warp:warp,similarity:similarity};
}(typeof window!=='undefined'?window:globalThis));
