import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { NgClass } from '@angular/common'
import { Game } from '../games.service'
import { GameCardComponent } from '../game-card.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

/**
 * Generic "heading + game grid + optional 换一批" block used by the recent /
 * latest / popular / featured-editor sections of the games home page.
 *
 * Pass a `shuffleLabel` to render the heading-row "换一批" pill (emits `shuffle`);
 * omit it to hide the action. `compact` toggles the compact heading style.
 * `sectionClass` adds extra classes to the inner <section> (e.g. for the
 * featured-editor ::before bar decoration defined in the parent's SCSS).
 */
@Component({
  selector: 'my-game-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GlobalIconComponent, NgClass ],
  template: `
    @if (games().length) {
      <section class="game-section" [ngClass]="sectionClass()" [class.compact-game-section]="compact()">
        <div class="game-section-heading game-section-heading-row" [class.compact-section-heading]="compact()">
          <h2>{{ heading() }}</h2>
          @if (shuffleLabel() && games().length) {
            <button class="section-shuffle" type="button" [attr.aria-label]="'换一批' + heading()" (click)="shuffle.emit()">
              <my-global-icon class="section-shuffle-icon" iconName="refresh" />
              <span>{{ shuffleLabel() }}</span>
            </button>
          }
        </div>
        <div class="game-grid">
          @for (game of games(); track game.uuid) {
            <my-game-card [game]="game" [searchTerm]="searchTerm()" />
          }
        </div>
      </section>
    }
  `,
  styles: [ `
    .game-grid {
      display: grid;
      column-gap: 1rem;
      row-gap: 0.9rem;
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    /* 标题行：标题居左，换一批胶囊居右（B 站分区栏布局） */
    .game-section-heading-row {
      align-items: center;
      display: flex;
      gap: 0.6rem;
      justify-content: space-between;
    }

    .game-section-heading-row h2 {
      align-items: center;
      display: inline-flex;
      gap: 0.55rem;
    }

    .game-section-heading-row h2::before {
      background: var(--game-brand);
      border-radius: var(--game-radius-pill);
      content: '';
      display: inline-block;
      flex: 0 0 0.22rem;
      height: 1.05rem;
    }

    .section-shuffle {
      align-items: center;
      background: var(--game-surface-alt);
      border: 0;
      border-radius: var(--game-radius-pill);
      color: var(--game-text-secondary);
      cursor: pointer;
      display: inline-flex;
      font-size: var(--game-font-size-sm);
      font-weight: 600;
      gap: 0.3rem;
      justify-content: center;
      min-height: 2rem;
      padding: 0.3rem 0.8rem;
      transition: background-color var(--game-dur-fast) var(--game-ease),
        color var(--game-dur-fast) var(--game-ease),
        transform var(--game-dur-fast) var(--game-ease);
    }

    .section-shuffle:hover,
    .section-shuffle:focus-visible {
      background: var(--game-brand-soft);
      color: var(--game-brand-deep);
      outline: none;
    }

    .section-shuffle:hover .section-shuffle-icon,
    .section-shuffle:focus-visible .section-shuffle-icon {
      animation: shuffleSpin 500ms ease;
    }

    .section-shuffle:active {
      transform: scale(0.96);
    }

    .section-shuffle:focus-visible {
      outline: 2px solid var(--game-brand-glow);
      outline-offset: 2px;
    }

    .section-shuffle-icon {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      height: 0.9rem;
      justify-content: center;
      width: 0.9rem;
    }

    .section-shuffle-icon ::ng-deep svg {
      display: block;
      height: 100% !important;
      stroke-width: 2.2;
      width: 100% !important;
    }

    /* Compact heading style (also defined in the host page SCSS for its own
       sections; duplicated here so emulated encapsulation styles this
       component's compact headings too). */
    .compact-section-heading {
      align-items: center;
      margin-bottom: 0.75rem;
      margin-top: 1.25rem;
    }

    .game-section-heading.compact-section-heading {
      margin-top: 1.25rem;
    }

    .compact-section-heading h2 {
      font-size: 1.25rem;
    }

    @keyframes shuffleSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @media (max-width: 1250px) {
      .game-grid { gap: 0.8rem; }
    }

    @media (max-width: 720px) {
      .game-grid { gap: 0.4rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 450px) {
      .game-grid { gap: 0.35rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .section-shuffle {
        transition: none;
      }

      .section-shuffle:hover .section-shuffle-icon,
      .section-shuffle:focus-visible .section-shuffle-icon {
        animation: none;
      }
    }
  ` ]
})
export class GameSectionComponent {
  readonly games = input<Game[]>([])
  readonly heading = input('')
  readonly searchTerm = input<string>('')
  /** When set, renders the heading-row "换一批" pill with this label. */
  readonly shuffleLabel = input<string | undefined>(undefined)
  readonly compact = input(false)
  /** Extra class(es) applied to the inner <section> for parent SCSS hooks. */
  readonly sectionClass = input<string>('')
  readonly shuffle = output()
}
