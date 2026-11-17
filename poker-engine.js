/* Texas Hold'em probability simulation.
   Local Monte Carlo. Opponents have uniformly random unknown hands.
   No network and no use of camera images. */
(function (root) {
  'use strict';
  var RANKS = '23456789TJQKA', SUITS = 'cdhs', SYMBOLS = '♣♦♥♠';
  var HAND_NAMES = ['Висока карта','Чифт','Два чифта','Тройка','Стрейт','Флъш','Фул хаус','Каре','Стрейт флъш'];

  function idFromCode(code) {
    if (typeof code !== 'string') return -1;
    var value = code.trim().replace(/^10/i,'T');
    if (value.length !== 2) return -1;
    var rank = RANKS.indexOf(value.charAt(0).toUpperCase());
    var suit = SUITS.indexOf(value.charAt(1).toLowerCase());
    if (suit < 0) suit = SYMBOLS.indexOf(value.charAt(1));
    return rank < 0 || suit < 0 ? -1 : suit * 13 + rank;
  }
  function label(id) {
    if (typeof id !== 'number' || id !== (id | 0) || id < 0 || id > 51) return '?';
    return (RANKS.charAt(id % 13)==='T'?'10':RANKS.charAt(id % 13)) + SYMBOLS.charAt(Math.floor(id / 13));
  }
  function encode(category, a, b, c, d, e) {
    return (((((category * 15 + (a||0)) * 15 + (b||0)) * 15 + (c||0)) * 15 + (d||0)) * 15 + (e||0));
  }
  function straight(mask) {
    for (var high = 14; high >= 6; high--) {
      if ((mask & (31 << (high - 4))) === (31 << (high - 4))) return high;
    }
    if ((mask & (1 << 14)) && ((mask & (15 << 2)) === (15 << 2))) return 5;
    return 0;
  }
  /* Lexicographically ranked best 5-card hand among seven cards. */
  function evaluate(seven) {
    if (!seven || seven.length !== 7) throw new Error('Оценката изисква 7 карти.');
    var ranks = [], suits = [0,0,0,0], masks = [0,0,0,0], all = 0, i;
    for (i = 0; i <= 14; i++) ranks.push(0);
    for (i = 0; i < 7; i++) {
      var id = seven[i];
      if (!Number.isInteger(id) || id < 0 || id > 51) throw new Error('Невалидна карта.');
      var rank = id % 13 + 2, suit = Math.floor(id / 13);
      ranks[rank]++; suits[suit]++; masks[suit] |= 1 << rank; all |= 1 << rank;
    }
    var flush = -1;
    for (i = 0; i < 4; i++) if (suits[i] >= 5) flush = i;
    if (flush >= 0) {
      var sflush = straight(masks[flush]);
      if (sflush) return encode(8, sflush);
    }
    for (i = 14; i >= 2; i--) if (ranks[i] === 4) {
      for (var j = 14; j >= 2; j--) if (j !== i && ranks[j]) return encode(7, i, j);
    }
    var three = 0, fullPair = 0;
    for (i = 14; i >= 2; i--) if (ranks[i] >= 3 && !three) three = i;
    if (three) for (i = 14; i >= 2; i--) if (i !== three && ranks[i] >= 2) {fullPair = i; break;}
    if (three && fullPair) return encode(6, three, fullPair);
    if (flush >= 0) {
      var f = [];
      for (i = 14; i >= 2; i--) if (masks[flush] & (1 << i)) f.push(i);
      return encode(5, f[0], f[1], f[2], f[3], f[4]);
    }
    var st = straight(all);
    if (st) return encode(4, st);
    if (three) {
      var t = [];
      for (i = 14; i >= 2; i--) if (i !== three && ranks[i]) t.push(i);
      return encode(3, three, t[0], t[1]);
    }
    var pairs = [];
    for (i = 14; i >= 2; i--) if (ranks[i] >= 2) pairs.push(i);
    if (pairs.length >= 2) {
      for (i = 14; i >= 2; i--) if (i !== pairs[0] && i !== pairs[1] && ranks[i]) {
        return encode(2, pairs[0], pairs[1], i);
      }
    }
    if (pairs.length) {
      var p = [];
      for (i = 14; i >= 2; i--) if (i !== pairs[0] && ranks[i]) p.push(i);
      return encode(1, pairs[0], p[0], p[1], p[2]);
    }
    var h = [];
    for (i = 14; i >= 2; i--) if (ranks[i]) h.push(i);
    return encode(0, h[0], h[1], h[2], h[3], h[4]);
  }
  function category(score) { return Math.floor(score / 759375); } // 15^5
  /*
   * Adaptive probability engine:
   * Enumerates every possible remaining deal when the sample space is small.
   * Otherwise performs incremental Monte Carlo and reports sampling uncertainty.
   * Unknown opponents are uniformly random; it cannot know their actual ranges.
   */
  var EXACT_LIMIT = 50000;
  function combinationsCount(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    var count = 1;
    for (var i = 1; i <= k; i++) count = count * (n - k + i) / i;
    return Math.round(count);
  }
  function simulator(input) {
    var hero = input.hero || [], board = input.board || [], dead = input.dead || [];
    var players = input.players, iterations = input.iterations || 10000;
    var knownOpponents = input.knownOpponents || [];
    if (hero.length !== 2) throw new Error('Посочи и двете лични карти.');
    if ([0,3,4,5].indexOf(board.length) < 0) throw new Error('Общите карти трябва да са 0, 3, 4 или 5.');
    if (!Number.isInteger(players) || players < 2 || players > 9) throw new Error('Избери 2–9 активни играчи, включително теб.');
    if (!Number.isInteger(iterations) || iterations < 100 || iterations > 50000) throw new Error('Невалиден брой симулации.');
    if (!Array.isArray(knownOpponents) || knownOpponents.length > players - 1)
      throw new Error('Невалиден списък с разкрити ръце на противници.');
    var known = hero.concat(board, dead), seen = {}, deck = [], i;
    for (i = 0; i < knownOpponents.length; i++) {
      if (!Array.isArray(knownOpponents[i]) || knownOpponents[i].length !== 2)
        throw new Error('Всяка разкрита ръка трябва да съдържа точно две карти.');
      known = known.concat(knownOpponents[i]);
    }
    for (i = 0; i < known.length; i++) {
      var id = known[i];
      if (!Number.isInteger(id) || id < 0 || id > 51) throw new Error('Невалидна карта.');
      if (seen[id]) throw new Error('Картата ' + label(id) + ' е въведена два пъти.');
      seen[id] = true;
    }
    for (i = 0; i < 52; i++) if (!seen[i]) deck.push(i);
    var missingBoard = 5 - board.length, opponents = players - 1;
    var unknownOpponents = opponents - knownOpponents.length;
    var draws = missingBoard + unknownOpponents * 2;
    if (draws > deck.length) throw new Error('Недостатъчно останали карти за този брой играчи.');

    // Count distinct unordered boards and unordered opponent hands. Opponent
    // seats remain distinct, so their assignments are not divided by factorials.
    var spaces = combinationsCount(deck.length, missingBoard);
    var left = deck.length - missingBoard;
    for (i = 0; i < unknownOpponents; i++) {
      spaces *= combinationsCount(left, 2);
      left -= 2;
      if (spaces > EXACT_LIMIT) break;
    }
    var exact = spaces <= EXACT_LIMIT;
    var total = exact ? spaces : iterations;
    var count = 0, wins = 0, losses = 0, ties = 0, share = 0;
    var categories = [0,0,0,0,0,0,0,0,0];

    // Lazy combination generators never store the full enumeration in RAM.
    function* choose(pool, length, offset, selected) {
      if (selected.length === length) {
        yield selected.slice();
        return;
      }
      var needed = length - selected.length;
      for (var ix = offset; ix <= pool.length - needed; ix++) {
        selected.push(pool[ix]);
        yield* choose(pool, length, ix + 1, selected);
        selected.pop();
      }
    }
    function* hands(pool, leftHands, picked, boardExtra) {
      if (!leftHands) {
        yield {extra:boardExtra, unknown:picked.slice()};
        return;
      }
      for (var a = 0; a < pool.length - 1; a++) {
        for (var b = a + 1; b < pool.length; b++) {
          var smaller = pool.slice(0, a).concat(pool.slice(a + 1, b),pool.slice(b + 1));
          picked.push([pool[a],pool[b]]);
          yield* hands(smaller, leftHands - 1, picked, boardExtra);
          picked.pop();
        }
      }
    }
    function* exactDeals() {
      for (var extra of choose(deck, missingBoard, 0, [])) {
        var remaining = deck.filter(function (id) {return extra.indexOf(id) === -1;});
        yield* hands(remaining, unknownOpponents, [], extra);
      }
    }
    var exactIterator = exact ? exactDeals() : null;
    function runTrial(extra, unknown) {
      var finalBoard = board.concat(extra);
      var own = evaluate(hero.concat(finalBoard));
      categories[category(own)]++;
      var best = own, winnerCount = 1, pos;
      for (pos = 0; pos < opponents; pos++) {
        var hand = pos < knownOpponents.length ?
          knownOpponents[pos] : unknown[pos - knownOpponents.length];
        var other = evaluate(hand.concat(finalBoard));
        if (other > best) {best = other; winnerCount = 1;}
        else if (other === best) winnerCount++;
      }
      var part = 0;
      if (own < best) losses++;
      else if (winnerCount > 1) {ties++; part = 1 / winnerCount;}
      else {wins++; part = 1;}
      share += part;
      count++;
    }
    function runRandom() {
      var pool = deck.slice();
      for (var j = 0; j < draws; j++) {
        var k = j + Math.floor(Math.random() * (pool.length - j));
        var tmp = pool[j];pool[j] = pool[k];pool[k] = tmp;
      }
      var extra = pool.slice(0, missingBoard);
      var randomHands = [], position = missingBoard;
      for (var q = 0; q < unknownOpponents; q++)
        randomHands.push([pool[position++],pool[position++]]);
      runTrial(extra, randomHands);
    }
    function result() {
      var denom = count || 1;
      var margin = null;
      if (exact) margin = 0;
      else if (count > 0) {
        // Hoeffding's two-sided 95% bound for bounded split-pot equity in [0,1].
        // Unlike a normal approximation it does not imply zero uncertainty
        // if all sampled outcomes happened to be wins.
        margin = 100 * Math.sqrt(Math.log(40) / (2 * count));
      }
      return {
        done:count, total:total, players:players,
        exact:exact, method:exact?'exact':'monte-carlo',
        equityMargin95:margin,
        knownOpponents:knownOpponents.length,
        win:100*wins/denom, loss:100*losses/denom,
        tie:100*ties/denom, equity:100*share/denom,
        categories:categories.map(function (n) {return 100*n/denom;}),
        names:HAND_NAMES.slice()
      };
    }
    return {
      batch:function (size) {
        var end = Math.min(total, count + Math.max(1,Math.floor(size || 1)));
        var deadline = Date.now() + 8;
        do {
          if (exact) {
            var next = exactIterator.next();
            if (next.done) {
              if (count !== total) throw new Error('Непълно точно изброяване на комбинациите.');
              break;
            }
            runTrial(next.value.extra, next.value.unknown);
          } else runRandom();
        } while (count < end && Date.now() < deadline);
        return count >= total;
      },
      result:result
    };
  }
  root.PokerMath = {
    idFromCode:idFromCode, label:label, evaluate:evaluate, category:category,
    simulator:simulator, handNames:HAND_NAMES.slice()
  };
}(typeof window !== 'undefined' ? window : self));