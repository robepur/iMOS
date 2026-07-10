import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; message: string }

/**
 * ErrorBoundary — wraps sensitive feature consoles.
 * Failures fail closed: no decrypted information is exposed.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  override componentDidCatch(error: unknown) {
    console.error('[iMOS ErrorBoundary]', error)
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="errorBoundary panel" role="alert">
          <p className="eyebrow">SYSTEM ERROR</p>
          <h3>This section is unavailable.</h3>
          <p>{this.state.message}</p>
          <button onClick={() => this.setState({ hasError: false, message: '' })}>RETRY</button>
        </div>
      )
    }
    return this.props.children
  }
}
