/**
 * TYTX (Typed Text) - JavaScript Implementation
 */

class DataType {
    constructor(name, code, aliases = []) {
        this.name = name;
        this.code = code;
        this.aliases = aliases;
    }

    parse(value) {
        return value;
    }

    serialize(value) {
        return String(value);
    }
}

class TypeRegistry {
    constructor() {
        this.types = new Map();
        this.codes = new Map();
        this.aliases = new Map();
    }

    register(typeInstance) {
        this.types.set(typeInstance.name, typeInstance);
        this.codes.set(typeInstance.code, typeInstance);
        typeInstance.aliases.forEach(alias => {
            this.aliases.set(alias, typeInstance);
        });
    }

    get(nameOrCode) {
        if (this.types.has(nameOrCode)) return this.types.get(nameOrCode);
        if (this.codes.has(nameOrCode)) return this.codes.get(nameOrCode);
        if (this.aliases.has(nameOrCode)) return this.aliases.get(nameOrCode);
        return null;
    }

    hydrate(valueString) {
        if (typeof valueString !== 'string' || !valueString.includes('::')) {
            return valueString;
        }

        // Split on last occurrence of ::
        const lastIndex = valueString.lastIndexOf('::');
        const valPart = valueString.substring(0, lastIndex);
        const typePart = valueString.substring(lastIndex + 2);

        const typeHandler = this.get(typePart);
        if (typeHandler) {
            return typeHandler.parse(valPart);
        }
        return valueString;
    }

    serialize(value) {
        if (typeof value === 'boolean') return this.get('B').serialize(value) + '::B';
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return this.get('I').serialize(value) + '::I';
            return this.get('F').serialize(value) + '::F';
        }
        if (typeof value === 'string') {
            if (value.includes('::')) return value;
            return value;
        }
        if (value instanceof Date) {
            // Heuristic: if time is 00:00:00, assume date? No, safer to use datetime or explicit type.
            // For now, let's default to datetime for Date objects
            return this.get('dt').serialize(value) + '::dt';
        }
        if (Array.isArray(value)) {
            // Could be List or JSON. If simple list of strings, maybe L.
            // But JSON is safer for complex structures.
            return this.get('J').serialize(value) + '::J';
        }
        if (typeof value === 'object' && value !== null) {
            // Check for custom types if we had a way to map classes to types
            // For now, JSON fallback
            return this.get('J').serialize(value) + '::J';
        }
        return String(value);
    }
}

// Built-in Types

class IntType extends DataType {
    constructor() { super('int', 'I', ['integer', 'long']); }
    parse(value) { return parseInt(value, 10); }
}

class FloatType extends DataType {
    constructor() { super('float', 'F', ['double', 'real']); }
    parse(value) { return parseFloat(value); }
}

class BoolType extends DataType {
    constructor() { super('bool', 'B', ['boolean']); }
    parse(value) {
        const v = value.toLowerCase();
        return v === 'true' || v === '1' || v === 'yes' || v === 't';
    }
    serialize(value) { return value ? 'true' : 'false'; }
}

class StrType extends DataType {
    constructor() { super('str', 'S', ['string', 'text']); }
}

class JsonType extends DataType {
    constructor() { super('json', 'J', []); }
    parse(value) { return JSON.parse(value); }
    serialize(value) { return JSON.stringify(value); }
}

class ListType extends DataType {
    constructor() { super('list', 'L', ['array']); }
    parse(value) { return value ? value.split(',') : []; }
    serialize(value) { return Array.isArray(value) ? value.join(',') : String(value); }
}

class DecimalType extends DataType {
    constructor() { super('decimal', 'D', ['dec', 'money']); }
    parse(value) { return parseFloat(value); } // JS has no native Decimal, use float for now
}

class DateType extends DataType {
    constructor() { super('date', 'd', []); }
    parse(value) { return new Date(value); }
    serialize(value) { return value.toISOString().split('T')[0]; }
}

class DateTimeType extends DataType {
    constructor() { super('datetime', 'dt', []); }
    parse(value) { return new Date(value); }
    serialize(value) { return value.toISOString(); }
}

// Initialize Registry
const registry = new TypeRegistry();
registry.register(new IntType());
registry.register(new FloatType());
registry.register(new BoolType());
registry.register(new StrType());
registry.register(new JsonType());
registry.register(new ListType());
registry.register(new DecimalType());
registry.register(new DateType());
registry.register(new DateTimeType());

module.exports = {
    registry,
    DataType,
    TypeRegistry,
    hydrate: (val) => registry.hydrate(val),
    serialize: (val) => registry.serialize(val)
};
