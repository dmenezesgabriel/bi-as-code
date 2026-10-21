Feature: site search indexes the pages under pages/
  The shipped example project's search documents, checked over HTTP: the
  search module serves every page's prose under its sidebar name, and a
  page whose front-matter `index` is not a boolean fails to compile.

  Scenario: serve the search documents; reject a non-boolean index
    Given the shipped example project
    When biac dev serves it
    Then the search module serves Allocation with its body word "fulfilment"
    When I set "index: no way" in the Allocation page's front-matter
    Then the Allocation page module fails naming "index: expected true | false"
    And the server stops on SIGINT
