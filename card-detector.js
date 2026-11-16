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
    found.sort(function(a,b){return a.x-b.x;});
    return found;
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