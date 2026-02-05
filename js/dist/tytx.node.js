var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/registry.js
import { createRequire } from "module";
function createDecimal(value) {
  return new DecimalClass(value);
}
function isDecimal(value) {
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
function getTypeEntry(value) {
  if (isDecimal(value)) {
    return ["N", _serializeDecimal, false];
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
  return null;
}
function _deserializeDecimal(s) {
  return createDecimal(s);
}
function _deserializeDate(s) {
  const [year, month, day] = s.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
function _deserializeDatetime(s) {
  let str = s;
  if (str.endsWith("Z")) {
    str = str.slice(0, -1) + "+00:00";
  }
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
function _deserializeQs(s) {
  const { fromQs } = require2("./qs.js");
  return fromQs(s);
}
var require2, DecimalJS, BigJS, DecimalClass, decimalLibrary, SUFFIX_TO_TYPE;
var init_registry = __esm({
  "src/registry.js"() {
    require2 = createRequire(import.meta.url);
    DecimalJS = null;
    BigJS = null;
    try {
      DecimalJS = require2("decimal.js");
    } catch {
    }
    try {
      BigJS = require2("big.js");
    } catch {
    }
    DecimalClass = DecimalJS || BigJS || Number;
    decimalLibrary = DecimalJS ? "decimal.js" : BigJS ? "big.js" : "number";
    SUFFIX_TO_TYPE = {
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
      "QS": [Object, _deserializeQs]
    };
  }
});

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
var init_utils = __esm({
  "src/utils.js"() {
    init_registry();
  }
});

// src/decode.js
import { createRequire as createRequire3 } from "module";
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
  const { fromXml } = require4("./xml.js");
  const result = fromXml(data);
  if (typeof result === "string") {
    return fromTytx(result);
  }
  return result;
}
function _fromMsgpack(data) {
  const { fromMsgpack } = require4("./msgpack.js");
  return fromMsgpack(data);
}
function fromTytx(data, transport = null) {
  if (data === null) {
    return null;
  }
  if (transport === null || transport === "json") {
    let jsonData = data;
    if (transport === "json") {
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
var require4;
var init_decode = __esm({
  "src/decode.js"() {
    init_utils();
    require4 = createRequire3(import.meta.url);
  }
});

// src/index.js
init_registry();

// src/encode.js
init_utils();
init_registry();
import { createRequire as createRequire2 } from "module";
var require3 = createRequire2(import.meta.url);
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
  const msgpack = require3("msgpack-lite");
  return msgpack.encode(value);
}
function toTytx(value, transport = null, { raw = false, qs = false, _forceSuffix = false } = {}) {
  if (qs) {
    const { toQs } = require3("./qs.js");
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
    const { toXml } = require3("./xml.js");
    const result = toXml(value);
    return `<?xml version="1.0" ?><tytx_root>${result}</tytx_root>`;
  } else if (transport === "msgpack") {
    const { toMsgpack } = require3("./msgpack.js");
    return toMsgpack(value);
  } else {
    throw new Error(`Unknown transport: ${transport}`);
  }
}

// src/index.js
init_decode();

// src/http.js
init_decode();
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
var __version__ = "0.7.4";
export {
  CONTENT_TYPES,
  __version__,
  fetchTytx,
  fromTytx,
  getTransport,
  isDecimal,
  toTytx
};
