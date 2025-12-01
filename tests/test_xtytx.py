"""Tests for XTYTX extended envelope format."""

from decimal import Decimal
from datetime import date

import pytest

from genro_tytx import from_json, registry, XtytxResult, validation_registry


class TestXtytxBasicParsing:
    """Tests for basic XTYTX:// prefix detection and parsing."""

    def test_detect_xtytx_prefix(self):
        """XTYTX:// prefix is detected and processed."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": ""}'
        result = from_json(payload)
        assert isinstance(result, XtytxResult)
        assert result.data is None

    def test_xtytx_with_empty_data_returns_none(self):
        """Empty data field returns None in XtytxResult."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": ""}'
        result = from_json(payload)
        assert isinstance(result, XtytxResult)
        assert result.data is None

    def test_tytx_prefix_still_works(self):
        """TYTX:// prefix continues to work."""
        payload = 'TYTX://{"price": "100::N"}'
        result = from_json(payload)
        assert result == {"price": Decimal("100")}

    def test_regular_json_still_works(self):
        """Regular JSON without prefix still works."""
        payload = '{"price": "100::N"}'
        result = from_json(payload)
        assert result == {"price": Decimal("100")}


class TestXtytxGstruct:
    """Tests for gstruct (global struct registration)."""

    def test_gstruct_registers_struct_globally(self):
        """gstruct entries are registered in global registry."""
        payload = 'XTYTX://{"gstruct": {"XCUSTOMER": {"name": "T", "balance": "N"}}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            # Struct should be registered
            assert registry.get_struct("XCUSTOMER") is not None
            assert registry.get_struct("XCUSTOMER") == {"name": "T", "balance": "N"}
        finally:
            registry.unregister_struct("XCUSTOMER")

    def test_gstruct_overwrites_existing(self):
        """gstruct overwrites existing struct with same name."""
        # Pre-register a struct
        registry.register_struct("XOVERWRITE", {"a": "L"})
        try:
            payload = 'XTYTX://{"gstruct": {"XOVERWRITE": {"b": "N"}}, "lstruct": {}, "data": ""}'
            from_json(payload)
            # Should be overwritten
            assert registry.get_struct("XOVERWRITE") == {"b": "N"}
        finally:
            registry.unregister_struct("XOVERWRITE")

    def test_gstruct_persists_after_decoding(self):
        """gstruct remains registered after decoding completes."""
        payload = 'XTYTX://{"gstruct": {"XPERSIST": {"x": "R"}}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            # Should still exist
            assert registry.get_struct("XPERSIST") == {"x": "R"}
            # Can use it in subsequent calls
            result = from_json('{"point": "3.14::@XPERSIST"}')
            # Note: this tests that the struct is usable
        finally:
            registry.unregister_struct("XPERSIST")

    def test_gstruct_multiple_structs(self):
        """Multiple structs can be registered at once."""
        payload = '''XTYTX://{"gstruct": {"XA": {"a": "L"}, "XB": ["N"]}, "lstruct": {}, "data": ""}'''
        try:
            from_json(payload)
            assert registry.get_struct("XA") == {"a": "L"}
            assert registry.get_struct("XB") == ["N"]
        finally:
            registry.unregister_struct("XA")
            registry.unregister_struct("XB")


class TestXtytxLstruct:
    """Tests for lstruct (local struct definitions)."""

    def test_lstruct_not_registered_globally(self):
        """lstruct entries are NOT registered in global registry after decoding."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {"XLOCAL": {"a": "L"}}, "data": ""}'
        from_json(payload)
        # Should NOT be in global registry
        assert registry.get_struct("XLOCAL") is None

    def test_lstruct_used_during_decoding(self):
        """lstruct is available during data decoding."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {"XTEMP": {"name": "T", "value": "N"}}, "data": "TYTX://{\\"item\\": \\"{\\\\\\"name\\\\\\": \\\\\\"Test\\\\\\", \\\\\\"value\\\\\\": \\\\\\"42\\\\\\"}::@XTEMP\\"}"}'
        result = from_json(payload)
        assert result.data == {"item": {"name": "Test", "value": Decimal("42")}}
        # lstruct should be gone
        assert registry.get_struct("XTEMP") is None

    def test_lstruct_discarded_after_decoding(self):
        """lstruct is discarded after decoding completes."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {"XGONE": ["L"]}, "data": "TYTX://{\\"nums\\": \\"[1, 2, 3]::@XGONE\\"}"}'
        result = from_json(payload)
        assert result.data == {"nums": [1, 2, 3]}
        # lstruct should NOT persist
        assert registry.get_struct("XGONE") is None


class TestXtytxPrecedence:
    """Tests for lstruct > registry precedence."""

    def test_lstruct_overrides_gstruct_during_decode(self):
        """lstruct takes precedence over gstruct during decoding."""
        # Both define XPOINT, lstruct version should win during decode
        payload = '''XTYTX://{"gstruct": {"XPOINT": "x:L,y:L"}, "lstruct": {"XPOINT": "x:R,y:R,z:R"}, "data": "TYTX://{\\"p\\": \\"[1.5, 2.5, 3.5]::@XPOINT\\"}"}'''
        try:
            result = from_json(payload)
            # lstruct version (R,R,R with z) should be used
            assert result.data == {"p": {"x": 1.5, "y": 2.5, "z": 3.5}}
            # But gstruct version should persist in registry
            assert registry.get_struct("XPOINT") == "x:L,y:L"
        finally:
            registry.unregister_struct("XPOINT")

    def test_lstruct_overrides_existing_registry(self):
        """lstruct takes precedence over pre-existing registry entry."""
        # Pre-register a struct
        registry.register_struct("XEXISTING", {"old": "T"})
        try:
            payload = 'XTYTX://{"gstruct": {}, "lstruct": {"XEXISTING": {"new": "N"}}, "data": "TYTX://{\\"item\\": \\"{\\\\\\"new\\\\\\": \\\\\\"100\\\\\\"}::@XEXISTING\\"}"}'
            result = from_json(payload)
            # lstruct version should be used
            assert result.data == {"item": {"new": Decimal("100")}}
            # Original should still be there (lstruct doesn't modify registry)
            assert registry.get_struct("XEXISTING") == {"old": "T"}
        finally:
            registry.unregister_struct("XEXISTING")


class TestXtytxDataDecoding:
    """Tests for data field decoding."""

    def test_data_with_tytx_prefix(self):
        """data field with TYTX:// prefix is decoded."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "TYTX://{\\"price\\": \\"99.99::N\\"}"}'
        result = from_json(payload)
        assert result.data == {"price": Decimal("99.99")}

    def test_data_without_prefix(self):
        """data field without prefix is still decoded as TYTX."""
        payload = 'XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"price\\": \\"99.99::N\\"}"}'
        result = from_json(payload)
        assert result.data == {"price": Decimal("99.99")}

    def test_data_with_struct_from_gstruct(self):
        """data can use structs defined in gstruct."""
        payload = 'XTYTX://{"gstruct": {"XITEM": {"name": "T", "qty": "L"}}, "lstruct": {}, "data": "TYTX://{\\"item\\": \\"{\\\\\\"name\\\\\\": \\\\\\"Widget\\\\\\", \\\\\\"qty\\\\\\": \\\\\\"5\\\\\\"}::@XITEM\\"}"}'
        try:
            result = from_json(payload)
            assert result.data == {"item": {"name": "Widget", "qty": 5}}
        finally:
            registry.unregister_struct("XITEM")

    def test_data_complex_nested(self):
        """Complex nested data with multiple struct types."""
        # XADDR uses string schema (array input -> dict output)
        # XPERSON uses string schema too (array input -> dict output)
        payload = '''XTYTX://{"gstruct": {"XADDR": "city:T,zip:L"}, "lstruct": {"XPERSON": "name:T,age:L"}, "data": "TYTX://{\\"person\\": \\"[\\\\\\"John\\\\\\", \\\\\\"30\\\\\\"]::@XPERSON\\", \\"address\\": \\"[\\\\\\"Rome\\\\\\", \\\\\\"12345\\\\\\"]::@XADDR\\"}"}'''
        try:
            result = from_json(payload)
            assert result.data == {
                "person": {"name": "John", "age": 30},
                "address": {"city": "Rome", "zip": 12345},
            }
            # XADDR should persist, XPERSON should not
            assert registry.get_struct("XADDR") == "city:T,zip:L"
            assert registry.get_struct("XPERSON") is None
        finally:
            registry.unregister_struct("XADDR")


class TestXtytxUseCases:
    """Tests for real-world use cases."""

    def test_struct_only_registration(self):
        """Use XTYTX to register structs without data."""
        payload = '''XTYTX://{"gstruct": {"XPRODUCT": {"sku": "T", "price": "N", "stock": "L"}}, "lstruct": {}, "data": ""}'''
        try:
            result = from_json(payload)
            assert isinstance(result, XtytxResult)
            assert result.data is None
            # Struct should be available for future use
            # Use from_text for typed text, not from_json
            from genro_tytx import from_text
            product_data = from_text('{"sku": "ABC123", "price": "29.99", "stock": "100"}::@XPRODUCT')
            assert product_data == {"sku": "ABC123", "price": Decimal("29.99"), "stock": 100}
        finally:
            registry.unregister_struct("XPRODUCT")

    def test_self_contained_payload(self):
        """Self-contained payload with local structs only."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {"XORDER": {"id": "L", "total": "N", "date": "D"}}, "data": "TYTX://{\\"order\\": \\"{\\\\\\"id\\\\\\": \\\\\\"123\\\\\\", \\\\\\"total\\\\\\": \\\\\\"199.99\\\\\\", \\\\\\"date\\\\\\": \\\\\\"2025-01-15\\\\\\"}::@XORDER\\"}"}'''
        result = from_json(payload)
        assert result.data == {
            "order": {
                "id": 123,
                "total": Decimal("199.99"),
                "date": date(2025, 1, 15),
            }
        }
        # Nothing should be registered
        assert registry.get_struct("XORDER") is None

    def test_mixed_global_local(self):
        """Mix of global and local structs."""
        payload = '''XTYTX://{"gstruct": {"XBASE": {"id": "L"}}, "lstruct": {"XTEMP": ["N"]}, "data": "TYTX://{\\"base\\": \\"{\\\\\\"id\\\\\\": \\\\\\"1\\\\\\"}::@XBASE\\", \\"temps\\": \\"[100, 200]::@XTEMP\\"}"}'''
        try:
            result = from_json(payload)
            assert result.data == {
                "base": {"id": 1},
                "temps": [Decimal("100"), Decimal("200")],
            }
            # XBASE persists, XTEMP does not
            assert registry.get_struct("XBASE") == {"id": "L"}
            assert registry.get_struct("XTEMP") is None
        finally:
            registry.unregister_struct("XBASE")


class TestXtytxErrorHandling:
    """Tests for error handling."""

    def test_invalid_json_envelope(self):
        """Invalid JSON in envelope raises error."""
        with pytest.raises(Exception):  # json.JSONDecodeError
            from_json('XTYTX://{invalid json}')

    def test_missing_gstruct_field(self):
        """Missing gstruct field raises error."""
        with pytest.raises(KeyError):
            from_json('XTYTX://{"lstruct": {}, "data": ""}')

    def test_missing_lstruct_field(self):
        """Missing lstruct field raises error."""
        with pytest.raises(KeyError):
            from_json('XTYTX://{"gstruct": {}, "data": ""}')

    def test_missing_data_field(self):
        """Missing data field raises error."""
        with pytest.raises(KeyError):
            from_json('XTYTX://{"gstruct": {}, "lstruct": {}}')


class TestXtytxSchemaFormats:
    """Tests for different schema formats in gstruct/lstruct."""

    def test_dict_schema_in_gstruct(self):
        """Dict schema format works in gstruct."""
        payload = 'XTYTX://{"gstruct": {"XDICT": {"a": "L", "b": "N"}}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            assert registry.get_struct("XDICT") == {"a": "L", "b": "N"}
        finally:
            registry.unregister_struct("XDICT")

    def test_list_schema_in_gstruct(self):
        """List schema format works in gstruct."""
        payload = 'XTYTX://{"gstruct": {"XLIST": ["T", "L", "N"]}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            assert registry.get_struct("XLIST") == ["T", "L", "N"]
        finally:
            registry.unregister_struct("XLIST")

    def test_string_schema_in_gstruct(self):
        """String schema format works in gstruct."""
        payload = 'XTYTX://{"gstruct": {"XSTR": "x:R,y:R"}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            assert registry.get_struct("XSTR") == "x:R,y:R"
        finally:
            registry.unregister_struct("XSTR")

    def test_homogeneous_list_schema(self):
        """Homogeneous list schema (single element) works."""
        payload = 'XTYTX://{"gstruct": {"XNUMS": ["N"]}, "lstruct": {}, "data": ""}'
        try:
            from_json(payload)
            assert registry.get_struct("XNUMS") == ["N"]
        finally:
            registry.unregister_struct("XNUMS")


class TestXtytxGvalidation:
    """Tests for gvalidation (global validation registration)."""

    def test_gvalidation_registers_globally(self):
        """gvalidation entries are registered in global validation_registry."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xtest_email": {"pattern": "^[^@]+@[^@]+$", "message": "Invalid email"}}, "lvalidation": {}, "data": ""}'''
        try:
            result = from_json(payload)
            # Validation should be registered
            assert validation_registry.get("xtest_email") is not None
            assert validation_registry.get("xtest_email")["pattern"] == "^[^@]+@[^@]+$"
            # Validate works
            assert validation_registry.validate("test@example.com", "xtest_email")
            assert not validation_registry.validate("invalid", "xtest_email")
        finally:
            validation_registry.unregister("xtest_email")

    def test_gvalidation_returned_in_result(self):
        """gvalidation is available in XtytxResult."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xmy_val": {"pattern": "^ABC$"}}, "lvalidation": {}, "data": ""}'''
        try:
            result = from_json(payload)
            assert result.global_validations is not None
            assert "xmy_val" in result.global_validations
            assert result.global_validations["xmy_val"]["pattern"] == "^ABC$"
        finally:
            validation_registry.unregister("xmy_val")

    def test_gvalidation_persists_after_decoding(self):
        """gvalidation remains registered after decoding completes."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xpersist_val": {"pattern": "^[A-Z]+$"}}, "lvalidation": {}, "data": ""}'''
        try:
            from_json(payload)
            # Should still exist
            assert validation_registry.get("xpersist_val") is not None
            # Can use in subsequent validations
            assert validation_registry.validate("ABC", "xpersist_val")
        finally:
            validation_registry.unregister("xpersist_val")

    def test_gvalidation_multiple_validations(self):
        """Multiple validations can be registered at once."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xval_a": {"pattern": "^A"}, "xval_b": {"pattern": "^B"}}, "lvalidation": {}, "data": ""}'''
        try:
            from_json(payload)
            assert validation_registry.get("xval_a") is not None
            assert validation_registry.get("xval_b") is not None
        finally:
            validation_registry.unregister("xval_a")
            validation_registry.unregister("xval_b")


class TestXtytxLvalidation:
    """Tests for lvalidation (local validation definitions)."""

    def test_lvalidation_not_registered_globally(self):
        """lvalidation entries are NOT registered in global registry after decoding."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xlocal_val": {"pattern": "^LOCAL$"}}, "data": ""}'''
        result = from_json(payload)
        # Should NOT be in global registry
        assert validation_registry.get("xlocal_val") is None
        # But should be in result
        assert result.local_validations is not None
        assert "xlocal_val" in result.local_validations

    def test_lvalidation_returned_in_result(self):
        """lvalidation is available in XtytxResult for later use."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xtemp_val": {"pattern": "^[0-9]+$", "message": "Numbers only"}}, "data": ""}'''
        result = from_json(payload)
        assert result.local_validations is not None
        assert "xtemp_val" in result.local_validations
        assert result.local_validations["xtemp_val"]["message"] == "Numbers only"

    def test_lvalidation_can_be_used_with_validate(self):
        """lvalidation can be used with validate() method."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {}, "lvalidation": {"xnum_only": {"pattern": "^[0-9]+$"}}, "data": ""}'''
        result = from_json(payload)
        # Use local_validations in validate
        assert validation_registry.validate(
            "12345",
            "xnum_only",
            local_validations=result.local_validations,
        )
        assert not validation_registry.validate(
            "abc",
            "xnum_only",
            local_validations=result.local_validations,
        )


class TestXtytxValidationPrecedence:
    """Tests for validation resolution order: lvalidation > gvalidation > registry."""

    def test_lvalidation_overrides_gvalidation(self):
        """lvalidation takes precedence over gvalidation."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xprec": {"pattern": "^GLOBAL$"}}, "lvalidation": {"xprec": {"pattern": "^LOCAL$"}}, "data": ""}'''
        try:
            result = from_json(payload)
            # Using local_validations should use LOCAL pattern
            assert validation_registry.validate(
                "LOCAL",
                "xprec",
                local_validations=result.local_validations,
                global_validations=result.global_validations,
            )
            assert not validation_registry.validate(
                "GLOBAL",
                "xprec",
                local_validations=result.local_validations,
                global_validations=result.global_validations,
            )
            # But global registry has GLOBAL pattern
            assert validation_registry.validate("GLOBAL", "xprec")
        finally:
            validation_registry.unregister("xprec")

    def test_gvalidation_overrides_registry(self):
        """gvalidation takes precedence over pre-registered validations."""
        # Pre-register a validation
        validation_registry.register("xexisting_val", {"pattern": "^REGISTRY$"})
        try:
            payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xexisting_val": {"pattern": "^GVALIDATION$"}}, "lvalidation": {}, "data": ""}'''
            from_json(payload)
            # gvalidation should have overwritten
            assert validation_registry.validate("GVALIDATION", "xexisting_val")
            assert not validation_registry.validate("REGISTRY", "xexisting_val")
        finally:
            validation_registry.unregister("xexisting_val")


class TestXtytxValidationWithData:
    """Tests for using validations with actual data."""

    def test_envelope_with_validations_and_data(self):
        """Complete envelope with structs, validations, and data."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xcode": {"pattern": "^[A-Z]{3}$", "len": 3}}, "lvalidation": {}, "data": "{\\"code\\": \\"ABC\\"}"}'''
        try:
            result = from_json(payload)
            assert result.data == {"code": "ABC"}
            # Validation is available
            assert validation_registry.validate("ABC", "xcode")
            assert not validation_registry.validate("ABCD", "xcode")  # too long
            assert not validation_registry.validate("abc", "xcode")  # lowercase
        finally:
            validation_registry.unregister("xcode")

    def test_validation_expression_with_gvalidation(self):
        """Boolean expressions work with gvalidation."""
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "gvalidation": {"xupper": {"pattern": "^[A-Z]+$"}, "xshort": {"max": 5}}, "lvalidation": {}, "data": ""}'''
        try:
            result = from_json(payload)
            # AND expression
            assert validation_registry.validate_expression("ABC", "xupper&xshort")
            assert not validation_registry.validate_expression("ABCDEF", "xupper&xshort")  # too long
            assert not validation_registry.validate_expression("abc", "xupper&xshort")  # lowercase
        finally:
            validation_registry.unregister("xupper")
            validation_registry.unregister("xshort")

    def test_optional_validation_fields(self):
        """gvalidation and lvalidation fields are optional."""
        # Without gvalidation/lvalidation fields
        payload = '''XTYTX://{"gstruct": {}, "lstruct": {}, "data": "{\\"x\\": 1}"}'''
        result = from_json(payload)
        assert result.data == {"x": 1}
        assert result.global_validations is None
        assert result.local_validations is None
