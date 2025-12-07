/**
 * Build dataset from the shared JSON spec for JS tests.
 */

const fs = require('fs');
const path = require('path');
const { DecimalLib } = require('../../js/src/registry');

const SPEC_PATH = path.join(__dirname, '..', 'dataset_spec.json');
const SPEC = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

const hasDecimal = Boolean(DecimalLib);

function toDecimal(value) {
    if (hasDecimal) {
        return new DecimalLib(value);
    }
    return Number(value);
}

function parseDate(value) {
    // Keep midnight UTC for date-only values
    return new Date(value + 'T00:00:00.000Z');
}

function parseDateTime(value, aware = true) {
    if (value.endsWith('Z')) {
        return new Date(value);
    }
    const dt = new Date(value);
    if (!aware) {
        // Keep as-is (naive) by removing timezone offset effect
        const tzOffsetMs = dt.getTimezoneOffset() * 60_000;
        return new Date(dt.getTime() + tzOffsetMs);
    }
    return dt;
}

function parseTime(value) {
    // Represent time as Date on epoch day (UTC)
    const base = '1970-01-01T' + value + 'Z';
    return new Date(base);
}

function parseScalar(entry) {
    const t = entry.type;
    const v = entry.value;
    switch (t) {
        case 'decimal':
            return toDecimal(v);
        case 'date':
            return parseDate(v);
        case 'datetime':
            return parseDateTime(v, true);
        case 'datetime_naive':
            return parseDateTime(v, false);
        case 'time':
            return parseTime(v);
        case 'bool':
            return Boolean(v);
        case 'int':
            return Number(v);
        case 'float':
            return Number(v);
        case 'string':
            return String(v);
        case 'null':
            return null;
        default:
            throw new Error('Unsupported scalar type: ' + t);
    }
}

function resolveRefs(data, scalarMap) {
    if (typeof data === 'string' && data.startsWith('#')) {
        return scalarMap[data.slice(1)];
    }
    if (Array.isArray(data)) {
        return data.map((v) => resolveRefs(v, scalarMap));
    }
    if (data && typeof data === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(data)) {
            out[k] = resolveRefs(v, scalarMap);
        }
        return out;
    }
    return data;
}

function buildScalars(spec) {
    const scalars = {};
    for (const entry of spec.scalar) {
        scalars[entry.id] = parseScalar(entry);
    }
    return scalars;
}

function buildComposites(spec, scalarMap) {
    const composites = {};
    for (const entry of spec.composite) {
        composites[entry.id] = resolveRefs(entry.value, scalarMap);
    }
    return composites;
}

function columnValue(col, row) {
    const idx = row - 1;
    switch (col.type) {
        case 'int': {
            let base = Number(col.start || 0) + idx * Number(col.step || 0);
            if (col.mod) base = base % Number(col.mod);
            return base;
        }
        case 'float': {
            let base = Number(col.start || 0) + idx * Number(col.step || 0);
            if (col.mod) base = base % Number(col.mod);
            return base;
        }
        case 'decimal': {
            const start = Number(col.start || 0);
            const step = Number(col.step || 0);
            const val = start + step * idx;
            if (col.value !== undefined) return toDecimal(col.value);
            return toDecimal(col.mod ? val % Number(col.mod) : val);
        }
        case 'bool': {
            const pattern = col.pattern || '';
            if (pattern === 'row%2==0') return idx % 2 === 0;
            if (pattern === 'row%3==0') return idx % 3 === 0;
            if (pattern === 'row%5<2') return idx % 5 < 2;
            return idx % 2 === 0;
        }
        case 'string': {
            if (col.template) {
                return col.template
                    .replace('{row}', String(row))
                    .replace('{row_mod_10}', String(row % 10))
                    .replace('{row_mod_255}', String(row % 255))
                    .replace('{row_mod_251}', String(row % 251))
                    .replace('{row_pad_5}', String(row).padStart(5, '0'))
                    .replace('{row_pad_12}', String(row).padStart(12, '0'));
            }
            if (col.choices && col.choices.length) {
                return col.choices[idx % col.choices.length];
            }
            return '';
        }
        case 'date': {
            const base = parseDate(col.start);
            const days = idx * Number(col.step_days || 0);
            return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        }
        case 'datetime': {
            const base = parseDateTime(col.start, true);
            const seconds = idx * Number(col.step_seconds || 0);
            return new Date(base.getTime() + seconds * 1000);
        }
        case 'datetime_naive': {
            const base = parseDateTime(col.start, false);
            const seconds = idx * Number(col.step_seconds || 0);
            return new Date(base.getTime() + seconds * 1000);
        }
        case 'time': {
            const base = parseTime(col.start);
            const seconds = idx * Number(col.step_seconds || 0);
            return new Date(base.getTime() + seconds * 1000);
        }
        case 'list':
            return col.template || [];
        case 'dict':
            return col.template || {};
        default:
            throw new Error('Unsupported column type: ' + col.type);
    }
}

function buildRecordset(spec) {
    const { rows, columns } = spec.recordset;
    const data = [];
    for (let row = 1; row <= rows; row += 1) {
        const record = {};
        for (const col of columns) {
            record[col.name] = columnValue(col, row);
        }
        data.push(record);
    }
    return data;
}

function buildDataset() {
    const scalars = buildScalars(SPEC);
    const composites = buildComposites(SPEC, scalars);
    const recordset = buildRecordset(SPEC);
    const payloads = [...Object.values(scalars), ...Object.values(composites), { records: recordset }];
    return { scalars, composites, recordset, payloads };
}

module.exports = { buildDataset, hasDecimal };
