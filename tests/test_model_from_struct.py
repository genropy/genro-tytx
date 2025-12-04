# Copyright 2025 Softwell S.r.l.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tests for model_from_struct() - TYTX struct to Pydantic model conversion.

This is the inverse of struct_from_model(): given a registered TYTX struct,
generate a Pydantic BaseModel class with proper field types and constraints.

Type Mapping (TYTX → Python):
    T       -> str
    L       -> int
    R       -> float
    N       -> Decimal
    B       -> bool
    D       -> date
    DHZ     -> datetime
    H       -> time
    #X      -> list[X]
    JS      -> dict
    @STRUCT -> nested model

Metadata Mapping (TYTX → Pydantic Field):
    min:N (str)  -> min_length=N
    max:N (str)  -> max_length=N
    min:N (num)  -> ge=N
    max:N (num)  -> le=N
    reg:"..."    -> pattern="..."
    lbl:X        -> title="X"
    hint:X       -> description="X"
    def:X        -> default=X
    enum:a|b|c   -> Literal["a","b","c"]
"""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal, get_args, get_origin

import pytest

from genro_tytx import registry
from genro_tytx.pydantic_utils import PydanticConverter

# Create a converter for tests
converter = PydanticConverter(registry)


class TestModelFromStructBasic:
    """Tests for basic model_from_struct functionality."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_simple_types(self) -> None:
        """Test model generation with simple types."""
        registry.register_struct(
            "SIMPLE",
            {
                "name": "T",
                "age": "L",
                "balance": "N",
            },
        )

        Model = converter.model_from_struct("SIMPLE")

        # Check class name
        assert Model.__name__ == "Simple"

        # Check field types
        fields = Model.model_fields
        assert fields["name"].annotation is str
        assert fields["age"].annotation is int
        assert fields["balance"].annotation is Decimal

    def test_all_basic_types(self) -> None:
        """Test model with all supported basic types."""
        registry.register_struct(
            "ALLTYPES",
            {
                "text": "T",
                "integer": "L",
                "floating": "R",
                "boolean": "B",
                "decimal": "N",
                "date_field": "D",
                "datetime_field": "DHZ",
                "time_field": "H",
            },
        )

        Model = converter.model_from_struct("ALLTYPES")

        fields = Model.model_fields
        assert fields["text"].annotation is str
        assert fields["integer"].annotation is int
        assert fields["floating"].annotation is float
        assert fields["boolean"].annotation is bool
        assert fields["decimal"].annotation is Decimal
        assert fields["date_field"].annotation is date
        assert fields["datetime_field"].annotation is datetime
        assert fields["time_field"].annotation is time

    def test_struct_not_found(self) -> None:
        """Test error when struct code not found."""
        with pytest.raises(KeyError, match="Struct 'NOTFOUND' not registered"):
            converter.model_from_struct("NOTFOUND")

    def test_model_instantiation(self) -> None:
        """Test that generated model can be instantiated."""
        registry.register_struct(
            "PERSON",
            {
                "name": "T",
                "age": "L",
            },
        )

        Person = converter.model_from_struct("PERSON")

        # Should be able to create instance
        person = Person(name="Mario", age=30)
        assert person.name == "Mario"
        assert person.age == 30

    def test_model_validation(self) -> None:
        """Test that generated model validates input."""
        registry.register_struct(
            "TYPED",
            {
                "count": "L",
                "active": "B",
            },
        )

        Model = converter.model_from_struct("TYPED")

        # Valid data
        obj = Model(count=5, active=True)
        assert obj.count == 5
        assert obj.active is True

        # Pydantic coerces strings
        obj2 = Model(count="10", active="true")
        assert obj2.count == 10
        assert obj2.active is True


class TestModelFromStructList:
    """Tests for list field handling."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_list_of_strings(self) -> None:
        """Test list[str] field."""
        registry.register_struct("TAGS", {"tags": "#T"})

        Model = converter.model_from_struct("TAGS")

        field_type = Model.model_fields["tags"].annotation
        assert get_origin(field_type) is list
        assert get_args(field_type)[0] is str

    def test_list_of_integers(self) -> None:
        """Test list[int] field."""
        registry.register_struct("NUMS", {"numbers": "#L"})

        Model = converter.model_from_struct("NUMS")

        field_type = Model.model_fields["numbers"].annotation
        assert get_origin(field_type) is list
        assert get_args(field_type)[0] is int

    def test_list_of_decimals(self) -> None:
        """Test list[Decimal] field."""
        registry.register_struct("PRICES", {"prices": "#N"})

        Model = converter.model_from_struct("PRICES")

        field_type = Model.model_fields["prices"].annotation
        assert get_origin(field_type) is list
        assert get_args(field_type)[0] is Decimal

    def test_list_instantiation(self) -> None:
        """Test list field can be used."""
        registry.register_struct("WITHLIST", {"items": "#T"})

        Model = converter.model_from_struct("WITHLIST")

        obj = Model(items=["a", "b", "c"])
        assert obj.items == ["a", "b", "c"]


class TestModelFromStructDict:
    """Tests for dict field handling."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_dict_field(self) -> None:
        """Test dict field."""
        registry.register_struct("META", {"metadata": "JS"})

        Model = converter.model_from_struct("META")

        # JS maps to dict[str, Any]
        field_type = Model.model_fields["metadata"].annotation
        origin = get_origin(field_type)
        assert origin is dict

    def test_dict_instantiation(self) -> None:
        """Test dict field can be used."""
        registry.register_struct("WITHMETA", {"data": "JS"})

        Model = converter.model_from_struct("WITHMETA")

        obj = Model(data={"key": "value", "count": 42})
        assert obj.data == {"key": "value", "count": 42}


class TestModelFromStructNested:
    """Tests for nested struct handling."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_nested_struct(self) -> None:
        """Test nested struct reference."""
        registry.register_struct(
            "ADDRESS",
            {
                "street": "T",
                "city": "T",
            },
        )
        registry.register_struct(
            "PERSON",
            {
                "name": "T",
                "address": "@ADDRESS",
            },
        )

        Person = converter.model_from_struct("PERSON")
        converter.model_from_struct("ADDRESS")

        # Check nested type
        address_field = Person.model_fields["address"]
        # The annotation should be the Address model
        assert address_field.annotation.__name__ == "Address"

    def test_nested_struct_instantiation(self) -> None:
        """Test nested struct can be instantiated."""
        registry.register_struct("INNER", {"value": "L"})
        registry.register_struct(
            "OUTER",
            {
                "name": "T",
                "inner": "@INNER",
            },
        )

        Outer = converter.model_from_struct("OUTER")

        # Can instantiate with nested dict
        obj = Outer(name="test", inner={"value": 42})
        assert obj.name == "test"
        assert obj.inner.value == 42

    def test_list_of_nested_structs(self) -> None:
        """Test list of nested structs."""
        registry.register_struct(
            "ITEM",
            {
                "name": "T",
                "price": "N",
            },
        )
        registry.register_struct(
            "ORDER",
            {
                "id": "L",
                "items": "#@ITEM",
            },
        )

        Order = converter.model_from_struct("ORDER")

        # Check items is list[Item]
        items_field = Order.model_fields["items"]
        field_type = items_field.annotation
        assert get_origin(field_type) is list
        inner_type = get_args(field_type)[0]
        assert inner_type.__name__ == "Item"

    def test_list_of_nested_instantiation(self) -> None:
        """Test list of nested structs instantiation."""
        registry.register_struct(
            "LINEITEM",
            {
                "product": "T",
                "qty": "L",
            },
        )
        registry.register_struct(
            "CART",
            {
                "items": "#@LINEITEM",
            },
        )

        Cart = converter.model_from_struct("CART")

        obj = Cart(
            items=[
                {"product": "Widget", "qty": 2},
                {"product": "Gadget", "qty": 1},
            ]
        )
        assert len(obj.items) == 2
        assert obj.items[0].product == "Widget"
        assert obj.items[1].qty == 1


class TestModelFromStructConstraints:
    """Tests for constraint/metadata extraction - schema and metadata separate."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_string_min_length(self) -> None:
        """Test min_length constraint on string."""
        registry.register_struct(
            "MINLEN",
            schema={"name": "T"},
            metadata={"name": {"validate": {"min": 1}}},
        )

        Model = converter.model_from_struct("MINLEN")

        # Check constraint was applied
        field = Model.model_fields["name"]
        # In Pydantic v2, constraints are in metadata
        constraints = {type(c).__name__: c for c in field.metadata}
        assert "MinLen" in constraints
        assert constraints["MinLen"].min_length == 1

    def test_string_max_length(self) -> None:
        """Test max_length constraint on string."""
        registry.register_struct(
            "MAXLEN",
            schema={"code": "T"},
            metadata={"code": {"validate": {"max": 10}}},
        )

        Model = converter.model_from_struct("MAXLEN")

        field = Model.model_fields["code"]
        constraints = {type(c).__name__: c for c in field.metadata}
        assert "MaxLen" in constraints
        assert constraints["MaxLen"].max_length == 10

    def test_string_pattern(self) -> None:
        """Test pattern constraint on string."""
        registry.register_struct(
            "PATTERN",
            schema={"email": "T"},
            metadata={"email": {"validate": {"pattern": r"^[^@]+@[^@]+$"}}},
        )

        Model = converter.model_from_struct("PATTERN")

        # Pydantic should validate pattern
        obj = Model(email="test@example.com")
        assert obj.email == "test@example.com"

        # Invalid should raise
        with pytest.raises(Exception):  # ValidationError
            Model(email="invalid")

    def test_numeric_ge(self) -> None:
        """Test ge constraint on numeric field."""
        registry.register_struct(
            "GE",
            schema={"age": "L"},
            metadata={"age": {"validate": {"min": 0}}},
        )

        Model = converter.model_from_struct("GE")

        # Valid
        obj = Model(age=0)
        assert obj.age == 0

        # Invalid (negative)
        with pytest.raises(Exception):
            Model(age=-1)

    def test_numeric_le(self) -> None:
        """Test le constraint on numeric field."""
        registry.register_struct(
            "LE",
            schema={"score": "L"},
            metadata={"score": {"validate": {"max": 100}}},
        )

        Model = converter.model_from_struct("LE")

        # Valid
        obj = Model(score=100)
        assert obj.score == 100

        # Invalid (too high)
        with pytest.raises(Exception):
            Model(score=101)

    def test_title_and_description(self) -> None:
        """Test title (label) and description (hint) metadata."""
        registry.register_struct(
            "META",
            schema={"name": "T"},
            metadata={
                "name": {"ui": {"label": "Full Name", "hint": "Enter your full name"}}
            },
        )

        Model = converter.model_from_struct("META")

        field = Model.model_fields["name"]
        assert field.title == "Full Name"
        assert field.description == "Enter your full name"

    def test_default_value_string(self) -> None:
        """Test default value for string field."""
        registry.register_struct(
            "DEFSTR",
            schema={"status": "T"},
            metadata={"status": {"validate": {"default": "active"}}},
        )

        Model = converter.model_from_struct("DEFSTR")

        # Can create without providing status
        obj = Model()
        assert obj.status == "active"

    def test_default_value_int(self) -> None:
        """Test default value for integer field."""
        registry.register_struct(
            "DEFINT",
            schema={"count": "L"},
            metadata={"count": {"validate": {"default": 0}}},
        )

        Model = converter.model_from_struct("DEFINT")

        obj = Model()
        assert obj.count == 0

    def test_enum_as_literal(self) -> None:
        """Test enum metadata becomes Literal type."""
        registry.register_struct(
            "ENUM",
            schema={"status": "T"},
            metadata={
                "status": {"validate": {"enum": ["active", "inactive", "pending"]}}
            },
        )

        Model = converter.model_from_struct("ENUM")

        field = Model.model_fields["status"]
        # Check it's a Literal type
        origin = get_origin(field.annotation)
        assert origin is Literal
        args = get_args(field.annotation)
        assert set(args) == {"active", "inactive", "pending"}

    def test_enum_with_default(self) -> None:
        """Test enum with default value."""
        registry.register_struct(
            "ENUMDEF",
            schema={"status": "T"},
            metadata={
                "status": {
                    "validate": {"enum": ["active", "inactive"], "default": "active"}
                }
            },
        )

        Model = converter.model_from_struct("ENUMDEF")

        # Default should work
        obj = Model()
        assert obj.status == "active"

        # Only valid values accepted
        obj2 = Model(status="inactive")
        assert obj2.status == "inactive"

        with pytest.raises(Exception):
            Model(status="invalid")

    def test_combined_constraints(self) -> None:
        """Test multiple constraints on same field."""
        registry.register_struct(
            "COMBO",
            schema={"name": "T"},
            metadata={
                "name": {
                    "validate": {"min": 1, "max": 100},
                    "ui": {"label": "Customer Name"},
                }
            },
        )

        Model = converter.model_from_struct("COMBO")

        field = Model.model_fields["name"]
        assert field.title == "Customer Name"

        constraints = {type(c).__name__: c for c in field.metadata}
        assert "MinLen" in constraints
        assert "MaxLen" in constraints


class TestModelFromStructRoundTrip:
    """Tests for round-trip: Pydantic → TYTX → Pydantic."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_roundtrip_simple(self) -> None:
        """Test simple model round-trip."""
        from pydantic import BaseModel as PydanticBaseModel

        class Original(PydanticBaseModel):
            name: str
            age: int
            balance: Decimal

        # Pydantic → TYTX (now returns tuple)
        schema, metadata = converter.struct_from_model(Original)
        registry.register_struct("ROUNDTRIP", schema, metadata)

        # TYTX → Pydantic
        Generated = converter.model_from_struct("ROUNDTRIP")

        # Should have same fields
        assert set(Generated.model_fields.keys()) == {"name", "age", "balance"}

        # Should work the same
        orig = Original(name="Test", age=25, balance=Decimal("100.50"))
        gen = Generated(name="Test", age=25, balance=Decimal("100.50"))

        assert orig.name == gen.name
        assert orig.age == gen.age
        assert orig.balance == gen.balance

    def test_roundtrip_with_constraints(self) -> None:
        """Test model with constraints round-trip."""
        from pydantic import BaseModel as PydanticBaseModel
        from pydantic import Field

        class Original(PydanticBaseModel):
            name: str = Field(min_length=1, max_length=50, title="Name")
            age: int = Field(ge=0, le=150)

        # Pydantic → TYTX (now returns tuple)
        schema, metadata = converter.struct_from_model(Original)
        registry.register_struct("CONSTRAINED", schema, metadata)

        # TYTX → Pydantic
        Generated = converter.model_from_struct("CONSTRAINED")

        # Constraints should be preserved
        # Valid
        gen = Generated(name="Test", age=25)
        assert gen.name == "Test"

        # Invalid name (too short)
        with pytest.raises(Exception):
            Generated(name="", age=25)

        # Invalid age (negative)
        with pytest.raises(Exception):
            Generated(name="Test", age=-1)


class TestModelFromStructRealWorld:
    """Real-world usage examples."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_customer_model(self) -> None:
        """Test customer-like model."""
        registry.register_struct(
            "CUSTOMER",
            schema={
                "id": "L",
                "name": "T",
                "email": "T",
                "status": "T",
                "balance": "N",
            },
            metadata={
                "name": {"validate": {"min": 1, "max": 100}},
                "status": {
                    "validate": {
                        "enum": ["active", "inactive", "suspended"],
                        "default": "active",
                    }
                },
                "balance": {"validate": {"min": 0}},
            },
        )

        Customer = converter.model_from_struct("CUSTOMER")

        # Create customer
        customer = Customer(
            id=1,
            name="Mario Rossi",
            email="mario@example.com",
            balance=Decimal("1000.00"),
        )

        assert customer.id == 1
        assert customer.name == "Mario Rossi"
        assert customer.status == "active"  # default
        assert customer.balance == Decimal("1000.00")

    def test_invoice_model(self) -> None:
        """Test invoice with nested line items."""
        registry.register_struct(
            "LINEITEM",
            schema={"description": "T", "quantity": "L", "unit_price": "N"},
            metadata={
                "quantity": {"validate": {"min": 1}},
                "unit_price": {"validate": {"min": 0}},
            },
        )
        registry.register_struct(
            "INVOICE",
            schema={"number": "T", "date": "D", "items": "#@LINEITEM", "total": "N"},
        )

        Invoice = converter.model_from_struct("INVOICE")

        invoice = Invoice(
            number="INV-001",
            date=date(2025, 1, 15),
            items=[
                {
                    "description": "Widget",
                    "quantity": 2,
                    "unit_price": Decimal("10.00"),
                },
                {
                    "description": "Gadget",
                    "quantity": 1,
                    "unit_price": Decimal("25.00"),
                },
            ],
            total=Decimal("45.00"),
        )

        assert invoice.number == "INV-001"
        assert len(invoice.items) == 2
        assert invoice.items[0].description == "Widget"
        assert invoice.items[1].quantity == 1

    def test_json_serialization(self) -> None:
        """Test that generated model can serialize to JSON."""
        registry.register_struct(
            "JSONTEST",
            {
                "name": "T",
                "count": "L",
            },
        )

        Model = converter.model_from_struct("JSONTEST")

        obj = Model(name="test", count=42)

        # Should be able to dump to JSON
        json_str = obj.model_dump_json()
        assert '"name":"test"' in json_str or '"name": "test"' in json_str
        assert '"count":42' in json_str or '"count": 42' in json_str
