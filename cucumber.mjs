// Cucumber config — official @cucumber/cucumber format. Plan-mandated
// (the integration tier) but with no reference-repo grounding:
// no research repo uses BDD, so this follows cucumber-js docs, not a port.
// ESM configs export the options DIRECTLY (no `default:` profile wrapper):
// from_file.js unwraps the module namespace, so a wrapper would be parsed
// as an unknown option and silently yield "0 scenarios" (measured).
export default {
  paths: ["test/integration/features/**/*.feature"],
  import: ["test/integration/features/step_definitions/**/*.ts"],
};
