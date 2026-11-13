---
title: Build, preview and serve
icon: server
sidebar_position: 700
keywords:
  [build, preview, serve, deploy, static, production, port, host, auth, headers]
---

# Build, preview and serve

`biac dev` is for writing a project: it compiles each page as you open it. Three other commands turn the project into something other people can read. `biac build` writes a static site, `biac preview` shows that site on your own machine, and `biac serve` hosts it for readers. Each takes the project directory as its one optional argument and uses the current directory when you give none.

| Command        | What it does                                                     | Default address         | Checks a password           |
| -------------- | ---------------------------------------------------------------- | ----------------------- | --------------------------- |
| `biac build`   | Writes the whole site to `build/` and exits                      | none                    | no                          |
| `biac preview` | Serves `build/` the way a plain static host would, for a look    | `http://localhost:4173` | no                          |
| `biac serve`   | Serves `build/` to readers, with security headers and a password | `http://127.0.0.1:3000` | yes, when you set variables |

## Build

Run the commands from the project directory, where `npm i -D @biac/cli` installed the `biac` command.

```sh
npx biac build
```

It prints `biac build — wrote` and the path of `my-site/build`. The command empties `build/` first, so a page you removed does not linger.

`build/` holds everything a reader needs and nothing that runs on a server:

| Path                 | Holds                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `index.html`         | The page at `/`                                                                                |
| `<route>/index.html` | One copy of the site's shell per page, so a host with no rewrite rules answers every deep link |
| `404.html`           | The page a host shows for an address that matches no page                                      |
| `assets/`            | The site's scripts and styles, named by their content so they can be cached for good           |
| `data/`              | The project's data files, and the output of its data loaders                                   |
| `widgets/`           | One module for each exported widget, when a page exports any                                   |

Every query still runs in the reader's browser, so the site needs no database. You can copy `build/` to any static host.

The build exits `1` in three cases:

- A page does not compile. The error names the page file, the line and column, and what the compiler found, such as `4:1: Unexpected end of file after name`.
- A link between pages points at a route that does not exist. The error counts the broken links and lists each as the file and line of the link and the route it names, such as `pages/index.md:3 → /missing (no page serves this route)`.
- An image shows a file the build does not serve. The error counts the broken images and lists each as the file and line of the image and the path it names, such as `pages/index.md:5 → /data/gone.png (no file at data/gone.png)`.

Run `biac build` before you deploy, and treat a non-zero exit as a stop.

## Preview

```sh
npx biac preview
```

It prints the address and keeps running until you press Ctrl+C. Open it and click through the pages: they come from the files in `build/`, with no page compiled on the way, so what you see is what a static host will send.

Preview refuses to start when `build/` is missing and says to run `biac build` first. It listens on `localhost` only. It does not check a password and does not add the security headers that `biac serve` adds, so use it to look, not to share.

## Serve

```sh
npx biac serve
```

`biac serve` is the command to run on a server or in a container. It serves the same `build/`, and it adds what a public address needs:

- `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` on every response. The second keeps page addresses, which carry filter state, out of the `Referer` that other sites receive.
- A year-long `Cache-Control: immutable` on everything under `assets/`.
- A `404` with the site's own `404.html` for an address that matches no page, and a redirect from `/route` to `/route/`.
- Optional password protection, below.

| Command | Option   | Default     | Effect                                                            |
| ------- | -------- | ----------- | ----------------------------------------------------------------- |
| `serve` | `--host` | `127.0.0.1` | The address to bind. `0.0.0.0` listens on every network interface |
| `serve` | `--port` | `3000`      | The port to listen on                                             |

`biac preview` takes `--port` too, with default `4173`. Both commands stop with `Port 4173 is already in use` (or the port you named) when something else holds it; pass another `--port`.

### Passwords

`biac serve` reads its password from the environment, so no secret appears in a command line or a file in the project.

| Variable              | Effect                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `BIAC_BASIC_USER`     | The user name. Every path, data files included, asks for it                                 |
| `BIAC_BASIC_PASSWORD` | The password. Setting only one of the two counts as setting neither, and the server says so |
| `BIAC_AUTH_DISABLED`  | `true` or `1` turns the check off. Use it only behind a proxy that signs readers in         |

The server prints one line after its address that says which mode it started in: `auth: basic (user viewer)`, `auth: none (loopback only)` or `auth: DISABLED (BIAC_AUTH_DISABLED)`.

Binding anything other than `127.0.0.1`, `localhost` or `::1` without credentials or `BIAC_AUTH_DISABLED=true` stops the server before it listens. It exits `1` and names all three variables:

```sh
npx biac serve --host 0.0.0.0
```

```text
biac serve: refusing to serve beyond localhost (host "0.0.0.0") without auth — set BIAC_BASIC_USER and BIAC_BASIC_PASSWORD, keep --host on 127.0.0.1, or, on a trusted private network only, set BIAC_AUTH_DISABLED=true
```

Give the server credentials and it starts:

```sh
BIAC_BASIC_USER=viewer BIAC_BASIC_PASSWORD=s3cret npx biac serve --host 0.0.0.0
```

Basic auth sends the password with every request, and `biac serve` speaks plain HTTP. Put a proxy that terminates HTTPS in front of it before a reader types a password.
