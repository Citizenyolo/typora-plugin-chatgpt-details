# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.11] - 2026-09-19

### Changed

- Click-handler visibility updates are now scoped to the toggled `<details>`
  section instead of rescanning all document blocks. Response time is
  O(section size) rather than O(document size), resulting in approximately
  5× faster expand/collapse on typical Codex exports.

### Added

- `_wrapperLeaves` index built once during document parsing so empty-wrapper
  detection after a click is also bounded by section size, eliminating a
  previously measured 31–34× regression on list-heavy documents.
- JSDOM-based regression test suite (`test/`) covering initial state, toggle,
  nesting, closer blocks, and structural-wrapper visibility. Run with
  `cd test && npm test`; no browser or Typora required.
- Unit tests wired into the GitHub Actions `Validate plugin` workflow so they
  run on every push and pull request.

## [1.0.10] - 2026-09-10

### Added

- Collapsible conversation-history and tool-activity blocks for Codex Markdown exports.
- Independent handling of nested `<details>` sections.
- State preservation while Typora virtualizes and redraws the document.
- Cleanup of empty list and blockquote wrappers at every nesting depth.
- Runtime-only rendering that does not modify the Markdown source.

[1.0.11]: https://github.com/Citizenyolo/typora-plugin-chatgpt-details/compare/1.0.10...1.0.11
[1.0.10]: https://github.com/Citizenyolo/typora-plugin-chatgpt-details/releases/tag/1.0.10
