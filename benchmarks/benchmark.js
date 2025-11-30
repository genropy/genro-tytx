#!/usr/bin/env node
/**
 * TYTX Performance Benchmarks (JavaScript)
 *
 * Run with: node benchmarks/benchmark.js
 */

const {
    from_text,
    as_text,
    as_typed_text,
    as_json,
    as_typed_json,
    from_json,
    as_xml,
    as_typed_xml,
    from_xml,
    registry
} = require('../js/src/index');

function benchmark(name, fn, iterations = 10000, warmup = 1000) {
    // Warmup
    for (let i = 0; i < warmup; i++) {
        fn();
    }

    // Measure
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        fn();
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
    }

    const avg_ns = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg_ns, 2), 0) / times.length;
    const std_ns = Math.sqrt(variance);
    const ops_per_sec = 1_000_000_000 / avg_ns;

    return {
        name,
        iterations,
        avg_ns,
        std_ns,
        avg_us: avg_ns / 1000,
        ops_per_sec
    };
}

function printResult(result) {
    const name = result.name.padEnd(40);
    const avg = result.avg_us.toFixed(2).padStart(8);
    const ops = Math.round(result.ops_per_sec).toLocaleString().padStart(12);
    console.log(`  ${name} ${avg} µs  (${ops} ops/sec)`);
}

function runBenchmarks() {
    console.log('='.repeat(70));
    console.log('TYTX Performance Benchmarks (JavaScript)');
    console.log('='.repeat(70));

    // ==========================================================================
    // Text Parsing (from_text)
    // ==========================================================================
    console.log('\n📖 from_text (parse typed strings)');
    console.log('-'.repeat(70));

    let results = [];

    results.push(benchmark('Integer (123::L)', () => from_text('123::L')));
    results.push(benchmark('Float (3.14159::R)', () => from_text('3.14159::R')));
    results.push(benchmark('Decimal (99999.99::N)', () => from_text('99999.99::N')));
    results.push(benchmark('Boolean (true::B)', () => from_text('true::B')));
    results.push(benchmark('Date (2025-01-15::D)', () => from_text('2025-01-15::D')));
    results.push(benchmark('DateTime (2025-01-15T10:30:00Z::DHZ)',
                          () => from_text('2025-01-15T10:30:00Z::DHZ')));
    results.push(benchmark('Time (10:30:00::H)', () => from_text('10:30:00::H')));
    results.push(benchmark('String (plain, no type)', () => from_text('hello world')));
    results.push(benchmark('JSON object', () => from_text('{"a": 1, "b": 2}::JS')));

    results.forEach(printResult);

    // ==========================================================================
    // Text Serialization (as_typed_text)
    // ==========================================================================
    console.log('\n📝 as_typed_text (serialize with type suffix)');
    console.log('-'.repeat(70));

    results = [];

    results.push(benchmark('Integer (123)', () => as_typed_text(123)));
    results.push(benchmark('Float (3.14159)', () => as_typed_text(3.14159)));
    results.push(benchmark('Boolean (true)', () => as_typed_text(true)));

    const testDate = new Date('2025-01-15T00:00:00.000Z');
    results.push(benchmark('Date', () => as_typed_text(testDate)));

    const testDateTime = new Date('2025-01-15T10:30:00.000Z');
    results.push(benchmark('DateTime', () => as_typed_text(testDateTime)));

    results.push(benchmark('String', () => as_typed_text('hello world')));

    results.forEach(printResult);

    // ==========================================================================
    // Typed Arrays
    // ==========================================================================
    console.log('\n📦 Typed Arrays');
    console.log('-'.repeat(70));

    results = [];

    results.push(benchmark('Parse [1,2,3]::L', () => from_text('[1,2,3]::L')));
    results.push(benchmark('Parse [[1,2],[3,4]]::L (nested)',
                          () => from_text('[[1,2],[3,4]]::L')));

    const largeArrayStr = '[' + Array.from({length: 100}, (_, i) => i).join(',') + ']::L';
    results.push(benchmark('Parse 100 integers', () => from_text(largeArrayStr)));

    const smallArray = [1, 2, 3];
    results.push(benchmark('Serialize [1,2,3] compact',
                          () => as_typed_text(smallArray, true)));

    const nestedArray = [[1, 2], [3, 4]];
    results.push(benchmark('Serialize nested compact',
                          () => as_typed_text(nestedArray, true)));

    const largeArray = Array.from({length: 100}, (_, i) => i);
    results.push(benchmark('Serialize 100 integers compact',
                          () => as_typed_text(largeArray, true)));

    results.forEach(printResult);

    // ==========================================================================
    // JSON Utilities
    // ==========================================================================
    console.log('\n🔄 JSON Utilities');
    console.log('-'.repeat(70));

    results = [];

    const simpleObj = { price: 99.99, count: 42, name: 'Widget' };
    results.push(benchmark('as_typed_json (simple)', () => as_typed_json(simpleObj)));
    results.push(benchmark('as_json (simple)', () => as_json(simpleObj)));

    const typedJson = '{"price": "99.99::N", "count": "42::L", "name": "Widget"}';
    results.push(benchmark('from_json (simple)', () => from_json(typedJson)));

    const complexObj = {
        order: {
            id: 12345,
            items: [
                { name: 'Widget', price: 25.00, qty: 2 },
                { name: 'Gadget', price: 75.50, qty: 1 }
            ],
            total: 125.50,
            date: new Date('2025-01-15'),
            status: 'shipped'
        }
    };
    results.push(benchmark('as_typed_json (complex)', () => as_typed_json(complexObj)));
    results.push(benchmark('as_json (complex)', () => as_json(complexObj)));

    const complexTypedJson = as_typed_json(complexObj);
    results.push(benchmark('from_json (complex)', () => from_json(complexTypedJson)));

    results.forEach(printResult);

    // ==========================================================================
    // XML Utilities
    // ==========================================================================
    console.log('\n📄 XML Utilities');
    console.log('-'.repeat(70));

    results = [];

    const simpleXmlData = { price: { attrs: {}, value: 99.99 } };
    results.push(benchmark('as_typed_xml (simple)', () => as_typed_xml(simpleXmlData)));
    results.push(benchmark('as_xml (simple)', () => as_xml(simpleXmlData)));

    const simpleXml = '<price>99.99::R</price>';
    results.push(benchmark('from_xml (simple)', () => from_xml(simpleXml)));

    const attrXmlData = {
        product: {
            attrs: { id: 123, price: 99.50 },
            value: 'Widget'
        }
    };
    results.push(benchmark('as_typed_xml (with attrs)', () => as_typed_xml(attrXmlData)));

    const attrXml = '<product id="123::L" price="99.50::R">Widget</product>';
    results.push(benchmark('from_xml (with attrs)', () => from_xml(attrXml)));

    results.forEach(printResult);

    // ==========================================================================
    // Registry Operations
    // ==========================================================================
    console.log('\n🔍 Registry Operations');
    console.log('-'.repeat(70));

    results = [];

    results.push(benchmark("registry.get('L')", () => registry.get('L')));
    results.push(benchmark("registry.get('INTEGER')", () => registry.get('INTEGER')));
    results.push(benchmark("registry.is_typed('123::L')", () => registry.is_typed('123::L')));
    results.push(benchmark("registry.is_typed('hello')", () => registry.is_typed('hello')));

    results.forEach(printResult);

    // ==========================================================================
    // Roundtrip Comparisons
    // ==========================================================================
    console.log('\n🔁 Roundtrip (serialize + parse)');
    console.log('-'.repeat(70));

    results = [];

    results.push(benchmark('Integer roundtrip', () => {
        const s = as_typed_text(12345);
        return from_text(s);
    }));

    const dateVal = new Date('2025-01-15T00:00:00.000Z');
    results.push(benchmark('Date roundtrip', () => {
        const s = as_typed_text(dateVal);
        return from_text(s);
    }));

    const jsonObj = { price: 99.99, date: new Date('2025-01-15'), count: 42 };
    results.push(benchmark('JSON object roundtrip', () => {
        const s = as_typed_json(jsonObj);
        return from_json(s);
    }));

    const arrayVal = Array.from({length: 50}, (_, i) => i);
    results.push(benchmark('Array (50 ints) roundtrip', () => {
        const s = as_typed_text(arrayVal, true);
        return from_text(s);
    }));

    results.forEach(printResult);

    // ==========================================================================
    // Comparison with native JSON
    // ==========================================================================
    console.log('\n⚡ Comparison with native JSON');
    console.log('-'.repeat(70));

    const jsonNative = { price: 99.99, count: 42, name: 'Widget', active: true };
    const jsonStr = JSON.stringify(jsonNative);

    results = [];
    results.push(benchmark('JSON.stringify (native)', () => JSON.stringify(jsonNative)));
    results.push(benchmark('JSON.parse (native)', () => JSON.parse(jsonStr)));
    results.push(benchmark('as_typed_json (native types)', () => as_typed_json(jsonNative)));

    const typedNative = as_typed_json(jsonNative);
    results.push(benchmark('from_json (native types)', () => from_json(typedNative)));

    results.forEach(printResult);

    console.log('\n' + '='.repeat(70));
    console.log('Benchmark complete!');
    console.log('='.repeat(70));
}

runBenchmarks();
