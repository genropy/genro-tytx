var TYTX = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
    isDecimal: () => isDecimal,
    registerClass: () => registerClass,
    registerType: () => registerType,
    setDecimalLibrary: () => setDecimalLibrary,
    toTytx: () => toTytx
  });

  // node-module-shim:module
  function createRequire() {
    return function browserRequire(id) {
      throw new Error(`Cannot require '${id}' in browser environment`);
    };
  }

  // src/msgpack.js
  var import_meta = {};
  var require2 = createRequire(import_meta.url);
  var msgpack = null;
  var HAS_MSGPACK = false;
  try {
    msgpack = require2("@msgpack/msgpack");
    HAS_MSGPACK = true;
  } catch {
    HAS_MSGPACK = false;
  }
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
        if (isDecimal(v)) {
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
  var import_meta2 = {};
  var require3 = createRequire(import_meta2.url);
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
    const { encode } = require3("@msgpack/msgpack");
    return encode(value);
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
  var import_meta3 = {};
  var require4 = createRequire(import_meta3.url);
  var DOMParser;
  var XMLSerializer;
  if (typeof window !== "undefined" && window.DOMParser) {
    DOMParser = window.DOMParser;
    XMLSerializer = window.XMLSerializer;
  } else {
    try {
      const xmldom = require4("@xmldom/xmldom");
      DOMParser = xmldom.DOMParser;
      XMLSerializer = xmldom.XMLSerializer;
    } catch {
      DOMParser = null;
      XMLSerializer = null;
    }
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
  function _serializeElement(doc, tag, data) {
    const element = doc.createElement(tag);
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
  var import_meta4 = {};
  var require5 = createRequire(import_meta4.url);
  var DecimalJS = null;
  var BigJS = null;
  try {
    DecimalJS = require5("decimal.js");
  } catch {
  }
  try {
    BigJS = require5("big.js");
  } catch {
  }
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
    if (isDecimal(value)) {
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
//# sourceMappingURL=tytx.browser.js.map
