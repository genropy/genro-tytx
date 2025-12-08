/**
 * TYTX Base - XML Tests (TypeScript)
 *
 * @license Apache-2.0
 * @copyright Softwell S.r.l. 2025
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    toXml,
    fromXml,
    DecimalLib,
    isDecimalInstance,
    type XmlElementData
} from '../src/index';

// Helper to create dates
function createDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
}

function createTime(hour: number, minute: number, second: number): Date {
    return new Date(Date.UTC(1970, 0, 1, hour, minute, second));
}

function createDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

describe('TYTX XML (TypeScript)', () => {
    describe('Encode', () => {
        it('should encode Decimal', () => {
            if (!DecimalLib) {
                console.log('Skipping Decimal test - no decimal library');
                return;
            }
            const data = {
                price: {
                    attrs: {},
                    value: new DecimalLib('100.50')
                }
            };
            const xml = toXml(data);
            assert.ok(xml.includes('<?xml'), 'Should have declaration');
            // Verify by decoding - check mathematical value, not string representation
            const decoded = fromXml<{ price: XmlElementData }>(xml);
            assert.ok(isDecimalInstance(decoded.price.value), 'Should be Decimal');
            assert.equal(parseFloat((decoded.price.value as { toString(): string }).toString()), 100.5);
        });

        it('should encode Date', () => {
            const data = {
                record: {
                    attrs: {},
                    value: {
                        date: { attrs: {}, value: createDate(2025, 1, 15) }
                    }
                }
            };
            const result = toXml(data);
            assert.ok(result.includes('2025-01-15::D'), 'Should contain typed Date');
        });

        it('should encode attributes', () => {
            const data = {
                order: {
                    attrs: { id: 123, active: true },
                    value: null
                }
            };
            const result = toXml(data);
            assert.ok(result.includes('id="123::L"'), 'Should have typed integer attribute');
            assert.ok(result.includes('active="true::B"'), 'Should have typed boolean attribute');
        });

        it('should encode nested structure', () => {
            if (!DecimalLib) {
                console.log('Skipping Decimal test - no decimal library');
                return;
            }
            const data = {
                invoice: {
                    attrs: { id: 1 },
                    value: {
                        total: { attrs: {}, value: new DecimalLib('999.99') },
                        date: { attrs: {}, value: createDate(2025, 6, 15) }
                    }
                }
            };
            const result = toXml(data);
            assert.ok(result.includes('<total>999.99::N</total>'), 'Should have total');
            assert.ok(result.includes('<date>2025-06-15::D</date>'), 'Should have date');
        });

        it('should encode array as _item elements', () => {
            const data = {
                items: {
                    attrs: {},
                    value: [
                        { attrs: {}, value: 'one' },
                        { attrs: {}, value: 'two' },
                        { attrs: {}, value: 'three' }
                    ]
                }
            };
            const result = toXml(data);
            assert.ok(result.includes('<_item>one</_item>'), 'Should have first item');
            assert.ok(result.includes('<_item>two</_item>'), 'Should have second item');
            assert.ok(result.includes('<_item>three</_item>'), 'Should have third item');
        });
    });

    describe('Decode', () => {
        it('should decode Decimal', () => {
            if (!DecimalLib) {
                console.log('Skipping Decimal test - no decimal library');
                return;
            }
            const xml = '<?xml version="1.0" ?><price>100.50::N</price>';
            const result = fromXml<{ price: XmlElementData }>(xml);
            assert.ok(result.price, 'Should have price');
            assert.ok(isDecimalInstance(result.price.value), 'Should be Decimal');
            assert.equal((result.price.value as { toString(): string }).toString(), '100.5');
        });

        it('should decode Date', () => {
            const xml = '<?xml version="1.0" ?><record><date>2025-01-15::D</date></record>';
            const result = fromXml(xml) as { record: { value: { date: { value: Date } } } };
            assert.ok(result.record.value.date.value instanceof Date, 'Should be Date');
            assert.equal(result.record.value.date.value.toISOString().slice(0, 10), '2025-01-15');
        });

        it('should decode attributes', () => {
            const xml = '<?xml version="1.0" ?><order id="123::L" active="true::B" />';
            const result = fromXml(xml) as { order: { attrs: { id: number; active: boolean } } };
            assert.equal(result.order.attrs.id, 123, 'Should have integer attribute');
            assert.equal(result.order.attrs.active, true, 'Should have boolean attribute');
        });

        it('should decode nested structure', () => {
            if (!DecimalLib) {
                console.log('Skipping Decimal test - no decimal library');
                return;
            }
            const xml = '<?xml version="1.0" ?><invoice id="1::L"><total>999.99::N</total><date>2025-06-15::D</date></invoice>';
            const result = fromXml(xml) as {
                invoice: {
                    attrs: { id: number };
                    value: {
                        total: { value: { toString(): string } };
                        date: { value: Date };
                    };
                };
            };
            assert.equal(result.invoice.attrs.id, 1);
            assert.ok(isDecimalInstance(result.invoice.value.total.value));
            assert.equal(result.invoice.value.total.value.toString(), '999.99');
            assert.ok(result.invoice.value.date.value instanceof Date);
        });

        it('should decode array from _item elements', () => {
            const xml = '<?xml version="1.0" ?><items><_item>one</_item><_item>two</_item><_item>three</_item></items>';
            const result = fromXml(xml) as { items: { value: Array<{ value: string }> } };
            assert.ok(Array.isArray(result.items.value), 'Should be array');
            assert.equal(result.items.value.length, 3);
            assert.equal(result.items.value[0]!.value, 'one');
            assert.equal(result.items.value[1]!.value, 'two');
            assert.equal(result.items.value[2]!.value, 'three');
        });
    });

    describe('Roundtrip', () => {
        it('should roundtrip complex data', () => {
            if (!DecimalLib) {
                console.log('Skipping Decimal test - no decimal library');
                return;
            }
            const original = {
                invoice: {
                    attrs: { id: 42, active: true },
                    value: {
                        total: { attrs: {}, value: new DecimalLib('999.99') },
                        date: { attrs: {}, value: createDate(2025, 1, 15) }
                    }
                }
            };

            const xml = toXml(original);
            const result = fromXml(xml) as {
                invoice: {
                    attrs: { id: number; active: boolean };
                    value: {
                        total: { value: { toString(): string } };
                        date: { value: Date };
                    };
                };
            };

            assert.equal(result.invoice.attrs.id, 42);
            assert.equal(result.invoice.attrs.active, true);
            assert.equal(result.invoice.value.total.value.toString(), '999.99');
            assert.equal(result.invoice.value.date.value.toISOString().slice(0, 10), '2025-01-15');
        });

        it('should roundtrip Time', () => {
            const original = {
                record: {
                    attrs: {},
                    value: {
                        time: { attrs: {}, value: createTime(10, 30, 45) }
                    }
                }
            };
            const xml = toXml(original);
            const result = fromXml(xml) as { record: { value: { time: { value: Date } } } };
            assert.ok(result.record.value.time.value instanceof Date, 'Should be Date');
        });

        it('should roundtrip DateTime', () => {
            const original = {
                record: {
                    attrs: {},
                    value: {
                        datetime: { attrs: {}, value: createDateTime(2025, 1, 15, 10, 30, 0) }
                    }
                }
            };
            const xml = toXml(original);
            const result = fromXml(xml) as { record: { value: { datetime: { value: Date } } } };
            assert.ok(result.record.value.datetime.value instanceof Date, 'Should be Date');
        });
    });

    describe('Options', () => {
        it('should omit declaration when option is false', () => {
            const data = {
                test: { attrs: {}, value: 'hello' }
            };
            const result = toXml(data, { declaration: false });
            assert.ok(!result.includes('<?xml'), 'Should not have declaration');
            assert.ok(result.startsWith('<test>'), 'Should start with root element');
        });
    });

    describe('Root wrapper', () => {
        it('should wrap with root=true', () => {
            const data = {
                price: { value: 123 }
            };
            const result = toXml(data, { root: true, declaration: false });
            assert.ok(result.startsWith('<tytx_root>'), 'Should start with tytx_root');
            assert.ok(result.endsWith('</tytx_root>'), 'Should end with tytx_root');
        });

        it('should wrap with custom root tag', () => {
            const data = {
                price: { value: 123 }
            };
            const result = toXml(data, { root: 'data', declaration: false });
            assert.ok(result.startsWith('<data>'), 'Should start with custom root');
            assert.ok(result.endsWith('</data>'), 'Should end with custom root');
        });

        it('should wrap with root attrs', () => {
            const data = {
                price: { value: 123 }
            };
            const result = toXml(data, { root: { version: 1 }, declaration: false });
            assert.ok(result.includes('tytx_root'), 'Should have tytx_root');
            assert.ok(result.includes('version="1::L"'), 'Should have version attr');
        });

        it('should unwrap tytx_root on decode', () => {
            const xml = '<tytx_root><price>100::L</price></tytx_root>';
            const result = fromXml(xml) as { price: { value: number } };
            assert.ok(result.price, 'Should have price directly (unwrapped)');
            assert.equal(result.price.value, 100);
        });

        it('should throw on invalid root type', () => {
            const data = { price: { value: 123 } };
            assert.throws(() => {
                toXml(data, { root: 123 as unknown as boolean });
            }, /root must be boolean, string, or object/);
        });
    });

    describe('Error handling', () => {
        it('should throw on invalid XML', () => {
            assert.throws(() => {
                fromXml('not valid xml');
            }, /Invalid XML/);
        });

        it('should throw on missing value key', () => {
            assert.throws(() => {
                toXml({ price: 123 } as unknown as Record<string, XmlElementData>);
            }, /must be an object with 'value' key/);
        });

        it('should throw on multiple root elements', () => {
            assert.throws(() => {
                toXml({ a: { value: 1 }, b: { value: 2 } });
            }, /single root element/);
        });

        it('should throw on non-object input', () => {
            assert.throws(() => {
                toXml('not an object' as unknown as Record<string, XmlElementData>);
            }, /must be an object/);
        });
    });

    describe('XML entities', () => {
        it('should escape special characters in text', () => {
            const data = {
                message: { attrs: {}, value: 'Hello <world> & "friends"' }
            };
            const result = toXml(data, { declaration: false });
            assert.ok(result.includes('&lt;world&gt;'), 'Should escape < and >');
            assert.ok(result.includes('&amp;'), 'Should escape &');
            assert.ok(result.includes('&quot;'), 'Should escape "');
        });

        it('should escape special characters in attributes', () => {
            const data = {
                item: { attrs: { name: 'A & B "quoted"' }, value: null }
            };
            const result = toXml(data, { declaration: false });
            assert.ok(result.includes('&amp;'), 'Should escape &');
            assert.ok(result.includes('&quot;'), 'Should escape "');
        });

        it('should unescape entities on decode', () => {
            const xml = '<message>Hello &lt;world&gt; &amp; &quot;friends&quot;</message>';
            const result = fromXml(xml) as { message: { value: string } };
            assert.equal(result.message.value, 'Hello <world> & "friends"');
        });

        it('should handle apostrophe entity', () => {
            const xml = '<message>It&apos;s working</message>';
            const result = fromXml(xml) as { message: { value: string } };
            assert.equal(result.message.value, "It's working");
        });
    });

    describe('Repeated elements', () => {
        it('should handle multiple children with same tag', () => {
            const data = {
                order: {
                    attrs: {},
                    value: {
                        item: [
                            { attrs: { name: 'A' }, value: 10 },
                            { attrs: { name: 'B' }, value: 20 },
                            { attrs: { name: 'C' }, value: 30 }
                        ]
                    }
                }
            };
            const result = toXml(data, { declaration: false });
            assert.ok(result.includes('<item name="A">10::L</item>'), 'Should have item A');
            assert.ok(result.includes('<item name="B">20::L</item>'), 'Should have item B');
            assert.ok(result.includes('<item name="C">30::L</item>'), 'Should have item C');
        });

        it('should decode repeated elements as array', () => {
            const xml = '<order><item>10::L</item><item>20::L</item><item>30::L</item></order>';
            const result = fromXml(xml) as { order: { value: { item: Array<{ value: number }> } } };
            assert.ok(Array.isArray(result.order.value.item), 'Should be array');
            assert.equal(result.order.value.item.length, 3);
            assert.equal(result.order.value.item[0]!.value, 10);
            assert.equal(result.order.value.item[1]!.value, 20);
            assert.equal(result.order.value.item[2]!.value, 30);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty text content', () => {
            const xml = '<item></item>';
            const result = fromXml(xml) as { item: { value: null } };
            assert.equal(result.item.value, null);
        });

        it('should handle whitespace-only content', () => {
            const xml = '<item>   </item>';
            const result = fromXml(xml) as { item: { value: null } };
            assert.equal(result.item.value, null);
        });

        it('should handle float numbers', () => {
            const data = {
                value: { attrs: {}, value: 3.14159 }
            };
            const result = toXml(data, { declaration: false });
            assert.ok(result.includes('3.14159::R'), 'Should encode as float');
        });

        it('should handle unknown type suffix', () => {
            const xml = '<item>something::UNKNOWN</item>';
            const result = fromXml(xml) as { item: { value: string } };
            assert.equal(result.item.value, 'something::UNKNOWN');
        });

        it('should handle self-closing tags', () => {
            const xml = '<item id="123::L" />';
            const result = fromXml(xml) as { item: { attrs: { id: number }; value: null } };
            assert.equal(result.item.attrs.id, 123);
            assert.equal(result.item.value, null);
        });
    });
});
