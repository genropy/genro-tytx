var TYTX = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    CONTENT_TYPES: () => CONTENT_TYPES,
    __version__: () => __version__,
    createDecimal: () => createDecimal,
    fetchTytx: () => fetchTytx,
    fromTytx: () => fromTytx,
    getDecimalLibrary: () => getDecimalLibrary,
    getRegisteredType: () => getRegisteredType,
    getTransport: () => getTransport,
    isDecimal: () => isDecimal2,
    registerClass: () => registerClass,
    registerType: () => registerType,
    setDecimalLibrary: () => setDecimalLibrary,
    toTytx: () => toTytx
  });

  // node_modules/decimal.js/decimal.mjs
  var EXP_LIMIT = 9e15;
  var MAX_DIGITS = 1e9;
  var NUMERALS = "0123456789abcdef";
  var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
  var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
  var DEFAULTS = {
    // These values must be integers within the stated ranges (inclusive).
    // Most of these values can be changed at run-time using the `Decimal.config` method.
    // The maximum number of significant digits of the result of a calculation or base conversion.
    // E.g. `Decimal.config({ precision: 20 });`
    precision: 20,
    // 1 to MAX_DIGITS
    // The rounding mode used when rounding to `precision`.
    //
    // ROUND_UP         0 Away from zero.
    // ROUND_DOWN       1 Towards zero.
    // ROUND_CEIL       2 Towards +Infinity.
    // ROUND_FLOOR      3 Towards -Infinity.
    // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
    // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
    // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
    // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
    // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
    //
    // E.g.
    // `Decimal.rounding = 4;`
    // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
    rounding: 4,
    // 0 to 8
    // The modulo mode used when calculating the modulus: a mod n.
    // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
    // The remainder (r) is calculated as: r = a - n * q.
    //
    // UP         0 The remainder is positive if the dividend is negative, else is negative.
    // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
    // FLOOR      3 The remainder has the same sign as the divisor (Python %).
    // HALF_EVEN  6 The IEEE 754 remainder function.
    // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
    //
    // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
    // division (9) are commonly used for the modulus operation. The other rounding modes can also
    // be used, but they may not give useful results.
    modulo: 1,
    // 0 to 9
    // The exponent value at and beneath which `toString` returns exponential notation.
    // JavaScript numbers: -7
    toExpNeg: -7,
    // 0 to -EXP_LIMIT
    // The exponent value at and above which `toString` returns exponential notation.
    // JavaScript numbers: 21
    toExpPos: 21,
    // 0 to EXP_LIMIT
    // The minimum exponent value, beneath which underflow to zero occurs.
    // JavaScript numbers: -324  (5e-324)
    minE: -EXP_LIMIT,
    // -1 to -EXP_LIMIT
    // The maximum exponent value, above which overflow to Infinity occurs.
    // JavaScript numbers: 308  (1.7976931348623157e+308)
    maxE: EXP_LIMIT,
    // 1 to EXP_LIMIT
    // Whether to use cryptographically-secure random number generation, if available.
    crypto: false
    // true/false
  };
  var inexact;
  var quadrant;
  var external = true;
  var decimalError = "[DecimalError] ";
  var invalidArgument = decimalError + "Invalid argument: ";
  var precisionLimitExceeded = decimalError + "Precision limit exceeded";
  var cryptoUnavailable = decimalError + "crypto unavailable";
  var tag = "[object Decimal]";
  var mathfloor = Math.floor;
  var mathpow = Math.pow;
  var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
  var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
  var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
  var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
  var BASE = 1e7;
  var LOG_BASE = 7;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var LN10_PRECISION = LN10.length - 1;
  var PI_PRECISION = PI.length - 1;
  var P = { toStringTag: tag };
  P.absoluteValue = P.abs = function() {
    var x = new this.constructor(this);
    if (x.s < 0) x.s = 1;
    return finalise(x);
  };
  P.ceil = function() {
    return finalise(new this.constructor(this), this.e + 1, 2);
  };
  P.clampedTo = P.clamp = function(min2, max2) {
    var k, x = this, Ctor = x.constructor;
    min2 = new Ctor(min2);
    max2 = new Ctor(max2);
    if (!min2.s || !max2.s) return new Ctor(NaN);
    if (min2.gt(max2)) throw Error(invalidArgument + max2);
    k = x.cmp(min2);
    return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
  };
  P.comparedTo = P.cmp = function(y) {
    var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
    if (!xd || !yd) {
      return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
    }
    if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
    if (xs !== ys) return xs;
    if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
    xdL = xd.length;
    ydL = yd.length;
    for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
      if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
    }
    return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
  };
  P.cosine = P.cos = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.d) return new Ctor(NaN);
    if (!x.d[0]) return new Ctor(1);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
    Ctor.rounding = 1;
    x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
  };
  P.cubeRoot = P.cbrt = function() {
    var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    external = false;
    s = x.s * mathpow(x.s * x, 1 / 3);
    if (!s || Math.abs(s) == 1 / 0) {
      n = digitsToString(x.d);
      e = x.e;
      if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
      s = mathpow(n, 1 / 3);
      e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new Ctor(n);
      r.s = x.s;
    } else {
      r = new Ctor(s.toString());
    }
    sd = (e = Ctor.precision) + 3;
    for (; ; ) {
      t = r;
      t3 = t.times(t).times(t);
      t3plusx = t3.plus(x);
      r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
      if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
        n = n.slice(sd - 3, sd + 1);
        if (n == "9999" || !rep && n == "4999") {
          if (!rep) {
            finalise(t, e + 1, 0);
            if (t.times(t).times(t).eq(x)) {
              r = t;
              break;
            }
          }
          sd += 4;
          rep = 1;
        } else {
          if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
            finalise(r, e + 1, 1);
            m = !r.times(r).times(r).eq(x);
          }
          break;
        }
      }
    }
    external = true;
    return finalise(r, e, Ctor.rounding, m);
  };
  P.decimalPlaces = P.dp = function() {
    var w, d = this.d, n = NaN;
    if (d) {
      w = d.length - 1;
      n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
      w = d[w];
      if (w) for (; w % 10 == 0; w /= 10) n--;
      if (n < 0) n = 0;
    }
    return n;
  };
  P.dividedBy = P.div = function(y) {
    return divide(this, new this.constructor(y));
  };
  P.dividedToIntegerBy = P.divToInt = function(y) {
    var x = this, Ctor = x.constructor;
    return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
  };
  P.equals = P.eq = function(y) {
    return this.cmp(y) === 0;
  };
  P.floor = function() {
    return finalise(new this.constructor(this), this.e + 1, 3);
  };
  P.greaterThan = P.gt = function(y) {
    return this.cmp(y) > 0;
  };
  P.greaterThanOrEqualTo = P.gte = function(y) {
    var k = this.cmp(y);
    return k == 1 || k === 0;
  };
  P.hyperbolicCosine = P.cosh = function() {
    var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
    if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
    if (x.isZero()) return one;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
    Ctor.rounding = 1;
    len = x.d.length;
    if (len < 32) {
      k = Math.ceil(len / 3);
      n = (1 / tinyPow(4, k)).toString();
    } else {
      k = 16;
      n = "2.3283064365386962890625e-10";
    }
    x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
    var cosh2_x, i = k, d8 = new Ctor(8);
    for (; i--; ) {
      cosh2_x = x.times(x);
      x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
    }
    return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
  };
  P.hyperbolicSine = P.sinh = function() {
    var k, pr, rm, len, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
    Ctor.rounding = 1;
    len = x.d.length;
    if (len < 3) {
      x = taylorSeries(Ctor, 2, x, x, true);
    } else {
      k = 1.4 * Math.sqrt(len);
      k = k > 16 ? 16 : k | 0;
      x = x.times(1 / tinyPow(5, k));
      x = taylorSeries(Ctor, 2, x, x, true);
      var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
      for (; k--; ) {
        sinh2_x = x.times(x);
        x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
      }
    }
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(x, pr, rm, true);
  };
  P.hyperbolicTangent = P.tanh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(x.s);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 7;
    Ctor.rounding = 1;
    return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
  };
  P.inverseCosine = P.acos = function() {
    var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
    if (k !== -1) {
      return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
    }
    if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
    Ctor.precision = pr + 6;
    Ctor.rounding = 1;
    x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(2);
  };
  P.inverseHyperbolicCosine = P.acosh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
    if (!x.isFinite()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
    Ctor.rounding = 1;
    external = false;
    x = x.times(x).minus(1).sqrt().plus(x);
    external = true;
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.ln();
  };
  P.inverseHyperbolicSine = P.asinh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
    Ctor.rounding = 1;
    external = false;
    x = x.times(x).plus(1).sqrt().plus(x);
    external = true;
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.ln();
  };
  P.inverseHyperbolicTangent = P.atanh = function() {
    var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    xsd = x.sd();
    if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
    Ctor.precision = wpr = xsd - x.e;
    x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
    Ctor.precision = pr + 4;
    Ctor.rounding = 1;
    x = x.ln();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(0.5);
  };
  P.inverseSine = P.asin = function() {
    var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
    if (x.isZero()) return new Ctor(x);
    k = x.abs().cmp(1);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (k !== -1) {
      if (k === 0) {
        halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
        halfPi.s = x.s;
        return halfPi;
      }
      return new Ctor(NaN);
    }
    Ctor.precision = pr + 6;
    Ctor.rounding = 1;
    x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(2);
  };
  P.inverseTangent = P.atan = function() {
    var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
    if (!x.isFinite()) {
      if (!x.s) return new Ctor(NaN);
      if (pr + 4 <= PI_PRECISION) {
        r = getPi(Ctor, pr + 4, rm).times(0.5);
        r.s = x.s;
        return r;
      }
    } else if (x.isZero()) {
      return new Ctor(x);
    } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.25);
      r.s = x.s;
      return r;
    }
    Ctor.precision = wpr = pr + 10;
    Ctor.rounding = 1;
    k = Math.min(28, wpr / LOG_BASE + 2 | 0);
    for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
    external = false;
    j = Math.ceil(wpr / LOG_BASE);
    n = 1;
    x2 = x.times(x);
    r = new Ctor(x);
    px = x;
    for (; i !== -1; ) {
      px = px.times(x2);
      t = r.minus(px.div(n += 2));
      px = px.times(x2);
      r = t.plus(px.div(n += 2));
      if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
    }
    if (k) r = r.times(2 << k - 1);
    external = true;
    return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
  };
  P.isFinite = function() {
    return !!this.d;
  };
  P.isInteger = P.isInt = function() {
    return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
  };
  P.isNaN = function() {
    return !this.s;
  };
  P.isNegative = P.isNeg = function() {
    return this.s < 0;
  };
  P.isPositive = P.isPos = function() {
    return this.s > 0;
  };
  P.isZero = function() {
    return !!this.d && this.d[0] === 0;
  };
  P.lessThan = P.lt = function(y) {
    return this.cmp(y) < 0;
  };
  P.lessThanOrEqualTo = P.lte = function(y) {
    return this.cmp(y) < 1;
  };
  P.logarithm = P.log = function(base) {
    var isBase10, d, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
    if (base == null) {
      base = new Ctor(10);
      isBase10 = true;
    } else {
      base = new Ctor(base);
      d = base.d;
      if (base.s < 0 || !d || !d[0] || base.eq(1)) return new Ctor(NaN);
      isBase10 = base.eq(10);
    }
    d = arg.d;
    if (arg.s < 0 || !d || !d[0] || arg.eq(1)) {
      return new Ctor(d && !d[0] ? -1 / 0 : arg.s != 1 ? NaN : d ? 0 : 1 / 0);
    }
    if (isBase10) {
      if (d.length > 1) {
        inf = true;
      } else {
        for (k = d[0]; k % 10 === 0; ) k /= 10;
        inf = k !== 1;
      }
    }
    external = false;
    sd = pr + guard;
    num = naturalLogarithm(arg, sd);
    denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
    r = divide(num, denominator, sd, 1);
    if (checkRoundingDigits(r.d, k = pr, rm)) {
      do {
        sd += 10;
        num = naturalLogarithm(arg, sd);
        denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
        r = divide(num, denominator, sd, 1);
        if (!inf) {
          if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
            r = finalise(r, pr + 1, 0);
          }
          break;
        }
      } while (checkRoundingDigits(r.d, k += 10, rm));
    }
    external = true;
    return finalise(r, pr, rm);
  };
  P.minus = P.sub = function(y) {
    var d, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.d) {
      if (!x.s || !y.s) y = new Ctor(NaN);
      else if (x.d) y.s = -y.s;
      else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
      return y;
    }
    if (x.s != y.s) {
      y.s = -y.s;
      return x.plus(y);
    }
    xd = x.d;
    yd = y.d;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (!xd[0] || !yd[0]) {
      if (yd[0]) y.s = -y.s;
      else if (xd[0]) y = new Ctor(x);
      else return new Ctor(rm === 3 ? -0 : 0);
      return external ? finalise(y, pr, rm) : y;
    }
    e = mathfloor(y.e / LOG_BASE);
    xe = mathfloor(x.e / LOG_BASE);
    xd = xd.slice();
    k = xe - e;
    if (k) {
      xLTy = k < 0;
      if (xLTy) {
        d = xd;
        k = -k;
        len = yd.length;
      } else {
        d = yd;
        e = xe;
        len = xd.length;
      }
      i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
      if (k > i) {
        k = i;
        d.length = 1;
      }
      d.reverse();
      for (i = k; i--; ) d.push(0);
      d.reverse();
    } else {
      i = xd.length;
      len = yd.length;
      xLTy = i < len;
      if (xLTy) len = i;
      for (i = 0; i < len; i++) {
        if (xd[i] != yd[i]) {
          xLTy = xd[i] < yd[i];
          break;
        }
      }
      k = 0;
    }
    if (xLTy) {
      d = xd;
      xd = yd;
      yd = d;
      y.s = -y.s;
    }
    len = xd.length;
    for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
    for (i = yd.length; i > k; ) {
      if (xd[--i] < yd[i]) {
        for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
        --xd[j];
        xd[i] += BASE;
      }
      xd[i] -= yd[i];
    }
    for (; xd[--len] === 0; ) xd.pop();
    for (; xd[0] === 0; xd.shift()) --e;
    if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
    y.d = xd;
    y.e = getBase10Exponent(xd, e);
    return external ? finalise(y, pr, rm) : y;
  };
  P.modulo = P.mod = function(y) {
    var q, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
    if (!y.d || x.d && !x.d[0]) {
      return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
    }
    external = false;
    if (Ctor.modulo == 9) {
      q = divide(x, y.abs(), 0, 3, 1);
      q.s *= y.s;
    } else {
      q = divide(x, y, 0, Ctor.modulo, 1);
    }
    q = q.times(y);
    external = true;
    return x.minus(q);
  };
  P.naturalExponential = P.exp = function() {
    return naturalExponential(this);
  };
  P.naturalLogarithm = P.ln = function() {
    return naturalLogarithm(this);
  };
  P.negated = P.neg = function() {
    var x = new this.constructor(this);
    x.s = -x.s;
    return finalise(x);
  };
  P.plus = P.add = function(y) {
    var carry, d, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.d) {
      if (!x.s || !y.s) y = new Ctor(NaN);
      else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
      return y;
    }
    if (x.s != y.s) {
      y.s = -y.s;
      return x.minus(y);
    }
    xd = x.d;
    yd = y.d;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (!xd[0] || !yd[0]) {
      if (!yd[0]) y = new Ctor(x);
      return external ? finalise(y, pr, rm) : y;
    }
    k = mathfloor(x.e / LOG_BASE);
    e = mathfloor(y.e / LOG_BASE);
    xd = xd.slice();
    i = k - e;
    if (i) {
      if (i < 0) {
        d = xd;
        i = -i;
        len = yd.length;
      } else {
        d = yd;
        e = k;
        len = xd.length;
      }
      k = Math.ceil(pr / LOG_BASE);
      len = k > len ? k + 1 : len + 1;
      if (i > len) {
        i = len;
        d.length = 1;
      }
      d.reverse();
      for (; i--; ) d.push(0);
      d.reverse();
    }
    len = xd.length;
    i = yd.length;
    if (len - i < 0) {
      i = len;
      d = yd;
      yd = xd;
      xd = d;
    }
    for (carry = 0; i; ) {
      carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
      xd[i] %= BASE;
    }
    if (carry) {
      xd.unshift(carry);
      ++e;
    }
    for (len = xd.length; xd[--len] == 0; ) xd.pop();
    y.d = xd;
    y.e = getBase10Exponent(xd, e);
    return external ? finalise(y, pr, rm) : y;
  };
  P.precision = P.sd = function(z) {
    var k, x = this;
    if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
    if (x.d) {
      k = getPrecision(x.d);
      if (z && x.e + 1 > k) k = x.e + 1;
    } else {
      k = NaN;
    }
    return k;
  };
  P.round = function() {
    var x = this, Ctor = x.constructor;
    return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
  };
  P.sine = P.sin = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
    Ctor.rounding = 1;
    x = sine(Ctor, toLessThanHalfPi(Ctor, x));
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
  };
  P.squareRoot = P.sqrt = function() {
    var m, n, sd, r, rep, t, x = this, d = x.d, e = x.e, s = x.s, Ctor = x.constructor;
    if (s !== 1 || !d || !d[0]) {
      return new Ctor(!s || s < 0 && (!d || d[0]) ? NaN : d ? x : 1 / 0);
    }
    external = false;
    s = Math.sqrt(+x);
    if (s == 0 || s == 1 / 0) {
      n = digitsToString(d);
      if ((n.length + e) % 2 == 0) n += "0";
      s = Math.sqrt(n);
      e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new Ctor(n);
    } else {
      r = new Ctor(s.toString());
    }
    sd = (e = Ctor.precision) + 3;
    for (; ; ) {
      t = r;
      r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
      if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
        n = n.slice(sd - 3, sd + 1);
        if (n == "9999" || !rep && n == "4999") {
          if (!rep) {
            finalise(t, e + 1, 0);
            if (t.times(t).eq(x)) {
              r = t;
              break;
            }
          }
          sd += 4;
          rep = 1;
        } else {
          if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
            finalise(r, e + 1, 1);
            m = !r.times(r).eq(x);
          }
          break;
        }
      }
    }
    external = true;
    return finalise(r, e, Ctor.rounding, m);
  };
  P.tangent = P.tan = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 10;
    Ctor.rounding = 1;
    x = x.sin();
    x.s = 1;
    x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
  };
  P.times = P.mul = function(y) {
    var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
    y.s *= x.s;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
    }
    e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
    xdL = xd.length;
    ydL = yd.length;
    if (xdL < ydL) {
      r = xd;
      xd = yd;
      yd = r;
      rL = xdL;
      xdL = ydL;
      ydL = rL;
    }
    r = [];
    rL = xdL + ydL;
    for (i = rL; i--; ) r.push(0);
    for (i = ydL; --i >= 0; ) {
      carry = 0;
      for (k = xdL + i; k > i; ) {
        t = r[k] + yd[i] * xd[k - i - 1] + carry;
        r[k--] = t % BASE | 0;
        carry = t / BASE | 0;
      }
      r[k] = (r[k] + carry) % BASE | 0;
    }
    for (; !r[--rL]; ) r.pop();
    if (carry) ++e;
    else r.shift();
    y.d = r;
    y.e = getBase10Exponent(r, e);
    return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
  };
  P.toBinary = function(sd, rm) {
    return toStringBinary(this, 2, sd, rm);
  };
  P.toDecimalPlaces = P.toDP = function(dp, rm) {
    var x = this, Ctor = x.constructor;
    x = new Ctor(x);
    if (dp === void 0) return x;
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    return finalise(x, dp + x.e + 1, rm);
  };
  P.toExponential = function(dp, rm) {
    var str, x = this, Ctor = x.constructor;
    if (dp === void 0) {
      str = finiteToString(x, true);
    } else {
      checkInt32(dp, 0, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      x = finalise(new Ctor(x), dp + 1, rm);
      str = finiteToString(x, true, dp + 1);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toFixed = function(dp, rm) {
    var str, y, x = this, Ctor = x.constructor;
    if (dp === void 0) {
      str = finiteToString(x);
    } else {
      checkInt32(dp, 0, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      y = finalise(new Ctor(x), dp + x.e + 1, rm);
      str = finiteToString(y, false, dp + y.e + 1);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toFraction = function(maxD) {
    var d, d0, d1, d2, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
    if (!xd) return new Ctor(x);
    n1 = d0 = new Ctor(1);
    d1 = n0 = new Ctor(0);
    d = new Ctor(d1);
    e = d.e = getPrecision(xd) - x.e - 1;
    k = e % LOG_BASE;
    d.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
    if (maxD == null) {
      maxD = e > 0 ? d : n1;
    } else {
      n = new Ctor(maxD);
      if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
      maxD = n.gt(d) ? e > 0 ? d : n1 : n;
    }
    external = false;
    n = new Ctor(digitsToString(xd));
    pr = Ctor.precision;
    Ctor.precision = e = xd.length * LOG_BASE * 2;
    for (; ; ) {
      q = divide(n, d, 0, 1, 1);
      d2 = d0.plus(q.times(d1));
      if (d2.cmp(maxD) == 1) break;
      d0 = d1;
      d1 = d2;
      d2 = n1;
      n1 = n0.plus(q.times(d2));
      n0 = d2;
      d2 = d;
      d = n.minus(q.times(d2));
      n = d2;
    }
    d2 = divide(maxD.minus(d0), d1, 0, 1, 1);
    n0 = n0.plus(d2.times(n1));
    d0 = d0.plus(d2.times(d1));
    n0.s = n1.s = x.s;
    r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
    Ctor.precision = pr;
    external = true;
    return r;
  };
  P.toHexadecimal = P.toHex = function(sd, rm) {
    return toStringBinary(this, 16, sd, rm);
  };
  P.toNearest = function(y, rm) {
    var x = this, Ctor = x.constructor;
    x = new Ctor(x);
    if (y == null) {
      if (!x.d) return x;
      y = new Ctor(1);
      rm = Ctor.rounding;
    } else {
      y = new Ctor(y);
      if (rm === void 0) {
        rm = Ctor.rounding;
      } else {
        checkInt32(rm, 0, 8);
      }
      if (!x.d) return y.s ? x : y;
      if (!y.d) {
        if (y.s) y.s = x.s;
        return y;
      }
    }
    if (y.d[0]) {
      external = false;
      x = divide(x, y, 0, rm, 1).times(y);
      external = true;
      finalise(x);
    } else {
      y.s = x.s;
      x = y;
    }
    return x;
  };
  P.toNumber = function() {
    return +this;
  };
  P.toOctal = function(sd, rm) {
    return toStringBinary(this, 8, sd, rm);
  };
  P.toPower = P.pow = function(y) {
    var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
    if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
    x = new Ctor(x);
    if (x.eq(1)) return x;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (y.eq(1)) return finalise(x, pr, rm);
    e = mathfloor(y.e / LOG_BASE);
    if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
      r = intPow(Ctor, x, k, pr);
      return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
    }
    s = x.s;
    if (s < 0) {
      if (e < y.d.length - 1) return new Ctor(NaN);
      if ((y.d[e] & 1) == 0) s = 1;
      if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
        x.s = s;
        return x;
      }
    }
    k = mathpow(+x, yn);
    e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
    if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
    external = false;
    Ctor.rounding = x.s = 1;
    k = Math.min(12, (e + "").length);
    r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
    if (r.d) {
      r = finalise(r, pr + 5, 1);
      if (checkRoundingDigits(r.d, pr, rm)) {
        e = pr + 10;
        r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
        if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
      }
    }
    r.s = s;
    external = true;
    Ctor.rounding = rm;
    return finalise(r, pr, rm);
  };
  P.toPrecision = function(sd, rm) {
    var str, x = this, Ctor = x.constructor;
    if (sd === void 0) {
      str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    } else {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      x = finalise(new Ctor(x), sd, rm);
      str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toSignificantDigits = P.toSD = function(sd, rm) {
    var x = this, Ctor = x.constructor;
    if (sd === void 0) {
      sd = Ctor.precision;
      rm = Ctor.rounding;
    } else {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
    }
    return finalise(new Ctor(x), sd, rm);
  };
  P.toString = function() {
    var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.truncated = P.trunc = function() {
    return finalise(new this.constructor(this), this.e + 1, 1);
  };
  P.valueOf = P.toJSON = function() {
    var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    return x.isNeg() ? "-" + str : str;
  };
  function digitsToString(d) {
    var i, k, ws, indexOfLastWord = d.length - 1, str = "", w = d[0];
    if (indexOfLastWord > 0) {
      str += w;
      for (i = 1; i < indexOfLastWord; i++) {
        ws = d[i] + "";
        k = LOG_BASE - ws.length;
        if (k) str += getZeroString(k);
        str += ws;
      }
      w = d[i];
      ws = w + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
    } else if (w === 0) {
      return "0";
    }
    for (; w % 10 === 0; ) w /= 10;
    return str + w;
  }
  function checkInt32(i, min2, max2) {
    if (i !== ~~i || i < min2 || i > max2) {
      throw Error(invalidArgument + i);
    }
  }
  function checkRoundingDigits(d, i, rm, repeating) {
    var di, k, r, rd;
    for (k = d[0]; k >= 10; k /= 10) --i;
    if (--i < 0) {
      i += LOG_BASE;
      di = 0;
    } else {
      di = Math.ceil((i + 1) / LOG_BASE);
      i %= LOG_BASE;
    }
    k = mathpow(10, LOG_BASE - i);
    rd = d[di] % k | 0;
    if (repeating == null) {
      if (i < 3) {
        if (i == 0) rd = rd / 100 | 0;
        else if (i == 1) rd = rd / 10 | 0;
        r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
      } else {
        r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d[di + 1] / k / 100 | 0) == 0;
      }
    } else {
      if (i < 4) {
        if (i == 0) rd = rd / 1e3 | 0;
        else if (i == 1) rd = rd / 100 | 0;
        else if (i == 2) rd = rd / 10 | 0;
        r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
      } else {
        r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
      }
    }
    return r;
  }
  function convertBase(str, baseIn, baseOut) {
    var j, arr = [0], arrL, i = 0, strL = str.length;
    for (; i < strL; ) {
      for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
      arr[0] += NUMERALS.indexOf(str.charAt(i++));
      for (j = 0; j < arr.length; j++) {
        if (arr[j] > baseOut - 1) {
          if (arr[j + 1] === void 0) arr[j + 1] = 0;
          arr[j + 1] += arr[j] / baseOut | 0;
          arr[j] %= baseOut;
        }
      }
    }
    return arr.reverse();
  }
  function cosine(Ctor, x) {
    var k, len, y;
    if (x.isZero()) return x;
    len = x.d.length;
    if (len < 32) {
      k = Math.ceil(len / 3);
      y = (1 / tinyPow(4, k)).toString();
    } else {
      k = 16;
      y = "2.3283064365386962890625e-10";
    }
    Ctor.precision += k;
    x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
    for (var i = k; i--; ) {
      var cos2x = x.times(x);
      x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
    }
    Ctor.precision -= k;
    return x;
  }
  var divide = /* @__PURE__ */ (function() {
    function multiplyInteger(x, k, base) {
      var temp, carry = 0, i = x.length;
      for (x = x.slice(); i--; ) {
        temp = x[i] * k + carry;
        x[i] = temp % base | 0;
        carry = temp / base | 0;
      }
      if (carry) x.unshift(carry);
      return x;
    }
    function compare(a, b, aL, bL) {
      var i, r;
      if (aL != bL) {
        r = aL > bL ? 1 : -1;
      } else {
        for (i = r = 0; i < aL; i++) {
          if (a[i] != b[i]) {
            r = a[i] > b[i] ? 1 : -1;
            break;
          }
        }
      }
      return r;
    }
    function subtract(a, b, aL, base) {
      var i = 0;
      for (; aL--; ) {
        a[aL] -= i;
        i = a[aL] < b[aL] ? 1 : 0;
        a[aL] = i * base + a[aL] - b[aL];
      }
      for (; !a[0] && a.length > 1; ) a.shift();
    }
    return function(x, y, pr, rm, dp, base) {
      var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
      if (!xd || !xd[0] || !yd || !yd[0]) {
        return new Ctor(
          // Return NaN if either NaN, or both Infinity or 0.
          !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
            // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
            xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
          )
        );
      }
      if (base) {
        logBase = 1;
        e = x.e - y.e;
      } else {
        base = BASE;
        logBase = LOG_BASE;
        e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
      }
      yL = yd.length;
      xL = xd.length;
      q = new Ctor(sign2);
      qd = q.d = [];
      for (i = 0; yd[i] == (xd[i] || 0); i++) ;
      if (yd[i] > (xd[i] || 0)) e--;
      if (pr == null) {
        sd = pr = Ctor.precision;
        rm = Ctor.rounding;
      } else if (dp) {
        sd = pr + (x.e - y.e) + 1;
      } else {
        sd = pr;
      }
      if (sd < 0) {
        qd.push(1);
        more = true;
      } else {
        sd = sd / logBase + 2 | 0;
        i = 0;
        if (yL == 1) {
          k = 0;
          yd = yd[0];
          sd++;
          for (; (i < xL || k) && sd--; i++) {
            t = k * base + (xd[i] || 0);
            qd[i] = t / yd | 0;
            k = t % yd | 0;
          }
          more = k || i < xL;
        } else {
          k = base / (yd[0] + 1) | 0;
          if (k > 1) {
            yd = multiplyInteger(yd, k, base);
            xd = multiplyInteger(xd, k, base);
            yL = yd.length;
            xL = xd.length;
          }
          xi = yL;
          rem = xd.slice(0, yL);
          remL = rem.length;
          for (; remL < yL; ) rem[remL++] = 0;
          yz = yd.slice();
          yz.unshift(0);
          yd0 = yd[0];
          if (yd[1] >= base / 2) ++yd0;
          do {
            k = 0;
            cmp = compare(yd, rem, yL, remL);
            if (cmp < 0) {
              rem0 = rem[0];
              if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
              k = rem0 / yd0 | 0;
              if (k > 1) {
                if (k >= base) k = base - 1;
                prod = multiplyInteger(yd, k, base);
                prodL = prod.length;
                remL = rem.length;
                cmp = compare(prod, rem, prodL, remL);
                if (cmp == 1) {
                  k--;
                  subtract(prod, yL < prodL ? yz : yd, prodL, base);
                }
              } else {
                if (k == 0) cmp = k = 1;
                prod = yd.slice();
              }
              prodL = prod.length;
              if (prodL < remL) prod.unshift(0);
              subtract(rem, prod, remL, base);
              if (cmp == -1) {
                remL = rem.length;
                cmp = compare(yd, rem, yL, remL);
                if (cmp < 1) {
                  k++;
                  subtract(rem, yL < remL ? yz : yd, remL, base);
                }
              }
              remL = rem.length;
            } else if (cmp === 0) {
              k++;
              rem = [0];
            }
            qd[i++] = k;
            if (cmp && rem[0]) {
              rem[remL++] = xd[xi] || 0;
            } else {
              rem = [xd[xi]];
              remL = 1;
            }
          } while ((xi++ < xL || rem[0] !== void 0) && sd--);
          more = rem[0] !== void 0;
        }
        if (!qd[0]) qd.shift();
      }
      if (logBase == 1) {
        q.e = e;
        inexact = more;
      } else {
        for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
        q.e = i + e * logBase - 1;
        finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
      }
      return q;
    };
  })();
  function finalise(x, sd, rm, isTruncated) {
    var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
    out: if (sd != null) {
      xd = x.d;
      if (!xd) return x;
      for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
      i = sd - digits;
      if (i < 0) {
        i += LOG_BASE;
        j = sd;
        w = xd[xdi = 0];
        rd = w / mathpow(10, digits - j - 1) % 10 | 0;
      } else {
        xdi = Math.ceil((i + 1) / LOG_BASE);
        k = xd.length;
        if (xdi >= k) {
          if (isTruncated) {
            for (; k++ <= xdi; ) xd.push(0);
            w = rd = 0;
            digits = 1;
            i %= LOG_BASE;
            j = i - LOG_BASE + 1;
          } else {
            break out;
          }
        } else {
          w = k = xd[xdi];
          for (digits = 1; k >= 10; k /= 10) digits++;
          i %= LOG_BASE;
          j = i - LOG_BASE + digits;
          rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
        }
      }
      isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
      roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
      (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
      if (sd < 1 || !xd[0]) {
        xd.length = 0;
        if (roundUp) {
          sd -= x.e + 1;
          xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
          x.e = -sd || 0;
        } else {
          xd[0] = x.e = 0;
        }
        return x;
      }
      if (i == 0) {
        xd.length = xdi;
        k = 1;
        xdi--;
      } else {
        xd.length = xdi + 1;
        k = mathpow(10, LOG_BASE - i);
        xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
      }
      if (roundUp) {
        for (; ; ) {
          if (xdi == 0) {
            for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
            j = xd[0] += k;
            for (k = 1; j >= 10; j /= 10) k++;
            if (i != k) {
              x.e++;
              if (xd[0] == BASE) xd[0] = 1;
            }
            break;
          } else {
            xd[xdi] += k;
            if (xd[xdi] != BASE) break;
            xd[xdi--] = 0;
            k = 1;
          }
        }
      }
      for (i = xd.length; xd[--i] === 0; ) xd.pop();
    }
    if (external) {
      if (x.e > Ctor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < Ctor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
    return x;
  }
  function finiteToString(x, isExp, sd) {
    if (!x.isFinite()) return nonFiniteToString(x);
    var k, e = x.e, str = digitsToString(x.d), len = str.length;
    if (isExp) {
      if (sd && (k = sd - len) > 0) {
        str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
      } else if (len > 1) {
        str = str.charAt(0) + "." + str.slice(1);
      }
      str = str + (x.e < 0 ? "e" : "e+") + x.e;
    } else if (e < 0) {
      str = "0." + getZeroString(-e - 1) + str;
      if (sd && (k = sd - len) > 0) str += getZeroString(k);
    } else if (e >= len) {
      str += getZeroString(e + 1 - len);
      if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
    } else {
      if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
      if (sd && (k = sd - len) > 0) {
        if (e + 1 === len) str += ".";
        str += getZeroString(k);
      }
    }
    return str;
  }
  function getBase10Exponent(digits, e) {
    var w = digits[0];
    for (e *= LOG_BASE; w >= 10; w /= 10) e++;
    return e;
  }
  function getLn10(Ctor, sd, pr) {
    if (sd > LN10_PRECISION) {
      external = true;
      if (pr) Ctor.precision = pr;
      throw Error(precisionLimitExceeded);
    }
    return finalise(new Ctor(LN10), sd, 1, true);
  }
  function getPi(Ctor, sd, rm) {
    if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
    return finalise(new Ctor(PI), sd, rm, true);
  }
  function getPrecision(digits) {
    var w = digits.length - 1, len = w * LOG_BASE + 1;
    w = digits[w];
    if (w) {
      for (; w % 10 == 0; w /= 10) len--;
      for (w = digits[0]; w >= 10; w /= 10) len++;
    }
    return len;
  }
  function getZeroString(k) {
    var zs = "";
    for (; k--; ) zs += "0";
    return zs;
  }
  function intPow(Ctor, x, n, pr) {
    var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
    external = false;
    for (; ; ) {
      if (n % 2) {
        r = r.times(x);
        if (truncate(r.d, k)) isTruncated = true;
      }
      n = mathfloor(n / 2);
      if (n === 0) {
        n = r.d.length - 1;
        if (isTruncated && r.d[n] === 0) ++r.d[n];
        break;
      }
      x = x.times(x);
      truncate(x.d, k);
    }
    external = true;
    return r;
  }
  function isOdd(n) {
    return n.d[n.d.length - 1] & 1;
  }
  function maxOrMin(Ctor, args, n) {
    var k, y, x = new Ctor(args[0]), i = 0;
    for (; ++i < args.length; ) {
      y = new Ctor(args[i]);
      if (!y.s) {
        x = y;
        break;
      }
      k = x.cmp(y);
      if (k === n || k === 0 && x.s === n) {
        x = y;
      }
    }
    return x;
  }
  function naturalExponential(x, sd) {
    var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
    if (!x.d || !x.d[0] || x.e > 17) {
      return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
    }
    if (sd == null) {
      external = false;
      wpr = pr;
    } else {
      wpr = sd;
    }
    t = new Ctor(0.03125);
    while (x.e > -2) {
      x = x.times(t);
      k += 5;
    }
    guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
    wpr += guard;
    denominator = pow2 = sum2 = new Ctor(1);
    Ctor.precision = wpr;
    for (; ; ) {
      pow2 = finalise(pow2.times(x), wpr, 1);
      denominator = denominator.times(++i);
      t = sum2.plus(divide(pow2, denominator, wpr, 1));
      if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
        j = k;
        while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
        if (sd == null) {
          if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
            Ctor.precision = wpr += 10;
            denominator = pow2 = t = new Ctor(1);
            i = 0;
            rep++;
          } else {
            return finalise(sum2, Ctor.precision = pr, rm, external = true);
          }
        } else {
          Ctor.precision = pr;
          return sum2;
        }
      }
      sum2 = t;
    }
  }
  function naturalLogarithm(y, sd) {
    var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
    if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
      return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
    }
    if (sd == null) {
      external = false;
      wpr = pr;
    } else {
      wpr = sd;
    }
    Ctor.precision = wpr += guard;
    c = digitsToString(xd);
    c0 = c.charAt(0);
    if (Math.abs(e = x.e) < 15e14) {
      while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
        x = x.times(y);
        c = digitsToString(x.d);
        c0 = c.charAt(0);
        n++;
      }
      e = x.e;
      if (c0 > 1) {
        x = new Ctor("0." + c);
        e++;
      } else {
        x = new Ctor(c0 + "." + c.slice(1));
      }
    } else {
      t = getLn10(Ctor, wpr + 2, pr).times(e + "");
      x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
      Ctor.precision = pr;
      return sd == null ? finalise(x, pr, rm, external = true) : x;
    }
    x1 = x;
    sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
    x2 = finalise(x.times(x), wpr, 1);
    denominator = 3;
    for (; ; ) {
      numerator = finalise(numerator.times(x2), wpr, 1);
      t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
      if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
        sum2 = sum2.times(2);
        if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
        sum2 = divide(sum2, new Ctor(n), wpr, 1);
        if (sd == null) {
          if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
            Ctor.precision = wpr += guard;
            t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
            x2 = finalise(x.times(x), wpr, 1);
            denominator = rep = 1;
          } else {
            return finalise(sum2, Ctor.precision = pr, rm, external = true);
          }
        } else {
          Ctor.precision = pr;
          return sum2;
        }
      }
      sum2 = t;
      denominator += 2;
    }
  }
  function nonFiniteToString(x) {
    return String(x.s * x.s / 0);
  }
  function parseDecimal(x, str) {
    var e, i, len;
    if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
    if ((i = str.search(/e/i)) > 0) {
      if (e < 0) e = i;
      e += +str.slice(i + 1);
      str = str.substring(0, i);
    } else if (e < 0) {
      e = str.length;
    }
    for (i = 0; str.charCodeAt(i) === 48; i++) ;
    for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
    str = str.slice(i, len);
    if (str) {
      len -= i;
      x.e = e = e - i - 1;
      x.d = [];
      i = (e + 1) % LOG_BASE;
      if (e < 0) i += LOG_BASE;
      if (i < len) {
        if (i) x.d.push(+str.slice(0, i));
        for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
        str = str.slice(i);
        i = LOG_BASE - str.length;
      } else {
        i -= len;
      }
      for (; i--; ) str += "0";
      x.d.push(+str);
      if (external) {
        if (x.e > x.constructor.maxE) {
          x.d = null;
          x.e = NaN;
        } else if (x.e < x.constructor.minE) {
          x.e = 0;
          x.d = [0];
        }
      }
    } else {
      x.e = 0;
      x.d = [0];
    }
    return x;
  }
  function parseOther(x, str) {
    var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
    if (str.indexOf("_") > -1) {
      str = str.replace(/(\d)_(?=\d)/g, "$1");
      if (isDecimal.test(str)) return parseDecimal(x, str);
    } else if (str === "Infinity" || str === "NaN") {
      if (!+str) x.s = NaN;
      x.e = NaN;
      x.d = null;
      return x;
    }
    if (isHex.test(str)) {
      base = 16;
      str = str.toLowerCase();
    } else if (isBinary.test(str)) {
      base = 2;
    } else if (isOctal.test(str)) {
      base = 8;
    } else {
      throw Error(invalidArgument + str);
    }
    i = str.search(/p/i);
    if (i > 0) {
      p = +str.slice(i + 1);
      str = str.substring(2, i);
    } else {
      str = str.slice(2);
    }
    i = str.indexOf(".");
    isFloat = i >= 0;
    Ctor = x.constructor;
    if (isFloat) {
      str = str.replace(".", "");
      len = str.length;
      i = len - i;
      divisor = intPow(Ctor, new Ctor(base), i, i * 2);
    }
    xd = convertBase(str, base, BASE);
    xe = xd.length - 1;
    for (i = xe; xd[i] === 0; --i) xd.pop();
    if (i < 0) return new Ctor(x.s * 0);
    x.e = getBase10Exponent(xd, xe);
    x.d = xd;
    external = false;
    if (isFloat) x = divide(x, divisor, len * 4);
    if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
    external = true;
    return x;
  }
  function sine(Ctor, x) {
    var k, len = x.d.length;
    if (len < 3) {
      return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
    }
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x);
    var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sin2_x = x.times(x);
      x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
    }
    return x;
  }
  function taylorSeries(Ctor, n, x, y, isHyperbolic) {
    var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
    external = false;
    x2 = x.times(x);
    u = new Ctor(y);
    for (; ; ) {
      t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
      u = isHyperbolic ? y.plus(t) : y.minus(t);
      y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
      t = u.plus(y);
      if (t.d[k] !== void 0) {
        for (j = k; t.d[j] === u.d[j] && j--; ) ;
        if (j == -1) break;
      }
      j = u;
      u = y;
      y = t;
      t = j;
      i++;
    }
    external = true;
    t.d.length = k + 1;
    return t;
  }
  function tinyPow(b, e) {
    var n = b;
    while (--e) n *= b;
    return n;
  }
  function toLessThanHalfPi(Ctor, x) {
    var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
    x = x.abs();
    if (x.lte(halfPi)) {
      quadrant = isNeg ? 4 : 1;
      return x;
    }
    t = x.divToInt(pi);
    if (t.isZero()) {
      quadrant = isNeg ? 3 : 2;
    } else {
      x = x.minus(t.times(pi));
      if (x.lte(halfPi)) {
        quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
        return x;
      }
      quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
    }
    return x.minus(pi).abs();
  }
  function toStringBinary(x, baseOut, sd, rm) {
    var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
    if (isExp) {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
    } else {
      sd = Ctor.precision;
      rm = Ctor.rounding;
    }
    if (!x.isFinite()) {
      str = nonFiniteToString(x);
    } else {
      str = finiteToString(x);
      i = str.indexOf(".");
      if (isExp) {
        base = 2;
        if (baseOut == 16) {
          sd = sd * 4 - 3;
        } else if (baseOut == 8) {
          sd = sd * 3 - 2;
        }
      } else {
        base = baseOut;
      }
      if (i >= 0) {
        str = str.replace(".", "");
        y = new Ctor(1);
        y.e = str.length - i;
        y.d = convertBase(finiteToString(y), 10, base);
        y.e = y.d.length;
      }
      xd = convertBase(str, 10, base);
      e = len = xd.length;
      for (; xd[--len] == 0; ) xd.pop();
      if (!xd[0]) {
        str = isExp ? "0p+0" : "0";
      } else {
        if (i < 0) {
          e--;
        } else {
          x = new Ctor(x);
          x.d = xd;
          x.e = e;
          x = divide(x, y, sd, rm, 0, base);
          xd = x.d;
          e = x.e;
          roundUp = inexact;
        }
        i = xd[sd];
        k = base / 2;
        roundUp = roundUp || xd[sd + 1] !== void 0;
        roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
        xd.length = sd;
        if (roundUp) {
          for (; ++xd[--sd] > base - 1; ) {
            xd[sd] = 0;
            if (!sd) {
              ++e;
              xd.unshift(1);
            }
          }
        }
        for (len = xd.length; !xd[len - 1]; --len) ;
        for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
        if (isExp) {
          if (len > 1) {
            if (baseOut == 16 || baseOut == 8) {
              i = baseOut == 16 ? 4 : 3;
              for (--len; len % i; len++) str += "0";
              xd = convertBase(str, base, baseOut);
              for (len = xd.length; !xd[len - 1]; --len) ;
              for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
            } else {
              str = str.charAt(0) + "." + str.slice(1);
            }
          }
          str = str + (e < 0 ? "p" : "p+") + e;
        } else if (e < 0) {
          for (; ++e; ) str = "0" + str;
          str = "0." + str;
        } else {
          if (++e > len) for (e -= len; e--; ) str += "0";
          else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
        }
      }
      str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
    }
    return x.s < 0 ? "-" + str : str;
  }
  function truncate(arr, len) {
    if (arr.length > len) {
      arr.length = len;
      return true;
    }
  }
  function abs(x) {
    return new this(x).abs();
  }
  function acos(x) {
    return new this(x).acos();
  }
  function acosh(x) {
    return new this(x).acosh();
  }
  function add(x, y) {
    return new this(x).plus(y);
  }
  function asin(x) {
    return new this(x).asin();
  }
  function asinh(x) {
    return new this(x).asinh();
  }
  function atan(x) {
    return new this(x).atan();
  }
  function atanh(x) {
    return new this(x).atanh();
  }
  function atan2(y, x) {
    y = new this(y);
    x = new this(x);
    var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
    if (!y.s || !x.s) {
      r = new this(NaN);
    } else if (!y.d && !x.d) {
      r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
      r.s = y.s;
    } else if (!x.d || y.isZero()) {
      r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
      r.s = y.s;
    } else if (!y.d || x.isZero()) {
      r = getPi(this, wpr, 1).times(0.5);
      r.s = y.s;
    } else if (x.s < 0) {
      this.precision = wpr;
      this.rounding = 1;
      r = this.atan(divide(y, x, wpr, 1));
      x = getPi(this, wpr, 1);
      this.precision = pr;
      this.rounding = rm;
      r = y.s < 0 ? r.minus(x) : r.plus(x);
    } else {
      r = this.atan(divide(y, x, wpr, 1));
    }
    return r;
  }
  function cbrt(x) {
    return new this(x).cbrt();
  }
  function ceil(x) {
    return finalise(x = new this(x), x.e + 1, 2);
  }
  function clamp(x, min2, max2) {
    return new this(x).clamp(min2, max2);
  }
  function config(obj) {
    if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
    var i, p, v, useDefaults = obj.defaults === true, ps = [
      "precision",
      1,
      MAX_DIGITS,
      "rounding",
      0,
      8,
      "toExpNeg",
      -EXP_LIMIT,
      0,
      "toExpPos",
      0,
      EXP_LIMIT,
      "maxE",
      0,
      EXP_LIMIT,
      "minE",
      -EXP_LIMIT,
      0,
      "modulo",
      0,
      9
    ];
    for (i = 0; i < ps.length; i += 3) {
      if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
      if ((v = obj[p]) !== void 0) {
        if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
        else throw Error(invalidArgument + p + ": " + v);
      }
    }
    if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (v === true || v === false || v === 0 || v === 1) {
        if (v) {
          if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
            this[p] = true;
          } else {
            throw Error(cryptoUnavailable);
          }
        } else {
          this[p] = false;
        }
      } else {
        throw Error(invalidArgument + p + ": " + v);
      }
    }
    return this;
  }
  function cos(x) {
    return new this(x).cos();
  }
  function cosh(x) {
    return new this(x).cosh();
  }
  function clone(obj) {
    var i, p, ps;
    function Decimal2(v) {
      var e, i2, t, x = this;
      if (!(x instanceof Decimal2)) return new Decimal2(v);
      x.constructor = Decimal2;
      if (isDecimalInstance(v)) {
        x.s = v.s;
        if (external) {
          if (!v.d || v.e > Decimal2.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (v.e < Decimal2.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = v.e;
            x.d = v.d.slice();
          }
        } else {
          x.e = v.e;
          x.d = v.d ? v.d.slice() : v.d;
        }
        return;
      }
      t = typeof v;
      if (t === "number") {
        if (v === 0) {
          x.s = 1 / v < 0 ? -1 : 1;
          x.e = 0;
          x.d = [0];
          return;
        }
        if (v < 0) {
          v = -v;
          x.s = -1;
        } else {
          x.s = 1;
        }
        if (v === ~~v && v < 1e7) {
          for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
          if (external) {
            if (e > Decimal2.maxE) {
              x.e = NaN;
              x.d = null;
            } else if (e < Decimal2.minE) {
              x.e = 0;
              x.d = [0];
            } else {
              x.e = e;
              x.d = [v];
            }
          } else {
            x.e = e;
            x.d = [v];
          }
          return;
        }
        if (v * 0 !== 0) {
          if (!v) x.s = NaN;
          x.e = NaN;
          x.d = null;
          return;
        }
        return parseDecimal(x, v.toString());
      }
      if (t === "string") {
        if ((i2 = v.charCodeAt(0)) === 45) {
          v = v.slice(1);
          x.s = -1;
        } else {
          if (i2 === 43) v = v.slice(1);
          x.s = 1;
        }
        return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
      }
      if (t === "bigint") {
        if (v < 0) {
          v = -v;
          x.s = -1;
        } else {
          x.s = 1;
        }
        return parseDecimal(x, v.toString());
      }
      throw Error(invalidArgument + v);
    }
    Decimal2.prototype = P;
    Decimal2.ROUND_UP = 0;
    Decimal2.ROUND_DOWN = 1;
    Decimal2.ROUND_CEIL = 2;
    Decimal2.ROUND_FLOOR = 3;
    Decimal2.ROUND_HALF_UP = 4;
    Decimal2.ROUND_HALF_DOWN = 5;
    Decimal2.ROUND_HALF_EVEN = 6;
    Decimal2.ROUND_HALF_CEIL = 7;
    Decimal2.ROUND_HALF_FLOOR = 8;
    Decimal2.EUCLID = 9;
    Decimal2.config = Decimal2.set = config;
    Decimal2.clone = clone;
    Decimal2.isDecimal = isDecimalInstance;
    Decimal2.abs = abs;
    Decimal2.acos = acos;
    Decimal2.acosh = acosh;
    Decimal2.add = add;
    Decimal2.asin = asin;
    Decimal2.asinh = asinh;
    Decimal2.atan = atan;
    Decimal2.atanh = atanh;
    Decimal2.atan2 = atan2;
    Decimal2.cbrt = cbrt;
    Decimal2.ceil = ceil;
    Decimal2.clamp = clamp;
    Decimal2.cos = cos;
    Decimal2.cosh = cosh;
    Decimal2.div = div;
    Decimal2.exp = exp;
    Decimal2.floor = floor;
    Decimal2.hypot = hypot;
    Decimal2.ln = ln;
    Decimal2.log = log;
    Decimal2.log10 = log10;
    Decimal2.log2 = log2;
    Decimal2.max = max;
    Decimal2.min = min;
    Decimal2.mod = mod;
    Decimal2.mul = mul;
    Decimal2.pow = pow;
    Decimal2.random = random;
    Decimal2.round = round;
    Decimal2.sign = sign;
    Decimal2.sin = sin;
    Decimal2.sinh = sinh;
    Decimal2.sqrt = sqrt;
    Decimal2.sub = sub;
    Decimal2.sum = sum;
    Decimal2.tan = tan;
    Decimal2.tanh = tanh;
    Decimal2.trunc = trunc;
    if (obj === void 0) obj = {};
    if (obj) {
      if (obj.defaults !== true) {
        ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
        for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
      }
    }
    Decimal2.config(obj);
    return Decimal2;
  }
  function div(x, y) {
    return new this(x).div(y);
  }
  function exp(x) {
    return new this(x).exp();
  }
  function floor(x) {
    return finalise(x = new this(x), x.e + 1, 3);
  }
  function hypot() {
    var i, n, t = new this(0);
    external = false;
    for (i = 0; i < arguments.length; ) {
      n = new this(arguments[i++]);
      if (!n.d) {
        if (n.s) {
          external = true;
          return new this(1 / 0);
        }
        t = n;
      } else if (t.d) {
        t = t.plus(n.times(n));
      }
    }
    external = true;
    return t.sqrt();
  }
  function isDecimalInstance(obj) {
    return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
  }
  function ln(x) {
    return new this(x).ln();
  }
  function log(x, y) {
    return new this(x).log(y);
  }
  function log2(x) {
    return new this(x).log(2);
  }
  function log10(x) {
    return new this(x).log(10);
  }
  function max() {
    return maxOrMin(this, arguments, -1);
  }
  function min() {
    return maxOrMin(this, arguments, 1);
  }
  function mod(x, y) {
    return new this(x).mod(y);
  }
  function mul(x, y) {
    return new this(x).mul(y);
  }
  function pow(x, y) {
    return new this(x).pow(y);
  }
  function random(sd) {
    var d, e, k, n, i = 0, r = new this(1), rd = [];
    if (sd === void 0) sd = this.precision;
    else checkInt32(sd, 1, MAX_DIGITS);
    k = Math.ceil(sd / LOG_BASE);
    if (!this.crypto) {
      for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
    } else if (crypto.getRandomValues) {
      d = crypto.getRandomValues(new Uint32Array(k));
      for (; i < k; ) {
        n = d[i];
        if (n >= 429e7) {
          d[i] = crypto.getRandomValues(new Uint32Array(1))[0];
        } else {
          rd[i++] = n % 1e7;
        }
      }
    } else if (crypto.randomBytes) {
      d = crypto.randomBytes(k *= 4);
      for (; i < k; ) {
        n = d[i] + (d[i + 1] << 8) + (d[i + 2] << 16) + ((d[i + 3] & 127) << 24);
        if (n >= 214e7) {
          crypto.randomBytes(4).copy(d, i);
        } else {
          rd.push(n % 1e7);
          i += 4;
        }
      }
      i = k / 4;
    } else {
      throw Error(cryptoUnavailable);
    }
    k = rd[--i];
    sd %= LOG_BASE;
    if (k && sd) {
      n = mathpow(10, LOG_BASE - sd);
      rd[i] = (k / n | 0) * n;
    }
    for (; rd[i] === 0; i--) rd.pop();
    if (i < 0) {
      e = 0;
      rd = [0];
    } else {
      e = -1;
      for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
      for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
      if (k < LOG_BASE) e -= LOG_BASE - k;
    }
    r.e = e;
    r.d = rd;
    return r;
  }
  function round(x) {
    return finalise(x = new this(x), x.e + 1, this.rounding);
  }
  function sign(x) {
    x = new this(x);
    return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
  }
  function sin(x) {
    return new this(x).sin();
  }
  function sinh(x) {
    return new this(x).sinh();
  }
  function sqrt(x) {
    return new this(x).sqrt();
  }
  function sub(x, y) {
    return new this(x).sub(y);
  }
  function sum() {
    var i = 0, args = arguments, x = new this(args[i]);
    external = false;
    for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
    external = true;
    return finalise(x, this.precision, this.rounding);
  }
  function tan(x) {
    return new this(x).tan();
  }
  function tanh(x) {
    return new this(x).tanh();
  }
  function trunc(x) {
    return finalise(x = new this(x), x.e + 1, 1);
  }
  P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.toString;
  P[Symbol.toStringTag] = "Decimal";
  var Decimal = P.constructor = clone(DEFAULTS);
  LN10 = new Decimal(LN10);
  PI = new Decimal(PI);
  var decimal_default = Decimal;

  // node_modules/big.js/big.mjs
  var DP = 20;
  var RM = 1;
  var MAX_DP = 1e6;
  var MAX_POWER = 1e6;
  var NE = -7;
  var PE = 21;
  var STRICT = false;
  var NAME = "[big.js] ";
  var INVALID = NAME + "Invalid ";
  var INVALID_DP = INVALID + "decimal places";
  var INVALID_RM = INVALID + "rounding mode";
  var DIV_BY_ZERO = NAME + "Division by zero";
  var P2 = {};
  var UNDEFINED = void 0;
  var NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
  function _Big_() {
    function Big2(n) {
      var x = this;
      if (!(x instanceof Big2)) return n === UNDEFINED ? _Big_() : new Big2(n);
      if (n instanceof Big2) {
        x.s = n.s;
        x.e = n.e;
        x.c = n.c.slice();
      } else {
        if (typeof n !== "string") {
          if (Big2.strict === true && typeof n !== "bigint") {
            throw TypeError(INVALID + "value");
          }
          n = n === 0 && 1 / n < 0 ? "-0" : String(n);
        }
        parse(x, n);
      }
      x.constructor = Big2;
    }
    Big2.prototype = P2;
    Big2.DP = DP;
    Big2.RM = RM;
    Big2.NE = NE;
    Big2.PE = PE;
    Big2.strict = STRICT;
    Big2.roundDown = 0;
    Big2.roundHalfUp = 1;
    Big2.roundHalfEven = 2;
    Big2.roundUp = 3;
    return Big2;
  }
  function parse(x, n) {
    var e, i, nl;
    if (!NUMERIC.test(n)) {
      throw Error(INVALID + "number");
    }
    x.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
    if ((e = n.indexOf(".")) > -1) n = n.replace(".", "");
    if ((i = n.search(/e/i)) > 0) {
      if (e < 0) e = i;
      e += +n.slice(i + 1);
      n = n.substring(0, i);
    } else if (e < 0) {
      e = n.length;
    }
    nl = n.length;
    for (i = 0; i < nl && n.charAt(i) == "0"; ) ++i;
    if (i == nl) {
      x.c = [x.e = 0];
    } else {
      for (; nl > 0 && n.charAt(--nl) == "0"; ) ;
      x.e = e - i - 1;
      x.c = [];
      for (e = 0; i <= nl; ) x.c[e++] = +n.charAt(i++);
    }
    return x;
  }
  function round2(x, sd, rm, more) {
    var xc = x.c;
    if (rm === UNDEFINED) rm = x.constructor.RM;
    if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) {
      throw Error(INVALID_RM);
    }
    if (sd < 1) {
      more = rm === 3 && (more || !!xc[0]) || sd === 0 && (rm === 1 && xc[0] >= 5 || rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED)));
      xc.length = 1;
      if (more) {
        x.e = x.e - sd + 1;
        xc[0] = 1;
      } else {
        xc[0] = x.e = 0;
      }
    } else if (sd < xc.length) {
      more = rm === 1 && xc[sd] >= 5 || rm === 2 && (xc[sd] > 5 || xc[sd] === 5 && (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) || rm === 3 && (more || !!xc[0]);
      xc.length = sd;
      if (more) {
        for (; ++xc[--sd] > 9; ) {
          xc[sd] = 0;
          if (sd === 0) {
            ++x.e;
            xc.unshift(1);
            break;
          }
        }
      }
      for (sd = xc.length; !xc[--sd]; ) xc.pop();
    }
    return x;
  }
  function stringify(x, doExponential, isNonzero) {
    var e = x.e, s = x.c.join(""), n = s.length;
    if (doExponential) {
      s = s.charAt(0) + (n > 1 ? "." + s.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
    } else if (e < 0) {
      for (; ++e; ) s = "0" + s;
      s = "0." + s;
    } else if (e > 0) {
      if (++e > n) {
        for (e -= n; e--; ) s += "0";
      } else if (e < n) {
        s = s.slice(0, e) + "." + s.slice(e);
      }
    } else if (n > 1) {
      s = s.charAt(0) + "." + s.slice(1);
    }
    return x.s < 0 && isNonzero ? "-" + s : s;
  }
  P2.abs = function() {
    var x = new this.constructor(this);
    x.s = 1;
    return x;
  };
  P2.cmp = function(y) {
    var isneg, x = this, xc = x.c, yc = (y = new x.constructor(y)).c, i = x.s, j = y.s, k = x.e, l = y.e;
    if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;
    if (i != j) return i;
    isneg = i < 0;
    if (k != l) return k > l ^ isneg ? 1 : -1;
    j = (k = xc.length) < (l = yc.length) ? k : l;
    for (i = -1; ++i < j; ) {
      if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
    }
    return k == l ? 0 : k > l ^ isneg ? 1 : -1;
  };
  P2.div = function(y) {
    var x = this, Big2 = x.constructor, a = x.c, b = (y = new Big2(y)).c, k = x.s == y.s ? 1 : -1, dp = Big2.DP;
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    if (!b[0]) {
      throw Error(DIV_BY_ZERO);
    }
    if (!a[0]) {
      y.s = k;
      y.c = [y.e = 0];
      return y;
    }
    var bl, bt, n, cmp, ri, bz = b.slice(), ai = bl = b.length, al = a.length, r = a.slice(0, bl), rl = r.length, q = y, qc = q.c = [], qi = 0, p = dp + (q.e = x.e - y.e) + 1;
    q.s = k;
    k = p < 0 ? 0 : p;
    bz.unshift(0);
    for (; rl++ < bl; ) r.push(0);
    do {
      for (n = 0; n < 10; n++) {
        if (bl != (rl = r.length)) {
          cmp = bl > rl ? 1 : -1;
        } else {
          for (ri = -1, cmp = 0; ++ri < bl; ) {
            if (b[ri] != r[ri]) {
              cmp = b[ri] > r[ri] ? 1 : -1;
              break;
            }
          }
        }
        if (cmp < 0) {
          for (bt = rl == bl ? b : bz; rl; ) {
            if (r[--rl] < bt[rl]) {
              ri = rl;
              for (; ri && !r[--ri]; ) r[ri] = 9;
              --r[ri];
              r[rl] += 10;
            }
            r[rl] -= bt[rl];
          }
          for (; !r[0]; ) r.shift();
        } else {
          break;
        }
      }
      qc[qi++] = cmp ? n : ++n;
      if (r[0] && cmp) r[rl] = a[ai] || 0;
      else r = [a[ai]];
    } while ((ai++ < al || r[0] !== UNDEFINED) && k--);
    if (!qc[0] && qi != 1) {
      qc.shift();
      q.e--;
      p--;
    }
    if (qi > p) round2(q, p, Big2.RM, r[0] !== UNDEFINED);
    return q;
  };
  P2.eq = function(y) {
    return this.cmp(y) === 0;
  };
  P2.gt = function(y) {
    return this.cmp(y) > 0;
  };
  P2.gte = function(y) {
    return this.cmp(y) > -1;
  };
  P2.lt = function(y) {
    return this.cmp(y) < 0;
  };
  P2.lte = function(y) {
    return this.cmp(y) < 1;
  };
  P2.minus = P2.sub = function(y) {
    var i, j, t, xlty, x = this, Big2 = x.constructor, a = x.s, b = (y = new Big2(y)).s;
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }
    var xc = x.c.slice(), xe = x.e, yc = y.c, ye = y.e;
    if (!xc[0] || !yc[0]) {
      if (yc[0]) {
        y.s = -b;
      } else if (xc[0]) {
        y = new Big2(x);
      } else {
        y.s = 1;
      }
      return y;
    }
    if (a = xe - ye) {
      if (xlty = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }
      t.reverse();
      for (b = a; b--; ) t.push(0);
      t.reverse();
    } else {
      j = ((xlty = xc.length < yc.length) ? xc : yc).length;
      for (a = b = 0; b < j; b++) {
        if (xc[b] != yc[b]) {
          xlty = xc[b] < yc[b];
          break;
        }
      }
    }
    if (xlty) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }
    if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--; ) xc[i++] = 0;
    for (b = i; j > a; ) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i]; ) xc[i] = 9;
        --xc[i];
        xc[j] += 10;
      }
      xc[j] -= yc[j];
    }
    for (; xc[--b] === 0; ) xc.pop();
    for (; xc[0] === 0; ) {
      xc.shift();
      --ye;
    }
    if (!xc[0]) {
      y.s = 1;
      xc = [ye = 0];
    }
    y.c = xc;
    y.e = ye;
    return y;
  };
  P2.mod = function(y) {
    var ygtx, x = this, Big2 = x.constructor, a = x.s, b = (y = new Big2(y)).s;
    if (!y.c[0]) {
      throw Error(DIV_BY_ZERO);
    }
    x.s = y.s = 1;
    ygtx = y.cmp(x) == 1;
    x.s = a;
    y.s = b;
    if (ygtx) return new Big2(x);
    a = Big2.DP;
    b = Big2.RM;
    Big2.DP = Big2.RM = 0;
    x = x.div(y);
    Big2.DP = a;
    Big2.RM = b;
    return this.minus(x.times(y));
  };
  P2.neg = function() {
    var x = new this.constructor(this);
    x.s = -x.s;
    return x;
  };
  P2.plus = P2.add = function(y) {
    var e, k, t, x = this, Big2 = x.constructor;
    y = new Big2(y);
    if (x.s != y.s) {
      y.s = -y.s;
      return x.minus(y);
    }
    var xe = x.e, xc = x.c, ye = y.e, yc = y.c;
    if (!xc[0] || !yc[0]) {
      if (!yc[0]) {
        if (xc[0]) {
          y = new Big2(x);
        } else {
          y.s = x.s;
        }
      }
      return y;
    }
    xc = xc.slice();
    if (e = xe - ye) {
      if (e > 0) {
        ye = xe;
        t = yc;
      } else {
        e = -e;
        t = xc;
      }
      t.reverse();
      for (; e--; ) t.push(0);
      t.reverse();
    }
    if (xc.length - yc.length < 0) {
      t = yc;
      yc = xc;
      xc = t;
    }
    e = yc.length;
    for (k = 0; e; xc[e] %= 10) k = (xc[--e] = xc[e] + yc[e] + k) / 10 | 0;
    if (k) {
      xc.unshift(k);
      ++ye;
    }
    for (e = xc.length; xc[--e] === 0; ) xc.pop();
    y.c = xc;
    y.e = ye;
    return y;
  };
  P2.pow = function(n) {
    var x = this, one = new x.constructor("1"), y = one, isneg = n < 0;
    if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
      throw Error(INVALID + "exponent");
    }
    if (isneg) n = -n;
    for (; ; ) {
      if (n & 1) y = y.times(x);
      n >>= 1;
      if (!n) break;
      x = x.times(x);
    }
    return isneg ? one.div(y) : y;
  };
  P2.prec = function(sd, rm) {
    if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
      throw Error(INVALID + "precision");
    }
    return round2(new this.constructor(this), sd, rm);
  };
  P2.round = function(dp, rm) {
    if (dp === UNDEFINED) dp = 0;
    else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    return round2(new this.constructor(this), dp + this.e + 1, rm);
  };
  P2.sqrt = function() {
    var r, c, t, x = this, Big2 = x.constructor, s = x.s, e = x.e, half = new Big2("0.5");
    if (!x.c[0]) return new Big2(x);
    if (s < 0) {
      throw Error(NAME + "No square root");
    }
    s = Math.sqrt(+stringify(x, true, true));
    if (s === 0 || s === 1 / 0) {
      c = x.c.join("");
      if (!(c.length + e & 1)) c += "0";
      s = Math.sqrt(c);
      e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
      r = new Big2((s == 1 / 0 ? "5e" : (s = s.toExponential()).slice(0, s.indexOf("e") + 1)) + e);
    } else {
      r = new Big2(s + "");
    }
    e = r.e + (Big2.DP += 4);
    do {
      t = r;
      r = half.times(t.plus(x.div(t)));
    } while (t.c.slice(0, e).join("") !== r.c.slice(0, e).join(""));
    return round2(r, (Big2.DP -= 4) + r.e + 1, Big2.RM);
  };
  P2.times = P2.mul = function(y) {
    var c, x = this, Big2 = x.constructor, xc = x.c, yc = (y = new Big2(y)).c, a = xc.length, b = yc.length, i = x.e, j = y.e;
    y.s = x.s == y.s ? 1 : -1;
    if (!xc[0] || !yc[0]) {
      y.c = [y.e = 0];
      return y;
    }
    y.e = i + j;
    if (a < b) {
      c = xc;
      xc = yc;
      yc = c;
      j = a;
      a = b;
      b = j;
    }
    for (c = new Array(j = a + b); j--; ) c[j] = 0;
    for (i = b; i--; ) {
      b = 0;
      for (j = a + i; j > i; ) {
        b = c[j] + yc[i] * xc[j - i - 1] + b;
        c[j--] = b % 10;
        b = b / 10 | 0;
      }
      c[j] = b;
    }
    if (b) ++y.e;
    else c.shift();
    for (i = c.length; !c[--i]; ) c.pop();
    y.c = c;
    return y;
  };
  P2.toExponential = function(dp, rm) {
    var x = this, n = x.c[0];
    if (dp !== UNDEFINED) {
      if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
        throw Error(INVALID_DP);
      }
      x = round2(new x.constructor(x), ++dp, rm);
      for (; x.c.length < dp; ) x.c.push(0);
    }
    return stringify(x, true, !!n);
  };
  P2.toFixed = function(dp, rm) {
    var x = this, n = x.c[0];
    if (dp !== UNDEFINED) {
      if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
        throw Error(INVALID_DP);
      }
      x = round2(new x.constructor(x), dp + x.e + 1, rm);
      for (dp = dp + x.e + 1; x.c.length < dp; ) x.c.push(0);
    }
    return stringify(x, false, !!n);
  };
  P2[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P2.toJSON = P2.toString = function() {
    var x = this, Big2 = x.constructor;
    return stringify(x, x.e <= Big2.NE || x.e >= Big2.PE, !!x.c[0]);
  };
  P2.toNumber = function() {
    var n = +stringify(this, true, true);
    if (this.constructor.strict === true && !this.eq(n.toString())) {
      throw Error(NAME + "Imprecise conversion");
    }
    return n;
  };
  P2.toPrecision = function(sd, rm) {
    var x = this, Big2 = x.constructor, n = x.c[0];
    if (sd !== UNDEFINED) {
      if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
        throw Error(INVALID + "precision");
      }
      x = round2(new Big2(x), sd, rm);
      for (; x.c.length < sd; ) x.c.push(0);
    }
    return stringify(x, sd <= x.e || x.e <= Big2.NE || x.e >= Big2.PE, !!n);
  };
  P2.valueOf = function() {
    var x = this, Big2 = x.constructor;
    if (Big2.strict === true) {
      throw Error(NAME + "valueOf disallowed");
    }
    return stringify(x, x.e <= Big2.NE || x.e >= Big2.PE, true);
  };
  var Big = _Big_();
  var big_default = Big;

  // node_modules/@msgpack/msgpack/dist.esm/index.mjs
  var dist_exports = {};
  __export(dist_exports, {
    DecodeError: () => DecodeError,
    Decoder: () => Decoder,
    EXT_TIMESTAMP: () => EXT_TIMESTAMP,
    Encoder: () => Encoder,
    ExtData: () => ExtData,
    ExtensionCodec: () => ExtensionCodec,
    decode: () => decode,
    decodeArrayStream: () => decodeArrayStream,
    decodeAsync: () => decodeAsync,
    decodeMulti: () => decodeMulti,
    decodeMultiStream: () => decodeMultiStream,
    decodeTimestampExtension: () => decodeTimestampExtension,
    decodeTimestampToTimeSpec: () => decodeTimestampToTimeSpec,
    encode: () => encode,
    encodeDateToTimeSpec: () => encodeDateToTimeSpec,
    encodeTimeSpecToTimestamp: () => encodeTimeSpecToTimestamp,
    encodeTimestampExtension: () => encodeTimestampExtension
  });

  // node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs
  function utf8Count(str) {
    const strLength = str.length;
    let byteLength = 0;
    let pos = 0;
    while (pos < strLength) {
      let value = str.charCodeAt(pos++);
      if ((value & 4294967168) === 0) {
        byteLength++;
        continue;
      } else if ((value & 4294965248) === 0) {
        byteLength += 2;
      } else {
        if (value >= 55296 && value <= 56319) {
          if (pos < strLength) {
            const extra = str.charCodeAt(pos);
            if ((extra & 64512) === 56320) {
              ++pos;
              value = ((value & 1023) << 10) + (extra & 1023) + 65536;
            }
          }
        }
        if ((value & 4294901760) === 0) {
          byteLength += 3;
        } else {
          byteLength += 4;
        }
      }
    }
    return byteLength;
  }
  function utf8EncodeJs(str, output, outputOffset) {
    const strLength = str.length;
    let offset = outputOffset;
    let pos = 0;
    while (pos < strLength) {
      let value = str.charCodeAt(pos++);
      if ((value & 4294967168) === 0) {
        output[offset++] = value;
        continue;
      } else if ((value & 4294965248) === 0) {
        output[offset++] = value >> 6 & 31 | 192;
      } else {
        if (value >= 55296 && value <= 56319) {
          if (pos < strLength) {
            const extra = str.charCodeAt(pos);
            if ((extra & 64512) === 56320) {
              ++pos;
              value = ((value & 1023) << 10) + (extra & 1023) + 65536;
            }
          }
        }
        if ((value & 4294901760) === 0) {
          output[offset++] = value >> 12 & 15 | 224;
          output[offset++] = value >> 6 & 63 | 128;
        } else {
          output[offset++] = value >> 18 & 7 | 240;
          output[offset++] = value >> 12 & 63 | 128;
          output[offset++] = value >> 6 & 63 | 128;
        }
      }
      output[offset++] = value & 63 | 128;
    }
  }
  var sharedTextEncoder = new TextEncoder();
  var TEXT_ENCODER_THRESHOLD = 50;
  function utf8EncodeTE(str, output, outputOffset) {
    sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
  }
  function utf8Encode(str, output, outputOffset) {
    if (str.length > TEXT_ENCODER_THRESHOLD) {
      utf8EncodeTE(str, output, outputOffset);
    } else {
      utf8EncodeJs(str, output, outputOffset);
    }
  }
  var CHUNK_SIZE = 4096;
  function utf8DecodeJs(bytes, inputOffset, byteLength) {
    let offset = inputOffset;
    const end = offset + byteLength;
    const units = [];
    let result = "";
    while (offset < end) {
      const byte1 = bytes[offset++];
      if ((byte1 & 128) === 0) {
        units.push(byte1);
      } else if ((byte1 & 224) === 192) {
        const byte2 = bytes[offset++] & 63;
        units.push((byte1 & 31) << 6 | byte2);
      } else if ((byte1 & 240) === 224) {
        const byte2 = bytes[offset++] & 63;
        const byte3 = bytes[offset++] & 63;
        units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
      } else if ((byte1 & 248) === 240) {
        const byte2 = bytes[offset++] & 63;
        const byte3 = bytes[offset++] & 63;
        const byte4 = bytes[offset++] & 63;
        let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
        if (unit > 65535) {
          unit -= 65536;
          units.push(unit >>> 10 & 1023 | 55296);
          unit = 56320 | unit & 1023;
        }
        units.push(unit);
      } else {
        units.push(byte1);
      }
      if (units.length >= CHUNK_SIZE) {
        result += String.fromCharCode(...units);
        units.length = 0;
      }
    }
    if (units.length > 0) {
      result += String.fromCharCode(...units);
    }
    return result;
  }
  var sharedTextDecoder = new TextDecoder();
  var TEXT_DECODER_THRESHOLD = 200;
  function utf8DecodeTD(bytes, inputOffset, byteLength) {
    const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
    return sharedTextDecoder.decode(stringBytes);
  }
  function utf8Decode(bytes, inputOffset, byteLength) {
    if (byteLength > TEXT_DECODER_THRESHOLD) {
      return utf8DecodeTD(bytes, inputOffset, byteLength);
    } else {
      return utf8DecodeJs(bytes, inputOffset, byteLength);
    }
  }

  // node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs
  var ExtData = class {
    constructor(type, data) {
      __publicField(this, "type");
      __publicField(this, "data");
      this.type = type;
      this.data = data;
    }
  };

  // node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs
  var DecodeError = class _DecodeError extends Error {
    constructor(message) {
      super(message);
      const proto = Object.create(_DecodeError.prototype);
      Object.setPrototypeOf(this, proto);
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: _DecodeError.name
      });
    }
  };

  // node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs
  var UINT32_MAX = 4294967295;
  function setUint64(view, offset, value) {
    const high = value / 4294967296;
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
  }
  function setInt64(view, offset, value) {
    const high = Math.floor(value / 4294967296);
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
  }
  function getInt64(view, offset) {
    const high = view.getInt32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
  }
  function getUint64(view, offset) {
    const high = view.getUint32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
  }

  // node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs
  var EXT_TIMESTAMP = -1;
  var TIMESTAMP32_MAX_SEC = 4294967296 - 1;
  var TIMESTAMP64_MAX_SEC = 17179869184 - 1;
  function encodeTimeSpecToTimestamp({ sec, nsec }) {
    if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
      if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
        const rv = new Uint8Array(4);
        const view = new DataView(rv.buffer);
        view.setUint32(0, sec);
        return rv;
      } else {
        const secHigh = sec / 4294967296;
        const secLow = sec & 4294967295;
        const rv = new Uint8Array(8);
        const view = new DataView(rv.buffer);
        view.setUint32(0, nsec << 2 | secHigh & 3);
        view.setUint32(4, secLow);
        return rv;
      }
    } else {
      const rv = new Uint8Array(12);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec);
      setInt64(view, 4, sec);
      return rv;
    }
  }
  function encodeDateToTimeSpec(date) {
    const msec = date.getTime();
    const sec = Math.floor(msec / 1e3);
    const nsec = (msec - sec * 1e3) * 1e6;
    const nsecInSec = Math.floor(nsec / 1e9);
    return {
      sec: sec + nsecInSec,
      nsec: nsec - nsecInSec * 1e9
    };
  }
  function encodeTimestampExtension(object) {
    if (object instanceof Date) {
      const timeSpec = encodeDateToTimeSpec(object);
      return encodeTimeSpecToTimestamp(timeSpec);
    } else {
      return null;
    }
  }
  function decodeTimestampToTimeSpec(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    switch (data.byteLength) {
      case 4: {
        const sec = view.getUint32(0);
        const nsec = 0;
        return { sec, nsec };
      }
      case 8: {
        const nsec30AndSecHigh2 = view.getUint32(0);
        const secLow32 = view.getUint32(4);
        const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
        const nsec = nsec30AndSecHigh2 >>> 2;
        return { sec, nsec };
      }
      case 12: {
        const sec = getInt64(view, 4);
        const nsec = view.getUint32(0);
        return { sec, nsec };
      }
      default:
        throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
    }
  }
  function decodeTimestampExtension(data) {
    const timeSpec = decodeTimestampToTimeSpec(data);
    return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
  }
  var timestampExtension = {
    type: EXT_TIMESTAMP,
    encode: encodeTimestampExtension,
    decode: decodeTimestampExtension
  };

  // node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs
  var _ExtensionCodec = class _ExtensionCodec {
    constructor() {
      // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
      // this will make type errors a lot more clear
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __publicField(this, "__brand");
      // built-in extensions
      __publicField(this, "builtInEncoders", []);
      __publicField(this, "builtInDecoders", []);
      // custom extensions
      __publicField(this, "encoders", []);
      __publicField(this, "decoders", []);
      this.register(timestampExtension);
    }
    register({ type, encode: encode2, decode: decode2 }) {
      if (type >= 0) {
        this.encoders[type] = encode2;
        this.decoders[type] = decode2;
      } else {
        const index = -1 - type;
        this.builtInEncoders[index] = encode2;
        this.builtInDecoders[index] = decode2;
      }
    }
    tryToEncode(object, context) {
      for (let i = 0; i < this.builtInEncoders.length; i++) {
        const encodeExt = this.builtInEncoders[i];
        if (encodeExt != null) {
          const data = encodeExt(object, context);
          if (data != null) {
            const type = -1 - i;
            return new ExtData(type, data);
          }
        }
      }
      for (let i = 0; i < this.encoders.length; i++) {
        const encodeExt = this.encoders[i];
        if (encodeExt != null) {
          const data = encodeExt(object, context);
          if (data != null) {
            const type = i;
            return new ExtData(type, data);
          }
        }
      }
      if (object instanceof ExtData) {
        return object;
      }
      return null;
    }
    decode(data, type, context) {
      const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
      if (decodeExt) {
        return decodeExt(data, type, context);
      } else {
        return new ExtData(type, data);
      }
    }
  };
  __publicField(_ExtensionCodec, "defaultCodec", new _ExtensionCodec());
  var ExtensionCodec = _ExtensionCodec;

  // node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs
  function isArrayBufferLike(buffer) {
    return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
  }
  function ensureUint8Array(buffer) {
    if (buffer instanceof Uint8Array) {
      return buffer;
    } else if (ArrayBuffer.isView(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (isArrayBufferLike(buffer)) {
      return new Uint8Array(buffer);
    } else {
      return Uint8Array.from(buffer);
    }
  }

  // node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs
  var DEFAULT_MAX_DEPTH = 100;
  var DEFAULT_INITIAL_BUFFER_SIZE = 2048;
  var Encoder = class _Encoder {
    constructor(options) {
      __publicField(this, "extensionCodec");
      __publicField(this, "context");
      __publicField(this, "useBigInt64");
      __publicField(this, "maxDepth");
      __publicField(this, "initialBufferSize");
      __publicField(this, "sortKeys");
      __publicField(this, "forceFloat32");
      __publicField(this, "ignoreUndefined");
      __publicField(this, "forceIntegerToFloat");
      __publicField(this, "pos");
      __publicField(this, "view");
      __publicField(this, "bytes");
      __publicField(this, "entered", false);
      this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
      this.context = options?.context;
      this.useBigInt64 = options?.useBigInt64 ?? false;
      this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
      this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
      this.sortKeys = options?.sortKeys ?? false;
      this.forceFloat32 = options?.forceFloat32 ?? false;
      this.ignoreUndefined = options?.ignoreUndefined ?? false;
      this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
      this.pos = 0;
      this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
      this.bytes = new Uint8Array(this.view.buffer);
    }
    clone() {
      return new _Encoder({
        extensionCodec: this.extensionCodec,
        context: this.context,
        useBigInt64: this.useBigInt64,
        maxDepth: this.maxDepth,
        initialBufferSize: this.initialBufferSize,
        sortKeys: this.sortKeys,
        forceFloat32: this.forceFloat32,
        ignoreUndefined: this.ignoreUndefined,
        forceIntegerToFloat: this.forceIntegerToFloat
      });
    }
    reinitializeState() {
      this.pos = 0;
    }
    /**
     * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
     *
     * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
     */
    encodeSharedRef(object) {
      if (this.entered) {
        const instance = this.clone();
        return instance.encodeSharedRef(object);
      }
      try {
        this.entered = true;
        this.reinitializeState();
        this.doEncode(object, 1);
        return this.bytes.subarray(0, this.pos);
      } finally {
        this.entered = false;
      }
    }
    /**
     * @returns Encodes the object and returns a copy of the encoder's internal buffer.
     */
    encode(object) {
      if (this.entered) {
        const instance = this.clone();
        return instance.encode(object);
      }
      try {
        this.entered = true;
        this.reinitializeState();
        this.doEncode(object, 1);
        return this.bytes.slice(0, this.pos);
      } finally {
        this.entered = false;
      }
    }
    doEncode(object, depth) {
      if (depth > this.maxDepth) {
        throw new Error(`Too deep objects in depth ${depth}`);
      }
      if (object == null) {
        this.encodeNil();
      } else if (typeof object === "boolean") {
        this.encodeBoolean(object);
      } else if (typeof object === "number") {
        if (!this.forceIntegerToFloat) {
          this.encodeNumber(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      } else if (typeof object === "string") {
        this.encodeString(object);
      } else if (this.useBigInt64 && typeof object === "bigint") {
        this.encodeBigInt64(object);
      } else {
        this.encodeObject(object, depth);
      }
    }
    ensureBufferSizeToWrite(sizeToWrite) {
      const requiredSize = this.pos + sizeToWrite;
      if (this.view.byteLength < requiredSize) {
        this.resizeBuffer(requiredSize * 2);
      }
    }
    resizeBuffer(newSize) {
      const newBuffer = new ArrayBuffer(newSize);
      const newBytes = new Uint8Array(newBuffer);
      const newView = new DataView(newBuffer);
      newBytes.set(this.bytes);
      this.view = newView;
      this.bytes = newBytes;
    }
    encodeNil() {
      this.writeU8(192);
    }
    encodeBoolean(object) {
      if (object === false) {
        this.writeU8(194);
      } else {
        this.writeU8(195);
      }
    }
    encodeNumber(object) {
      if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
        if (object >= 0) {
          if (object < 128) {
            this.writeU8(object);
          } else if (object < 256) {
            this.writeU8(204);
            this.writeU8(object);
          } else if (object < 65536) {
            this.writeU8(205);
            this.writeU16(object);
          } else if (object < 4294967296) {
            this.writeU8(206);
            this.writeU32(object);
          } else if (!this.useBigInt64) {
            this.writeU8(207);
            this.writeU64(object);
          } else {
            this.encodeNumberAsFloat(object);
          }
        } else {
          if (object >= -32) {
            this.writeU8(224 | object + 32);
          } else if (object >= -128) {
            this.writeU8(208);
            this.writeI8(object);
          } else if (object >= -32768) {
            this.writeU8(209);
            this.writeI16(object);
          } else if (object >= -2147483648) {
            this.writeU8(210);
            this.writeI32(object);
          } else if (!this.useBigInt64) {
            this.writeU8(211);
            this.writeI64(object);
          } else {
            this.encodeNumberAsFloat(object);
          }
        }
      } else {
        this.encodeNumberAsFloat(object);
      }
    }
    encodeNumberAsFloat(object) {
      if (this.forceFloat32) {
        this.writeU8(202);
        this.writeF32(object);
      } else {
        this.writeU8(203);
        this.writeF64(object);
      }
    }
    encodeBigInt64(object) {
      if (object >= BigInt(0)) {
        this.writeU8(207);
        this.writeBigUint64(object);
      } else {
        this.writeU8(211);
        this.writeBigInt64(object);
      }
    }
    writeStringHeader(byteLength) {
      if (byteLength < 32) {
        this.writeU8(160 + byteLength);
      } else if (byteLength < 256) {
        this.writeU8(217);
        this.writeU8(byteLength);
      } else if (byteLength < 65536) {
        this.writeU8(218);
        this.writeU16(byteLength);
      } else if (byteLength < 4294967296) {
        this.writeU8(219);
        this.writeU32(byteLength);
      } else {
        throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
      }
    }
    encodeString(object) {
      const maxHeaderSize = 1 + 4;
      const byteLength = utf8Count(object);
      this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
      this.writeStringHeader(byteLength);
      utf8Encode(object, this.bytes, this.pos);
      this.pos += byteLength;
    }
    encodeObject(object, depth) {
      const ext = this.extensionCodec.tryToEncode(object, this.context);
      if (ext != null) {
        this.encodeExtension(ext);
      } else if (Array.isArray(object)) {
        this.encodeArray(object, depth);
      } else if (ArrayBuffer.isView(object)) {
        this.encodeBinary(object);
      } else if (typeof object === "object") {
        this.encodeMap(object, depth);
      } else {
        throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
      }
    }
    encodeBinary(object) {
      const size = object.byteLength;
      if (size < 256) {
        this.writeU8(196);
        this.writeU8(size);
      } else if (size < 65536) {
        this.writeU8(197);
        this.writeU16(size);
      } else if (size < 4294967296) {
        this.writeU8(198);
        this.writeU32(size);
      } else {
        throw new Error(`Too large binary: ${size}`);
      }
      const bytes = ensureUint8Array(object);
      this.writeU8a(bytes);
    }
    encodeArray(object, depth) {
      const size = object.length;
      if (size < 16) {
        this.writeU8(144 + size);
      } else if (size < 65536) {
        this.writeU8(220);
        this.writeU16(size);
      } else if (size < 4294967296) {
        this.writeU8(221);
        this.writeU32(size);
      } else {
        throw new Error(`Too large array: ${size}`);
      }
      for (const item of object) {
        this.doEncode(item, depth + 1);
      }
    }
    countWithoutUndefined(object, keys) {
      let count = 0;
      for (const key of keys) {
        if (object[key] !== void 0) {
          count++;
        }
      }
      return count;
    }
    encodeMap(object, depth) {
      const keys = Object.keys(object);
      if (this.sortKeys) {
        keys.sort();
      }
      const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
      if (size < 16) {
        this.writeU8(128 + size);
      } else if (size < 65536) {
        this.writeU8(222);
        this.writeU16(size);
      } else if (size < 4294967296) {
        this.writeU8(223);
        this.writeU32(size);
      } else {
        throw new Error(`Too large map object: ${size}`);
      }
      for (const key of keys) {
        const value = object[key];
        if (!(this.ignoreUndefined && value === void 0)) {
          this.encodeString(key);
          this.doEncode(value, depth + 1);
        }
      }
    }
    encodeExtension(ext) {
      if (typeof ext.data === "function") {
        const data = ext.data(this.pos + 6);
        const size2 = data.length;
        if (size2 >= 4294967296) {
          throw new Error(`Too large extension object: ${size2}`);
        }
        this.writeU8(201);
        this.writeU32(size2);
        this.writeI8(ext.type);
        this.writeU8a(data);
        return;
      }
      const size = ext.data.length;
      if (size === 1) {
        this.writeU8(212);
      } else if (size === 2) {
        this.writeU8(213);
      } else if (size === 4) {
        this.writeU8(214);
      } else if (size === 8) {
        this.writeU8(215);
      } else if (size === 16) {
        this.writeU8(216);
      } else if (size < 256) {
        this.writeU8(199);
        this.writeU8(size);
      } else if (size < 65536) {
        this.writeU8(200);
        this.writeU16(size);
      } else if (size < 4294967296) {
        this.writeU8(201);
        this.writeU32(size);
      } else {
        throw new Error(`Too large extension object: ${size}`);
      }
      this.writeI8(ext.type);
      this.writeU8a(ext.data);
    }
    writeU8(value) {
      this.ensureBufferSizeToWrite(1);
      this.view.setUint8(this.pos, value);
      this.pos++;
    }
    writeU8a(values) {
      const size = values.length;
      this.ensureBufferSizeToWrite(size);
      this.bytes.set(values, this.pos);
      this.pos += size;
    }
    writeI8(value) {
      this.ensureBufferSizeToWrite(1);
      this.view.setInt8(this.pos, value);
      this.pos++;
    }
    writeU16(value) {
      this.ensureBufferSizeToWrite(2);
      this.view.setUint16(this.pos, value);
      this.pos += 2;
    }
    writeI16(value) {
      this.ensureBufferSizeToWrite(2);
      this.view.setInt16(this.pos, value);
      this.pos += 2;
    }
    writeU32(value) {
      this.ensureBufferSizeToWrite(4);
      this.view.setUint32(this.pos, value);
      this.pos += 4;
    }
    writeI32(value) {
      this.ensureBufferSizeToWrite(4);
      this.view.setInt32(this.pos, value);
      this.pos += 4;
    }
    writeF32(value) {
      this.ensureBufferSizeToWrite(4);
      this.view.setFloat32(this.pos, value);
      this.pos += 4;
    }
    writeF64(value) {
      this.ensureBufferSizeToWrite(8);
      this.view.setFloat64(this.pos, value);
      this.pos += 8;
    }
    writeU64(value) {
      this.ensureBufferSizeToWrite(8);
      setUint64(this.view, this.pos, value);
      this.pos += 8;
    }
    writeI64(value) {
      this.ensureBufferSizeToWrite(8);
      setInt64(this.view, this.pos, value);
      this.pos += 8;
    }
    writeBigUint64(value) {
      this.ensureBufferSizeToWrite(8);
      this.view.setBigUint64(this.pos, value);
      this.pos += 8;
    }
    writeBigInt64(value) {
      this.ensureBufferSizeToWrite(8);
      this.view.setBigInt64(this.pos, value);
      this.pos += 8;
    }
  };

  // node_modules/@msgpack/msgpack/dist.esm/encode.mjs
  function encode(value, options) {
    const encoder = new Encoder(options);
    return encoder.encodeSharedRef(value);
  }

  // node_modules/@msgpack/msgpack/dist.esm/utils/prettyByte.mjs
  function prettyByte(byte) {
    return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
  }

  // node_modules/@msgpack/msgpack/dist.esm/CachedKeyDecoder.mjs
  var DEFAULT_MAX_KEY_LENGTH = 16;
  var DEFAULT_MAX_LENGTH_PER_KEY = 16;
  var CachedKeyDecoder = class {
    constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
      __publicField(this, "hit", 0);
      __publicField(this, "miss", 0);
      __publicField(this, "caches");
      __publicField(this, "maxKeyLength");
      __publicField(this, "maxLengthPerKey");
      this.maxKeyLength = maxKeyLength;
      this.maxLengthPerKey = maxLengthPerKey;
      this.caches = [];
      for (let i = 0; i < this.maxKeyLength; i++) {
        this.caches.push([]);
      }
    }
    canBeCached(byteLength) {
      return byteLength > 0 && byteLength <= this.maxKeyLength;
    }
    find(bytes, inputOffset, byteLength) {
      const records = this.caches[byteLength - 1];
      FIND_CHUNK: for (const record of records) {
        const recordBytes = record.bytes;
        for (let j = 0; j < byteLength; j++) {
          if (recordBytes[j] !== bytes[inputOffset + j]) {
            continue FIND_CHUNK;
          }
        }
        return record.str;
      }
      return null;
    }
    store(bytes, value) {
      const records = this.caches[bytes.length - 1];
      const record = { bytes, str: value };
      if (records.length >= this.maxLengthPerKey) {
        records[Math.random() * records.length | 0] = record;
      } else {
        records.push(record);
      }
    }
    decode(bytes, inputOffset, byteLength) {
      const cachedValue = this.find(bytes, inputOffset, byteLength);
      if (cachedValue != null) {
        this.hit++;
        return cachedValue;
      }
      this.miss++;
      const str = utf8DecodeJs(bytes, inputOffset, byteLength);
      const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
      this.store(slicedCopyOfBytes, str);
      return str;
    }
  };

  // node_modules/@msgpack/msgpack/dist.esm/Decoder.mjs
  var STATE_ARRAY = "array";
  var STATE_MAP_KEY = "map_key";
  var STATE_MAP_VALUE = "map_value";
  var mapKeyConverter = (key) => {
    if (typeof key === "string" || typeof key === "number") {
      return key;
    }
    throw new DecodeError("The type of key must be string or number but " + typeof key);
  };
  var StackPool = class {
    constructor() {
      __publicField(this, "stack", []);
      __publicField(this, "stackHeadPosition", -1);
    }
    get length() {
      return this.stackHeadPosition + 1;
    }
    top() {
      return this.stack[this.stackHeadPosition];
    }
    pushArrayState(size) {
      const state = this.getUninitializedStateFromPool();
      state.type = STATE_ARRAY;
      state.position = 0;
      state.size = size;
      state.array = new Array(size);
    }
    pushMapState(size) {
      const state = this.getUninitializedStateFromPool();
      state.type = STATE_MAP_KEY;
      state.readCount = 0;
      state.size = size;
      state.map = {};
    }
    getUninitializedStateFromPool() {
      this.stackHeadPosition++;
      if (this.stackHeadPosition === this.stack.length) {
        const partialState = {
          type: void 0,
          size: 0,
          array: void 0,
          position: 0,
          readCount: 0,
          map: void 0,
          key: null
        };
        this.stack.push(partialState);
      }
      return this.stack[this.stackHeadPosition];
    }
    release(state) {
      const topStackState = this.stack[this.stackHeadPosition];
      if (topStackState !== state) {
        throw new Error("Invalid stack state. Released state is not on top of the stack.");
      }
      if (state.type === STATE_ARRAY) {
        const partialState = state;
        partialState.size = 0;
        partialState.array = void 0;
        partialState.position = 0;
        partialState.type = void 0;
      }
      if (state.type === STATE_MAP_KEY || state.type === STATE_MAP_VALUE) {
        const partialState = state;
        partialState.size = 0;
        partialState.map = void 0;
        partialState.readCount = 0;
        partialState.type = void 0;
      }
      this.stackHeadPosition--;
    }
    reset() {
      this.stack.length = 0;
      this.stackHeadPosition = -1;
    }
  };
  var HEAD_BYTE_REQUIRED = -1;
  var EMPTY_VIEW = new DataView(new ArrayBuffer(0));
  var EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
  try {
    EMPTY_VIEW.getInt8(0);
  } catch (e) {
    if (!(e instanceof RangeError)) {
      throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
    }
  }
  var MORE_DATA = new RangeError("Insufficient data");
  var sharedCachedKeyDecoder = new CachedKeyDecoder();
  var Decoder = class _Decoder {
    constructor(options) {
      __publicField(this, "extensionCodec");
      __publicField(this, "context");
      __publicField(this, "useBigInt64");
      __publicField(this, "rawStrings");
      __publicField(this, "maxStrLength");
      __publicField(this, "maxBinLength");
      __publicField(this, "maxArrayLength");
      __publicField(this, "maxMapLength");
      __publicField(this, "maxExtLength");
      __publicField(this, "keyDecoder");
      __publicField(this, "mapKeyConverter");
      __publicField(this, "totalPos", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "view", EMPTY_VIEW);
      __publicField(this, "bytes", EMPTY_BYTES);
      __publicField(this, "headByte", HEAD_BYTE_REQUIRED);
      __publicField(this, "stack", new StackPool());
      __publicField(this, "entered", false);
      this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
      this.context = options?.context;
      this.useBigInt64 = options?.useBigInt64 ?? false;
      this.rawStrings = options?.rawStrings ?? false;
      this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
      this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
      this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
      this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
      this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
      this.keyDecoder = options?.keyDecoder !== void 0 ? options.keyDecoder : sharedCachedKeyDecoder;
      this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
    }
    clone() {
      return new _Decoder({
        extensionCodec: this.extensionCodec,
        context: this.context,
        useBigInt64: this.useBigInt64,
        rawStrings: this.rawStrings,
        maxStrLength: this.maxStrLength,
        maxBinLength: this.maxBinLength,
        maxArrayLength: this.maxArrayLength,
        maxMapLength: this.maxMapLength,
        maxExtLength: this.maxExtLength,
        keyDecoder: this.keyDecoder
      });
    }
    reinitializeState() {
      this.totalPos = 0;
      this.headByte = HEAD_BYTE_REQUIRED;
      this.stack.reset();
    }
    setBuffer(buffer) {
      const bytes = ensureUint8Array(buffer);
      this.bytes = bytes;
      this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.pos = 0;
    }
    appendBuffer(buffer) {
      if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
        this.setBuffer(buffer);
      } else {
        const remainingData = this.bytes.subarray(this.pos);
        const newData = ensureUint8Array(buffer);
        const newBuffer = new Uint8Array(remainingData.length + newData.length);
        newBuffer.set(remainingData);
        newBuffer.set(newData, remainingData.length);
        this.setBuffer(newBuffer);
      }
    }
    hasRemaining(size) {
      return this.view.byteLength - this.pos >= size;
    }
    createExtraByteError(posToShow) {
      const { view, pos } = this;
      return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
    }
    /**
     * @throws {@link DecodeError}
     * @throws {@link RangeError}
     */
    decode(buffer) {
      if (this.entered) {
        const instance = this.clone();
        return instance.decode(buffer);
      }
      try {
        this.entered = true;
        this.reinitializeState();
        this.setBuffer(buffer);
        const object = this.doDecodeSync();
        if (this.hasRemaining(1)) {
          throw this.createExtraByteError(this.pos);
        }
        return object;
      } finally {
        this.entered = false;
      }
    }
    *decodeMulti(buffer) {
      if (this.entered) {
        const instance = this.clone();
        yield* instance.decodeMulti(buffer);
        return;
      }
      try {
        this.entered = true;
        this.reinitializeState();
        this.setBuffer(buffer);
        while (this.hasRemaining(1)) {
          yield this.doDecodeSync();
        }
      } finally {
        this.entered = false;
      }
    }
    async decodeAsync(stream) {
      if (this.entered) {
        const instance = this.clone();
        return instance.decodeAsync(stream);
      }
      try {
        this.entered = true;
        let decoded = false;
        let object;
        for await (const buffer of stream) {
          if (decoded) {
            this.entered = false;
            throw this.createExtraByteError(this.totalPos);
          }
          this.appendBuffer(buffer);
          try {
            object = this.doDecodeSync();
            decoded = true;
          } catch (e) {
            if (!(e instanceof RangeError)) {
              throw e;
            }
          }
          this.totalPos += this.pos;
        }
        if (decoded) {
          if (this.hasRemaining(1)) {
            throw this.createExtraByteError(this.totalPos);
          }
          return object;
        }
        const { headByte, pos, totalPos } = this;
        throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
      } finally {
        this.entered = false;
      }
    }
    decodeArrayStream(stream) {
      return this.decodeMultiAsync(stream, true);
    }
    decodeStream(stream) {
      return this.decodeMultiAsync(stream, false);
    }
    async *decodeMultiAsync(stream, isArray) {
      if (this.entered) {
        const instance = this.clone();
        yield* instance.decodeMultiAsync(stream, isArray);
        return;
      }
      try {
        this.entered = true;
        let isArrayHeaderRequired = isArray;
        let arrayItemsLeft = -1;
        for await (const buffer of stream) {
          if (isArray && arrayItemsLeft === 0) {
            throw this.createExtraByteError(this.totalPos);
          }
          this.appendBuffer(buffer);
          if (isArrayHeaderRequired) {
            arrayItemsLeft = this.readArraySize();
            isArrayHeaderRequired = false;
            this.complete();
          }
          try {
            while (true) {
              yield this.doDecodeSync();
              if (--arrayItemsLeft === 0) {
                break;
              }
            }
          } catch (e) {
            if (!(e instanceof RangeError)) {
              throw e;
            }
          }
          this.totalPos += this.pos;
        }
      } finally {
        this.entered = false;
      }
    }
    doDecodeSync() {
      DECODE: while (true) {
        const headByte = this.readHeadByte();
        let object;
        if (headByte >= 224) {
          object = headByte - 256;
        } else if (headByte < 192) {
          if (headByte < 128) {
            object = headByte;
          } else if (headByte < 144) {
            const size = headByte - 128;
            if (size !== 0) {
              this.pushMapState(size);
              this.complete();
              continue DECODE;
            } else {
              object = {};
            }
          } else if (headByte < 160) {
            const size = headByte - 144;
            if (size !== 0) {
              this.pushArrayState(size);
              this.complete();
              continue DECODE;
            } else {
              object = [];
            }
          } else {
            const byteLength = headByte - 160;
            object = this.decodeString(byteLength, 0);
          }
        } else if (headByte === 192) {
          object = null;
        } else if (headByte === 194) {
          object = false;
        } else if (headByte === 195) {
          object = true;
        } else if (headByte === 202) {
          object = this.readF32();
        } else if (headByte === 203) {
          object = this.readF64();
        } else if (headByte === 204) {
          object = this.readU8();
        } else if (headByte === 205) {
          object = this.readU16();
        } else if (headByte === 206) {
          object = this.readU32();
        } else if (headByte === 207) {
          if (this.useBigInt64) {
            object = this.readU64AsBigInt();
          } else {
            object = this.readU64();
          }
        } else if (headByte === 208) {
          object = this.readI8();
        } else if (headByte === 209) {
          object = this.readI16();
        } else if (headByte === 210) {
          object = this.readI32();
        } else if (headByte === 211) {
          if (this.useBigInt64) {
            object = this.readI64AsBigInt();
          } else {
            object = this.readI64();
          }
        } else if (headByte === 217) {
          const byteLength = this.lookU8();
          object = this.decodeString(byteLength, 1);
        } else if (headByte === 218) {
          const byteLength = this.lookU16();
          object = this.decodeString(byteLength, 2);
        } else if (headByte === 219) {
          const byteLength = this.lookU32();
          object = this.decodeString(byteLength, 4);
        } else if (headByte === 220) {
          const size = this.readU16();
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else if (headByte === 221) {
          const size = this.readU32();
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else if (headByte === 222) {
          const size = this.readU16();
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte === 223) {
          const size = this.readU32();
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte === 196) {
          const size = this.lookU8();
          object = this.decodeBinary(size, 1);
        } else if (headByte === 197) {
          const size = this.lookU16();
          object = this.decodeBinary(size, 2);
        } else if (headByte === 198) {
          const size = this.lookU32();
          object = this.decodeBinary(size, 4);
        } else if (headByte === 212) {
          object = this.decodeExtension(1, 0);
        } else if (headByte === 213) {
          object = this.decodeExtension(2, 0);
        } else if (headByte === 214) {
          object = this.decodeExtension(4, 0);
        } else if (headByte === 215) {
          object = this.decodeExtension(8, 0);
        } else if (headByte === 216) {
          object = this.decodeExtension(16, 0);
        } else if (headByte === 199) {
          const size = this.lookU8();
          object = this.decodeExtension(size, 1);
        } else if (headByte === 200) {
          const size = this.lookU16();
          object = this.decodeExtension(size, 2);
        } else if (headByte === 201) {
          const size = this.lookU32();
          object = this.decodeExtension(size, 4);
        } else {
          throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
        }
        this.complete();
        const stack = this.stack;
        while (stack.length > 0) {
          const state = stack.top();
          if (state.type === STATE_ARRAY) {
            state.array[state.position] = object;
            state.position++;
            if (state.position === state.size) {
              object = state.array;
              stack.release(state);
            } else {
              continue DECODE;
            }
          } else if (state.type === STATE_MAP_KEY) {
            if (object === "__proto__") {
              throw new DecodeError("The key __proto__ is not allowed");
            }
            state.key = this.mapKeyConverter(object);
            state.type = STATE_MAP_VALUE;
            continue DECODE;
          } else {
            state.map[state.key] = object;
            state.readCount++;
            if (state.readCount === state.size) {
              object = state.map;
              stack.release(state);
            } else {
              state.key = null;
              state.type = STATE_MAP_KEY;
              continue DECODE;
            }
          }
        }
        return object;
      }
    }
    readHeadByte() {
      if (this.headByte === HEAD_BYTE_REQUIRED) {
        this.headByte = this.readU8();
      }
      return this.headByte;
    }
    complete() {
      this.headByte = HEAD_BYTE_REQUIRED;
    }
    readArraySize() {
      const headByte = this.readHeadByte();
      switch (headByte) {
        case 220:
          return this.readU16();
        case 221:
          return this.readU32();
        default: {
          if (headByte < 160) {
            return headByte - 144;
          } else {
            throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
          }
        }
      }
    }
    pushMapState(size) {
      if (size > this.maxMapLength) {
        throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
      }
      this.stack.pushMapState(size);
    }
    pushArrayState(size) {
      if (size > this.maxArrayLength) {
        throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
      }
      this.stack.pushArrayState(size);
    }
    decodeString(byteLength, headerOffset) {
      if (!this.rawStrings || this.stateIsMapKey()) {
        return this.decodeUtf8String(byteLength, headerOffset);
      }
      return this.decodeBinary(byteLength, headerOffset);
    }
    /**
     * @throws {@link RangeError}
     */
    decodeUtf8String(byteLength, headerOffset) {
      if (byteLength > this.maxStrLength) {
        throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
      }
      if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
        throw MORE_DATA;
      }
      const offset = this.pos + headerOffset;
      let object;
      if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
        object = this.keyDecoder.decode(this.bytes, offset, byteLength);
      } else {
        object = utf8Decode(this.bytes, offset, byteLength);
      }
      this.pos += headerOffset + byteLength;
      return object;
    }
    stateIsMapKey() {
      if (this.stack.length > 0) {
        const state = this.stack.top();
        return state.type === STATE_MAP_KEY;
      }
      return false;
    }
    /**
     * @throws {@link RangeError}
     */
    decodeBinary(byteLength, headOffset) {
      if (byteLength > this.maxBinLength) {
        throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
      }
      if (!this.hasRemaining(byteLength + headOffset)) {
        throw MORE_DATA;
      }
      const offset = this.pos + headOffset;
      const object = this.bytes.subarray(offset, offset + byteLength);
      this.pos += headOffset + byteLength;
      return object;
    }
    decodeExtension(size, headOffset) {
      if (size > this.maxExtLength) {
        throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
      }
      const extType = this.view.getInt8(this.pos + headOffset);
      const data = this.decodeBinary(
        size,
        headOffset + 1
        /* extType */
      );
      return this.extensionCodec.decode(data, extType, this.context);
    }
    lookU8() {
      return this.view.getUint8(this.pos);
    }
    lookU16() {
      return this.view.getUint16(this.pos);
    }
    lookU32() {
      return this.view.getUint32(this.pos);
    }
    readU8() {
      const value = this.view.getUint8(this.pos);
      this.pos++;
      return value;
    }
    readI8() {
      const value = this.view.getInt8(this.pos);
      this.pos++;
      return value;
    }
    readU16() {
      const value = this.view.getUint16(this.pos);
      this.pos += 2;
      return value;
    }
    readI16() {
      const value = this.view.getInt16(this.pos);
      this.pos += 2;
      return value;
    }
    readU32() {
      const value = this.view.getUint32(this.pos);
      this.pos += 4;
      return value;
    }
    readI32() {
      const value = this.view.getInt32(this.pos);
      this.pos += 4;
      return value;
    }
    readU64() {
      const value = getUint64(this.view, this.pos);
      this.pos += 8;
      return value;
    }
    readI64() {
      const value = getInt64(this.view, this.pos);
      this.pos += 8;
      return value;
    }
    readU64AsBigInt() {
      const value = this.view.getBigUint64(this.pos);
      this.pos += 8;
      return value;
    }
    readI64AsBigInt() {
      const value = this.view.getBigInt64(this.pos);
      this.pos += 8;
      return value;
    }
    readF32() {
      const value = this.view.getFloat32(this.pos);
      this.pos += 4;
      return value;
    }
    readF64() {
      const value = this.view.getFloat64(this.pos);
      this.pos += 8;
      return value;
    }
  };

  // node_modules/@msgpack/msgpack/dist.esm/decode.mjs
  function decode(buffer, options) {
    const decoder = new Decoder(options);
    return decoder.decode(buffer);
  }
  function decodeMulti(buffer, options) {
    const decoder = new Decoder(options);
    return decoder.decodeMulti(buffer);
  }

  // node_modules/@msgpack/msgpack/dist.esm/utils/stream.mjs
  function isAsyncIterable(object) {
    return object[Symbol.asyncIterator] != null;
  }
  async function* asyncIterableFromStream(stream) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
  function ensureAsyncIterable(streamLike) {
    if (isAsyncIterable(streamLike)) {
      return streamLike;
    } else {
      return asyncIterableFromStream(streamLike);
    }
  }

  // node_modules/@msgpack/msgpack/dist.esm/decodeAsync.mjs
  async function decodeAsync(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeAsync(stream);
  }
  function decodeArrayStream(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeArrayStream(stream);
  }
  function decodeMultiStream(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeStream(stream);
  }

  // src/platform/dependencies.browser.js
  var DecimalJS = decimal_default;
  var BigJS = big_default;
  var msgpack = dist_exports;
  var NodeDOMParser = null;
  var NodeXMLSerializer = null;

  // src/msgpack.js
  var HAS_MSGPACK = msgpack !== null;
  function _checkMsgpack() {
    if (!HAS_MSGPACK) {
      throw new Error(
        "@msgpack/msgpack is required for MessagePack support. Install with: npm install @msgpack/msgpack"
      );
    }
  }
  var _extensionCodec = _buildCodec();
  function _buildCodec() {
    if (!HAS_MSGPACK) {
      return null;
    }
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const codec = new msgpack.ExtensionCodec();
    codec.register({
      type: -1,
      encode: (v) => {
        if (v instanceof Date) {
          const dt = getDateType(v);
          if (dt === "D" || dt === "H") {
            return null;
          }
        }
        return msgpack.encodeTimestampExtension(v);
      },
      decode: (data) => msgpack.decodeTimestampExtension(data)
    });
    codec.register({
      type: 1,
      encode: (v) => {
        if (isDecimal2(v)) {
          return enc.encode(v.toString());
        }
        return null;
      },
      decode: (data) => createDecimal(dec.decode(data))
    });
    codec.register({
      type: 2,
      encode: (v) => {
        if (v instanceof Date && getDateType(v) === "D") {
          const y = v.getUTCFullYear();
          const m = String(v.getUTCMonth() + 1).padStart(2, "0");
          const d = String(v.getUTCDate()).padStart(2, "0");
          return enc.encode(`${y}-${m}-${d}`);
        }
        return null;
      },
      decode: (data) => /* @__PURE__ */ new Date(dec.decode(data) + "T00:00:00.000Z")
    });
    codec.register({
      type: 3,
      encode: (v) => {
        if (v instanceof Date && getDateType(v) === "H") {
          const h = String(v.getUTCHours()).padStart(2, "0");
          const m = String(v.getUTCMinutes()).padStart(2, "0");
          const s = String(v.getUTCSeconds()).padStart(2, "0");
          const ms = String(v.getUTCMilliseconds()).padStart(3, "0");
          return enc.encode(`${h}:${m}:${s}.${ms}`);
        }
        return null;
      },
      decode: (data) => {
        const str = dec.decode(data);
        const dotIdx = str.indexOf(".");
        const timePart = dotIdx >= 0 ? str.substring(0, dotIdx) : str;
        const fracStr = dotIdx >= 0 ? str.substring(dotIdx + 1) : "0";
        const [h, m, s] = timePart.split(":");
        const ms = Math.round(+fracStr.substring(0, 3));
        return new Date(Date.UTC(1970, 0, 1, +h, +m, +s, ms));
      }
    });
    codec.register({
      type: 4,
      encode: (v) => {
        const entry = getCustomTypeEntry(v);
        if (entry !== null) {
          const [suffix, serializer] = entry;
          return enc.encode(`${suffix}:${serializer(v)}`);
        }
        return null;
      },
      decode: (data) => {
        const str = dec.decode(data);
        const idx = str.indexOf(":");
        const suffix = str.slice(0, idx);
        const payload = str.slice(idx + 1);
        const entry = SUFFIX_TO_TYPE[suffix];
        if (entry !== void 0) {
          const [, deserializer] = entry;
          return deserializer(payload);
        }
        return `${payload}::${suffix}`;
      }
    });
    return codec;
  }
  function toMsgpack(value) {
    _checkMsgpack();
    return msgpack.encode(value, { extensionCodec: _extensionCodec });
  }
  function fromMsgpack(data) {
    _checkMsgpack();
    return msgpack.decode(data, { extensionCodec: _extensionCodec });
  }

  // src/utils.js
  function rawEncode(value, forceSuffix = false) {
    const entry = getTypeEntry(value);
    if (entry === null) {
      return [false, String(value)];
    }
    const [suffix, serializer, jsonNative] = entry;
    if (jsonNative && !forceSuffix) {
      return [false, String(value)];
    }
    return [true, `${serializer(value)}::${suffix}`];
  }
  function rawDecode(s) {
    if (!s.includes("::")) {
      return [false, s];
    }
    const lastIndex = s.lastIndexOf("::");
    const value = s.slice(0, lastIndex);
    const suffix = s.slice(lastIndex + 2);
    const entry = SUFFIX_TO_TYPE[suffix];
    if (entry === void 0) {
      return [false, s];
    }
    const [, decoder] = entry;
    return [true, decoder(value)];
  }
  function walk(data, callback, filtercb) {
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      const result = {};
      for (const [k, v] of Object.entries(data)) {
        result[k] = walk(v, callback, filtercb);
      }
      return result;
    }
    if (Array.isArray(data)) {
      return data.map((item) => walk(item, callback, filtercb));
    }
    if (filtercb(data)) {
      return callback(data);
    }
    return data;
  }

  // src/encode.js
  function _preprocessValue(value) {
    const entry = getTypeEntry(value);
    if (entry !== null) {
      const [suffix, serializer, jsonNative] = entry;
      if (!jsonNative) {
        return [`${serializer(value)}::${suffix}`, true];
      }
      return [value, false];
    }
    if (Array.isArray(value)) {
      let hasSpecial = false;
      const result = value.map((item) => {
        const [processed, special] = _preprocessValue(item);
        if (special) hasSpecial = true;
        return processed;
      });
      return [result, hasSpecial];
    }
    if (value !== null && typeof value === "object") {
      let hasSpecial = false;
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        const [processed, special] = _preprocessValue(v);
        if (special) hasSpecial = true;
        result[k] = processed;
      }
      return [result, hasSpecial];
    }
    return [value, false];
  }
  function _toJson(value, forceSuffix = false) {
    const [encoded, result] = rawEncode(value, forceSuffix);
    if (encoded) {
      return result;
    }
    const [processed, hasSpecial] = _preprocessValue(value);
    const jsonResult = JSON.stringify(processed);
    if (hasSpecial) {
      return `${jsonResult}::JS`;
    }
    return jsonResult;
  }
  function _toRawJson(value) {
    return JSON.stringify(value);
  }
  function _toRawMsgpack(value) {
    if (!msgpack) throw new Error("@msgpack/msgpack is required for MessagePack support");
    return msgpack.encode(value);
  }
  function toTytx(value, transport = null, { raw = false, qs = false, _forceSuffix = false } = {}) {
    if (qs) {
      return `${toQs(value)}::QS`;
    }
    if (raw) {
      if (transport === null || transport === "json") {
        return _toRawJson(value);
      } else if (transport === "msgpack") {
        return _toRawMsgpack(value);
      } else if (transport === "xml") {
        throw new Error("raw=true is not supported for XML transport");
      } else {
        throw new Error(`Unknown transport: ${transport}`);
      }
    }
    if (transport === null || transport === "json") {
      const result = _toJson(value, _forceSuffix);
      if (transport === "json") {
        return `"${result}"`;
      }
      return result;
    } else if (transport === "xml") {
      const result = toXml(value);
      return `<?xml version="1.0" ?><tytx_root>${result}</tytx_root>`;
    } else if (transport === "msgpack") {
      return toMsgpack(value);
    } else {
      throw new Error(`Unknown transport: ${transport}`);
    }
  }

  // src/xml.js
  var DOMParser;
  var XMLSerializer;
  if (typeof window !== "undefined" && window.DOMParser) {
    DOMParser = window.DOMParser;
    XMLSerializer = window.XMLSerializer;
  } else {
    DOMParser = NodeDOMParser;
    XMLSerializer = NodeXMLSerializer;
  }
  function _isXmlElement(item) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }
    const keys = Object.keys(item);
    if (keys.length !== 1) {
      return false;
    }
    const itemData = item[keys[0]];
    return itemData !== null && typeof itemData === "object" && "value" in itemData;
  }
  function _serializeElement(doc, tag2, data) {
    const element = doc.createElement(tag2);
    const attrs = data.attrs || {};
    const value = data.value;
    for (const [attrName, attrValue] of Object.entries(attrs)) {
      element.setAttribute(attrName, toTytx(attrValue, null, { _forceSuffix: true }));
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (_isXmlElement(item)) {
          const [itemTag] = Object.keys(item);
          const itemData = item[itemTag];
          const childElement = _serializeElement(doc, itemTag, itemData);
          element.appendChild(childElement);
        } else {
          element.textContent = toTytx(value);
          break;
        }
      }
    } else {
      element.textContent = toTytx(value);
    }
    return element;
  }
  function toXml(value) {
    if (!DOMParser) {
      throw new Error("XML support requires @xmldom/xmldom package in Node.js");
    }
    if (_isXmlElement(value)) {
      const [rootTag] = Object.keys(value);
      const rootData = value[rootTag];
      const doc = new DOMParser().parseFromString("<root/>", "text/xml");
      const element = _serializeElement(doc, rootTag, rootData);
      const serializer = new XMLSerializer();
      return serializer.serializeToString(element);
    } else {
      return toTytx(value);
    }
  }
  function fromXmlnode(element) {
    const attrs = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attrs[attr.name] = fromTytx(attr.value);
    }
    const children = [];
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 1) {
        children.push(node);
      }
    }
    if (children.length > 0) {
      if (children.length === 1) {
        const child = children[0];
        const childData = fromXmlnode(child);
        return { attrs, value: { [child.tagName]: childData } };
      } else {
        const valueList = [];
        for (const child of children) {
          const childData = fromXmlnode(child);
          valueList.push({ [child.tagName]: childData });
        }
        return { attrs, value: valueList };
      }
    }
    return { attrs, value: fromTytx(element.textContent) };
  }
  function fromXml(data) {
    if (!DOMParser) {
      throw new Error("XML support requires @xmldom/xmldom package in Node.js");
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(data, "text/xml");
    let root = doc.documentElement;
    if (root.tagName === "tytx_root") {
      let firstElementChild = null;
      for (let i = 0; i < root.childNodes.length; i++) {
        if (root.childNodes[i].nodeType === 1) {
          firstElementChild = root.childNodes[i];
          break;
        }
      }
      if (!firstElementChild) {
        return fromTytx(root.textContent);
      }
      root = firstElementChild;
    }
    const result = fromXmlnode(root);
    return { [root.tagName]: result };
  }

  // src/decode.js
  function isString(v) {
    return typeof v === "string";
  }
  function _fromJson(data) {
    const [decoded, value] = rawDecode(data);
    if (decoded) {
      return value;
    }
    let jsonData = data;
    if (jsonData.endsWith("::JS")) {
      jsonData = jsonData.slice(0, -4);
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      return data;
    }
    return walk(parsed, _decodeItem, isString);
  }
  function _decodeItem(s) {
    if (!s.includes("::")) {
      return s;
    }
    return rawDecode(s)[1];
  }
  function _fromXml(data) {
    const result = fromXml(data);
    if (typeof result === "string") {
      return fromTytx(result);
    }
    return result;
  }
  function _fromMsgpack(data) {
    return fromMsgpack(data);
  }
  function fromTytx(data, transport = null) {
    if (data === null) {
      return null;
    }
    if (transport === null || transport === "json") {
      let jsonData = data;
      if (transport === "json" && data.startsWith('"') && data.endsWith('"')) {
        jsonData = data.slice(1, -1);
      }
      return _fromJson(jsonData);
    } else if (transport === "xml") {
      return _fromXml(data);
    } else if (transport === "msgpack") {
      return _fromMsgpack(data);
    } else {
      throw new Error(`Unknown transport: ${transport}`);
    }
  }

  // src/qs.js
  function toQs(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join("&");
    }
    if (value !== null && typeof value === "object") {
      const parts = [];
      for (const [k, v] of Object.entries(value)) {
        const [encoded, result] = rawEncode(v, true);
        if (encoded) {
          parts.push(`${k}=${result}`);
        } else {
          parts.push(`${k}=${v}`);
        }
      }
      return parts.join("&");
    }
    throw new TypeError(`toQs expects object or array, got ${typeof value}`);
  }
  function fromQs(data) {
    if (!data) {
      return [];
    }
    const parts = data.split("&");
    const hasEq = parts.map((p) => p.includes("="));
    const allWithEq = hasEq.every(Boolean);
    const noneWithEq = !hasEq.some(Boolean);
    if (!allWithEq && !noneWithEq) {
      throw new Error("QS format error: mixed items with and without '='");
    }
    if (noneWithEq) {
      return parts.map((p) => fromTytx(p));
    }
    const result = {};
    for (const part of parts) {
      const eqIndex = part.indexOf("=");
      const key = part.slice(0, eqIndex);
      const value = part.slice(eqIndex + 1);
      result[key] = fromTytx(value);
    }
    return result;
  }

  // src/registry.js
  var DecimalClass = DecimalJS || BigJS || Number;
  var decimalLibrary = DecimalJS ? "decimal.js" : BigJS ? "big.js" : "number";
  function setDecimalLibrary(name) {
    if (name === "decimal.js" && DecimalJS) {
      DecimalClass = DecimalJS;
      decimalLibrary = "decimal.js";
    } else if (name === "big.js" && BigJS) {
      DecimalClass = BigJS;
      decimalLibrary = "big.js";
    } else {
      DecimalClass = Number;
      decimalLibrary = "number";
    }
  }
  function getDecimalLibrary() {
    return decimalLibrary;
  }
  function createDecimal(value) {
    return new DecimalClass(value);
  }
  function isDecimal2(value) {
    if (decimalLibrary === "number") {
      return false;
    }
    return value instanceof DecimalClass;
  }
  function getDateType(d) {
    const isEpochDate = d.getUTCFullYear() === 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1;
    const isMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
    if (isEpochDate && !isMidnight) return "H";
    if (isMidnight && !isEpochDate) return "D";
    return "DHZ";
  }
  function _serializeDecimal(v) {
    return v.toString();
  }
  function _serializeDate(v) {
    const year = v.getUTCFullYear();
    const month = String(v.getUTCMonth() + 1).padStart(2, "0");
    const day = String(v.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function _serializeDatetime(v) {
    return v.toISOString();
  }
  function _serializeTime(v) {
    const hours = String(v.getUTCHours()).padStart(2, "0");
    const minutes = String(v.getUTCMinutes()).padStart(2, "0");
    const seconds = String(v.getUTCSeconds()).padStart(2, "0");
    const millis = String(v.getUTCMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }
  function _serializeBool(v) {
    return v ? "true" : "false";
  }
  function _serializeInt(v) {
    return v.toString();
  }
  function _serializeFloat(v) {
    return v.toString();
  }
  function _serializeRaw(v) {
    let binary = "";
    for (let i = 0; i < v.length; i += 32768) {
      binary += String.fromCharCode.apply(null, v.subarray(i, i + 32768));
    }
    return btoa(binary);
  }
  var CUSTOM_TYPES = [];
  function getCustomTypeEntry(value) {
    if (value === null || typeof value !== "object") {
      return null;
    }
    for (const [cls, suffix, serializer, jsonNative] of CUSTOM_TYPES) {
      if (value.constructor === cls) {
        return [suffix, serializer, jsonNative];
      }
    }
    return null;
  }
  function getTypeEntry(value) {
    if (value === null) {
      return ["NN", () => "", true];
    }
    if (isDecimal2(value)) {
      return ["N", _serializeDecimal, false];
    }
    if (value instanceof Uint8Array) {
      return ["RAW", _serializeRaw, false];
    }
    if (value instanceof Date) {
      const dateType = getDateType(value);
      if (dateType === "D") {
        return ["D", _serializeDate, false];
      } else if (dateType === "H") {
        return ["H", _serializeTime, false];
      } else {
        return ["DHZ", _serializeDatetime, false];
      }
    }
    if (typeof value === "boolean") {
      return ["B", _serializeBool, true];
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        return ["L", _serializeInt, true];
      } else {
        return ["R", _serializeFloat, true];
      }
    }
    return getCustomTypeEntry(value);
  }
  function _deserializeDecimal(s) {
    return createDecimal(s);
  }
  function _deserializeDate(s) {
    const [year, month, day] = s.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
  function _deserializeDatetime(s) {
    return new Date(s);
  }
  function _deserializeTime(s) {
    const [h, m, rest] = s.split(":");
    const [sec, ms] = rest.split(".");
    return new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), Number(sec), Number(ms || 0)));
  }
  function _deserializeBool(s) {
    return s.toLowerCase() === "true";
  }
  function _deserializeInt(s) {
    return parseInt(s, 10);
  }
  function _deserializeFloat(s) {
    return parseFloat(s);
  }
  function _deserializeStr(s) {
    return s;
  }
  function _deserializeNone(s) {
    return null;
  }
  var BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  function _deserializeRaw(s) {
    if (!BASE64_PATTERN.test(s)) {
      throw new Error(`RAW payload is not standard padded base64: '${s}'`);
    }
    const binary = atob(s);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  function _deserializeQs(s) {
    return fromQs(s);
  }
  var SUFFIX_PATTERN = /^[A-Z]+$/;
  var SUFFIX_TO_TYPE = {
    "N": [Object, _deserializeDecimal],
    // Object as placeholder for Decimal type
    "D": [Date, _deserializeDate],
    "DH": [Date, _deserializeDatetime],
    // deprecated, still accepted
    "DHZ": [Date, _deserializeDatetime],
    // canonical
    "H": [Date, _deserializeTime],
    "L": [Number, _deserializeInt],
    "R": [Number, _deserializeFloat],
    "T": [String, _deserializeStr],
    "B": [Boolean, _deserializeBool],
    "QS": [Object, _deserializeQs],
    "NN": [null, _deserializeNone],
    "RAW": [Uint8Array, _deserializeRaw]
  };
  function getRegisteredType(suffix) {
    return Object.hasOwn(SUFFIX_TO_TYPE, suffix) ? SUFFIX_TO_TYPE[suffix][0] : null;
  }
  function registerType(cls, suffix, serializer, deserializer, jsonNative = false) {
    if (typeof suffix !== "string" || !SUFFIX_PATTERN.test(suffix)) {
      throw new Error(
        `TYTX suffix '${suffix}' is invalid: expected uppercase ASCII letters only`
      );
    }
    const existing = SUFFIX_TO_TYPE[suffix];
    if (existing !== void 0 && existing[0] !== cls) {
      const owner = existing[0] === null ? "null" : existing[0].name;
      throw new Error(`TYTX suffix '${suffix}' is already registered for ${owner}`);
    }
    CUSTOM_TYPES = CUSTOM_TYPES.filter(([c]) => c !== cls);
    CUSTOM_TYPES.push([cls, suffix, serializer, jsonNative]);
    SUFFIX_TO_TYPE[suffix] = [cls, deserializer];
  }
  function registerClass(cls) {
    if (!cls.tytxSuffix) {
      throw new Error(`registerClass: ${cls.name} is missing a static tytxSuffix`);
    }
    if (typeof cls.prototype?.toTytx !== "function") {
      throw new Error(`registerClass: ${cls.name} is missing a toTytx method`);
    }
    if (typeof cls.fromTytx !== "function") {
      throw new Error(`registerClass: ${cls.name} is missing a static fromTytx method`);
    }
    registerType(
      cls,
      cls.tytxSuffix,
      (obj) => obj.toTytx(),
      (s) => cls.fromTytx(s),
      cls.tytxJsonNative || false
    );
    return cls;
  }

  // src/http.js
  var CONTENT_TYPES = {
    json: "application/json",
    xml: "application/xml",
    msgpack: "application/msgpack"
  };
  function getTransport(contentType) {
    if (!contentType) return null;
    const ct = contentType.toLowerCase();
    if (ct.includes("json")) return "json";
    if (ct.includes("xml")) return "xml";
    if (ct.includes("msgpack")) return "msgpack";
    return null;
  }
  async function fetchTytx(url, options = {}) {
    const {
      body,
      transport = "json",
      method = body !== void 0 ? "POST" : "GET",
      headers = {},
      ...fetchOptions
    } = options;
    const requestHeaders = {
      "X-TYTX-Transport": transport,
      ...headers
    };
    let requestBody;
    if (body !== void 0) {
      requestHeaders["Content-Type"] = CONTENT_TYPES[transport];
      const encoded = toTytx(body, transport);
      if (transport === "msgpack") {
        requestBody = encoded;
      } else {
        requestBody = encoded;
      }
    }
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      ...fetchOptions
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const responseContentType = response.headers.get("Content-Type") || "";
    const responseTransport = getTransport(responseContentType) || transport;
    let responseData;
    if (responseTransport === "msgpack") {
      const buffer = await response.arrayBuffer();
      responseData = fromTytx(Buffer.from(buffer), responseTransport);
    } else {
      const text = await response.text();
      responseData = fromTytx(text, responseTransport);
    }
    return responseData;
  }

  // src/index.js
  var __version__ = "0.15.0";
  return __toCommonJS(index_exports);
})();
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
//# sourceMappingURL=tytx.browser.js.map
