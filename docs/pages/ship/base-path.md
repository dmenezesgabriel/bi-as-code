---
title: Serve under a path prefix
icon: globe
sidebar_position: 710
keywords: [base, path, prefix, subpath, sub-path, deploy, url, host]
---

# Serve under a path prefix

By default biac builds a site for the root of its host, such as `https://example.com/`. Some hosts serve a site below a path instead, such as `https://example.com/sales/`. Set `base` in `biac.config.ts` to that path, build, and every address the site uses sits beneath it.

## Set the base

Put the path in the project's `biac.config.ts`. The [`base` reference](/pages/biac-config) lists the rules.

```ts
export default { base: "/sales" };
```

biac adds the closing `/`, so this site is served from `/sales/`. A `base` that does not start with `/` stops every command before it does any work, and the message names the line, the column and the value:

```text
Invalid biac.config.ts:1:18 — base: expected a path starting with "/", got "docs"
```

A relative base such as `./` is refused the same way. The build copies the site's shell into a folder for each page, and a relative path would resolve against a different folder in each copy.

## Build

Run the commands from the project directory, where `npm i -D biac` installed `biac`.

```sh
npx biac build
```

The files in `build/` sit where they always do: `index.html` and `assets/` are at its top, not inside a `sales/` folder. What changes is every address the files contain. The scripts and styles in `index.html` become `/sales/assets/...`, the favicon becomes `/sales/favicon.svg`, and the browser asks for the data files and the exported widget modules beneath `/sales/data/` and `/sales/widgets/`.

The prefix is written into the build, so a build serves only under the `base` it was made with. To serve the same site under another path, change `base` and run `biac build` again.

## Links between pages

Write a link to another page the way you would at the root of a host. A page that links to `/details` looks like this:

```md
See the [details page](/details).
```

The built page links to `/sales/details/`, and clicking it opens that page. The navigation links get the prefix the same way. Nothing in the Markdown changes when the prefix does.

## Check it with preview

`biac preview` serves `build/` beneath the same `base`, so you see the site at the address a host will give it:

```sh
npx biac preview
```

It prints `http://localhost:4173/sales/`. Open that address: the page and its table load from `/sales/assets/` and `/sales/data/`.

| Request                 | `biac preview`              | `biac serve`                |
| ----------------------- | --------------------------- | --------------------------- |
| `/`                     | `302` to `/sales/`          | `302` to `/sales/`          |
| `/sales/`               | `200`, the site             | `200`, the site             |
| `/sales/details/`       | `200`, the page             | `200`, the page             |
| `/sales/details`        | `200`, the site             | `301` to `/sales/details/`  |
| `/sales/data/sales.csv` | `200`, the file             | `200`, the file             |
| `/data/sales.csv`       | `404`, nothing answers here | `404`, nothing answers here |
| `/sales`                | `404`                       | `404`                       |

Nothing answers outside the prefix, so a request that leaves it fails here with a `404`, not on the day you deploy. Link to `/sales/`, with the closing slash: neither command answers `/sales` on its own.

## Serve

`biac serve` answers under the same `base`, with the headers and the password that [Build, preview and serve](/ship/build-preview-serve) describes. The one-year `Cache-Control: immutable` applies to everything beneath `/sales/assets/`.

## Develop

`biac dev` ignores `base`. It prints `http://localhost:5173/` and serves every page from the root, so you write and review a project without the prefix. Run `biac preview` before you deploy: it is the one command that shows the prefixed site.

## Deploy

Copy the contents of `build/` to the place your host serves at the prefix, so that `https://example.com/sales/` returns `build/index.html`. Set `base` to that path and build again for each host path you deploy to.
