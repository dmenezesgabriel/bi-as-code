---
title: Embeds
icon: package
sidebar_position: 740
keywords:
  [
    embed,
    iframe,
    cors,
    frame-ancestors,
    widget,
    module,
    export,
    postmessage,
    data,
  ]
---

# Embeds

A biac site can show up inside another site. There are three ways, and a project can use all of them:

| Way                | The other site gets                                      | You grant it with                   |
| ------------------ | -------------------------------------------------------- | ----------------------------------- |
| An iframe          | A whole page, without the sidebar or the header          | `embed.origins`                     |
| A data file        | The bytes of a file under `/data/`, read by its own code | `embed.dataOrigins`                 |
| An exported widget | One chart, mounted into an element of its own page       | `embed.dataOrigins` and `export=""` |

Everything is denied until you list the other site's origin. The [`embed` reference](/pages/biac-config) describes how an origin is written. The two lists are separate on purpose: a site that may frame your pages cannot read your raw data, and the other way round.

Here is one `biac.config.ts` for the rest of this guide. `https://intranet.example.com` frames pages, and `https://notebook.example.com` reads data and mounts widgets:

```ts
export default {
  embed: {
    origins: ["https://intranet.example.com"],
    dataOrigins: ["https://notebook.example.com"],
  },
};
```

## Show a page in an iframe

A page in an iframe should not draw its own navigation. Three front-matter keys remove it:

```md
---
title: Weekly revenue (embed)
sidebar: false
header: false
table_of_contents: false
---
```

The [Markdown pages reference](/pages/markdown-pages) lists every key. The example project has this page as `pages/embed-weekly-revenue.md`.

Every response from `biac dev`, `biac preview` and `biac serve` carries the framing policy. With the config above, a page answers like this:

```http
Content-Security-Policy: frame-ancestors https://intranet.example.com
X-Frame-Options: DENY
```

`X-Frame-Options: DENY` stays in the response for old browsers. A browser that knows `frame-ancestors` ignores it. With an empty `origins` list the first line reads `frame-ancestors 'none'`, and nobody can frame the site, not even the site itself.

On the other site, put the page in an iframe:

```html
<iframe
  id="weekly-revenue"
  src="https://biac.example.com/embed-weekly-revenue/"
  style="width: 100%; border: 0"
></iframe>
```

### Size the frame to the page

An iframe does not grow with what is inside it. A framed biac page sends its height to the page that holds it each time the height changes, as `{ type: "biac:height", height }`. It sends the message only to a parent whose origin is in `origins`, so any other site learns nothing. Listen for it on the host page:

```js
const frame = document.querySelector("#weekly-revenue");
window.addEventListener("message", (event) => {
  if (event.origin !== "https://biac.example.com") return;
  if (event.data?.type !== "biac:height") return;
  frame.style.height = `${event.data.height}px`;
});
```

Check `event.origin` before you trust the message, as the first line does.

## Read a data file

Every file in `data/` and every output of a data loader is served from `/data/` at a stable address, with the media type its extension implies:

| Extension  | Media type                          |
| ---------- | ----------------------------------- |
| `.csv`     | `text/csv`                          |
| `.tsv`     | `text/tab-separated-values`         |
| `.json`    | `application/json`                  |
| `.parquet` | `application/vnd.apache.parquet`    |
| `.arrow`   | `application/vnd.apache.arrow.file` |

Any other extension is served as `application/octet-stream`.

A script on another site may read these files only when its origin is in `dataOrigins`. The response then names that origin, and nothing else:

```http
Vary: Origin
Access-Control-Allow-Origin: https://notebook.example.com
Access-Control-Expose-Headers: Content-Range, Accept-Ranges
```

An origin that is not listed gets `Vary: Origin` alone, and the browser refuses to hand its script the response. biac never answers with `*`. The last line lets a script read the `Content-Range` of a partial read, which a Parquet reader uses to fetch only the part of a file it needs.

On the notebook site, fetch the file by its address:

```js
const response = await fetch("https://biac.example.com/data/orders.csv");
const rows = (await response.text()).split("\n");
```

## Mount a widget

A page can export one of its widgets as a JavaScript module. Another site imports the module and mounts the chart into an element of its own page, with no iframe and no page chrome. Only `BarChart` can be exported today.

Mark the widget with `export` and a name. The widget's query is one of the page's SQL fences, and the tag must name it in `data`:

````md
---
title: Orders dashboard
sql:
  orders: data/orders.csv
---

```sql revenue_by_region
select region, sum(amount) as revenue
from orders
group by region
```

<BarChart data="revenue_by_region" x="region" y="revenue" title="Revenue by region" export="revenue-by-region" />
````

`biac build` writes one module for each export and prints its path:

```sh
bin/biac build my-site
```

The module for this widget is `build/widgets/revenue-by-region.js`, which the published site serves at:

```text
https://biac.example.com/widgets/revenue-by-region.js
```

The name is part of that address. Rename the export and every site that imports it breaks.

On the notebook site, import the module and call its default export with the element to fill:

```html
<div id="chart"></div>
<script type="module">
  import mountWidget from "https://biac.example.com/widgets/revenue-by-region.js";

  const stop = mountWidget(document.querySelector("#chart"), { mode: "dark" });
  // stop() removes the widget and releases its query engine.
</script>
```

`mode` is `"light"` or `"dark"` and defaults to `"light"`. The widget draws inside a shadow root, so its styles and the notebook page's styles do not reach each other. An element hosts one widget at a time: call `stop()` before you mount into it again.

The widget runs its own query in the visitor's browser. It reads the data files from `https://biac.example.com/data/`, not from the notebook site, so the notebook origin must be in `dataOrigins`. That list also governs the import of the module itself.

### What the build refuses

The build fails, naming the page, the line and the tag, when an export cannot be baked. The name must be lowercase letters, digits and hyphens, because it becomes a file name:

```text
pages/revenue.md:13:85-13:101: export="Revenue" on <BarChart> — expected a lowercase kebab-case name (letters, digits, hyphens)
```

An exported widget has no filters to listen to, so `filters` and `select` are refused:

```text
pages/revenue.md:13:112-13:127: export="revenue-by-region" on <BarChart> — an exported widget cannot carry filters; remove select or drop the export
```

The build also refuses a widget tag other than `BarChart`, a `data` that names no SQL fence on the page, an attribute whose value is computed instead of written out, and two pages that export the same name.

### The size of a module

A module carries everything it needs, so the notebook page needs one `import` and nothing else. That includes the query engine, which makes it large: the module for the example project is about 102 MB, 25 MB compressed. Nearly all of it is the engine's WebAssembly. A project that exports several widgets shares that engine between them as extra files under `widgets/`.

## Serve the headers

`biac dev`, `biac preview` and `biac serve` send every header on this page. `biac dev` serves no `/widgets/`, because a module exists only in a build, so try an export against `biac preview`.

A static host that serves `build/` yourself must send them too:

| Path         | Headers to send for a listed origin                                      |
| ------------ | ------------------------------------------------------------------------ |
| every page   | `Content-Security-Policy: frame-ancestors …` and `X-Frame-Options: DENY` |
| `/data/*`    | the three CORS headers above, with `Content-Type` from the table above   |
| `/widgets/*` | the same three CORS headers                                              |

Send `Vary: Origin` on every response that depends on the caller's origin, or a shared cache will answer one site with another site's headers. When you serve under a path prefix, the paths above sit beneath it; see [Serve under a path prefix](/ship/base-path).
