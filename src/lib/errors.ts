export class AuthError extends Error {
  readonly exitCode = 2
  constructor(message = 'No token configured. Run `claude-sync init` first.') {
    super(message)
    this.name = 'AuthError'
  }
}

export class NetworkError extends Error {
  readonly exitCode = 3
  constructor(message: string, public readonly statusCode?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends Error {
  readonly exitCode = 1
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
