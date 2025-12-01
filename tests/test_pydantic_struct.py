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

from datetime import date, datetime, time
from decimal import Decimal

import pytest
from pydantic import BaseModel

from genro_tytx import registry


class TestRegisterStructFromModel:
    """Tests for basic register_struct_from_model functionality."""

    def teardown_method(self) -> None:
        """Clean up registered structs after each test."""
        # Clean up all test structs
        for code in list(registry._structs.keys()):
            if code not in ("SIMPLEMODEL",):  # Keep global test struct
                registry.unregister_struct(code)

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

        class Node(BaseModel):
            value: str
            children: list["Node"] = []

        # Should not raise RecursionError
        registry.register_struct_from_model("NODE", Node)

        schema = registry.get_struct("NODE")
        assert schema == {"value": "T", "children": "#@NODE"}

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
