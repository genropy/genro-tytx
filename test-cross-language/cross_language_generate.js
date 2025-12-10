/**
 * Generate encoded test files from JavaScript for cross-language testing.
 *
 * Run this, then run the Python cross-language tests.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
    toTytx,
    toMsgpack,
    toXml,
    createDecimal,
    getDecimalLibrary,
} = require('../js/src/index.js');

// Helper functions for creating dates
const createDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
const createTime = (h, m, s) => new Date(Date.UTC(1970, 0, 1, h, m, s, 0));
const createDateTime = (y, mo, d, h, mi, s) => new Date(Date.UTC(y, mo - 1, d, h, mi, s, 0));
const hasDecimal = getDecimalLibrary() !== 'number';

// Check if msgpack is available
let hasMsgpack = false;
try {
    require('@msgpack/msgpack');
    hasMsgpack = true;
} catch {
    console.log('MessagePack not available - skipping msgpack file generation');
}

const OUTPUT_DIR = path.join(__dirname, 'cross_language_data_js');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Test cases - mirror of Python test cases
const TEST_CASES = {
    decimal_simple: { price: hasDecimal ? createDecimal('100.50') : 100.50 },
    date_simple: { d: createDate(2025, 1, 15) },
    datetime_utc: { dt: createDateTime(2025, 1, 15, 10, 30, 0) },
    time_simple: { t: createTime(10, 30, 45) },
    mixed_types: {
        price: hasDecimal ? createDecimal('999.99') : 999.99,
        date: createDate(2025, 6, 15),
        datetime: createDateTime(2025, 6, 15, 14, 30, 0),
        time: createTime(8, 0, 0),
        string: 'hello',
        integer: 42,
        float: 3.14,
        boolean: true,
        null: null,
    },
    nested_structure: {
        invoice: {
            total: hasDecimal ? createDecimal('1234.56') : 1234.56,
            issued: createDate(2025, 3, 1),
            items: [
                { name: 'Item A', price: hasDecimal ? createDecimal('100.00') : 100, qty: 2 },
                { name: 'Item B', price: hasDecimal ? createDecimal('200.00') : 200, qty: 1 },
            ],
        },
    },
    array_of_decimals: hasDecimal
        ? [createDecimal('1.1'), createDecimal('2.2'), createDecimal('3.3')]
        : [1.1, 2.2, 3.3],
    array_of_dates: [createDate(2025, 1, 1), createDate(2025, 2, 1), createDate(2025, 3, 1)],
};

// Generate JSON files
for (const [name, data] of Object.entries(TEST_CASES)) {
    // Text format (::JS suffix)
    const textEncoded = toTytx(data);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.tytx.json`), textEncoded, 'utf8');
}
console.log(`Generated ${Object.keys(TEST_CASES).length} JSON files in ${OUTPUT_DIR}`);

// Generate MessagePack files
if (hasMsgpack) {
    for (const [name, data] of Object.entries(TEST_CASES)) {
        const encoded = toMsgpack(data);
        fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.tytx.msgpack`), encoded);
    }
    console.log(`Generated ${Object.keys(TEST_CASES).length} MessagePack files in ${OUTPUT_DIR}`);
}

// Generate XML files using root: true (same data as JSON/MessagePack)
for (const [name, data] of Object.entries(TEST_CASES)) {
    // Use root: true to wrap in <tytx_root>, which gets auto-unwrapped on decode
    const xmlEncoded = toXml(data, { declaration: false, root: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.tytx.xml`), xmlEncoded, 'utf8');
}
console.log(`Generated ${Object.keys(TEST_CASES).length} XML files in ${OUTPUT_DIR}`);

console.log('\nAll cross-language test files generated from JS!');
