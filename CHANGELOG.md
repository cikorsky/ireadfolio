# Changelog

## 0.8.2 — 2026-11-09

- Added Save current configuration under Appearance so image alignment and other adjustments persist for newly opened articles without creating a named style.
- Included the saved configuration in full backups. Selecting a default style applies that style to subsequent articles.

## 0.8.1 — 2026-11-08

- Added separate odd/even page-number alignment for duplex DOCX and Chrome print/PDF exports.
- Updated the 江河公文 preset to place odd page numbers on the right and even page numbers on the left.
- Added odd/even style previews and persistence in named styles and backups. Existing custom snapshots retain uniform page-number alignment until enabled.

## 0.8.0 — 2026-11-06

First public-source version under the iReadFolio name.

- Web article extraction, manual selection, site rules, outlines, search, and same-origin next-page loading.
- Named reading styles, Chinese heading recognition, system-font selection where supported, and document-style controls for body text, titles, signatures, tables, and page numbers.
- Annotations, saved articles, categories, tags, archives, recycle bin, local backup import/export, and manual versioned WebDAV backups.
- TXT, Markdown, HTML, Word-compatible HTML DOC, native DOCX, EPUB, PNG, JPEG, and browser print/PDF exports.
- Configurable toolbar buttons with persistent active states, transient action feedback, side tooltips, default-format downloads, and an image-embedding toggle.
- Export configuration grouped under toolbar settings, with filename field documentation and literal-safe template expansion.
- Public development documentation, source/asset provenance notes, dependency notices, portable browser-test configuration, and GitHub workflows.

Browser-store signing and publication are separate from this source release. Firefox release XPI files are unsigned. See the README for export limitations, permissions, and installation requirements.
