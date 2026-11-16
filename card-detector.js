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
  root.PokerCardDetector = {detect:detect,createStabilizer:createStabilizer};
}(typeof window !== 'undefined' ? window : self));