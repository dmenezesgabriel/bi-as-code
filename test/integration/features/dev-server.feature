Feature: biac dev serves a project's pages directory over HTTP
  The demo path from the user's seat: point the CLI at a project, get a dev
  server where every markdown page is a route and edits land live.

  Scenario: serve, compile, discover added pages, shut down cleanly
    Given a project with an index page and a nested page
    When I start the dev server
    Then the root URL serves the SPA shell
    And the index page module compiles its title and sql block
    And the page manifest lists the index and nested routes
    When I add a page file to the project
    Then the page manifest serves the new route
    And the dev server exits cleanly on SIGINT

  Scenario: save a page's source through the dev page-source endpoint
    Given a project with an index page and a nested page
    When I start the dev server
    And I save "# Saved from the browser" as the nested page's source
    Then the nested page file on disk reads "# Saved from the browser"
    And the nested page module compiles "Saved from the browser"
    And the dev server exits cleanly on SIGINT

  Scenario: a saved query file recompiles the page that reads it
    Given a project whose index page reads the query file "totals" holding "select 'before' as x"
    When I start the dev server
    Then the index page module compiles "select 'before' as x"
    When I save "select 'after' as x" as the query file "totals"
    Then the index page module compiles "select 'after' as x"
    And the dev server exits cleanly on SIGINT

  Scenario: a saved translations file reaches the page that reads it
    Given a project whose index page reads the translation "title" holding "Before"
    When I start the dev server
    Then the translations module serves "Before"
    When I save "After" as the translation "title"
    Then the translations module serves "After"
    And the dev server exits cleanly on SIGINT
