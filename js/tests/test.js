const { registry, hydrate, serialize } = require('../src/index');
const { dictToXml } = require('../src/xml');
const assert = require('assert');

console.log('Running TYTX JS Tests...');

try {
    // Test Hydrate
    assert.strictEqual(hydrate('123::I'), 123, 'Int hydrate failed');
    assert.strictEqual(hydrate('123.45::F'), 123.45, 'Float hydrate failed');
    assert.strictEqual(hydrate('true::B'), true, 'Bool true failed');
    assert.deepStrictEqual(hydrate('a,b,c::L'), ['a', 'b', 'c'], 'List hydrate failed');

    // Test Serialize
    assert.strictEqual(serialize(123), '123::I', 'Int serialize failed');
    assert.strictEqual(serialize(123.45), '123.45::F', 'Float serialize failed');
    assert.strictEqual(serialize(true), 'true::B', 'Bool serialize failed');

    // Test XML Generation
    const data = { root: { "@attr": 123, "#text": "content" } };
    const xml = dictToXml(data);
    console.log('XML Output:', xml);
    assert.ok(xml.includes('attr="123::I"'), 'XML attr failed');
    assert.ok(xml.includes('>content</root>'), 'XML content failed');

    console.log('✅ All tests passed!');
} catch (e) {
    console.error('❌ Test failed:', e.message);
    process.exit(1);
}
