# Changelog

Notable changes to genro-tytx. Started at 0.12.2; earlier releases are
documented by their git tags and commit history.

## [Unreleased]

### Added

- Type-code grammar: `register_type` / `registerType` (and the `register_class`
  / `registerClass` wrappers) now refuse a suffix that is not 1 to 3 uppercase
  ASCII letters (`SUFFIX_PATTERN`, exported). Every suffix registered so far
  (`X`, `BAG`, the test codes) already conforms.
- Spec §2.5 "Registered Types and Reserved Codes": exact-type lookup with one
  code per subclass (`X` for `Bag`, `XS` for `SourceBag`, `BAG` for the legacy
  Bag), opaque and possibly empty payloads, unknown codes returned untouched,
  the structural requirement on consumers that embed `"::CODE"` markers, and
  what an old `"::X"` marker does not say.
- Tests, Python and JavaScript, for the registered-subclass protocol across
  JSON, XML and MessagePack, and for the code grammar.

### Fixed

- CLAUDE.md pointed to `spec/type-codes.md`, which does not exist; the spec is
  `spec/TYTX-SPEC.md`.

## [0.13.0] - 2026-09-02

### Removed

- The HTTP request adapters (`asgi_data`, `wsgi_data`, `get_transport`,
  `TRANSPORT_MIME`, `MIME_TRANSPORT`) and the `genro_tytx.http` module.
  genro-tytx serializes and deserializes values; it does not read requests.

## [0.12.2] - 2026-08-06

### Fixed

- msgpack transport now honours registered custom types (`register_type` /
  `register_class`): a new extension type (ext code 4, payload
  `"SUFFIX:serialized"`, first-colon split) carries them over
  `transport="msgpack"`, which previously raised
  `TypeError: Unknown type`. Unknown suffixes on the receiving side degrade
  to the string `"serialized::SUFFIX"`, matching the JSON path. Implemented
  in both the Python package and the JS client; spec updated
  (`spec/TYTX-SPEC.md` §6).
