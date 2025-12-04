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

"""Tests for register_struct_from_model() - Pydantic to TYTX struct conversion."""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

import pytest
from pydantic import BaseModel

from genro_tytx import registry


# Module-level class for circular reference test (needed for Python 3.10 compatibility)
class _CircularNode(BaseModel):
    """Node with circular reference for testing."""

    value: str
    children: list[_CircularNode] = []


class TestRegisterStructFromModel:
    """Tests for basic register_struct_from_model functionality."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        # Clean up all test structs
        for code in list(registry._structs.keys()):
            if code not in ("SIMPLEMODEL",):  # Keep global test struct
                registry.unregister_struct(code)
        # Also clean up _CIRCULARNODE if registered
        registry.unregister_struct("_CIRCULARNODE")

    def test_simple_model(self) -> None:
        """Test basic model with simple types."""

        class Customer(BaseModel):
            name: str
            age: int
            balance: Decimal

        registry.register_struct_from_model("CUSTOMER", Customer)

        schema = registry.get_struct("CUSTOMER")
        assert schema == {"name": "T", "age": "L", "balance": "N"}

    def test_all_basic_types(self) -> None:
        """Test model with all supported basic types."""

        class AllTypes(BaseModel):
            text: str
            integer: int
            floating: float
            boolean: bool
            decimal: Decimal
            date_field: date
            datetime_field: datetime
            time_field: time

        registry.register_struct_from_model("ALLTYPES", AllTypes)

        schema = registry.get_struct("ALLTYPES")
        assert schema == {
            "text": "T",
            "integer": "L",
            "floating": "R",
            "boolean": "B",
            "decimal": "N",
            "date_field": "D",
            "datetime_field": "DHZ",
            "time_field": "H",
        }

    def test_optional_fields(self) -> None:
        """Test model with Optional fields."""

        class WithOptional(BaseModel):
            required: str
            optional_str: str | None = None
            optional_int: int | None = None

        registry.register_struct_from_model("WITHOPTIONAL", WithOptional)

        schema = registry.get_struct("WITHOPTIONAL")
        assert schema == {
            "required": "T",
            "optional_str": "T",
            "optional_int": "L",
        }

    def test_list_fields(self) -> None:
        """Test model with list fields."""

        class WithLists(BaseModel):
            tags: list[str]
            numbers: list[int]
            prices: list[Decimal]

        registry.register_struct_from_model("WITHLISTS", WithLists)

        schema = registry.get_struct("WITHLISTS")
        assert schema == {
            "tags": "#T",
            "numbers": "#L",
            "prices": "#N",
        }

    def test_dict_field(self) -> None:
        """Test model with dict field."""

        class WithDict(BaseModel):
            name: str
            metadata: dict[str, str]

        registry.register_struct_from_model("WITHDICT", WithDict)

        schema = registry.get_struct("WITHDICT")
        assert schema == {"name": "T", "metadata": "JS"}

    def test_nested_model(self) -> None:
        """Test model with nested Pydantic model."""

        class Address(BaseModel):
            street: str
            city: str

        class Person(BaseModel):
            name: str
            address: Address

        registry.register_struct_from_model("PERSON", Person)

        # Person schema should reference @ADDRESS
        person_schema = registry.get_struct("PERSON")
        assert person_schema == {"name": "T", "address": "@ADDRESS"}

        # Address should be auto-registered
        address_schema = registry.get_struct("ADDRESS")
        assert address_schema == {"street": "T", "city": "T"}

    def test_nested_model_with_list(self) -> None:
        """Test model with list of nested models."""

        class LineItem(BaseModel):
            product: str
            price: Decimal
            quantity: int

        class Order(BaseModel):
            id: int
            items: list[LineItem]

        registry.register_struct_from_model("ORDER", Order)

        order_schema = registry.get_struct("ORDER")
        assert order_schema == {"id": "L", "items": "#@LINEITEM"}

        # LineItem should be auto-registered
        lineitem_schema = registry.get_struct("LINEITEM")
        assert lineitem_schema == {"product": "T", "price": "N", "quantity": "L"}

    def test_include_nested_false(self) -> None:
        """Test that include_nested=False prevents auto-registration."""

        class Inner(BaseModel):
            value: str

        class Outer(BaseModel):
            name: str
            inner: Inner

        registry.register_struct_from_model("OUTER", Outer, include_nested=False)

        # Outer should still reference @INNER
        outer_schema = registry.get_struct("OUTER")
        assert outer_schema == {"name": "T", "inner": "@INNER"}

        # But Inner should NOT be registered
        inner_schema = registry.get_struct("INNER")
        assert inner_schema is None

    def test_deeply_nested(self) -> None:
        """Test deeply nested models."""

        class Level3(BaseModel):
            value: str

        class Level2(BaseModel):
            level3: Level3

        class Level1(BaseModel):
            level2: Level2

        registry.register_struct_from_model("LEVEL1", Level1)

        assert registry.get_struct("LEVEL1") == {"level2": "@LEVEL2"}
        assert registry.get_struct("LEVEL2") == {"level3": "@LEVEL3"}
        assert registry.get_struct("LEVEL3") == {"value": "T"}

    def test_circular_reference(self) -> None:
        """Test that circular references don't cause infinite recursion."""
        # Uses module-level _CircularNode class for Python 3.10 compatibility
        # (forward references in locally-defined classes don't resolve on 3.10)

        # Should not raise RecursionError
        registry.register_struct_from_model("CIRCULARNODE", _CircularNode)

        schema = registry.get_struct("CIRCULARNODE")
        # Schema contains pure type codes
        assert schema is not None
        assert schema["value"] == "T"
        assert schema["children"] == "#@_CIRCULARNODE"

        # Metadata contains default value (separate from schema)
        metadata = registry.get_struct_metadata("CIRCULARNODE", "children")
        assert metadata is not None
        assert metadata["validate"]["default"] == []

    def test_invalid_model_class(self) -> None:
        """Test that non-Pydantic class raises TypeError."""

        class NotPydantic:
            pass

        with pytest.raises(TypeError, match="must be a Pydantic BaseModel subclass"):
            registry.register_struct_from_model("INVALID", NotPydantic)

    def test_hydration_after_registration(self) -> None:
        """Test that registered struct can hydrate data."""

        class Product(BaseModel):
            name: str
            price: Decimal
            in_stock: bool

        registry.register_struct_from_model("PRODUCT", Product)

        # Test hydration
        result = registry.from_text(
            '{"name": "Widget", "price": "99.99", "in_stock": "true"}::@PRODUCT'
        )

        assert result == {
            "name": "Widget",
            "price": Decimal("99.99"),
            "in_stock": True,
        }


class TestGlobalRegistry:
    """Tests using the global registry instance."""

    def test_global_registry(self) -> None:
        """Test register_struct_from_model on global registry."""

        class SimpleModel(BaseModel):
            name: str
            value: int

        # Use global registry
        registry.register_struct_from_model("SIMPLEMODEL", SimpleModel)

        schema = registry.get_struct("SIMPLEMODEL")
        assert schema == {"name": "T", "value": "L"}

        # Cleanup
        registry.unregister_struct("SIMPLEMODEL")


class TestStructFromModel:
    """Tests for struct_from_model() - generates schema without registering."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_struct_from_model_basic(self) -> None:
        """Test struct_from_model returns (schema, metadata) tuple without registering."""
        from pydantic import BaseModel

        class Simple(BaseModel):
            name: str
            age: int

        schema, metadata = registry.struct_from_model(Simple)

        # Should return pure schema dict
        assert schema == {"name": "T", "age": "L"}
        # No constraints = empty metadata
        assert metadata == {}

        # Should NOT be registered
        assert registry.get_struct("SIMPLE") is None

    def test_struct_from_model_then_register(self) -> None:
        """Test typical workflow: generate schema, then register."""

        from pydantic import BaseModel

        class Product(BaseModel):
            name: str
            price: Decimal

        # Step 1: Generate schema and metadata
        schema, metadata = registry.struct_from_model(Product)
        assert schema == {"name": "T", "price": "N"}

        # Step 2: Register with custom code
        registry.register_struct("PROD", schema, metadata)

        # Now it's registered
        assert registry.get_struct("PROD") == {"name": "T", "price": "N"}


class TestFieldConstraints:
    """Tests for Pydantic Field constraint extraction - metadata is separate from schema."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_string_min_length(self) -> None:
        """Test min_length constraint on string field."""
        from pydantic import BaseModel, Field

        class WithMinLen(BaseModel):
            name: str = Field(min_length=1)

        schema, metadata = registry.struct_from_model(WithMinLen)
        assert schema["name"] == "T"
        assert metadata["name"]["validate"]["min"] == 1

    def test_string_max_length(self) -> None:
        """Test max_length constraint on string field."""
        from pydantic import BaseModel, Field

        class WithMaxLen(BaseModel):
            code: str = Field(max_length=10)

        schema, metadata = registry.struct_from_model(WithMaxLen)
        assert schema["code"] == "T"
        assert metadata["code"]["validate"]["max"] == 10

    def test_string_min_max_length(self) -> None:
        """Test combined min/max length constraints."""
        from pydantic import BaseModel, Field

        class WithBothLen(BaseModel):
            name: str = Field(min_length=2, max_length=50)

        schema, metadata = registry.struct_from_model(WithBothLen)
        assert schema["name"] == "T"
        assert metadata["name"]["validate"]["min"] == 2
        assert metadata["name"]["validate"]["max"] == 50

    def test_string_pattern(self) -> None:
        """Test pattern constraint on string field."""
        from pydantic import BaseModel, Field

        class WithPattern(BaseModel):
            email: str = Field(pattern=r"^[^@]+@[^@]+$")

        schema, metadata = registry.struct_from_model(WithPattern)
        assert schema["email"] == "T"
        assert metadata["email"]["validate"]["pattern"] == r"^[^@]+@[^@]+$"

    def test_numeric_ge(self) -> None:
        """Test ge (>=) constraint on numeric field."""
        from pydantic import BaseModel, Field

        class WithGe(BaseModel):
            age: int = Field(ge=0)

        schema, metadata = registry.struct_from_model(WithGe)
        assert schema["age"] == "L"
        assert metadata["age"]["validate"]["min"] == 0

    def test_numeric_le(self) -> None:
        """Test le (<=) constraint on numeric field."""
        from pydantic import BaseModel, Field

        class WithLe(BaseModel):
            score: int = Field(le=100)

        schema, metadata = registry.struct_from_model(WithLe)
        assert schema["score"] == "L"
        assert metadata["score"]["validate"]["max"] == 100

    def test_numeric_gt(self) -> None:
        """Test gt (>) constraint - should be min+1."""
        from pydantic import BaseModel, Field

        class WithGt(BaseModel):
            quantity: int = Field(gt=0)  # > 0 means >= 1

        schema, metadata = registry.struct_from_model(WithGt)
        assert schema["quantity"] == "L"
        assert metadata["quantity"]["validate"]["min"] == 1

    def test_numeric_lt(self) -> None:
        """Test lt (<) constraint - should be max-1."""
        from pydantic import BaseModel, Field

        class WithLt(BaseModel):
            count: int = Field(lt=100)  # < 100 means <= 99

        schema, metadata = registry.struct_from_model(WithLt)
        assert schema["count"] == "L"
        assert metadata["count"]["validate"]["max"] == 99

    def test_decimal_constraints(self) -> None:
        """Test constraints on Decimal field."""

        from pydantic import BaseModel, Field

        class WithDecimal(BaseModel):
            price: Decimal = Field(ge=0, le=9999.99)

        schema, metadata = registry.struct_from_model(WithDecimal)
        assert schema["price"] == "N"
        assert metadata["price"]["validate"]["min"] == 0
        assert metadata["price"]["validate"]["max"] == 9999.99

    def test_title_as_label(self) -> None:
        """Test title becomes ui.label metadata."""
        from pydantic import BaseModel, Field

        class WithTitle(BaseModel):
            name: str = Field(title="Customer Name")

        schema, metadata = registry.struct_from_model(WithTitle)
        assert schema["name"] == "T"
        assert metadata["name"]["ui"]["label"] == "Customer Name"

    def test_description_as_hint(self) -> None:
        """Test description becomes ui.hint metadata."""
        from pydantic import BaseModel, Field

        class WithDesc(BaseModel):
            email: str = Field(description="Enter your email address")

        schema, metadata = registry.struct_from_model(WithDesc)
        assert schema["email"] == "T"
        assert metadata["email"]["ui"]["hint"] == "Enter your email address"

    def test_default_value(self) -> None:
        """Test default value is captured."""
        from pydantic import BaseModel, Field

        class WithDefault(BaseModel):
            status: str = Field(default="active")

        schema, metadata = registry.struct_from_model(WithDefault)
        assert schema["status"] == "T"
        assert metadata["status"]["validate"]["default"] == "active"

    def test_combined_constraints(self) -> None:
        """Test multiple constraints on same field."""
        from pydantic import BaseModel, Field

        class Customer(BaseModel):
            name: str = Field(
                min_length=1,
                max_length=100,
                title="Full Name",
                description="Customer's full name",
            )

        schema, metadata = registry.struct_from_model(Customer)
        assert schema["name"] == "T"
        name_meta = metadata["name"]
        assert name_meta["validate"]["min"] == 1
        assert name_meta["validate"]["max"] == 100
        assert name_meta["ui"]["label"] == "Full Name"
        assert name_meta["ui"]["hint"] == "Customer's full name"


class TestLiteralEnum:
    """Tests for Literal type -> enum metadata."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_literal_string(self) -> None:
        """Test Literal with string values."""
        from typing import Literal

        from pydantic import BaseModel

        class WithStatus(BaseModel):
            status: Literal["active", "inactive", "pending"]

        schema, metadata = registry.struct_from_model(WithStatus)
        assert schema["status"] == "T"
        assert metadata["status"]["validate"]["enum"] == [
            "active",
            "inactive",
            "pending",
        ]

    def test_literal_int(self) -> None:
        """Test Literal with integer values."""
        from typing import Literal

        from pydantic import BaseModel

        class WithPriority(BaseModel):
            priority: Literal[1, 2, 3]

        schema, metadata = registry.struct_from_model(WithPriority)
        assert schema["priority"] == "L"
        assert metadata["priority"]["validate"]["enum"] == [1, 2, 3]

    def test_literal_mixed(self) -> None:
        """Test Literal with mixed types."""
        from typing import Literal

        from pydantic import BaseModel

        class WithMixed(BaseModel):
            value: Literal["auto", 0, 100]

        schema, metadata = registry.struct_from_model(WithMixed)
        # Mixed literal -> defaults to T (first value is string)
        assert metadata["value"]["validate"]["enum"] == ["auto", 0, 100]

    def test_literal_with_other_constraints(self) -> None:
        """Test Literal combined with other Field constraints."""
        from typing import Literal

        from pydantic import BaseModel, Field

        class WithLiteralAndTitle(BaseModel):
            status: Literal["A", "B", "C"] = Field(title="Status Code")

        schema, metadata = registry.struct_from_model(WithLiteralAndTitle)
        assert metadata["status"]["validate"]["enum"] == ["A", "B", "C"]
        assert metadata["status"]["ui"]["label"] == "Status Code"


class TestRealWorldExamples:
    """Real-world usage examples."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        for code in list(registry._structs.keys()):
            registry.unregister_struct(code)

    def test_invoice_model(self) -> None:
        """Test invoice-like model structure."""

        class Address(BaseModel):
            street: str
            city: str
            country: str

        class LineItem(BaseModel):
            description: str
            quantity: int
            unit_price: Decimal

        class Invoice(BaseModel):
            number: str
            date: date
            customer_name: str
            billing_address: Address
            items: list[LineItem]
            total: Decimal

        registry.register_struct_from_model("INVOICE", Invoice)

        # Check all structs were registered
        assert registry.get_struct("INVOICE") == {
            "number": "T",
            "date": "D",
            "customer_name": "T",
            "billing_address": "@ADDRESS",
            "items": "#@LINEITEM",
            "total": "N",
        }
        assert registry.get_struct("ADDRESS") == {
            "street": "T",
            "city": "T",
            "country": "T",
        }
        assert registry.get_struct("LINEITEM") == {
            "description": "T",
            "quantity": "L",
            "unit_price": "N",
        }

    def test_api_response_model(self) -> None:
        """Test API response-like model."""

        class Pagination(BaseModel):
            page: int
            per_page: int
            total: int

        class User(BaseModel):
            id: int
            email: str
            created_at: datetime

        class UserListResponse(BaseModel):
            users: list[User]
            pagination: Pagination

        registry.register_struct_from_model("USERLIST", UserListResponse)

        assert registry.get_struct("USERLIST") == {
            "users": "#@USER",
            "pagination": "@PAGINATION",
        }
        assert registry.get_struct("USER") == {
            "id": "L",
            "email": "T",
            "created_at": "DHZ",
        }
        assert registry.get_struct("PAGINATION") == {
            "page": "L",
            "per_page": "L",
            "total": "L",
        }
