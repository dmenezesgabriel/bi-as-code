---
title: Site search
icon: search
sidebar_position: 206
keywords:
  [
    search,
    find,
    finder,
    query,
    index,
    keywords,
    fuzzy,
    typo,
    prefix,
    shortcut,
    accent,
    sidebar,
  ]
---

# Site search

Every biac site has a search box in its sidebar. A reader types a word and the box lists the pages that contain it, best match first. There is nothing to configure: the box is built from the pages under `pages/`, and a page can opt out or add words with two front-matter keys.

The box in this site's sidebar is the one this page describes, and the examples below are queries to type into it. Under 1024 px the sidebar is a drawer: open it with the ☰ button.

## Using the box

The box sits under the site name, above the page links. Typing replaces the page links with the matching pages, in place; clearing the box brings the links back. Each result shows the page's sidebar title. The first result is highlighted, and the arrow keys move the highlight.

| Reader does                    | Result                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| Clicks a result                | Opens the page and clears the box                                     |
| Presses Enter                  | Opens the highlighted page, the first one until the arrows move it    |
| Presses `/`                    | Focuses the box, unless the reader is typing in another field         |
| Presses ⌘K or Ctrl-K           | Focuses the box from anywhere, even from another field, text selected |
| Presses Escape with a query    | Clears the box and keeps the focus                                    |
| Presses Escape in an empty box | Leaves the box                                                        |

Under 1024 px the sidebar is a drawer, and `/` or ⌘K opens it on the box. Escape clears the box first and closes the drawer on the second press. The [sidebar page](/pages/sidebar-contents-breadcrumbs) describes the drawer.

A line under the box reports where the search stands:

- `Loading…` while the search data is on its way.
- `1 result` or `3 results` once it has matched. The list holds every match, with no cap.
- `No results` when nothing matches.
- `Search is unavailable` when the search data failed to load. The page links stay usable.

## What the box searches

Each page is searched by three fields:

- Its sidebar title: the `title` front-matter key, or the file name turned into words.
- Its prose: headings, paragraphs, list items, table cells, link text and inline code. Code fences are left out, so the SQL of a query and the source of an example are not searched. A tag with a `data` attribute, such as a `Table` or a chart, is left out too, because what it shows comes from the data and changes with it. Layout tags such as `Callout` and `Details` keep their text.
- Its `keywords`.

`keywords` adds words the page does not otherwise contain, and `index: false` takes the page out of the results altogether: `Branded page example`, in the Pages section, sets it, so typing its name lists the pages that mention it and never that page. Both keys, and the errors a wrong value raises, are on [Markdown pages and front-matter](/pages/markdown-pages#search).

## How a query matches

- A match in the title or in the keywords counts four times as much as one in the prose, so a page named after the word comes first.
- A word you type matches the longer words it begins, so `hist` finds `histogram`.
- A word may be off by about 15% of its length, rounded to a whole letter. A four-letter word may miss by one letter, a ten-letter word by two, and a word of three letters or fewer must be exact.
- Case does not matter, and neither do accents: `resume` finds `résumé`.
- Only the first 15 letters of a word count, which keeps the search data small.
- A word with more than six digits, such as an order number or a key, is left out as noise.
- A query of several words finds the pages holding any of them, and the pages holding most of them come first.

## Try it

Type each query into the search box. The first result is the page named in the second column. The rules above explain each one. This page is listed too, further down, because it spells each query.

| Type           | First result | Why                                                                               |
| -------------- | ------------ | --------------------------------------------------------------------------------- |
| `histogramm`   | Histogram    | One letter too many is within the 15% a ten-letter word may miss.                 |
| `hist`         | Histogram    | A typed word matches the longer words it begins, and the title counts four times. |
| `localisation` | Translations | The word is one of that page's `keywords`; the text of that page never spells it. |
| `i18next`      | Translations | A word only the prose spells, in the name of a library the page links to.         |

## One search per language

A site with a `translations.yaml` has a search of the page text in each of its languages. The box searches the text in the language the page is shown in, so a French reader finds French words and an English word finds nothing there unless the French text spells it. A language the site does not declare is searched in the first declared language. Titles and keywords are the same in every language. See [Translations](/sql/translations) for how a language is chosen.

This sentence ends with a word that depends on the language: **{$translations.greeting}**. Type it into the box, then pick Français in the header menu and type the French word the sentence now ends with: the page is found each time, and not when the box holds the other language's word.

## When the search data loads

A site that nobody searches never downloads its search data. The pages' text and the search code are two separate files, and the browser fetches them the first time the box takes the focus. The index is then built in the browser, and it is built again if the reader switches language.

While `biac dev` runs, saving a page updates the open box without a reload: a new `keywords` entry or a new sentence can be searched a moment later. `biac build` writes the same data into the built site, so a deployed site searches as it does in development.

## A site without the box

The box is part of the sidebar. A project that sets `nav.sidebar: false` in `biac.config.ts`, or a page that sets `sidebar: false`, has no box on it and no `/` or ⌘K shortcut either. The keys are on [biac.config.ts](/pages/biac-config) and [Markdown pages and front-matter](/pages/markdown-pages).
