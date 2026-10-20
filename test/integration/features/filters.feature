Feature: the weekly-review demo page scopes regions through widget filters
  The demo path's HTTP surface: the compiled weekly-review module carries the
  fences its data widgets filter without the region interpolation, while the
  index page keeps the raw {{params.region}} surface. Live filtering is
  browser-only — the e2e-browser spec owns that half.

  Scenario: the weekly-review module's filtered fences compile without the region param
    Given the shipped project with its data files
    When biac dev serves the project
    Then the weekly-review module's region_orders query file, region_week and order_amounts blocks carry no region param
    And the index page module declares its orders table and named block
