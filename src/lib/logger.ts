import chalk from 'chalk'

let quiet = false

export function setQuiet(value: boolean): void {
  quiet = value
}

export const log = {
  info(message: string): void {
    if (!quiet) console.log(chalk.cyan('ℹ'), message)
  },
  success(message: string): void {
    if (!quiet) console.log(chalk.green('✔'), message)
  },
  warn(message: string): void {
    if (!quiet) console.warn(chalk.yellow('⚠'), message)
  },
  error(message: string): void {
    console.error(chalk.red('✖'), message)
  },
}
