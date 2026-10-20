Feature: sql: sources serve data files and shape the compiled page modules
  The demo path's HTTP surface: /data/ serves the declared fixtures, page
  modules export their sql tables and named blocks, and the config-level
  table reaches a page that never re-declares it. Live query execution is
  browser-only — the e2e-browser spec owns that half.

  Scenario: data files, page sql metadata and the config table serve
    Given the shipped project with its data files
    When biac dev serves the project
    Then the orders parquet serves with parquet magic bytes
    And the channels csv serves with the csv content type
    And the index page module declares its orders table and named block
    And the weekly-review module exports the region_orders query file, region_share and weekly_trend
    And the config module declares the channels table
    And the allocation module has channel_mix and no sql tables
    And the data server stops on SIGINT
