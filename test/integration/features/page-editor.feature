Feature: biac dev serves the page editor
  The editor opens on a page's own URL with `?edit`, and the dev server
  compiles the lazily loaded editor module the browser then requests.

  Scenario: a page's edit URL and the editor module are served
    Given a project with an index page and a nested page
    When I start the dev server
    Then the nested page's edit URL serves the SPA shell
    And the dev server compiles the page editor module
    And the dev server exits cleanly on SIGINT
