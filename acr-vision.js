/* ACR Poker – browser-only experimental rank/suit recognition */
(function(root){'use strict';
var REF={"rank":{"5":["000000","000000","01ff80","03ffc0","03ffc0","03ffc0","03c000","03c000","038000","03fe00","07ff00","07ff80","07ffc0","0387c0","0003c0","0003c0","0783c0","0787c0","07cfc0","03ff80","03ff00","00fe00","000000","000000"],"6":["000000","000000","007f00","00ff80","01ffc0","03ffc0","03e1c0","07c080","07c000","07ff00","07ff80","07ffc0","07e3c0","07c1c0","0781c0","0781c0","0781c0","07c1c0","03e3c0","03ffc0","01ffc0","00ff80","000000","000000"],"7":["000000","000000","07ffe0","0fffe0","0fffe0","07ffe0","0003e0","0003c0","000780","000f00","000f00","001e00","003e00","003c00","007c00","007800","007800","00f800","00f000","00f000","00f000","01f000","000000","000000"],"8":["000000","000000","003800","00ff00","01ff80","03ff80","03e7c0","07c3c0","03c3c0","03ff80","01ff00","01ff00","03ff80","03efc0","07c3c0","0783c0","0783c0","07c3c0","07efc0","03ffc0","01ff80","00fe00","000000","000000"],"A":["000000","000000","001e00","003e00","003f00","007f00","007f80","007f80","00ff80","00ffc0","00f7c0","01f3c0","01e3e0","03e3e0","03e3f0","03fff0","07fff0","07fff8","07fff8","0f80f8","0f8078","1f8078","000000","000000"],"J":["000000","000000","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","01c3c0","03c3c0","03c3c0","01e3c0","01ffc0","00ffc0","00ff80","003e00","000000","000000"]},"suit":{"c":["000000","000000","00ff80","01ff80","01ff80","01ff80","01ff80","00ffc0","03fff0","0ffff8","1ffffc","1ffffc","3ffffc","3ffffc","1ffffc","0ffffc","07fff8","000800","000c00","001c00","001e00","003e00","000000","000000"],"h":["000000","000000","0380e0","0ff7f8","1ffffc","3ffffc","3ffffc","3ffffc","3ffffc","3ffffc","1ffffc","1ffff8","07fff0","07ffe0","03ffc0","01ffc0","00ff80","00ff00","007e00","003e00","001c00","000000","000000","000000"],"s":["000000","000000","003c00","007e00","00ff00","01ff80","03ffe0","07fff0","0ffff8","3ffff8","3ffff8","3ffff8","3ffff8","1ffff8","0ffff8","07cdf8","000c00","001c00","001c00","001e00","003e00","003e00","000000","000000"]}};

var RANK_VALUES=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
var CACHE=null;
function matrixFromHex(rows){var o=new Uint8Array(576);for(var y=0;y<24;y++){var b=parseInt(rows[y],16);for(var x=0;x<24;x++)o[y*24+x]=(b>>(23-x))&1;}return o;}
function maskNormalize(src,sw,sh){
 var l=sw,t=sh,r=-1,b=-1;
 for(var y=0;y<sh;y++)for(var x=0;x<sw;x++)if(src[y*sw+x]){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
 if(r<0)return null;
 var pw=r-l+1,ph=b-t+1,k=Math.min(20/pw,20/ph),W=Math.max(1,Math.round(pw*k)),H=Math.max(1,Math.round(ph*k));
 var ox=Math.floor((24-W)/2),oy=Math.floor((24-H)/2),out=new Uint8Array(576);
 for(y=0;y<H;y++)for(x=0;x<W;x++){var sx=l+Math.min(pw-1,Math.floor(x*pw/W)),sy=t+Math.min(ph-1,Math.floor(y*ph/H));out[(y+oy)*24+x+ox]=src[sy*sw+sx];}
 return out;
}
function synthGlyph(glyph,font,weight){
 if(typeof document==='undefined')return null;
 var can=document.createElement('canvas');can.width=110;can.height=95;
 var c=can.getContext('2d');if(!c)return null;
 c.fillStyle='#fff';c.fillRect(0,0,110,95);c.font=weight+' 60px '+font;c.fillStyle='#000';c.textBaseline='alphabetic';c.fillText(glyph,5,70);
 var src=c.getImageData(0,0,110,95).data,mask=new Uint8Array(110*95);
 for(var i=0;i<mask.length;i++)if(src[i*4]<150)mask[i]=1;
 return maskNormalize(mask,110,95);
}
// Calibrated glyph silhouettes from two verified 709-pixel ACR Poker screenshots.
// Includes both board-sized and exposed-hand-sized ranks. These are glyphs only,
// not screenshots or personal/gameplay data. Newer screenshots still need testing.
var REAL_ACR_MASKS={"rank":{"4":["000000 000000 000780 000f80 001f80 003f80 003f80 007780 00e780 00e780 01c780 01c780 078780 070780 07ffe0 07ffe0 07ffe0 07ffe0 000780 000780 000780 000780 000000 000000"],"8":["000000 000000 00ff00 00ff00 03ffc0 03ffc0 03e7c0 03e3c0 03e3c0 03ffc0 03ffc0 03ffc0 03ffc0 03ffc0 0fe3e0 0fe3e0 0f83e0 0fe3e0 0fe3e0 03ffc0 03ffc0 00ff00 000000 000000","000000 000000 001c00 00ff00 01ff80 01ffc0 03e7c0 03c3c0 03c3c0 01ffc0 00ff80 00ff80 01ffc0 03f7c0 03c3c0 07c1c0 07c1c0 07c3c0 03f7c0 03ffc0 01ff80 00ff00 000000 000000"],"10":["000000 000000 000000 0101c0 0383f0 0787f8 3f8ffc 3f8f3c 3f9e1c 079e1c 079e1c 079e1c 079e1c 079e1c 079e1c 079e1c 078f3c 078ffc 0787f8 0303f0 000000 000000 000000 000000","000000 000000 000000 0101c0 0783f0 0787f8 3f8ffc 3f9e3c 3f9e3c 079e1c 079c1c 079c1c 079c1c 079e1c 079e1c 079e3c 079e3c 078ffc 0787f8 0303f0 000000 000000 000000 000000"]},"suit":{"d":["000000 000000 001c00 003e00 003e00 007f00 00ff80 01ffc0 01ffc0 03ffe0 07fff0 0ffff8 0ffff8 07fff0 03ffe0 01ffc0 01ff80 00ff80 007f00 003e00 003e00 001c00 000000 000000"],"c":["000000 000000 007fc0 007fc0 01ffc0 01ffc0 007fc0 03fff8 03fff8 0ffffc 3ffffc 3ffffc 3ffffc 0ffffc 0ffffc 03fff8 000800 000800 000e00 003e00 003e00 003e00 000000 000000"],"h":["000000 000000 000000 03f7e0 03f7e0 0ffff8 0ffff8 3ffff8 3ffffc 3ffffc 0ffff8 0ffff8 0ffff8 03ffe0 01ffc0 01ffc0 007f00 007f00 007f00 003e00 000000 000000 000000 000000"]}};
// Verified ACR corner-rank masks from user-supplied screenshots. These
// normalized 24x24 binary glyphs contain no player or account information.
var VERIFIED_ACR_RANK_MASKS={"3":["000000000000001800007f0000ff8001ffc003e7c003c3c003c3c00003c0000fc0001f80001f80001fc0000fc00003c007c3c007c3c003e7c003ffc001ff8000ff00000000000000"],"9":["000000000000007f0001ff8003ffc003f7e007c3e00781e00781e00781e00781e007c3e003ffe001ffe000fde00001e00001e00383e003e3e003ffc001ff8000ff00000000000000"],"Q":["000000000000007e0000ff0001ffc003efc00381e00780e00780e00f00e00f00e00f00e00700e00787e00387e003e7e001ffe000ffe0000000000000000000000000000000000000","00000000000000fe0001ff8007ffc007e7e00f81f01f01f01f00f01e00701e00701e00701e00701e00701e00f01f02f01f07f00f83f00fc3e007fff003fff000ff70000000000000","000000000000007f0001ffc003ffe007e3f00781f00f80f80f00781f00781f00781f00381f00781f00781f00781f02780f87f80f83f807e3f003fff801fff8007fb8000000000000"],"K":["0000000000000701f00f83f00f83f00f87e00f9f800f9f800fff000ffe000ffc000ffc000ffe000fff000fff000fdf800f8fc00f87c00f87e00f83f00f83f00f80f0000000000000"]};
// Suit glyphs extracted from verified ACR screenshots. Rank glyphs and
// suit glyphs are scored independently, with colour consistency validation.
var VERIFIED_ACR_SUIT_MASKS={"d":["00000000000000ff8001ffc003ffe003fff007fff80ffffc1ffffc3ffffc3ffffc1ffffc0ffff807fff003ffe000ffc000ff80007f00007f00003e00001e00000000000000000000"],"h":["0000000000000000003ffffc3ffffc3ffffc3ffffc3ffffc3ffffc1ffff80ffff807fff007fff003ffe001ffc000ff8000ff80007f00003e00001c00000000000000000000000000"],"c":["00000000000001ff0001ff8001ff8001ff8001ff8001ffc007fff00ffff81ffffc3ffffc3ffffc3ffffc3ffffc1ffffc0ffff0000800001800001c00003c00003e00000000000000"],"s":["000000000000003c00007e0000ff0001ff8003ffc007fff01ffff83ffff83ffff83ffff83ffff81ffff81ffff80fcdf8000c00001c00001c00001c00003e00003e00000000000000"]};
function templates(){
 if(CACHE)return CACHE;CACHE={rank:[],suit:[]};
 for(var kind in REF)for(var key in REF[kind])CACHE[kind].push({key:key,mask:matrixFromHex(REF[kind][key]),provenance:'acr'});
  for(var realKind in REAL_ACR_MASKS)for(var realKey in REAL_ACR_MASKS[realKind]){
    var examples=REAL_ACR_MASKS[realKind][realKey];
    for(var ex=0;ex<examples.length;ex++)CACHE[realKind].push({key:realKey,mask:matrixFromHex(examples[ex].split(' ')),provenance:'acr'});
  }
 for(var verifiedRank in VERIFIED_ACR_RANK_MASKS){
   var samples=VERIFIED_ACR_RANK_MASKS[verifiedRank];
   for(var sampleIndex=0;sampleIndex<samples.length;sampleIndex++){
     var rows=samples[sampleIndex].match(/.{6}/g);
     if(rows&&rows.length===24)CACHE.rank.push({key:verifiedRank,
       mask:matrixFromHex(rows),provenance:'acr'});
   }
 }
 for(var verifiedSuit in VERIFIED_ACR_SUIT_MASKS){
   var suitSamples=VERIFIED_ACR_SUIT_MASKS[verifiedSuit];
   for(var suitIndex=0;suitIndex<suitSamples.length;suitIndex++){
     var suitRows=suitSamples[suitIndex].match(/.{6}/g);
     if(suitRows&&suitRows.length===24)CACHE.suit.push({
       key:verifiedSuit,mask:matrixFromHex(suitRows),provenance:'acr'
     });
   }
 }
 var fonts=['Arial','Helvetica','sans-serif'],names=RANK_VALUES;
 for(var j=0;j<names.length;j++)for(var f=0;f<fonts.length;f++){
   var symbol=names[j],generated=synthGlyph(symbol,fonts[f],f===2?'900':'700');
   if(generated)CACHE.rank.push({key:symbol,mask:generated,provenance:'font'});
 }
 for(var q=0;q<4;q++){
   var suit='cdhs'.charAt(q),sym='♣♦♥♠'.charAt(q),g=synthGlyph(sym,'Georgia','700');
   if(g)CACHE.suit.push({key:suit,mask:g,provenance:'font'});
 }
 return CACHE;
}
function glyphMask(img,box,part,variant){
 // Try slightly different corner crops only when the standard crop is uncertain.
 // All variants remain inside the rank/small-suit corner, never the big suit art.
 var cuts=part==='rank'?
  [[.09,.56,.06,.285],[.06,.58,.04,.305],[.11,.60,.045,.30]]:
  [[.07,.50,.315,.55],[.055,.52,.295,.565],[.09,.53,.325,.575]];
 var p=cuts[variant||0];
 var x0=Math.max(0,Math.round(box.x+box.width*p[0])),
     x1=Math.min(img.width,Math.round(box.x+box.width*p[1]));
 var y0=Math.max(0,Math.round(box.y+box.height*p[2])),
     y1=Math.min(img.height,Math.round(box.y+box.height*p[3]));
 var w=x1-x0,h=y1-y0;if(w<6||h<7)return null;
 // Compare each glyph with its local card background. This preserves
 // dark symbols on cards dimmed by ACR animations and translucent overlays.
 var histogram=new Uint32Array(256),raw=img.data,total=w*h;
 for(var py=y0;py<y1;py++)for(var px=x0;px<x1;px++){
  var at=(py*img.width+px)*4;
  histogram[Math.max(raw[at],raw[at+1],raw[at+2])]++;
 }
 var target=Math.ceil(total*.70),running=0,background=255;
 for(var level=0;level<256;level++){
  running+=histogram[level];
  if(running>=target){background=level;break;}
 }
 var blackLimit=Math.min(145,Math.max(40,background-34));
 var src=new Uint8Array(w*h),redCount=0,blackCount=0;
 for(var y=0;y<h;y++)for(var x=0;x<w;x++){
  var i=((y+y0)*img.width+x+x0)*4,r=raw[i],g=raw[i+1],b=raw[i+2];
  var red=r>76&&r>1.3*g&&r>1.2*b,black=Math.max(r,g,b)<blackLimit;
  if(red||black){src[y*w+x]=1;if(red)redCount++;else blackCount++;}
 }
 return {mask:maskNormalize(src,w,h),
  // Shaded red ink can overlap neutral gray shadows. Require several red
  // pixels and retain the strict test for normal bright cards.
  isRed:redCount>=8&&redCount>blackCount*(box.shaded?.09:1.2),
  count:redCount+blackCount};
}
function similarity(a,b){var common=0,all=0;for(var i=0;i<576;i++){if(a[i]||b[i]){all++;if(a[i]&&b[i])common++;}}return all?common/all:0;}
function matchSymbol(mask,kind){
 var refs=templates()[kind],byKey={},first=null,second=null;
 for(var i=0;i<refs.length;i++){
  var e=refs[i],score=similarity(mask,e.mask);
  // Synthetic font references require more evidence than calibrated ACR glyphs.
  if(e.provenance==='font')score-=0.05;
  if(!byKey[e.key]||score>byKey[e.key].score)byKey[e.key]={key:e.key,score:score,provenance:e.provenance};
 }
 for(var k in byKey){var e=byKey[k];if(!first||e.score>first.score){second=first;first=e;}else if(!second||e.score>second.score)second=e;}
 return {first:first,second:second};
}

// Secondary OCR prototypes cover the COMPLETE 13-rank / 4-suit alphabet.
// The ACR-calibrated glyphs remain the primary recognition path. Generic font
// prototypes are fallback-only, because they have not been calibrated on
// verified screenshots of every rank and suit from ACR Poker.
var FALLBACK_CACHE=null;
var OCR_RANKS=RANK_VALUES,OCR_SUITS='cdhs';
function fallbackTemplates(kind){
 if(FALLBACK_CACHE)return FALLBACK_CACHE[kind];
 FALLBACK_CACHE={rank:[],suit:[]};
 var fonts=['Arial','Helvetica','Verdana','Tahoma','Georgia','sans-serif'];
 for(var k=0;k<OCR_RANKS.length;k++){
  var rank=OCR_RANKS[k],texts=rank==='10'?['10','T']:[rank];
  for(var f=0;f<fonts.length;f++)for(var v=0;v<texts.length;v++){
   var template=synthGlyph(texts[v],fonts[f],f%2?'900':'700');
   if(template)FALLBACK_CACHE.rank.push({key:rank,mask:template});
  }
 }
 var symbols='♣♦♥♠';
 for(k=0;k<OCR_SUITS.length;k++){
  for(f=0;f<fonts.length;f++){
   template=synthGlyph(symbols.charAt(k),fonts[f],f%2?'900':'700');
   if(template)FALLBACK_CACHE.suit.push({key:OCR_SUITS.charAt(k),mask:template});
  }
 }
 return FALLBACK_CACHE[kind];
}
function fallbackGlyph(img,box,part){
 var kind=part==='rank'?'rank':'suit',refs=fallbackTemplates(kind);
 if(!refs.length)return null;
 var votes={},total={},margins={},red={},bestVariant={};
 for(var v=0;v<3;v++){
  var pixels=glyphMask(img,box,part,v);
  if(!pixels||!pixels.mask||pixels.count<10)continue;
  var candidates={};
  for(var i=0;i<refs.length;i++){
   var ref=refs[i],score=similarity(pixels.mask,ref.mask);
   if(!candidates[ref.key]||score>candidates[ref.key])candidates[ref.key]=score;
  }
  var first=null,second=null;
  for(var key in candidates){
   var entry={key:key,score:candidates[key]};
   if(!first||entry.score>first.score){second=first;first=entry;}
   else if(!second||entry.score>second.score)second=entry;
  }
  if(!first)continue;
  var margin=first.score-(second?second.score:0);
  if(first.score<.64||margin<.035)continue;
  votes[first.key]=(votes[first.key]||0)+1;
  total[first.key]=(total[first.key]||0)+first.score;
  margins[first.key]=(margins[first.key]||0)+margin;
  red[first.key]=pixels.isRed;
  bestVariant[first.key]=v;
 }
 var selected=null;
 for(var key in votes){
  var count=votes[key],avg=total[key]/count,gap=margins[key]/count;
  // Two agreeing crops are required; a lone font match is not a card.
  if(count<2||avg<.70||gap<.055)continue;
  if(!selected||count>selected.count||count===selected.count&&avg>selected.score)
   selected={key:key,score:avg,margin:gap,accepted:true,
     isRed:red[key],variant:bestVariant[key],count:count,source:'font-fallback'};
 }
 return selected;
}
function templateCoverage(){
 var base=templates(),secondary=fallbackTemplates('rank');
 var rank={},suit={},calibratedRank={},calibratedSuit={};
 base.rank.concat(secondary).forEach(function(x){rank[x.key]=true;if(x.provenance==='acr')calibratedRank[x.key]=true;});
 base.suit.concat(fallbackTemplates('suit')).forEach(function(x){suit[x.key]=true;if(x.provenance==='acr')calibratedSuit[x.key]=true;});
 var missingRanks=OCR_RANKS.filter(function(x){return !rank[x];});
 var missingSuits=OCR_SUITS.split('').filter(function(x){return !suit[x];});
 return {ranks:OCR_RANKS.length-missingRanks.length,suits:OCR_SUITS.length-missingSuits.length,
  combinations:(OCR_RANKS.length-missingRanks.length)*(OCR_SUITS.length-missingSuits.length),
  missingRanks:missingRanks,missingSuits:missingSuits,
  calibratedRanks:Object.keys(calibratedRank).length,calibratedSuits:Object.keys(calibratedSuit).length,
  warning:'Шрифтовите образци не доказват точност върху реални ACR снимки.'};
}

function selectGlyph(img,box,part){
 var kind=part==='rank'?'rank':'suit',chosen=null,shadedVotes={},shadedCandidates={};
 for(var v=0;v<3;v++){
  var pixels=glyphMask(img,box,part,v);
  if(!pixels||!pixels.mask||pixels.count<10)continue;
  var matched=matchSymbol(pixels.mask,kind);
  if(!matched.first)continue;
  var gap=matched.first.score-(matched.second?matched.second.score:0);
  var accepted=matched.first.score>=(part==='rank'?.68:.71)&&
       gap>=(part==='rank'?.043:.055);
  var candidate={key:matched.first.key,score:matched.first.score,
    margin:gap,accepted:accepted,isRed:pixels.isRed,variant:v,
    source:matched.first.provenance||'unknown'};
  if(accepted){
   shadedVotes[candidate.key]=(shadedVotes[candidate.key]||0)+1;
   if(!shadedCandidates[candidate.key]||candidate.score>shadedCandidates[candidate.key].score)
    shadedCandidates[candidate.key]=candidate;
  }
  // Normal cards keep the fast path. Shaded cards need crop agreement,
  // because a winner banner may mimic one of the rank glyphs.
  if(v===0&&accepted&&!box.shaded)return candidate;
  if(!chosen||(candidate.accepted&&!chosen.accepted)||
     (candidate.accepted===chosen.accepted&&
      candidate.score+Math.min(.15,candidate.margin)*.2>
      chosen.score+Math.min(.15,chosen.margin)*.2))chosen=candidate;
 }
 if(box.shaded){
  var consensus=null;
  for(var k in shadedVotes)if(shadedVotes[k]>=2){
   var contender=shadedCandidates[k];
   if(!consensus||shadedVotes[k]>shadedVotes[consensus.key]||
      shadedVotes[k]===shadedVotes[consensus.key]&&contender.score>consensus.score)
    consensus=contender;
  }
  if(consensus)chosen=consensus;
  else if(chosen)chosen.accepted=false;
 }
 if(!chosen||!chosen.accepted){
  var alternate=fallbackGlyph(img,box,part);
  if(alternate&&(!box.shaded||alternate.count>=2))return alternate;
 }
 return chosen;
}
function classify(img,box){
 var rank=selectGlyph(img,box,'rank'),suit=selectGlyph(img,box,'suit');
 if(!rank||!suit)return {box:box,code:null,rank:rank&&rank.accepted?rank.key:null,
  suit:suit&&suit.accepted?suit.key:null,rankDetected:!!rank,suitDetected:!!suit,
  reason:'Неясен символ в ъгъла на картата'};
 var validColor=rank.isRed===suit.isRed&&((suit.key==='h'||suit.key==='d')===suit.isRed);
 var rankOk=rank.accepted,suitOk=suit.accepted&&validColor;
 var good=rankOk&&suitOk;
 return {box:box,code:good?rank.key+suit.key:null,
   rank:rankOk?rank.key:null,suit:suitOk?suit.key:null,
   rankDetected:!!rank,suitDetected:!!suit,
   rankScore:Math.round(rank.score*100),suitScore:Math.round(suit.score*100),
   rankMargin:Math.round(rank.margin*100),suitMargin:Math.round(suit.margin*100),
   rankSource:rank.source||'unknown',suitSource:suit.source||'unknown',
   guess:rank.key+suit.key,confidence:Math.round(100*Math.min(rank.score,suit.score)),
   reason:good?'':!validColor?'Несъответствие между цвят и боя':
    !rankOk&&!suitOk?'Непотвърдени стойност и боя':!rankOk?'Непотвърдена стойност':'Непотвърдена боя'};
}
function detectBurgundyPairs(img){
 var w=img.width,h=img.height,d=img.data,n=w*h,binary=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n);
 for(var i=0;i<n;i++){var r=d[4*i],g=d[4*i+1],b=d[4*i+2];
  if(r>75&&r<155&&g>22&&g<90&&b>27&&b<100&&r>1.58*g&&r>1.42*b&&b>.9*g)binary[i]=1;
 }
 var boxes=[];
 for(i=0;i<n;i++){
  if(!binary[i]||visited[i])continue;
  var head=0,tail=1,minX=i%w,maxX=minX,minY=(i/w)|0,maxY=minY;
  visited[i]=1;queue[0]=i;
  while(head<tail){
   var at=queue[head++],x=at%w,y=(at/w)|0;
   if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
   var j=at-1;if(x>0&&binary[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
   j=at+1;if(x<w-1&&binary[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
   j=at-w;if(y>0&&binary[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
   j=at+w;if(y<h-1&&binary[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
  }
  var bw=maxX-minX+1,bh=maxY-minY+1,fill=tail/(bw*bh);
  if(bw>w*.025&&bw<w*.13&&bh>h*.025&&bh<h*.14&&bw/bh>.42&&bw/bh<.89&&fill>.47)
   boxes.push({x:minX,y:minY,width:bw,height:bh});
 }
 boxes.sort(function(a,b){return a.y-b.y||a.x-b.x;});
 var used={},pairs=[];
 for(i=0;i<boxes.length;i++){
  if(used[i])continue;
  var a=boxes[i],match=-1,smallest=99999;
  for(var k=i+1;k<boxes.length;k++){
   if(used[k])continue;
   var b=boxes[k],dy=Math.abs(a.y-b.y),dx=Math.abs(a.x-b.x);
   if(dy<Math.max(a.height,b.height)*.28&&dx>Math.min(a.width,b.width)*.85&&
    dx<Math.max(a.width,b.width)*1.65&&Math.abs(a.height-b.height)<a.height*.25&&dx<smallest){match=k;smallest=dx;}
  }
  if(match>=0){used[i]=1;used[match]=1;pairs.push([a,boxes[match]]);}
 }
 return pairs;
}
// Keep community cards, the player's hole cards and other visible hands separate.
// Location is a heuristic for the ACR layout, never proof of a player's identity.
function groupVisible(cards,w,h){
 var rows=[],groups=[];
 var ordered=cards.slice().sort(function(a,b){return (a.box.y+a.box.height/2)-(b.box.y+b.box.height/2);});
 ordered.forEach(function(card){
  var mid=card.box.y+card.box.height/2,row=null;
  for(var i=0;i<rows.length;i++){
   if(Math.abs(rows[i].center-mid)<Math.max(rows[i].height,card.box.height)*.40){row=rows[i];break;}
  }
  if(!row){row={center:mid,height:card.box.height,cards:[]};rows.push(row);}
  row.cards.push(card);
  row.center=row.cards.reduce(function(t,c){return t+c.box.y+c.box.height/2;},0)/row.cards.length;
 });
 rows.forEach(function(row){
  row.cards.sort(function(a,b){return a.box.x-b.box.x;});
  var group=[];
  function append(){if(group.length){groups.push(group);group=[];}}
  row.cards.forEach(function(card){
   if(group.length){
    var last=group[group.length-1];
    var gap=card.box.x-(last.box.x+last.box.width);
    if(gap>Math.max(last.box.width,card.box.width)*1.75)append();
   }
   group.push(card);
  });
  append();
 });
 function measures(g){
  var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  g.forEach(function(c){
   minX=Math.min(minX,c.box.x);maxX=Math.max(maxX,c.box.x+c.box.width);
   minY=Math.min(minY,c.box.y);maxY=Math.max(maxY,c.box.y+c.box.height);
  });
  return {cards:g,cx:(minX+maxX)/2/w,cy:(minY+maxY)/2/h,height:(maxY-minY)/h};
 }
 var sets=groups.map(measures);
 var boards=sets.filter(function(g){
  return g.cards.length>=3&&g.cards.length<=5&&g.cx>.22&&g.cx<.78&&g.cy>.16&&g.cy<.79;
 });
 boards.sort(function(a,b){
  function score(g){return Math.abs(g.cx-.5)*3+Math.abs(g.cy-.47)+(.035*(5-g.cards.length));}
  return score(a)-score(b);
 });
 var board=boards.length?boards[0]:null;
 var heroes=sets.filter(function(g){
  return g!==board&&g.cards.length===2&&g.cx>.27&&g.cx<.73&&
   g.cy>.63&&(!board||g.cy>board.cy+Math.max(.095,board.height*.70));
 });
 heroes.sort(function(a,b){return (Math.abs(a.cx-.5)*2+(1-a.cy))-(Math.abs(b.cx-.5)*2+(1-b.cy));});
 var hero=heroes.length?heroes[0]:null;
 var selected=(board?board.cards:[]).concat(hero?hero.cards:[]);
 return {board:board?board.cards:[],hero:hero?hero.cards:[],
   others:cards.filter(function(c){return selected.indexOf(c)<0;})};
}
function analyze(img){
 var detect=root.PokerCardDetector,boxes=detect?detect.detect(img):[];
 // ACR portrait screenshots place action controls underneath the hole cards.
 // Card-shaped decorations in that UI zone are not poker cards.
 var portrait=img.height/img.width>1.65&&img.height/img.width<2.7;
 var ignoredUi=0;
 var candidates=boxes.filter(function(box){
  var isActionUi=portrait&&box.y/img.height>.90;
  if(isActionUi)ignoredUi++;
  return !isActionUi;
 });
 var face=candidates.map(function(box){return classify(img,box);});
 var groups=groupVisible(face,img.width,img.height),backs=detectBurgundyPairs(img);
 var board=groups.board,hero=groups.hero;
 var combined=board.concat(hero).filter(function(c){return !!c.code;}).map(function(c){return c.code;});
 var noDuplicates=(new Set(combined)).size===combined.length;
 // A visible face-up bottom pair and covered hands each represent a distinct
 // seat only when their locations differ. Back pairs are otherwise anonymous.
 var otherBacks=backs.filter(function(pair){
  if(!hero.length)return true;
  var bx=(pair[0].x+pair[1].x+pair[1].width)/2;
  var by=(pair[0].y+pair[1].y+pair[1].height)/2;
  var hx=(hero[0].box.x+hero[1].box.x+hero[1].box.width)/2;
  var hy=(hero[0].box.y+hero[1].box.y+hero[1].box.height)/2;
  return Math.abs(bx-hx)>img.width*.09||Math.abs(by-hy)>img.height*.10;
 });
 var stage=board.length===3?'Флоп':board.length===4?'Търн':board.length===5?'Ривър':null;
 var possibleBoard=groups.others.some(function(card){
  var x=(card.box.x+card.box.width/2)/img.width;
  var y=(card.box.y+card.box.height/2)/img.height;
  return x>.25&&x<.75&&y>.20&&y<.72;
 });
 return {visible:face,board:board,hero:hero,others:groups.others,
  ignoredUiBoxes:ignoredUi,
  faceCount:face.length,coveredHands:otherBacks.length,backPairs:otherBacks,
  activePlayers:otherBacks.length+(hero.length===2?1:0),
  stage:stage||(possibleBoard?'Неясен етап':'Префлоп'),
  stageConfirmed:!!stage||(!board.length&&!possibleBoard),
  boardComplete:board.length>=3&&board.every(function(c){return !!c.code;})&&noDuplicates,
  uniqueCards:noDuplicates};
}
root.ACRVision={analyze:analyze,classify:classify,glyphMask:glyphMask,matchSymbol:matchSymbol,templates:templates,templateCoverage:templateCoverage,groupVisible:groupVisible};

}(typeof window!=='undefined'?window:globalThis));