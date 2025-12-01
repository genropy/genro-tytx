# Optimizing OpenAPI with TYTX

OpenAPI (formerly Swagger) is the industry standard for defining RESTful APIs. However, OpenAPI definitions—especially in JSON or YAML—can become extremely verbose, particularly when defining repetitive elements like query parameters, headers, and operation metadata.

**TYTX Structs** offer a powerful way to model these specifications compactly, reducing file size and cognitive load while maintaining strict typing.

## The Problem: Verbosity

Consider a standard OpenAPI definition for a single query parameter:

```yaml
# Standard OpenAPI (YAML)
parameters:
  - name: limit
    in: query
    description: Max records to return
    required: false
    schema:
      type: integer
      default: 20
```

Now imagine an API with 50 endpoints, each accepting `limit`, `offset`, `sort`, and `filter`. The specification file quickly grows to thousands of lines of repetitive boilerplate.

## The Solution: TYTX Structs

We can define a **Struct** for an OpenAPI Parameter and use **Typed Arrays** to represent lists of parameters.

### 1. Define the Schema

First, we register a struct that matches the OpenAPI Parameter Object structure.

```python
# Define a compact struct for API Parameters
register_struct('PARAM', {
    'name':     'T',                                # Parameter name
    'in':       'T[enum:query|path|header|cookie]', # Location
    'required': 'B[def:false]',                     # Is it mandatory?
    'schema':   'JS'                                # JSON Schema (flexible)
})
```

### 2. Use it in the Spec

Now, instead of the verbose block above, we can define parameters as a compact list of values.

```javascript
// TYTX Payload
{
    "/users": {
        "get": {
            "summary": "List users",
            "parameters": [
                ["limit",  "query", false, {"type": "integer", "default": 20}],
                ["offset", "query", false, {"type": "integer", "default": 0}],
                ["sort",   "query", false, {"type": "string"}]
            ]::#@PARAM
        }
    }
}
```

### Benefits

1.  **Compactness**: Reduces parameter definitions from ~6 lines to **1 line**.
2.  **Readability**: The matrix-like format makes it easy to scan parameters at a glance.
3.  **Type Safety**: The struct ensures that `required` is always a Boolean and `in` is a valid string.
4.  **Validation**: Metadata like `T[enum:query|path|...]` enforces valid values at the parsing level.

## Advanced: Modeling Operations

We can extend this to the entire Operation object.

```python
register_struct('OP', {
    'summary':     'T',
    'operationId': 'T',
    'tags':        '#T',
    'parameters':  '#@PARAM'  # <-- Nested Typed Array of Structs
})
```

This allows defining entire API endpoints in a highly condensed format:

```javascript
"get": ["List users", "getUsers", ["users"], [
    ["limit", "query", false, {"type": "int"}]
]]::@OP
```

## Conclusion

Using TYTX as the transport format for your API specifications (or as an intermediate format before generating standard JSON/YAML) can significantly improve developer experience by removing the "noise" of XML/JSON syntax and focusing on the actual API contract.
