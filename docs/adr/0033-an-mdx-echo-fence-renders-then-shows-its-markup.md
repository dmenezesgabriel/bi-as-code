# ADR-0033 — An ` ```mdx echo ` fence renders its markup, then shows it, from one copy

Status: accepted
Date: 2026-10-27
Relates to: [ADR-0011](0011-a-named-sql-block-renders-nothing-unless-it-opts-in.md)

## Context

A page that teaches a widget has to show both the live widget and the markup that drew it. Written twice, once as JSX and once as a code fence, the two copies drift: the reader copies markup that no longer matches what they see. ADR-0011 already lets a ` ```sql ` fence opt into showing its own source with `echo`. A widget tag had no equivalent.

The facts that bind the design:

- `compilePage` (`src/engine/compile-page.ts`) runs a fixed remark chain: `remarkGfm`, then `remarkPageMetadata`, `remarkQueryFiles`, `remarkWidgetExports`, `remarkRejectReservedFilterIds`, `remarkRejectUnknownSearchMethod` and `remarkCheckTranslationKeys`. Each later plugin checks the JSX in the tree: `data=` query files, reserved filter ids, search methods, translation keys and exported widgets.
- A CommonMark fenced code block keeps its body verbatim and strips the fence's indent from each body line (https://spec.commonmark.org/0.31.2/#fenced-code-blocks). A fence body therefore cannot hold a three-backtick fence unless the outer fence is longer.
- The MDX parser reports positions relative to the text it parsed, so a parse of a fence body alone reports its lines relative to the fence, not to the page file.
- `pageProse` (`src/engine/page-search-text.ts`) parses the page body on its own and skips `code` nodes.

## Decision drivers

- One copy of the markup in the page file. What renders and what is shown cannot differ.
- Snippet markup is held to every check hand-written markup meets, with no second code path.
- An error in a snippet names its line in the page file.
- Reuse ADR-0011's grammar: a fence's info string carries its flags.

## Options considered

| Axis                 | Option                                                    | Pro                                                                         | Con                                                                                                        |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Snippet grammar      | A ` ```mdx echo ` fence                                   | Same info-string grammar as ` ```sql echo `; the body is already the source | A snippet that holds a ` ```sql ` fence needs a four-backtick outer fence                                  |
| Snippet grammar      | An `<Example>` wrapper whose children render              | No nested-fence rule                                                        | The engine has to slice the wrapper's source back out of the file, and the shown code loses its formatting |
| Output and code      | Output, then code, fixed                                  | Nothing more to learn; the reader sees the result first                     | No author choice                                                                                           |
| Output and code      | A switch for code above or below                          | Author choice                                                               | One more token, and a second layout to test                                                                |
| Where parsing occurs | A remark plugin right after `remarkGfm`, page's processor | Every later check sees the spliced JSX; MDX and GFM syntax match the page's | The plugin depends on its place in the chain                                                               |
| Where parsing occurs | A separate compile of each fence body                     | Independent of the chain                                                    | The snippet skips the page's checks or duplicates them                                                     |

## Decision

- **Grammar**: ` ```mdx echo ` renders its body as page markup, then shows the body as highlighted code. A plain ` ```mdx ` fence stays code-only. Any other info-string token after `mdx` fails the page at the fence's line with `Unknown mdx fence attribute "<token>" — expected \`mdx echo\``.
- **Splice**: `remarkSpliceMdxEcho` (`src/engine/mdx-echo-fence.ts`) parses the body with the page's own processor (`this.parse`), so it uses the same MDX and GFM syntax. It inserts the resulting nodes ahead of the fence, then clears the fence's `echo` meta, so the fence renders through the ordinary code-block path. It sits second in `compilePage`'s chain, right after `remarkGfm`, so every later check sees the spliced JSX exactly as it sees hand-written JSX.
- **Order**: output first, then code. There is no switch.
- **Positions**: every spliced node, and every JSX attribute, moves from body coordinates onto the page file: lines by the fence's start line, columns by its indent. A syntax error in the body is re-raised at its page-file line. A broken snippet, or a later check that rejects its markup, therefore names the line the author sees.
- **Nesting**: a snippet that holds a ` ```sql ` fence uses a four-backtick outer fence, per CommonMark.
- **Search**: the search index counts a snippet's prose zero times, because `pageProse` parses the original body and skips `code` nodes.

## Consequences

- An author writes the markup once. Editing it changes the live widget and the shown source together, on save in `biac dev`.
- Anything that walks a compiled page's tree for links or widgets has to run `remarkSpliceMdxEcho` in the same place, or it misses snippet markup. The internal-link check (ADR-0034) does.
- The fence cannot show markup without rendering it under the `echo` flag. A plain ` ```mdx ` fence covers that case.
