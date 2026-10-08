Feature: the demo pages compile their filter input widgets
  The input-bearing pages' compiled modules carry the <Dropdown>,
  <MultiSelect>, <Slider>, <DateRange>, <TextInput>, <Toggle> and
  <ButtonGroup> tags with the props that bind them to their page filters,
  and declare the fences those widgets read. Live interaction — picking
  options, URL writes, reload hydration — is browser-only and owned by
  test/e2e-browser/filter-inputs.spec.ts.

  Scenario: the input-bearing page modules compile their input widgets and fences
    Given the shipped project with its data files
    When biac dev serves the project
    Then the weekly-review module renders a Dropdown bound to the region filter
    And the weekly-review module renders the amount, ordered, q and large_orders inputs
    And the weekly-review module's order_detail block interpolates the q and large_orders params
    And the allocation module renders a MultiSelect and a channel-filtered Table
    And the allocation module renders a ButtonGroup bound to the channel filter
    And the allocation module has channel_mix and no sql tables
