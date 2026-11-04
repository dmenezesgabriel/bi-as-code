---
title: Translations
icon: globe
sidebar_position: 205
keywords:
  [
    translations,
    translation,
    language,
    languages,
    i18n,
    localisation,
    localization,
    locale,
    french,
    lang,
    menu,
    fallback,
    "translations.yaml",
  ]
---

# Translations

A project that serves readers in more than one language keeps its page text in `translations.yaml` at the project root. A page reads a key where its text goes, and a query reads a key as a value. The reader picks the language from a menu in the header, and every page that reads a key changes language in place. The docs site declares English and French, which is why the menu is in the header of this page.

## One file, one block per language

The top-level keys are two-letter ISO 639-1 language codes, such as `en` and `fr`. Under each code come the keys, as text or as a nested map, and a number or a boolean is read as its text. This is the whole file of this site:

```yaml
en:
  greeting: Hello
  welcome: "$t(greeting), and welcome to the biac docs"
  fallback_note: This sentence has no French translation, so a French reader sees it in English.
  weighed: Penguins that were weighed
  sex:
    female: Female
    male: Male
fr:
  greeting: Bonjour
  welcome: "$t(greeting), et bienvenue dans la documentation de biac"
  weighed: Pingouins qu'on a pesés
  sex:
    female: Femelle
    male: Mâle
```

A project without the file has no languages: the header shows no menu, and a page that spells out a key fails to compile, because there is no key to find. With one language the menu is hidden too, because there is nothing to choose.

The first language in the file is the default. A key that a language leaves out shows the text of `en`, so a half-translated site never shows an empty heading. Put `en` in the file whenever other languages leave keys out, because `en` is the language that fills the gaps.

## Keys in text and in tags

`{$translations.key}` in a page puts the key's text in the page. A nested key is written with dots, as in `{$translations.sex.female}`.

```mdx echo
{$translations.welcome}
```

A tag takes a key in an attribute the same way, with the braces around the whole value.

```mdx echo
<BigValue data="weighed" column="penguins" title={$translations.weighed} />
```

A key that the page spells out must exist in every language the file declares, and a key that is missing fails the page at the position of the key, with the closest key as a suggestion. A key that the page builds when it runs is not checked.

## Keys in SQL

`{{$translations.key}}` in a `sql` fence or a [query file](/sql/query-files) puts the key's text in the query as a bound value, the way [`{{params.id}}`](/sql/params-in-queries) is bound. The text is never pasted into the SQL, so an apostrophe in a translation cannot break the query or change it. This fence names the label of each sex in the language of the page:

```sql by_sex echo
select
  case sex
    when 'female' then {{$translations.sex.female}}
    when 'male' then {{$translations.sex.male}}
  end as label,
  count(*) as penguins
from penguins
where sex is not null
group by sex
order by sex
```

```mdx echo
<Table data="by_sex" />
```

The French text of the next fence, `Pingouins qu'on a pesés`, holds an apostrophe, and the query is the same in both languages:

```sql weighed echo
select {{$translations.weighed}} as label, count(body_mass_g) as penguins
from penguins
```

```mdx echo
<Table data="weighed" />
```

A bound value is a value and never a name, so a column cannot be chosen by writing `label_{{$translations.langcode}}`. Choose it with a `case` on a key that holds the language code:

```text
case {{$translations.langcode}} when 'fr' then label_fr else label_en end
```

## Keys that refer to keys

A value may contain `$t(key)`, which becomes the text of that key in the same language, as the [i18next nesting syntax](https://www.i18next.com/translation-function/nesting) defines it. `welcome` in the file above is `"$t(greeting), and welcome to the biac docs"`, so it reads `Hello, and welcome to the biac docs` in English and `Bonjour, et bienvenue dans la documentation de biac` in French.

## Missing keys

`fallback_note` exists only in `en`. In French it shows the English text:

```mdx echo
{$translations.fallback_note}
```

## Which language a reader sees

The browser decides, because a built site is a folder of files with no server to read the request. The first of these that names a language of the file wins:

| Order | Source                                      | Lasts                         |
| ----- | ------------------------------------------- | ----------------------------- |
| 1     | `lang` in the address, as in `?lang=fr`     | the page it opens             |
| 2     | the last language picked in the header menu | the browser, across tabs      |
| 3     | the first language of `translations.yaml`   | until one of the above is set |

A pick in the menu is stored and written into the address as `lang`, and the other filters in the address stay. A link that carries `?lang=fr` shows French to whoever opens it, and following a link on that page without `?lang=` shows the stored pick or the default. [This page in French](/sql/translations?lang=fr) is such a link.

The menu lists each language by its own name, such as `English` and `Français`, with the current one checked. The `lang` attribute of the `<html>` element follows the language, so a screen reader speaks the page in it.

`lang` belongs to this feature, so a filter cannot have `lang` for its `id`. The page fails to compile with this message:

```text
Reserved filter id "lang" on <Dropdown id> — "lang" chooses the page language; choose another id
```

Numbers and dates keep their English format in every language.

## Search

The site search indexes the text of each page in the language the reader chose, so a French reader searches French text.

## Errors

A `translations.yaml` that is broken stops only the pages that read it, with the file, the line and the column. The pages that read no key render, and the menu is empty until the file is saved again. The four shapes it rejects:

```text
Invalid translations.yaml:1:1 — "english" is not an ISO 639-1 language code (expected two letters such as en or fr)
```

```text
Invalid translations.yaml:1:5 — en must map keys to translations, got string
```

```text
Invalid translations.yaml:3:5 — en.colors must be a string, number, boolean or nested map, got a list
```

```text
Invalid translations.yaml:1:1 — the file must map language codes to translations, got a list
```

A page that spells out a key the file does not have fails to compile at the key:

```text
Undefined translation key: $translations.weigehd (did you mean $translations.weighed?)
```

A `sql` fence that names a key which is missing, or which holds a map instead of text, shows this under the block and does not run:

```text
Undefined translation key {{$translations.nope}} — expected a key of translations.yaml whose value is text
```
