# TYTX UI Generation

The `genro-tytx` JavaScript library includes a powerful **UI Generator** module that can automatically render HTML forms based on your Struct definitions.

This allows for a "Schema-First" approach to UI development: define your data structure once, and get a working form for free.

## Usage

Import the `FormGenerator` class from the library.

```javascript
import { FormGenerator } from 'genro-tytx/ui';

// 1. Define your Registry of Structs
const registry = {
    ADDRESS: {
        fields: [
            { name: 'street', type: 'T', meta: 'lbl:Street' },
            { name: 'city',   type: 'T', meta: 'lbl:City' }
        ]
    },
    USER: {
        fields: [
            { name: 'name',    type: 'T',        meta: 'lbl:Full Name' },
            { name: 'role',    type: 'T',        meta: 'enum:Admin|User' },
            { name: 'address', type: '@ADDRESS', meta: 'lbl:Home Address' }
        ]
    }
};

// 2. Initialize Generator
const generator = new FormGenerator(registry);

// 3. Render Form
const userStruct = registry['USER'];
const formElement = generator.render(userStruct);

// 4. Append to DOM
document.getElementById('app').appendChild(formElement);
```

## Supported Features

### 1. Native Inputs
*   `T` -> `<input type="text">`
*   `L`, `N`, `R` -> `<input type="number">`
*   `D` -> `<input type="date">`
*   `B` -> `<input type="checkbox">`

### 2. Nested Structs (Tree View)
Fields referencing other structs (e.g., `@ADDRESS`) are rendered as collapsible groups using HTML `<details>` and `<summary>` elements. This creates a natural tree interface for complex data.

### 3. Typed Arrays
Fields defining arrays of structs (e.g., `#@ITEM`) are rendered as a collapsible list.

### 4. UI Metadata
You can customize the rendering using standard TYTX metadata facets:

| Facet | Effect | Example |
| :--- | :--- | :--- |
| `lbl` | Sets the field label | `T[lbl:First Name]` |
| `ph` | Sets placeholder text | `T[ph:John Doe]` |
| `hint`| Adds a tooltip/help text | `T[hint:Enter legal name]` |
| `def` | Sets default value | `T[def:User]` |
| `ro` | Sets read-only attribute | `T[ro:true]` |
| `enum`| Renders a `<select>` dropdown | `T[enum:A|B|C]` |

## Customization

The `FormGenerator` class is designed to be extended. You can subclass it to override `renderInput` or `renderNested` to use your own component library (e.g., React components, Bootstrap classes, or Custom Elements).
