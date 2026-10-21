# ADR-0023 — A framed page reports its height only to a listed parent, addressed to its exact origin

Status: accepted
Date: 2026-10-21

## Context

A page framed by an origin `biac.config.ts` `embed.origins` lists ([ADR-0022](0022-framing-is-denied-unless-the-project-lists-the-origin.md)) sits in an `<iframe>` whose height the host page sets. Content height depends on the frame's width (prose wraps, a narrow frame stacks), so a fixed height either cuts the page off or leaves a gap. Only the framed page can measure its own content; a cross-origin host cannot read it. So the page has to tell its parent, and the parent sets `iframe.height`.

The page is not the one that decides who frames it, since the browser enforces `frame-ancestors`. But a static build copied to a host that sends no header can be framed by anyone. Whatever the page posts must still reach only a listed origin.

## Decision drivers

- Nothing leaves the page for a parent the project did not list, whatever server sent the page.
- The host writes one short listener with an origin check, the one MDN prescribes, and nothing else: no handshake, no library.
- The reported height is exactly the frame height that shows the page without a scrollbar, and it shrinks as well as grows.
- No console noise in either frame.

## Facts

| Fact                                                                                                                                                                                                                                                                                                                                                                                   | Source                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "Always specify an exact target origin, not `*`, when you use `postMessage` to dispatch data to other windows"; a receiver "must first check the identity of the sender of the message, using the `origin`"                                                                                                                                                                            | https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage       |
| A message is dispatched only when the target origin "match[es] exactly (including scheme, hostname, and port)"                                                                                                                                                                                                                                                                         | same                                                                      |
| `location.ancestorOrigins` lists the ancestors' origins, nearest first; Baseline since February 2026                                                                                                                                                                                                                                                                                   | https://developer.mozilla.org/en-US/docs/Web/API/Location/ancestorOrigins |
| An iframe `referrerpolicy` of `no-referrer` (or `same-origin`, cross-origin) redacts the parent's entry to an opaque origin serialized as `"null"`                                                                                                                                                                                                                                     | same                                                                      |
| Measured 2026-10-21 (`playwright-cli`, host `http://localhost:8901` framing `http://localhost:8902`): Chromium 152 and Firefox 156 both give `ancestorOrigins[0] === "http://localhost:8901"` and `document.referrer === "http://localhost:8901/"`; under `referrerpolicy="no-referrer"` the referrer is `""`, Firefox's `ancestorOrigins[0]` is `"null"`, Chromium's stays the origin | measured                                                                  |
| Inside an iframe `100vh` is the frame's own height: measured 2026-10-21, a `min-h-screen` wrapper in a 496 px frame computes `min-height: 496px`, so it is never shorter than the frame the host last set                                                                                                                                                                              | measured                                                                  |

## Options considered

| Question                       | Option                                                                  | Pro                                                         | Con                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| How the page learns its parent | `postMessage(…, "*")`                                                   | No origin needed                                            | Any framer reads the page's height; MDN's first warning                                                                                    |
|                                | One post per listed origin                                              | No detection; the browser drops the mismatches              | Every page load sends a message per listed origin; one listed parent sees only its own, but the rest are wasted and depend on silent drops |
|                                | A handshake message from the parent                                     | Works in every browser                                      | Every host writes more code, and a message the page receives must be validated in turn                                                     |
|                                | `ancestorOrigins[0]`, else the referrer's origin, posted only if listed | One post, exact origin, nothing for the host to send        | A browser that has neither, or a masked `"null"`, gets no height: it fails closed                                                          |
| What is measured               | `document.documentElement` height                                       | The whole document                                          | With a viewport-tall minimum it never shrinks below the frame the host last set                                                            |
|                                | The shell's content wrapper, without its viewport minimum while framed  | Exactly the content's height; shrinks when the content does | The shell drops `min-h-screen` on that wrapper while framed                                                                                |
| Message shape                  | `{ height }`                                                            | Shortest                                                    | A host with other frames cannot tell biac's message from another                                                                           |
|                                | `{ type: "biac:height", height }`                                       | A host filters on `type` as well as `origin`                | One more field                                                                                                                             |

## Decision

`virtual:biac-config` carries `embed.origins` to the browser; the `frame-ancestors` header already publishes them.

When the page is framed (`window.parent !== window`), `AppShell` (`src/web/src/App.tsx`) drops `min-h-screen` from its content wrapper. `useFrameHeightReporter` (`src/web/src/features/chrome/frame-height.ts`) takes the parent's origin from `location.ancestorOrigins[0]`, falling back to the origin of `document.referrer`. If that origin is in `embed.origins`, a `ResizeObserver` on the wrapper posts `{ type: "biac:height", height }` (its `scrollHeight` in CSS pixels) with that origin as `targetOrigin` each time the height changes. Otherwise nothing is observed and nothing is posted.

The host page's side:

```js
addEventListener("message", (event) => {
  if (
    event.origin !== "https://biac.example.com" ||
    event.data?.type !== "biac:height"
  )
    return;
  document.getElementById("report").height = event.data.height;
});
```

## Consequences

- A parent the project did not list never receives the page's height, even when a host that sends no `frame-ancestors` header serves the build.
- A host that sets `referrerpolicy="no-referrer"` on its iframe gets no height in Firefox (the parent's origin is masked as `"null"`) and keeps the iframe's own height; it must drop that policy to be sized.
- The page posts no other message and accepts none: there is no channel from the host into the page.
- Debouncing is left to `ResizeObserver`, which delivers at most once per rendered frame; an unchanged height is not re-sent.
