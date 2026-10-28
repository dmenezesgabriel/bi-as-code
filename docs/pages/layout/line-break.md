---
title: Line break
icon: file
sidebar_position: 403
keywords: [spacer, vertical space, gap, whitespace, blank lines, LineBreak]
---

# Line break

`<LineBreak>` adds vertical space: one or more blank lines between two blocks that would otherwise sit close together. Markdown collapses extra blank lines in the source, so a line break is how a page asks for more room.

## Examples

### One line

With no props, a line break adds one blank line.

```mdx echo
The paragraph above the break.

<LineBreak />

The paragraph below the break.
```

### Several lines

`lines` sets how many blank lines to add. Zero or a negative number adds none.

```mdx echo
The paragraph above the break.

<LineBreak lines={3} />

The paragraph three lines further down.
```

## Props

| Prop    | Type   | Default | What it does                |
| ------- | ------ | ------- | --------------------------- |
| `lines` | number | `1`     | How many blank lines to add |
