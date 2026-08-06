# Changelog

Notable changes to genro-tytx. Started at 0.12.2; earlier releases are
documented by their git tags and commit history.

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
