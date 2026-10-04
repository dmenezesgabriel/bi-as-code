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
