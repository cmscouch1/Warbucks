import { runSelfTest } from "./selftest.js";

const result = runSelfTest();
if (!result.passed) {
  for (const failure of result.failures) {
    process.stderr.write(`${failure.name}: ${failure.detail}\n`);
  }
  process.exit(1);
}
process.stdout.write(`self-test passed (${result.failures.length} failures)\n`);
