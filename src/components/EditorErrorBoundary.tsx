import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; onReset: () => void };
type State = { error: Error | null };

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("EditorView", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="page editor-page editor-opening">
          <p className="editor-opening-title" role="alert">
            L&apos;éditeur n&apos;a pas pu s&apos;afficher.
          </p>
          <p className="meta">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            Retour à l&apos;accueil
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
