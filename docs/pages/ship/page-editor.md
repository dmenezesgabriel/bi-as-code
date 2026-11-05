---
title: The page editor
icon: file-text
sidebar_position: 750
keywords:
  [editor, edit, save, source, preview, dev, codemirror, unsaved, ctrl-s]
---

# The page editor

`biac dev` can edit a page in the browser: the page's Markdown on the left, the page it renders on the right. You save with `Ctrl-s` and the right side updates in place, without a reload. The editor writes the page's file on disk, so a text editor, a `git diff` and the browser always agree.

The editor exists only while `biac dev` runs. [`biac build`, `biac preview` and `biac serve`](/ship/build-preview-serve) have no `Edit` link, no editor code and no address that writes a file.

## Open the editor

Every page has an **Edit** link in the header. It adds `edit=true` to the page's own address and keeps the filters you picked:

```text
/weekly-review?region=West            the page
/weekly-review?region=West&edit=true  the same page, with its source beside it
```

![The editor open beside the page it edits: the Markdown source on the left, the rendered page on the right, and the file name with "No unsaved changes" above the source](/data/page-editor-open.png)

The bar above the source names the file, for example `pages/ship/base-path.md`, and says where the buffer stands. **Done** in the header closes the editor and leaves the filters as they are. Any `edit` value but `false` opens the editor, so `?edit` alone works too. The key is lowercase: `?Edit` is an ordinary filter parameter.

From 1024 px wide the source and the page sit side by side and each scrolls on its own. Below that they stack, source first. In dark mode the source switches to a dark theme with the rest of the site.

## Edit and save

The source is highlighted as Markdown, and the body of a `sql` fence is highlighted as SQL. Typing a tag that has children, such as `<Details title="More">`, adds its closing tag; a tag you close yourself with `/>`, such as `<Table data="orders" />`, is left as you typed it.

`Ctrl-s` (`Cmd-s` on a Mac) writes the source to the page's file. The page on the right is swapped in place, so the cursor and scroll position in the source and the filters on the page stay where they were. The line above the source follows the buffer:

| It reads             | The buffer                                                   |
| -------------------- | ------------------------------------------------------------ |
| `Loading source…`    | Is being read from the file                                  |
| `No unsaved changes` | Matches the file                                             |
| `Unsaved changes`    | Holds text the file does not have yet                        |
| `Saving…`            | Is on its way to the file                                    |
| `Saved`              | Was written, and nothing was typed since                     |
| A failure message    | Was not written; see [When a save fails](#when-a-save-fails) |

The editor reads the file once, when it opens. If you also change the file in another program, close the editor with **Done** and open it again to read the new text.

### A page that does not compile

A broken page does not take the editor away. Save a half-typed tag and the right side shows what the compiler said, with the file, line and column, while the source stays open under your cursor:

![The editor open beside a compile error: the source on the left with the unfinished tag, and on the right the heading "This page failed to compile" with the file, line and column](/data/page-editor-compile-error.png)

The line above the source reads `Saved` all the same: the file was written, and the page is what failed. Fix the text and save again; the page comes back. A filter named `edit` is refused the same way, because `edit` is the editor's own address key. The [filters reference](/filters/filters-and-urls) explains how a filter's name becomes an address key.

## When a save fails

A failed save keeps your text in the buffer and puts the reason on the line above the source, for example `Saving "pages/weekly-review.md" failed: HTTP 404`. The message ends with the status:

| It ends with | Why                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HTTP 404`   | The file is gone, was renamed, or is not a `.md` or `.mdx` page. The editor saves existing pages; it never creates, renames or deletes one          |
| `HTTP 403`   | The request named another host than the one it reached, which happens behind a proxy that rewrites the host. Open the dev server at its own address |
| `HTTP 413`   | The page is over 1 MiB                                                                                                                              |

Only files under `pages/` can be saved. The address the editor writes to refuses a request that comes from another site or another local port, so a page open in a different tab cannot change your project.

## Leave with unsaved changes

While the buffer holds text the file does not, going to another page, or pressing **Done**, asks first:

```text
Leave this page? Your unsaved changes will be lost.
```

Press **Cancel** to stay and save. Reloading or closing the tab shows the browser's own prompt instead. A filter you change on the page does not count as leaving. A save that failed still counts as unsaved.
