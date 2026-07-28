import React from "react";
import { clearDeploymentReloadGuard, requestFreshDeploymentReload } from "../utils/runtimeRecovery";

export class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (requestFreshDeploymentReload(error)) return;
    console.error("CRUISER render error", error, errorInfo);
  }

  handleReload = () => {
    clearDeploymentReloadGuard();
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#050505] px-5 text-neutral-100">
        <section className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[#111111] p-6 shadow-[0_0_70px_rgba(163,230,53,0.1)]">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-lime-400">CRUISER RECOVERY</p>
          <h1 className="mt-3 text-xl font-black">Uygulama yenilenmeli</h1>
          <p className="mt-2 text-sm leading-5 text-neutral-400">
            Yeni sürüm yüklenirken eski dosyalar tarayıcıda kalmış olabilir. Verilerin güvende; güncel sürümü açmak için uygulamayı yenile.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 min-h-12 w-full rounded-2xl bg-lime-400 px-4 font-bold text-black shadow-[0_0_24px_rgba(163,230,53,0.35)]"
          >
            Uygulamayı Yenile
          </button>
        </section>
      </main>
    );
  }
}
