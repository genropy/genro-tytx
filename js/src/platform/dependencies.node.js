// Copyright 2025 Softwell S.r.l. - Licensed under Apache License 2.0
// Optional Node dependencies: absence disables only the corresponding codec/type.
const optional = async (name) => {
    try { return await import(name); } catch { return null; }
};

const [decimalModule, bigModule, msgpackModule, xmldomModule] = await Promise.all([
    optional('decimal.js'), optional('big.js'), optional('@msgpack/msgpack'),
    optional('@xmldom/xmldom'),
]);

export const DecimalJS = decimalModule?.default ?? decimalModule?.Decimal ?? null;
export const BigJS = bigModule?.default ?? bigModule?.Big ?? null;
export const msgpack = msgpackModule;
export const NodeDOMParser = xmldomModule?.DOMParser ?? null;
export const NodeXMLSerializer = xmldomModule?.XMLSerializer ?? null;
