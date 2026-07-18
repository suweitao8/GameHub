import { Component, signal } from '@angular/core'

@Component({
  template: `
    <main class="legacy-feature-placeholder" aria-labelledby="legacy-feature-title">
      <button type="button" (click)="showNotImplemented()" aria-describedby="legacy-feature-description">
        <span class="placeholder-mark" aria-hidden="true">—</span>
        <span>
          <strong id="legacy-feature-title">功能暂未实现</strong>
        <small id="legacy-feature-description">该旧版页面已被 GameHub 屏蔽</small>
        </span>
      </button>
    </main>
    @if (notImplementedVisible()) {
      <div
        class="not-implemented-backdrop"
        role="presentation"
        tabindex="-1"
        (click)="closeNotImplemented()"
        (keydown.escape)="closeNotImplemented()"
      >
        <div
          class="not-implemented-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="not-implemented-title"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <strong id="not-implemented-title">功能暂未实现</strong>
          <p>当前版本已切换为 GameHub 游戏社区，该旧版页面暂不提供。</p>
          <button type="button" (click)="closeNotImplemented()">知道了</button>
        </div>
      </div>
    }
  `,
  styles: [ `
    .legacy-feature-placeholder {
      align-items: center;
      background: #f6f6f6;
      display: flex;
      justify-content: center;
      min-height: calc(100vh - 64px);
      padding: 2rem;
    }

    .legacy-feature-placeholder button {
      align-items: center;
      background: transparent;
      border: 0;
      color: #4e5969;
      cursor: pointer;
      display: inline-flex;
      gap: 0.75rem;
      padding: 0.5rem;
      text-align: left;
    }

    .legacy-feature-placeholder button:hover strong,
    .legacy-feature-placeholder button:focus-visible strong { color: #00aeec; }
    .legacy-feature-placeholder button:focus-visible { outline: 2px solid #00aeec; outline-offset: 4px; }
    .placeholder-mark {
      align-items: center;
      background: #e5f7ff;
      border-radius: 50%;
      color: #00aeec;
      display: inline-flex;
      font-size: 1.4rem;
      height: 2.5rem;
      justify-content: center;
      width: 2.5rem;
    }

    .legacy-feature-placeholder span:not(.placeholder-mark) { display: grid; gap: 0.2rem; }
    .legacy-feature-placeholder strong { font-size: 1rem; font-weight: 700; }
    .legacy-feature-placeholder small { color: #9499a1; font-size: 0.78rem; }
    .not-implemented-backdrop {
      align-items: center;
      background: rgb(25 30 40 / 28%);
      display: flex;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 100;
    }

    .not-implemented-dialog {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 12px 36px rgb(25 30 40 / 18%);
      color: #4e5969;
      max-width: 360px;
      padding: 1.25rem;
      width: calc(100% - 2rem);
    }

    .not-implemented-dialog p { color: #61666d; line-height: 1.6; margin: 0.65rem 0 1rem; }
    .not-implemented-dialog button {
      background: #00aeec;
      border: 0;
      border-radius: 6px;
      color: #fff;
      font-weight: 700;
      padding: 0.55rem 1rem;
    }
  ` ]
})
export class LegacyFeaturePlaceholderComponent {
  readonly notImplementedVisible = signal(false)

  showNotImplemented () {
    this.notImplementedVisible.set(true)
  }

  closeNotImplemented () {
    this.notImplementedVisible.set(false)
  }
}
