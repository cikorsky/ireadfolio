# Source and asset provenance

Review scope: the first public iReadFolio 0.8.0 source tree, its selected assets, dependency metadata, and the build inputs used to create browser packages. This record distinguishes development history from an exhaustive copyright or clean-room certification.

## First-party implementation

Development records describe an independent TypeScript/React implementation after studying the observable functions, manifest/module metadata, and settings layout of Circle Reader 3.4.6. That reference product's package, browser bundle, screenshots, storage snapshots, services, account system, and branding are not selected for this public repository or release archives. The project makes no claim that another product's code or assets are relicensed by this repository.

The public implementation includes local parsing and storage logic, document-style controls, native DOCX generation, export processing, annotations, toolbar behavior, and standard WebDAV backup. Development was AI-assisted under the project maintainer's direction. Earlier layout presets and internal identifiers have been retained for behavior or data compatibility; their presence is recorded rather than used as proof of original authorship.

The checked source and editable assets support the recorded implementation path. This scoped review is not an exhaustive comparison with every reference-package file and does not establish that every possible third-party claim has been resolved. Contributions containing copied code or assets must identify their source and redistribution terms before inclusion. Credible provenance concerns should be reported to the maintainer with specific files and evidence.

## Assets and content

| Material | Recorded origin and publication treatment |
| --- | --- |
| Extension and toolbar logos | Editable SVG source is in `public/icons/`. The development records describe the book-shaped logo as project-created; raster icons are its distribution variants. The checked SVGs consist of basic vector shapes and paths. No external artist attribution is supplied in those files; the review does not treat absence of attribution as proof of ownership. |
| Runtime UI icons | Supplied by Ant Design Icons and its upstream SVG package; retain the applicable third-party license notices. |
| Chinese typography preset | Stores family names and numeric layout settings. It was calibrated against a user-provided document. The private document itself, its images, and its fonts are not distributed as project-owned assets. |
| System fonts | Referenced by name and queried locally where supported. Proprietary system-font files are not bundled. |
| Mathematical fonts and CSS | Build inputs come from the installed KaTeX package. Keep the upstream licenses and any asset-specific notices in the packaged third-party declarations. |
| Test articles and test media | Use synthetic repository fixtures. Private articles, reference-package snapshots, personal browser data, and downloaded third-party page assets are excluded from the selected public files. |
| User articles and imports | Remain the user's or the relevant rights holder's material. The project license does not grant rights to redistribute them. |

## Third-party software

Direct dependencies include Mozilla Readability, React, Ant Design, DOMPurify, Turndown, docx, JSZip, KaTeX, Highlight.js, and html-to-image. Their licenses remain separate from the project's Apache-2.0 license. Multi-license expressions in upstream packages must be handled according to the chosen upstream terms; a project-wide license does not erase dependency obligations.

`scripts/licenses.mjs` prepares [third-party notices](../public/THIRD_PARTY_LICENSES.txt) from the installed production dependency tree. The build copies the notices into distributable packages. Review the generated text and [NOTICE](../NOTICE) whenever dependencies or bundled assets change; successful generation alone is not an audit of every upstream asset.

## Public-file boundary

The public source is assembled from an allowlist of implementation, synthetic tests, build inputs, and public documentation. The historical development workspace is retained separately. Original reference packages, original-product observations, private template documents, storage exports, installed-extension history, machine-specific verification reports, and previous binary archives are outside this publication boundary.

Public release screenshots, if added, must use synthetic content and the current project interface. A source or package audit should inspect both the selected repository files and the generated browser archives; ignored local files must not accidentally become release assets.
