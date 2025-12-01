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

"""
Tests for TYTX validation system.

Tests cover:
- ValidationRegistry basic operations
- Standard validations (29 patterns)
- Italian locale validations (12 patterns)
- Boolean expression operators (!&|)
- Resolution order (local > global > registry)
"""

import pytest

from genro_tytx.struct import (
    STANDARD_VALIDATIONS,
    ValidationDef,
    ValidationRegistry,
    create_validation_registry,
    validation_registry,
)
from genro_tytx.validation_locale import it as it_validations


class TestValidationRegistryBasic:
    """Test ValidationRegistry basic operations."""

    def test_register_and_get(self) -> None:
        """Register a validation and retrieve it."""
        registry = ValidationRegistry()
        definition: ValidationDef = {
            "pattern": r"^[A-Z]+$",
            "message": "Must be uppercase",
        }
        registry.register("test_upper", definition)

        result = registry.get("test_upper")
        assert result is not None
        assert result["pattern"] == r"^[A-Z]+$"
        assert result["message"] == "Must be uppercase"

    def test_unregister(self) -> None:
        """Unregister removes validation."""
        registry = ValidationRegistry()
        registry.register("temp", {"pattern": r".*"})
        assert registry.get("temp") is not None

        registry.unregister("temp")
        assert registry.get("temp") is None

    def test_list_validations(self) -> None:
        """List all registered validation names."""
        registry = ValidationRegistry()
        registry.register("a", {"pattern": r"a"})
        registry.register("b", {"pattern": r"b"})
        registry.register("c", {"pattern": r"c"})

        names = registry.list_validations()
        assert set(names) == {"a", "b", "c"}

    def test_get_nonexistent_returns_none(self) -> None:
        """Get returns None for unknown validation."""
        registry = ValidationRegistry()
        assert registry.get("nonexistent") is None


class TestValidationRegistryValidate:
    """Test ValidationRegistry.validate() method."""

    def test_validate_pattern_pass(self) -> None:
        """Pattern validation passes for matching value."""
        registry = ValidationRegistry()
        registry.register("upper", {"pattern": r"^[A-Z]+$"})

        assert registry.validate("ABC", "upper") is True

    def test_validate_pattern_fail(self) -> None:
        """Pattern validation fails for non-matching value."""
        registry = ValidationRegistry()
        registry.register("upper", {"pattern": r"^[A-Z]+$"})

        assert registry.validate("abc", "upper") is False

    def test_validate_len_pass(self) -> None:
        """Length validation passes for correct length."""
        registry = ValidationRegistry()
        registry.register("len5", {"len": 5})

        assert registry.validate("12345", "len5") is True

    def test_validate_len_fail(self) -> None:
        """Length validation fails for wrong length."""
        registry = ValidationRegistry()
        registry.register("len5", {"len": 5})

        assert registry.validate("1234", "len5") is False
        assert registry.validate("123456", "len5") is False

    def test_validate_min_pass(self) -> None:
        """Min length validation passes."""
        registry = ValidationRegistry()
        registry.register("min3", {"min": 3})

        assert registry.validate("abc", "min3") is True
        assert registry.validate("abcd", "min3") is True

    def test_validate_min_fail(self) -> None:
        """Min length validation fails."""
        registry = ValidationRegistry()
        registry.register("min3", {"min": 3})

        assert registry.validate("ab", "min3") is False

    def test_validate_max_pass(self) -> None:
        """Max length validation passes."""
        registry = ValidationRegistry()
        registry.register("max5", {"max": 5})

        assert registry.validate("abc", "max5") is True
        assert registry.validate("abcde", "max5") is True

    def test_validate_max_fail(self) -> None:
        """Max length validation fails."""
        registry = ValidationRegistry()
        registry.register("max5", {"max": 5})

        assert registry.validate("abcdef", "max5") is False

    def test_validate_combined_constraints(self) -> None:
        """Multiple constraints are all checked."""
        registry = ValidationRegistry()
        registry.register(
            "strict",
            {
                "pattern": r"^[A-Z]+$",
                "len": 3,
            },
        )

        assert registry.validate("ABC", "strict") is True
        assert registry.validate("AB", "strict") is False  # wrong length
        assert registry.validate("abc", "strict") is False  # wrong pattern
        assert registry.validate("ABCD", "strict") is False  # wrong length

    def test_validate_unknown_raises(self) -> None:
        """Validate raises KeyError for unknown validation."""
        registry = ValidationRegistry()

        with pytest.raises(KeyError, match="not found"):
            registry.validate("test", "nonexistent")


class TestValidationExpressions:
    """Test boolean expression evaluation (!&|)."""

    @pytest.fixture
    def registry(self) -> ValidationRegistry:
        """Create registry with test validations."""
        reg = ValidationRegistry()
        reg.register("upper", {"pattern": r"^[A-Z]+$"})
        reg.register("lower", {"pattern": r"^[a-z]+$"})
        reg.register("numeric", {"pattern": r"^[0-9]+$"})
        reg.register("alpha", {"pattern": r"^[a-zA-Z]+$"})
        reg.register("len3", {"len": 3})
        return reg

    def test_single_validation(self, registry: ValidationRegistry) -> None:
        """Single validation name works."""
        assert registry.validate_expression("ABC", "upper") is True
        assert registry.validate_expression("abc", "upper") is False

    def test_and_operator_all_pass(self, registry: ValidationRegistry) -> None:
        """AND operator: all must pass."""
        assert registry.validate_expression("ABC", "upper&len3") is True

    def test_and_operator_one_fails(self, registry: ValidationRegistry) -> None:
        """AND operator: if one fails, result is False."""
        assert registry.validate_expression("ABCD", "upper&len3") is False
        assert registry.validate_expression("abc", "upper&len3") is False

    def test_or_operator_one_passes(self, registry: ValidationRegistry) -> None:
        """OR operator: at least one must pass."""
        assert registry.validate_expression("ABC", "upper|lower") is True
        assert registry.validate_expression("abc", "upper|lower") is True

    def test_or_operator_all_fail(self, registry: ValidationRegistry) -> None:
        """OR operator: all fail means False."""
        assert registry.validate_expression("123", "upper|lower") is False

    def test_not_operator_negates(self, registry: ValidationRegistry) -> None:
        """NOT operator: negates result."""
        assert registry.validate_expression("abc", "!upper") is True
        assert registry.validate_expression("ABC", "!upper") is False

    def test_not_with_and(self, registry: ValidationRegistry) -> None:
        """NOT combined with AND: !a&b means (!a) AND b."""
        # !upper&lower: NOT uppercase AND is lowercase
        assert registry.validate_expression("abc", "!upper&lower") is True
        assert registry.validate_expression("ABC", "!upper&lower") is False
        assert registry.validate_expression("123", "!upper&lower") is False

    def test_not_with_or(self, registry: ValidationRegistry) -> None:
        """NOT combined with OR: !a|b means (!a) OR b."""
        # !upper|numeric: NOT uppercase OR is numeric
        assert registry.validate_expression("abc", "!upper|numeric") is True  # !upper
        assert registry.validate_expression("123", "!upper|numeric") is True  # both
        assert registry.validate_expression("ABC", "!upper|numeric") is False  # neither

    def test_complex_expression(self, registry: ValidationRegistry) -> None:
        """Complex expression: a&b|c&d."""
        # upper&len3|lower&len3: (upper AND len3) OR (lower AND len3)
        assert registry.validate_expression("ABC", "upper&len3|lower&len3") is True
        assert registry.validate_expression("abc", "upper&len3|lower&len3") is True
        assert registry.validate_expression("ABCD", "upper&len3|lower&len3") is False
        assert registry.validate_expression("abcd", "upper&len3|lower&len3") is False

    def test_precedence_not_highest(self, registry: ValidationRegistry) -> None:
        """NOT has highest precedence."""
        # !upper&alpha on "abc": (!upper) AND alpha = True AND True = True
        assert registry.validate_expression("abc", "!upper&alpha") is True
        # !upper&alpha on "ABC": (!upper) AND alpha = False AND True = False
        assert registry.validate_expression("ABC", "!upper&alpha") is False

    def test_precedence_and_before_or(self, registry: ValidationRegistry) -> None:
        """AND has higher precedence than OR."""
        # upper|lower&len3 on "ABC": upper OR (lower AND len3) = True OR False = True
        assert registry.validate_expression("ABC", "upper|lower&len3") is True
        # upper|lower&len3 on "abcd": upper OR (lower AND len3) = False OR False = False
        assert registry.validate_expression("abcd", "upper|lower&len3") is False
        # upper|lower&len3 on "abc": upper OR (lower AND len3) = False OR True = True
        assert registry.validate_expression("abc", "upper|lower&len3") is True

    def test_whitespace_in_expression(self, registry: ValidationRegistry) -> None:
        """Whitespace is trimmed in expressions."""
        assert registry.validate_expression("ABC", " upper & len3 ") is True
        assert registry.validate_expression("abc", " upper | lower ") is True
        assert registry.validate_expression("abc", " ! upper ") is True


class TestResolutionOrder:
    """Test validation resolution order: local > global > registry."""

    def test_local_overrides_global(self) -> None:
        """Local validation takes precedence over global."""
        registry = ValidationRegistry()
        registry.register("test", {"pattern": r"^REGISTRY$"})

        global_validations: dict[str, ValidationDef] = {
            "test": {"pattern": r"^GLOBAL$"}
        }
        local_validations: dict[str, ValidationDef] = {
            "test": {"pattern": r"^LOCAL$"}
        }

        # Local wins
        assert (
            registry.validate(
                "LOCAL",
                "test",
                local_validations=local_validations,
                global_validations=global_validations,
            )
            is True
        )
        assert (
            registry.validate(
                "GLOBAL",
                "test",
                local_validations=local_validations,
                global_validations=global_validations,
            )
            is False
        )

    def test_global_overrides_registry(self) -> None:
        """Global validation takes precedence over registry."""
        registry = ValidationRegistry()
        registry.register("test", {"pattern": r"^REGISTRY$"})

        global_validations: dict[str, ValidationDef] = {
            "test": {"pattern": r"^GLOBAL$"}
        }

        # Global wins
        assert (
            registry.validate("GLOBAL", "test", global_validations=global_validations)
            is True
        )
        assert (
            registry.validate("REGISTRY", "test", global_validations=global_validations)
            is False
        )

    def test_registry_fallback(self) -> None:
        """Registry is used when no local/global override."""
        registry = ValidationRegistry()
        registry.register("test", {"pattern": r"^REGISTRY$"})

        assert registry.validate("REGISTRY", "test") is True

    def test_expression_with_local_validations(self) -> None:
        """Expressions work with local validations."""
        registry = ValidationRegistry()

        local_validations: dict[str, ValidationDef] = {
            "a": {"pattern": r"^[A-Z]+$"},
            "b": {"pattern": r"^.{3}$"},
        }

        assert (
            registry.validate_expression(
                "ABC", "a&b", local_validations=local_validations
            )
            is True
        )
        assert (
            registry.validate_expression(
                "ABCD", "a&b", local_validations=local_validations
            )
            is False
        )


class TestStandardValidations:
    """Test pre-defined standard validations."""

    def test_standard_validations_count(self) -> None:
        """29 standard validations are defined (locale-specific excluded)."""
        assert len(STANDARD_VALIDATIONS) == 29

    def test_global_registry_has_standard(self) -> None:
        """Global validation_registry has standard validations."""
        assert len(validation_registry.list_validations()) == 29

    def test_create_registry_with_standard(self) -> None:
        """create_validation_registry includes standard by default."""
        registry = create_validation_registry()
        assert len(registry.list_validations()) == 29

    def test_create_registry_without_standard(self) -> None:
        """create_validation_registry can exclude standard."""
        registry = create_validation_registry(include_standard=False)
        assert len(registry.list_validations()) == 0

    # Internet & Communication
    def test_email_valid(self) -> None:
        """Email validation accepts valid emails."""
        assert validation_registry.validate("test@example.com", "email") is True
        assert validation_registry.validate("user.name+tag@domain.co.uk", "email") is True

    def test_email_invalid(self) -> None:
        """Email validation rejects invalid emails."""
        assert validation_registry.validate("invalid", "email") is False
        assert validation_registry.validate("@domain.com", "email") is False
        assert validation_registry.validate("user@", "email") is False

    def test_url_valid(self) -> None:
        """URL validation accepts valid URLs."""
        assert validation_registry.validate("https://example.com", "url") is True
        assert validation_registry.validate("http://example.com/path?q=1", "url") is True

    def test_url_invalid(self) -> None:
        """URL validation rejects invalid URLs."""
        assert validation_registry.validate("ftp://example.com", "url") is False
        assert validation_registry.validate("example.com", "url") is False

    def test_domain_valid(self) -> None:
        """Domain validation accepts valid domains."""
        assert validation_registry.validate("example.com", "domain") is True
        assert validation_registry.validate("sub.example.co.uk", "domain") is True

    def test_ipv4_valid(self) -> None:
        """IPv4 validation accepts valid IPs."""
        assert validation_registry.validate("192.168.1.1", "ipv4") is True
        assert validation_registry.validate("255.255.255.255", "ipv4") is True

    def test_ipv4_invalid(self) -> None:
        """IPv4 validation rejects invalid IPs."""
        assert validation_registry.validate("256.1.1.1", "ipv4") is False
        assert validation_registry.validate("192.168.1", "ipv4") is False

    def test_phone_valid(self) -> None:
        """Phone validation (E.164) accepts valid numbers."""
        assert validation_registry.validate("+393331234567", "phone") is True
        assert validation_registry.validate("393331234567", "phone") is True

    # Identifiers
    def test_uuid_v4_valid(self) -> None:
        """UUID v4 validation accepts valid UUIDs."""
        assert (
            validation_registry.validate(
                "550e8400-e29b-41d4-a716-446655440000", "uuid"
            )
            is True
        )

    def test_uuid_v4_invalid(self) -> None:
        """UUID v4 validation rejects non-v4 UUIDs."""
        # v1 UUID (not v4)
        assert (
            validation_registry.validate(
                "550e8400-e29b-11d4-a716-446655440000", "uuid"
            )
            is False
        )

    def test_uuid_any_valid(self) -> None:
        """UUID any version validation."""
        assert (
            validation_registry.validate(
                "550e8400-e29b-11d4-a716-446655440000", "uuid_any"
            )
            is True
        )

    def test_slug_valid(self) -> None:
        """Slug validation accepts valid slugs."""
        assert validation_registry.validate("my-post-title", "slug") is True
        assert validation_registry.validate("post123", "slug") is True

    def test_slug_invalid(self) -> None:
        """Slug validation rejects invalid slugs."""
        assert validation_registry.validate("My-Post", "slug") is False  # uppercase
        assert validation_registry.validate("my_post", "slug") is False  # underscore

    # European Standards
    def test_iban_valid(self) -> None:
        """IBAN validation accepts valid IBANs."""
        assert validation_registry.validate("IT60X0542811101000000123456", "iban") is True

    def test_bic_valid(self) -> None:
        """BIC/SWIFT validation accepts valid codes."""
        assert validation_registry.validate("DEUTDEFF", "bic") is True
        assert validation_registry.validate("DEUTDEFF500", "bic") is True

    def test_vat_eu_valid(self) -> None:
        """EU VAT validation accepts valid codes."""
        assert validation_registry.validate("IT12345678901", "vat_eu") is True
        assert validation_registry.validate("DE123456789", "vat_eu") is True

    # Text Constraints
    def test_latin_valid(self) -> None:
        """Latin (ASCII) validation accepts ASCII."""
        assert validation_registry.validate("Hello World 123!", "latin") is True

    def test_latin_invalid(self) -> None:
        """Latin validation rejects non-ASCII."""
        assert validation_registry.validate("Héllo", "latin") is False
        assert validation_registry.validate("日本語", "latin") is False

    def test_uppercase_valid(self) -> None:
        """Uppercase validation accepts uppercase only."""
        assert validation_registry.validate("HELLO", "uppercase") is True

    def test_uppercase_invalid(self) -> None:
        """Uppercase validation rejects lowercase/mixed."""
        assert validation_registry.validate("Hello", "uppercase") is False
        assert validation_registry.validate("hello", "uppercase") is False

    def test_lowercase_valid(self) -> None:
        """Lowercase validation accepts lowercase only."""
        assert validation_registry.validate("hello", "lowercase") is True

    def test_alphanumeric_valid(self) -> None:
        """Alphanumeric validation accepts letters and digits."""
        assert validation_registry.validate("Hello123", "alphanumeric") is True

    def test_alphanumeric_invalid(self) -> None:
        """Alphanumeric validation rejects special chars."""
        assert validation_registry.validate("Hello-123", "alphanumeric") is False

    def test_no_spaces_valid(self) -> None:
        """No spaces validation accepts strings without spaces."""
        assert validation_registry.validate("HelloWorld", "no_spaces") is True

    def test_no_spaces_invalid(self) -> None:
        """No spaces validation rejects strings with spaces."""
        assert validation_registry.validate("Hello World", "no_spaces") is False

    def test_single_line_valid(self) -> None:
        """Single line validation accepts strings without newlines."""
        assert validation_registry.validate("Hello World!", "single_line") is True

    def test_single_line_invalid(self) -> None:
        """Single line validation rejects strings with newlines."""
        assert validation_registry.validate("Hello\nWorld", "single_line") is False

    # Numeric Formats
    def test_positive_int_valid(self) -> None:
        """Positive integer validation."""
        assert validation_registry.validate("123", "positive_int") is True
        assert validation_registry.validate("1", "positive_int") is True

    def test_positive_int_invalid(self) -> None:
        """Positive integer rejects zero and negative."""
        assert validation_registry.validate("0", "positive_int") is False
        assert validation_registry.validate("-1", "positive_int") is False

    def test_non_negative_int_valid(self) -> None:
        """Non-negative integer validation."""
        assert validation_registry.validate("0", "non_negative_int") is True
        assert validation_registry.validate("123", "non_negative_int") is True

    def test_decimal_valid(self) -> None:
        """Decimal validation accepts valid decimals."""
        assert validation_registry.validate("123.45", "decimal") is True
        assert validation_registry.validate("-123.45", "decimal") is True
        assert validation_registry.validate("123", "decimal") is True

    def test_percentage_valid(self) -> None:
        """Percentage validation accepts 0-100."""
        assert validation_registry.validate("0", "percentage") is True
        assert validation_registry.validate("50.5", "percentage") is True
        assert validation_registry.validate("100", "percentage") is True

    def test_percentage_invalid(self) -> None:
        """Percentage validation rejects out of range."""
        assert validation_registry.validate("101", "percentage") is False

    # Date & Time Formats
    def test_iso_date_valid(self) -> None:
        """ISO date validation accepts YYYY-MM-DD."""
        assert validation_registry.validate("2025-01-15", "iso_date") is True

    def test_iso_date_invalid(self) -> None:
        """ISO date validation rejects invalid dates."""
        assert validation_registry.validate("2025-13-01", "iso_date") is False
        assert validation_registry.validate("2025/01/15", "iso_date") is False

    def test_iso_datetime_valid(self) -> None:
        """ISO datetime validation accepts ISO 8601."""
        assert validation_registry.validate("2025-01-15T10:30:00Z", "iso_datetime") is True
        assert (
            validation_registry.validate("2025-01-15T10:30:00+01:00", "iso_datetime")
            is True
        )

    def test_time_valid(self) -> None:
        """Time validation accepts HH:MM and HH:MM:SS."""
        assert validation_registry.validate("10:30", "time") is True
        assert validation_registry.validate("10:30:45", "time") is True

    def test_time_invalid(self) -> None:
        """Time validation rejects invalid times."""
        assert validation_registry.validate("25:00", "time") is False

    def test_year_valid(self) -> None:
        """Year validation accepts 4-digit years."""
        assert validation_registry.validate("2025", "year") is True

    def test_year_invalid(self) -> None:
        """Year validation rejects non-4-digit."""
        assert validation_registry.validate("25", "year") is False
        assert validation_registry.validate("20250", "year") is False

    # Security
    def test_password_strong_valid(self) -> None:
        """Strong password validation."""
        assert validation_registry.validate("MyP@ss123", "password_strong") is True

    def test_password_strong_invalid(self) -> None:
        """Strong password rejects weak passwords."""
        assert validation_registry.validate("password", "password_strong") is False
        assert validation_registry.validate("Password1", "password_strong") is False

    def test_hex_valid(self) -> None:
        """Hex validation accepts hex strings."""
        assert validation_registry.validate("0123456789abcdefABCDEF", "hex") is True

    def test_hex_invalid(self) -> None:
        """Hex validation rejects non-hex."""
        assert validation_registry.validate("0123456789abcdefg", "hex") is False

    def test_base64_valid(self) -> None:
        """Base64 validation accepts valid base64."""
        assert validation_registry.validate("SGVsbG8gV29ybGQ=", "base64") is True

    def test_base64_invalid(self) -> None:
        """Base64 validation rejects invalid base64."""
        assert validation_registry.validate("Hello World!", "base64") is False


class TestItalianValidations:
    """Test Italian locale validations from validation_locale.it."""

    @pytest.fixture(autouse=True)
    def setup_italian_validations(self) -> None:
        """Register Italian validations before each test."""
        # Create a fresh registry with Italian validations
        self.registry = create_validation_registry(include_standard=True)
        it_validations.register_all(self.registry)

    def test_italian_validations_count(self) -> None:
        """12 Italian validations are defined."""
        assert len(it_validations.VALIDATIONS) == 12

    def test_cf_valid(self) -> None:
        """Codice Fiscale validation accepts valid codes."""
        assert self.registry.validate("RSSMRA85M01H501X", "cf") is True

    def test_cf_invalid(self) -> None:
        """Codice Fiscale validation rejects invalid codes."""
        assert self.registry.validate("RSSMRA85M01H501", "cf") is False  # too short
        assert self.registry.validate("rssmra85m01h501x", "cf") is False  # lowercase

    def test_piva_valid(self) -> None:
        """Partita IVA validation accepts valid codes."""
        assert self.registry.validate("12345678901", "piva") is True

    def test_piva_invalid(self) -> None:
        """Partita IVA validation rejects invalid codes."""
        assert self.registry.validate("1234567890", "piva") is False  # 10 digits
        assert self.registry.validate("123456789012", "piva") is False  # 12 digits

    def test_cap_valid(self) -> None:
        """Italian CAP validation accepts valid codes."""
        assert self.registry.validate("00100", "cap") is True
        assert self.registry.validate("20100", "cap") is True

    def test_cap_invalid(self) -> None:
        """Italian CAP validation rejects invalid codes."""
        assert self.registry.validate("0010", "cap") is False
        assert self.registry.validate("001000", "cap") is False

    def test_targa_valid(self) -> None:
        """Italian license plate validation accepts valid plates."""
        assert self.registry.validate("AA000AA", "targa") is True
        assert self.registry.validate("ZZ999ZZ", "targa") is True

    def test_targa_invalid(self) -> None:
        """Italian license plate validation rejects invalid plates."""
        assert self.registry.validate("AA00AA", "targa") is False  # only 2 digits
        assert self.registry.validate("AA0000AA", "targa") is False  # 4 digits

    def test_sdi_valid(self) -> None:
        """SDI code validation accepts valid codes."""
        assert self.registry.validate("ABCD123", "sdi") is True
        assert self.registry.validate("0000000", "sdi") is True

    def test_sdi_invalid(self) -> None:
        """SDI code validation rejects invalid codes."""
        assert self.registry.validate("ABCD12", "sdi") is False  # 6 chars
        assert self.registry.validate("ABCD1234", "sdi") is False  # 8 chars

    def test_pec_valid(self) -> None:
        """PEC validation accepts valid addresses."""
        assert self.registry.validate("info@example.pec.it", "pec") is True

    def test_pec_invalid(self) -> None:
        """PEC validation rejects non-PEC addresses."""
        assert self.registry.validate("info@example.com", "pec") is False

    def test_iban_it_valid(self) -> None:
        """Italian IBAN validation accepts valid IBANs."""
        assert self.registry.validate("IT60X0542811101000000123456", "iban_it") is True

    def test_iban_it_invalid(self) -> None:
        """Italian IBAN validation rejects non-Italian IBANs."""
        assert self.registry.validate("DE89370400440532013000", "iban_it") is False

    def test_cf_or_piva(self) -> None:
        """Accept either CF or PIVA using expression."""
        # Valid CF
        assert self.registry.validate_expression("RSSMRA85M01H501X", "cf|piva") is True
        # Valid PIVA
        assert self.registry.validate_expression("12345678901", "cf|piva") is True
        # Neither
        assert self.registry.validate_expression("invalid", "cf|piva") is False


class TestValidationExpressionRealWorld:
    """Real-world use cases for validation expressions."""

    def test_latin_uppercase(self) -> None:
        """Accept only uppercase latin characters."""
        assert (
            validation_registry.validate_expression("HELLO", "latin&uppercase") is True
        )
        assert (
            validation_registry.validate_expression("hello", "latin&uppercase") is False
        )
        assert (
            validation_registry.validate_expression("HÉLLO", "latin&uppercase") is False
        )

    def test_not_numeric(self) -> None:
        """Accept anything that is NOT numeric."""
        assert validation_registry.validate_expression("abc", "!positive_int") is True
        assert validation_registry.validate_expression("123", "!positive_int") is False

    def test_email_or_phone(self) -> None:
        """Accept email or phone."""
        assert (
            validation_registry.validate_expression("test@example.com", "email|phone")
            is True
        )
        assert (
            validation_registry.validate_expression("+393331234567", "email|phone")
            is True
        )
        assert (
            validation_registry.validate_expression("invalid", "email|phone") is False
        )
