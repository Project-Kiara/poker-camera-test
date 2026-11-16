/* ACR Poker – browser-only experimental rank/suit recognition */
(function(root){'use strict';
var REF={"rank":{"5":["000000","000000","01ff80","03ffc0","03ffc0","03ffc0","03c000","03c000","038000","03fe00","07ff00","07ff80","07ffc0","0387c0","0003c0","0003c0","0783c0","0787c0","07cfc0","03ff80","03ff00","00fe00","000000","000000"],"6":["000000","000000","007f00","00ff80","01ffc0","03ffc0","03e1c0","07c080","07c000","07ff00","07ff80","07ffc0","07e3c0","07c1c0","0781c0","0781c0","0781c0","07c1c0","03e3c0","03ffc0","01ffc0","00ff80","000000","000000"],"7":["000000","000000","07ffe0","0fffe0","0fffe0","07ffe0","0003e0","0003c0","000780","000f00","000f00","001e00","003e00","003c00","007c00","007800","007800","00f800","00f000","00f000","00f000","01f000","000000","000000"],"8":["000000","000000","003800","00ff00","01ff80","03ff80","03e7c0","07c3c0","03c3c0","03ff80","01ff00","01ff00","03ff80","03efc0","07c3c0","0783c0","0783c0","07c3c0","07efc0","03ffc0","01ff80","00fe00","000000","000000"],"A":["000000","000000","001e00","003e00","003f00","007f00","007f80","007f80","00ff80","00ffc0","00f7c0","01f3c0","01e3e0","03e3e0","03e3f0","03fff0","07fff0","07fff8","07fff8","0f80f8","0f8078","1f8078","000000","000000"],"J":["000000","000000","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","0003c0","01c3c0","03c3c0","03c3c0","01e3c0","01ffc0","00ffc0","00ff80","003e00","000000","000000"]},"suit":{"c":["000000","000000","00ff80","01ff80","01ff80","01ff80","01ff80","00ffc0","03fff0","0ffff8","1ffffc","1ffffc","3ffffc","3ffffc","1ffffc","0ffffc","07fff8","000800","000c00","001c00","001e00","003e00","000000","000000"],"h":["000000","000000","0380e0","0ff7f8","1ffffc","3ffffc","3ffffc","3ffffc","3ffffc","3ffffc","1ffffc","1ffff8","07fff0","07ffe0","03ffc0","01ffc0","00ff80","00ff00","007e00","003e00","001c00","000000","000000","000000"],"s":["000000","000000","003c00","007e00","00ff00","01ff80","03ffe0","07fff0","0ffff8","3ffff8","3ffff8","3ffff8","3ffff8","1ffff8","0ffff8","07cdf8","000c00","001c00","001c00","001e00","003e00","003e00","000000","000000"]}};

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
function templates(){
 if(CACHE)return CACHE;CACHE={rank:[],suit:[]};
 for(var kind in REF)for(var key in REF[kind])CACHE[kind].push({key:key,mask:matrixFromHex(REF[kind][key]),provenance:'acr'});
 var fonts=['Arial','Helvetica','sans-serif'],names='23456789TJQKA';
 for(var j=0;j<names.length;j++)for(var f=0;f<fonts.length;f++){
   var symbol=names.charAt(j),generated=synthGlyph(symbol==='T'?'10':symbol,fonts[f],f===2?'900':'700');
   if(generated)CACHE.rank.push({key:symbol,mask:generated,provenance:'font'});
 }
 for(var q=0;q<4;q++){
   var suit='cdhs'.charAt(q),sym='♣♦♥♠'.charAt(q),g=synthGlyph(sym,'Georgia','700');
   if(g)CACHE.suit.push({key:suit,mask:g,provenance:'font'});
 }
 return CACHE;
}
function glyphMask(img,box,part){
 var c=part==='rank'?[.09,.56,.06,.285]:[.07,.50,.315,.55];
 var x0=Math.max(0,Math.round(box.x+box.width*c[0])),x1=Math.min(img.width,Math.round(box.x+box.width*c[1]));
 var y0=Math.max(0,Math.round(box.y+box.height*c[2])),y1=Math.min(img.height,Math.round(box.y+box.height*c[3]));
 var w=x1-x0,h=y1-y0;if(w<6||h<7)return null;
 var src=new Uint8Array(w*h),redCount=0,blackCount=0;
 for(var y=0;y<h;y++)for(var x=0;x<w;x++){
  var i=((y+y0)*img.width+x+x0)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
  var red=r>76&&r>1.3*g&&r>1.2*b,black=Math.max(r,g,b)<145;
  if(red||black){src[y*w+x]=1;if(red)redCount++;else blackCount++;}
 }
 return {mask:maskNormalize(src,w,h),isRed:redCount>blackCount*1.2,count:redCount+blackCount};
}
function similarity(a,b){var common=0,all=0;for(var i=0;i<576;i++){if(a[i]||b[i]){all++;if(a[i]&&b[i])common++;}}return all?common/all:0;}
function matchSymbol(mask,kind){
 var refs=templates()[kind],byKey={},first=null,second=null;
 for(var i=0;i<refs.length;i++){
  var e=refs[i],score=similarity(mask,e.mask);
  // The synthetic font references are hypotheses until validated with examples.
  if(e.provenance==='font')score-=0.05;
  if(!byKey[e.key]||score>byKey[e.key].score)byKey[e.key]={key:e.key,score:score};
 }
 for(var k in byKey){var e=byKey[k];if(!first||e.score>first.score){second=first;first=e;}else if(!second||e.score>second.score)second=e;}
 return {first:first,second:second};
}
function classify(img,box){
 var rank=glyphMask(img,box,'rank'),suit=glyphMask(img,box,'suit');
 if(!rank||!suit||!rank.mask||!suit.mask||rank.count<10||suit.count<10)return {box:box,code:null,reason:'Нечетлив символ'};
 var r=matchSymbol(rank.mask,'rank'),s=matchSymbol(suit.mask,'suit');
 if(!r.first||!s.first)return {box:box,code:null,reason:'Няма образец'};
 var rm=r.first.score-(r.second?r.second.score:0),sm=s.first.score-(s.second?s.second.score:0);
 var colorValid=rank.isRed===suit.isRed&&((s.first.key==='h'||s.first.key==='d')===suit.isRed);
 var good=r.first.score>=0.68&&rm>=0.043&&s.first.score>=0.71&&sm>=0.055&&colorValid;
 return {box:box,code:good?r.first.key+s.first.key:null,guess:r.first.key+s.first.key,
   confidence:Math.round(100*Math.min(r.first.score,s.first.score)),reason:good?'':'Непотвърден символ'};
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
function groupVisible(cards,h){
 var groups=[];
 cards.forEach(function(card){
  var mid=card.box.y+card.box.height/2,group=null;
  for(var i=0;i<groups.length;i++)if(Math.abs(groups[i].center-mid)<card.box.height*.45){group=groups[i];break;}
  if(!group){group={center:mid,cards:[]};groups.push(group);}group.cards.push(card);
 });
 groups.forEach(function(g){g.cards.sort(function(a,b){return a.box.x-b.box.x;});});
 var boards=groups.filter(function(g){return g.cards.length>=3&&g.cards.length<=5;});
 boards.sort(function(a,b){return b.cards.length-a.cards.length;});
 var heroes=groups.filter(function(g){return g.cards.length===2&&g.center>h*.67;});
 heroes.sort(function(a,b){return b.center-a.center;});
 return {board:boards.length?boards[0].cards:[],hero:heroes.length?heroes[0].cards:[]};
}
function analyze(img){
 var detect=root.PokerCardDetector,face=detect?detect.detect(img).map(function(b){return classify(img,b);}):[];
 var groups=groupVisible(face,img.height),backs=detectBurgundyPairs(img);
 return {visible:face,board:groups.board,hero:groups.hero,
  faceCount:face.length,coveredHands:backs.length,
  boardComplete:groups.board.length>=3&&groups.board.every(function(c){return !!c.code;})};
}
root.ACRVision={analyze:analyze,classify:classify,glyphMask:glyphMask,matchSymbol:matchSymbol,templates:templates};

}(typeof window!=='undefined'?window:globalThis));