# Files for specs

Files that specs of the mocked-API suite upload or give as a download, one folder per area:
`e2e/ui/fixtures/<area>/<name>` (`core/members-list.xlsx`, `events/head-image.png`).

- Keep them small (a few kB): a picture of a few pixels, a spreadsheet with two rows.
- Make them for the test. Never copy a real members list, export or picture of a person here.
- A spec reads its file relative to itself:
  `fs.readFileSync(path.join(import.meta.dirname, '../fixtures/core/members-list.xlsx'))`,
  or passes the path to `setInputFiles()`.
- A file whose content doesn't matter needs no fixture: give `setInputFiles()` a buffer
  (`{ name: 'head.png', mimeType: 'image/png', buffer }`), as `e2e/ui/harness/api-mock.spec.ts` does.

See [docs/testing/writing-ui-specs.md](../../../docs/testing/writing-ui-specs.md).
