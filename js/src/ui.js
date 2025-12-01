/**
 * TYTX UI Generator
 * Generates HTML Forms from TYTX Struct definitions.
 */

export class FormGenerator {
    constructor(registry = {}) {
        this.registry = registry;
    }

    /**
     * Renders a form for a given struct.
     * @param {Object} structDef - The struct definition { name, fields: [...] }
     * @returns {HTMLElement} - The generated HTML element (div or form)
     */
    render(structDef) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tytx-form-container';

        structDef.fields.forEach(f => {
            const fieldEl = this.renderField(f);
            wrapper.appendChild(fieldEl);
        });

        return wrapper;
    }

    renderField(field) {
        // Parse Metadata
        const meta = this.parseMeta(field.meta);
        const label = meta.lbl || field.name;
        const type = field.type;

        // 1. Nested Struct (@NAME)
        if (type.startsWith('@')) {
            const nestedName = type.substring(1);
            return this.renderNested(label, nestedName, false);
        }

        // 2. Array of Structs (#@NAME)
        if (type.startsWith('#@')) {
            const nestedName = type.substring(2);
            return this.renderNested(label, nestedName, true);
        }

        // 3. Standard Field
        return this.renderInput(label, type, meta);
    }

    renderNested(label, structName, isArray) {
        const details = document.createElement('details');
        details.open = true;
        details.className = 'tytx-nested-group';
        details.style.marginBottom = '10px';
        details.style.marginLeft = '10px';

        const summaryText = isArray ? `${label} (List)` : label;
        const summarySub = isArray ? `[List of ${structName}]` : `(${structName})`;

        details.innerHTML = `
            <summary style="cursor:pointer; font-weight:600; color:var(--primary, #2563eb);">
                ${summaryText} 
                <span style="font-weight:normal; color:#64748b; font-size:0.8em">${summarySub}</span>
            </summary>
        `;

        const content = document.createElement('div');
        content.style.paddingLeft = '15px';
        content.style.borderLeft = '1px solid #cbd5e1';

        const nestedDef = this.registry[structName];
        if (nestedDef) {
            if (isArray) {
                // Render a placeholder "Add Item" button or empty list
                // For demo purposes, we render one empty item template
                const itemContainer = document.createElement('div');
                itemContainer.className = 'tytx-array-item';
                itemContainer.style.marginTop = '5px';
                itemContainer.appendChild(this.render(nestedDef));
                content.appendChild(itemContainer);
            } else {
                content.appendChild(this.render(nestedDef));
            }
        } else {
            content.innerHTML = `<div style="color:red">Unknown struct: ${structName}</div>`;
        }

        details.appendChild(content);
        return details;
    }

    renderInput(label, type, meta) {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.style.marginBottom = '15px';

        let inputHtml = '';
        const placeholder = meta.ph ? `placeholder="${meta.ph}"` : '';
        const defVal = meta.def ? `value="${meta.def}"` : '';
        const readOnly = meta.ro === 'true' ? 'readonly' : '';

        if (meta.enum) {
            const options = meta.enum.split('|').map(o => `<option>${o}</option>`).join('');
            inputHtml = `<select class="form-control" ${readOnly}>${options}</select>`;
        } else if (type === 'B') {
            inputHtml = `<label><input type="checkbox" ${meta.def === 'true' ? 'checked' : ''} ${readOnly}> ${label}</label>`;
        } else {
            let inputType = 'text';
            if (['L', 'N', 'R'].includes(type)) inputType = 'number';
            if (type === 'D') inputType = 'date';

            inputHtml = `
                <label class="form-label" style="display:block; font-weight:500; margin-bottom:5px;">${label}</label>
                <input type="${inputType}" class="form-control" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:4px;" ${placeholder} ${defVal} ${readOnly}>
            `;
        }

        if (type !== 'B') {
            group.innerHTML = inputHtml;
        } else {
            group.innerHTML = inputHtml;
        }

        return group;
    }

    parseMeta(metaStr) {
        const meta = {};
        if (!metaStr) return meta;
        if (typeof metaStr === 'object') return metaStr; // Already parsed

        metaStr.split(',').forEach(m => {
            const parts = m.split(':');
            if (parts.length >= 2) {
                const k = parts[0].trim();
                const v = parts.slice(1).join(':').trim();
                meta[k] = v;
            }
        });
        return meta;
    }
}
