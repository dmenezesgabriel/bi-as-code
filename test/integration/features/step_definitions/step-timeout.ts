import { setDefaultTimeout } from "@cucumber/cucumber";
import { EVENTUALLY_TIMEOUT_MS } from "../../../lib/http.ts";

// Cucumber stops a step at 5 s by default, before a step polling with
// `eventually` reaches its own deadline: a slow config reload then fails as
// a bare timeout instead of finishing, or failing with the poll's last error.
setDefaultTimeout(EVENTUALLY_TIMEOUT_MS + 5_000);
