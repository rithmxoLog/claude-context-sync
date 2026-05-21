// src/lib/logger.ts
import chalk from "chalk";
var quiet = false;
function setQuiet(value) {
  quiet = value;
}
var log = {
  info(message) {
    if (!quiet) console.log(chalk.cyan("\u2139"), message);
  },
  success(message) {
    if (!quiet) console.log(chalk.green("\u2714"), message);
  },
  warn(message) {
    if (!quiet) console.warn(chalk.yellow("\u26A0"), message);
  },
  error(message) {
    console.error(chalk.red("\u2716"), message);
  }
};

export {
  setQuiet,
  log
};
//# sourceMappingURL=chunk-ISJENZ3O.js.map