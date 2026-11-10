# Gedcomber

A local family-tree studio built with React, TypeScript, and Vite. Upload a GEDCOM, explore a branch at a time, edit individuals, and make themed tree prints and ancestry books. No account, backend, external font service, or cloud upload is used.

## Run locally

Use Node.js 22.12+ (or a supported newer LTS release).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. The port is fixed so browser storage remains associated with the same address. Stop the server with Ctrl+C.

```sh
npm test          # GEDCOM round trips, expansion, pagination, and backup validation
npm run build    # TypeScript checks and production assets in dist/
npm run preview  # Serve the production build at http://127.0.0.1:4173
npm run format   # Format source files
```

The development and preview addresses have separate browser storage. Download a project backup to move between them.

## Using the studio

1. Upload `.ged` or `.gedcom`, then choose the primary person. Only this person appears initially.
2. Use the controls above, beside, and below a person to toggle parents, siblings, partners, and children. Siblings alternate on either side of the reference person. Collapse follows the visible paths: someone reachable through another open branch stays visible.
3. Drag or scroll to pan, use the zoom controls (or Ctrl/Cmd + wheel), and use **Fit tree to view** after opening larger branches.
4. Click a person, or search all individuals in **People**, to edit their details. Add JPEG/PNG/WebP photographs and plain-text/Markdown Life Stories there. Uploaded photos are resized to at most 1,400 pixels on the longest edge.
5. Choose Botanical, Heirloom, Editorial, or Celestial, then customise colours, visible details, name formatting, dates, title, and subheading.
6. In **Ancestry book**, choose up to 100 individuals and arrange their order. Adjust paper size, orientation, photo placement, text size, and detail toggles. The book uses the tree’s theme; its name/date formatting is independent. Edit facts and stories in the tree workspace.

All project changes, photos, stories, book choices, viewport, and expansion preferences automatically save to IndexedDB on the current device. Download `.gedcomber` backups to move a project or keep a durable copy. Clearing browser data removes the locally saved project. Importing a different file or restoring a backup replaces the active workspace after the import/restore flow; the UI offers a backup action.

## Export behaviour

- **Whole GEDCOM:** every original individual, family, and other record is exported, regardless of branch visibility. Edits are applied to the underlying records. Unknown/custom tags, other events, alternate names, and source records remain intact. Sources are never presented or managed in the editor.
- **Life Stories:** stored in project backups and exported as multiline custom `_STORY` tags. Other genealogy tools may ignore this custom tag. Markdown is retained in GEDCOM/project data and converted to readable text for books; it is not rendered as arbitrary HTML.
- **Photographs:** included in project backups and visual exports. GEDCOM does not embed uploaded photo binaries; original media records remain untouched. Uploading a photo assigns it locally rather than rewriting original media references.
- **Current tree:** all expanded/visible people, including any panned off screen, with no controls or hidden relatives. PNG, JPEG, PDF, or self-contained SVG; raster exports offer 1×, 2×, and 4× resolution. SVG retains vector text/lines and embedded fonts/photos.
- **Books:** PDF on A4, A5, or US Letter in portrait or landscape. Every individual starts a fresh page. Long stories flow onto a second page and additional pages if necessary, without truncation. Long notes and other facts also paginate. Headers, margins, and footers are reserved. PDFs use high-resolution page artwork for consistent appearance; the text is not selectable/searchable.
- **Backups:** `.gedcomber` JSON contains the original records plus edits, photos, stories, settings, and expansion state. Backups are validated before restoration.

The parser supports line-based GEDCOM 5.x and 7 record structures in UTF-8, or BOM-marked UTF-16. It preserves unrecognised records. ANSEL and other legacy encodings require re-export as UTF-8. Standard GEDCOM date qualifiers and ranges retain their uncertainty; unrecognised calendars/date expressions are displayed verbatim. The editor exposes the first name, birth, death, occupation, and burial fields plus notes; additional original events remain in the export. This release edits existing individuals; it does not add/delete people or change family relationships.

## Structure and future packaging

- `src/lib/gedcom.ts`: parser, record-preserving edits, full export.
- `src/lib/types.ts`: versioned project model, independent of React and storage.
- `src/lib/tree.ts`: visible graph traversal, balanced placement, family connectors.
- `src/lib/format.ts`: display-only name/date/Markdown formatting.
- `src/lib/storage.ts`: local persistence and project-file boundary. Rapid writes coalesce while retaining the latest revision.
- `src/lib/book.ts`: page dimensions, measured line wrapping, fact/story pagination.
- `src/components/Artwork.tsx` and `BookArtwork.tsx`: shared preview/export artwork.
- `src/lib/exports.tsx`: lazy-loaded raster/SVG/PDF generation.
- `src/components/`: workspace, person editor, book controls, and reusable controls.

`dist/` is a static browser application and can be served by a future local web server. A server storage adapter can replace `loadProject`/`saveProject` without changing the GEDCOM model or renderers. A Windows Electron or Tauri wrapper can host the same assets and add native open/save dialogs and filesystem storage. Keep the existing versioned project-file format as the interchange boundary; add explicit migrations when the schema changes. Neither a server backend nor a desktop installer is included in this release.

## Verification

Automated tests cover record preservation, shared notes, multiline stories, malformed inputs, one-person initial visibility, balanced sibling expansion, collapse/reachability, cyclic relationships, date uncertainty, per-person pagination, long-story/fact retention, and project-backup validation.

Browser checks exercised actual GEDCOM/photo/Markdown uploads, local restoration after reload, editing, full GEDCOM export, all four tree export formats, book page layout, A5 landscape continuation pages, and project backup restoration. Exported PDF pages were rendered separately and visually inspected.
