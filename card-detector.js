/* Fast, dependency-free experimental playing-card rectangle detector.
   Input: ImageData from a small canvas (suggested width: 320px).
   Finds bright face-up cards. This does NOT classify rank/suit.
   It should never be used as proof that a particular card was recognized. */
(function (root) {
  'use strict';

  function detect(imageData) {
    if (!imageData || !imageData.data) throw new Error('ImageData is required');
    var w = imageData.width, h = imageData.height, rgba = imageData.data;
    var size = w * h;
    var bright = new Uint8Array(size), visited = new Uint8Array(size);
    var queue = new Int32Array(size);
    var i, x, y;

    // ACR Poker face-up cards have a near-white background.
    // Max-min approximates saturation without allocating an HSV buffer.
    for (i = 0; i < size; i++) {
      var p = i * 4;
      var r = rgba[p], g = rgba[p+1], b = rgba[p+2];
      var maximum = Math.max(r,g,b), minimum = Math.min(r,g,b);
      if (minimum >= 190 && maximum - minimum <= 65) bright[i] = 1;
    }

    var found = [];
    var minimumArea = Math.max(75, Math.round(size * 0.00045));
    for (i = 0; i < size; i++) {
      if (!bright[i] || visited[i]) continue;

      var head = 0, tail = 1;
      queue[0] = i; visited[i] = 1;
      var minX = i % w, maxX = minX;
      var minY = Math.floor(i/w), maxY = minY;
      while (head < tail) {
        var here = queue[head++];
        var cx = here % w, cy = (here / w) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Eight-connected neighborhoods handle anti-aliased boundaries.
        for (var oy = -1; oy <= 1; oy++) {
          var ny = cy + oy;
          if (ny < 0 || ny >= h) continue;
          for (var ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            var nx = cx + ox;
            if (nx < 0 || nx >= w) continue;
            var next = ny * w + nx;
            if (bright[next] && !visited[next]) {
              visited[next] = 1; queue[tail++] = next;
            }
          }
        }
      }

      var cw = maxX-minX+1, ch = maxY-minY+1, ratio = cw/ch;
      var fill = tail / (cw*ch);
      // ACR can visually touch two adjacent face-up hero cards, especially
      // when the bottom avatar overlays both. Connected components then
      // merge two cards into a single, too-wide rectangle (about 2.3x
      // community-card width). Split only a verified two-lobe component.
      var joined = splitJoinedHeroCards(bright, w, h, found,
        minX,minY,cw,ch,tail);
      if (joined) {
        found.push(joined[0],joined[1]);
        continue;
      }
      if (tail >= minimumArea &&
          cw >= Math.max(10, w*0.025) &&
          ch >= Math.max(20, h*0.03) &&
          ratio >= 0.50 && ratio <= 0.86 &&
          fill > 0.55 && fill < 1.01) {
        found.push({x:minX,y:minY,width:cw,height:ch,
                    pixelArea:tail,fill:fill});
      }
    }
    // A second, narrow pass recovers dimmed face-up cards under animations,
    // winner banners or semi-transparent overlays. The ordinary bright-card
    // pass remains the primary detector; do not scan the entire image dimly.
    var faded = detectShadedCards(imageData, found);
    for (var k=0;k<faded.length;k++) found.push(faded[k]);
    found.sort(function(a,b){return a.x-b.x;});
    return found;
  }

  function splitJoinedHeroCards(mask,w,h,previous,minX,minY,cw,ch,area) {
    if (area < Math.max(150,w*h*.0010) || cw/ch<.95 || cw/ch>1.7) return null;
    if (minY/h<.58 || minY/h>.90) return null;
    var center=(minX+cw/2)/w;
    if (center<.20 || center>.80) return null;
    // Anchor to real previously detected community cards where possible.
    var possibleBoard=previous.filter(function(box){
      return box.y+box.height<minY &&
        minY-(box.y+box.height)<box.height*3.5 &&
        Math.abs((box.x+box.width/2)/w-.5)<.42;
    });
    var board=null;
    if(possibleBoard.length>=3){
      possibleBoard.sort(function(a,b){return a.y-b.y;});
      var row=possibleBoard.filter(function(b){
        return Math.abs((b.y+b.height/2)-
          (possibleBoard[0].y+possibleBoard[0].height/2))<
          Math.max(b.height,possibleBoard[0].height)*.24;
      });
      if(row.length>=3){
        var sumW=0,sumH=0;
        row.forEach(function(b){sumW+=b.width;sumH+=b.height;});
        board={w:sumW/row.length,h:sumH/row.length};
      }
    }
    if(board){
      if(cw<board.w*1.75 || cw>board.w*2.9 ||
        ch<board.h*.85 || ch>board.h*1.8) return null;
    } else {
      // Conservative fallback for a preflop ACR portrait with no board.
      if(h/w<1.7 || h/w>2.6 || cw<w*.17 || cw>w*.45 ||
        ch<h*.07 || ch>h*.19 || minY/h<.66) return null;
    }
    // Find a narrow dark column gap around the midpoint of the merged pair.
    // Check just the top part so a seat avatar cannot distort the gap.
    var y0=Math.min(h-1,minY+Math.round(ch*.08));
    var y1=Math.min(h,minY+Math.round(ch*.66));
    var rows=y1-y0;
    if(rows<20)return null;
    var mid=minX+Math.floor(cw/2),from=Math.max(minX+1,mid-Math.round(cw*.12));
    var to=Math.min(minX+cw-2,mid+Math.round(cw*.12));
    var minCount=rows+1,cut=-1;
    function columnCount(x){
      var count=0;
      for(var y=y0;y<y1;y++)count+=mask[y*w+x];
      return count;
    }
    for(var x=from;x<=to;x++){
      var n=columnCount(x);
      if(n<minCount){minCount=n;cut=x;}
    }
    if(cut<0 || minCount>rows*.23)return null;
    var gapLimit=Math.max(5,Math.floor(rows*.20));
    var lo=cut,hi=cut;
    while(lo>minX&&columnCount(lo-1)<=gapLimit)lo--;
    while(hi<minX+cw-1&&columnCount(hi+1)<=gapLimit)hi++;
    var gapWidth=hi-lo+1;
    if(gapWidth<1 || gapWidth>cw*.10)return null;
    var firstW=lo-minX,secondX=hi+1,secondW=minX+cw-secondX;
    if(firstW<ch*.48 || firstW>ch*.88 ||
       secondW<ch*.48 || secondW>ch*.88 ||
       Math.abs(firstW-secondW)>Math.max(firstW,secondW)*.20)return null;
    if(board&&(firstW<board.w*.72 || firstW>board.w*1.65 ||
      secondW<board.w*.72 || secondW>board.w*1.65))return null;
    function makeCard(x,width){
      var pixels=0;
      for(var py=minY;py<minY+ch;py++)
        for(var px=x;px<x+width;px++)pixels+=mask[py*w+px];
      var fill=pixels/(width*ch);
      return fill>.42?{x:x,y:minY,width:width,height:ch,
        pixelArea:pixels,fill:fill,joinedPair:true}:null;
    }
    var left=makeCard(minX,firstW),right=makeCard(secondX,secondW);
    return left&&right?[left,right]:null;
  }

  function detectShadedCards(img,brightCards) {
    var w=img.width,h=img.height,d=img.data,size=w*h,roi=null,reference=null;
    var rows=[];
    // Determine a credible row of 3–5 community cards.
    brightCards.forEach(function(card){
      var row=null,cy=card.y+card.height/2;
      for(var i=0;i<rows.length;i++){
        if(Math.abs(rows[i].cy-cy)<Math.max(rows[i].height,card.height)*.25){
          row=rows[i];break;
        }
      }
      if(!row){row={cards:[],cy:cy,height:card.height};rows.push(row);}
      row.cards.push(card);
    });
    rows.sort(function(a,b){return b.cards.length-a.cards.length;});
    var board=rows.filter(function(row){
      if(row.cards.length<3||row.cards.length>5)return false;
      var widths=row.cards.map(function(c){return c.width;});
      var min=Math.min.apply(Math,widths),max=Math.max.apply(Math,widths);
      return max/min<1.7;
    })[0];
    if(board){
      var cards=board.cards,left=w,right=0,top=h,bottom=0,sumW=0,sumH=0;
      cards.forEach(function(c){
        left=Math.min(left,c.x);right=Math.max(right,c.x+c.width);
        top=Math.min(top,c.y);bottom=Math.max(bottom,c.y+c.height);
        sumW+=c.width;sumH+=c.height;
      });
      reference={width:sumW/cards.length,height:sumH/cards.length};
      var cx=(left+right)/2;
      roi={x0:Math.max(0,Math.floor(cx-reference.width*3.3)),
        x1:Math.min(w,Math.ceil(cx+reference.width*3.3)),
        y0:Math.min(h,Math.floor(bottom+reference.height*.25)),
        y1:Math.min(h,Math.ceil(bottom+reference.height*3.7))};
    } else if(h/w>1.65&&h/w<2.65){
      // Known portrait layout with hero cards at the bottom center.
      roi={x0:Math.floor(w*.16),x1:Math.ceil(w*.84),
        y0:Math.floor(h*.63),y1:Math.ceil(h*.93)};
    } else return [];
    if(roi.y1<=roi.y0||roi.x1<=roi.x0)return [];
    var already=brightCards.filter(function(c){
      var cx=c.x+c.width/2,cy=c.y+c.height/2;
      return cx>roi.x0&&cx<roi.x1&&cy>roi.y0&&cy<roi.y1&&
        (!reference||(c.width>.7*reference.width&&c.width<1.7*reference.width));
    });
    if(already.length>=2)return [];
    var flags=new Uint8Array(size),visited=new Uint8Array(size);
    var queue=new Int32Array((roi.x1-roi.x0)*(roi.y1-roi.y0));
    for(var y=roi.y0;y<roi.y1;y++)for(var x=roi.x0;x<roi.x1;x++){
      var at=(y*w+x)*4,r=d[at],g=d[at+1],b=d[at+2];
      var lo=Math.min(r,g,b),hi=Math.max(r,g,b);
      if(lo>=115&&hi-lo<=65)flags[y*w+x]=1;
    }
    var minArea=Math.max(75,Math.round(size*.00045)),out=[];
    for(y=roi.y0;y<roi.y1;y++)for(x=roi.x0;x<roi.x1;x++){
      var start=y*w+x;
      if(!flags[start]||visited[start])continue;
      var head=0,tail=1,minX=x,maxX=x,minY=y,maxY=y;
      queue[0]=start;visited[start]=1;
      while(head<tail){
        var pos=queue[head++],px=pos%w,py=(pos/w)|0;
        if(px<minX)minX=px;if(px>maxX)maxX=px;
        if(py<minY)minY=py;if(py>maxY)maxY=py;
        for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
          if(!dx&&!dy)continue;
          var nx=px+dx,ny=py+dy;
          if(nx<roi.x0||nx>=roi.x1||ny<roi.y0||ny>=roi.y1)continue;
          var j=ny*w+nx;
          if(flags[j]&&!visited[j]){visited[j]=1;queue[tail++]=j;}
        }
      }
      var cw=maxX-minX+1,ch=maxY-minY+1,fill=tail/(cw*ch);
      if(tail<minArea||cw<Math.max(10,w*.025)||ch<Math.max(20,h*.03)||
         cw/ch<.5||cw/ch>.86||fill<.48||fill>1.01)continue;
      if(reference){
        if(cw<reference.width*.7||cw>reference.width*1.65||
           ch<reference.height*.75||ch>reference.height*1.7)continue;
      }else if(cw<w*.07||cw>w*.22||ch<h*.065||ch>h*.19)continue;
      var box={x:minX,y:minY,width:cw,height:ch,pixelArea:tail,fill:fill,shaded:true};
      var duplicate=brightCards.concat(out).some(function(other){
        var ax=Math.max(box.x,other.x),ay=Math.max(box.y,other.y);
        var bx=Math.min(box.x+box.width,other.x+other.width);
        var by=Math.min(box.y+box.height,other.y+other.height);
        var intersection=Math.max(0,bx-ax)*Math.max(0,by-ay);
        return intersection>Math.min(box.width*box.height,other.width*other.height)*.42;
      });
      if(!duplicate)out.push(box);
    }
    // Shaded cards are accepted only as a plausible two-card pair,
    // avoiding random gray UI boxes that resemble a single playing card.
    var usable=out.filter(function(a){
      return out.concat(already).some(function(b){
        if(b===a)return false;
        var ay=a.y+a.height/2,by=b.y+b.height/2;
        return Math.abs(ay-by)<Math.max(a.height,b.height)*.22&&
          Math.abs(a.width-b.width)<Math.max(a.width,b.width)*.35&&
          Math.abs(a.x-b.x)>Math.min(a.width,b.width)*.55&&
          Math.abs(a.x-b.x)<Math.max(a.width,b.width)*1.65;
      });
    });
    return usable;
  }


  // Salvage the second, closely adjacent face-up hero card when glare, a
  // bottom seat avatar or a shared white edge prevents component detection.
  // Geometry is only used to propose candidate rectangles: card-face pixels
  // must independently validate the proposal. No identity is inferred here.
  function recoverHeroPair(img,boxes,prior){
    var w=img.width,h=img.height,d=img.data,portrait=h/w>1.65&&h/w<2.7;
    if(!portrait)return boxes;
    var eligible=boxes.filter(function(b){
      var cx=(b.x+b.width*.5)/w,cy=(b.y+b.height*.5)/h;
      return cx>.15&&cx<.85&&cy>.67&&cy<.92&&
       b.width>=w*.038&&b.width<=w*.32&&
       b.height>=h*.06&&b.height<=h*.30;
    }).sort(function(a,b){return a.x-b.x;});
    function sameRow(a,b){
      return Math.abs((a.y+a.height*.5)-(b.y+b.height*.5))<
       Math.max(a.height,b.height)*.19&&
       Math.abs(a.width-b.width)<Math.max(a.width,b.width)*.40&&
       Math.abs(a.x-b.x)>Math.min(a.width,b.width)*.68&&
       Math.abs(a.x-b.x)<Math.max(a.width,b.width)*1.56;
    }
    if(eligible.length===0)return boxes;
    if(eligible.some(function(a,i){return eligible.some(function(b,j){
      return i!==j&&sameRow(a,b);
    });}))return boxes;
    function patchScore(box){
      var x0=Math.max(0,Math.floor(box.x+box.width*.17));
      var x1=Math.min(w-1,Math.floor(box.x+box.width*.78));
      var y0=Math.max(0,Math.floor(box.y+box.height*.13));
      var y1=Math.min(h-1,Math.floor(box.y+box.height*.66));
      if(x1<=x0||y1<=y0)return 0;
      var white=0,total=0;
      for(var y=y0;y<=y1;y+=3)for(var x=x0;x<=x1;x+=3){
        var p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2];
        total++;
        if(Math.min(r,g,b)>=177&&Math.max(r,g,b)-Math.min(r,g,b)<76)white++;
      }
      return total?white/total:0;
    }
    function intersects(box){
      return boxes.some(function(other){
       var dx=Math.max(0,Math.min(box.x+box.width,other.x+other.width)-
        Math.max(box.x,other.x));
       var dy=Math.max(0,Math.min(box.y+box.height,other.y+other.height)-
        Math.max(box.y,other.y));
       return dx*dy>box.width*box.height*.22;
      });
    }
    // Prefer an independently confirmed prior location for the missing
    // slot, then consider immediate left/right neighbors of a detected card.
    var suggestions=[],older=(prior&&prior.hero)||[];
    for(var p=0;p<older.length;p++)if(older[p]&&older[p].box){
      var hist=older[p].box;
      if(eligible.some(function(b){
       return Math.abs((hist.x+hist.width*.5)-(b.x+b.width*.5))<
        Math.max(hist.width,b.width)*.32;
      }))continue;
      var nearest=eligible.some(function(b){return sameRow(b,hist);});
      if(nearest)suggestions.push({
       x:Math.round(hist.x),y:Math.round(hist.y),
       width:Math.round(hist.width),height:Math.round(hist.height),
       fromMemory:true
      });
    }
    eligible.forEach(function(b){
      [-1,1].forEach(function(sign){
        [0.98,1.06,1.16].forEach(function(step){
          suggestions.push({
            x:Math.round(b.x+sign*b.width*step),
            y:b.y,width:b.width,height:b.height
          });
        });
      });
    });
    var winning=null;
    suggestions.forEach(function(c){
      if(c.x<0||c.y<0||c.x+c.width>w||c.y+c.height>h)return;
      var cx=(c.x+c.width*.5)/w,cy=(c.y+c.height*.5)/h;
      if(cx<.17||cx>.83||cy<.67||cy>.91||intersects(c))return;
      if(!eligible.some(function(b){return sameRow(c,b);}))return;
      var score=patchScore(c);
      // Most of the clean top/inner card must actually be near white.
      if(score<.66)return;
      score+=c.fromMemory?.08:0;
      var pairCenter=(eligible[0].x+eligible[0].width*.5+
         c.x+c.width*.5)/(2*w);
      score-=Math.abs(pairCenter-.5)*.16;
      if(!winning||score>winning.score)winning={box:c,score:score};
    });
    if(!winning)return boxes;
    var out=boxes.slice(),newCard=winning.box;
    out.push({x:newCard.x,y:newCard.y,width:newCard.width,
      height:newCard.height,guided:true,fill:winning.score});
    out.sort(function(a,b){return a.x-b.x;});
    return out;
  }

  // Require repeated detection before declaring a count stable.
  // This deliberately does not declare individual ranks/suits.
  function createStabilizer(required) {
    var previous = null, repeat = 0, need = Math.max(2, required || 3);
    return {
      update: function(boxes) {
        var count = boxes.length;
        repeat = (count === previous) ? repeat + 1 : 1;
        previous = count;
        return {count:count, stable:repeat>=need};
      },
      reset: function(){previous=null;repeat=0;}
    };
  }
  root.PokerCardDetector = {detect:detect,recoverHeroPair:recoverHeroPair,createStabilizer:createStabilizer};
}(typeof window !== 'undefined' ? window : self));