Feature: page chrome derives from pages/ front-matter and biac.config.ts
  The shipped example project's chrome, checked over HTTP: the page
  manifest carries the nav tree, the config module carries the site
  config, the HTML shell wires theme and favicon, and a config edit
  reloads the app.

  Scenario: serve nav, config, theme script and favicon; reload on config edit
    Given the shipped example project
    When biac dev serves it
    Then the manifest module serves the nav tree with titles, positions and the titled nested group
    And the config module serves the configured title and page layout
    And the HTML shell wires the pre-paint theme script and the favicon
    And the favicon serves
    When I rename the site to "ACME" in biac.config.ts
    Then the config module serves the new title
    When I title the nested folder "Planning" in biac.config.ts
    Then the manifest module names the nested folder "Planning"
    And the server stops on SIGINT
