import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { NgClass } from '@angular/common'
import { Game } from '../games.service'
import { GameCardComponent } from '../game-card.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

/**
 * Generic "heading + game grid + optional 换一批" block used by the recent /
 * latest / popular / featured-editor sections of the games home page.
 *
 * Pass a `shuffleLabel` to render the side "换一批" action (emits `shuffle`);
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
        <div class="game-section-heading" [class.compact-section-heading]="compact()">
          <h2>{{ heading() }}</h2>
        </div>
        <div class="section-with-side-action">
          <div class="game-grid">
            @for (game of games(); track game.uuid) {
              <my-game-card [game]="game" [searchTerm]="searchTerm()" />
            }
          </div>
          @if (shuffleLabel() && games().length) {
            <button class="section-side-action" type="button" [attr.aria-label]="'换一批' + heading()" (click)="shuffle.emit()">
              <my-global-icon class="section-side-action-icon" iconName="refresh" />
              <span class="section-side-action-label">{{ shuffleLabel() }}</span>
            </button>
          }
        </div>
      </section>
    }
  `,
  styles: [ `
    .game-grid {
      display: grid;
      column-gap: 1rem;
      row-gap: 0.62rem;
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .section-with-side-action {
      min-width: 0;
      padding-right: 2.9rem;
      position: relative;
    }

    .section-side-action {
      align-items: center;
      background: #f6f7f8;
      border: 1px solid #e3e5e7;
      border-radius: 6px;
      color: #646464;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      justify-content: center;
      min-height: 5rem;
      padding: 0.45rem 0.2rem;
      position: absolute;
      right: 0;
      top: 0;
      transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 120ms ease;
      width: 2.25rem;
    }

    .section-side-action:hover,
    .section-side-action:focus-visible {
      background: #ecf9ff;
      border-color: #b6e5f8;
      box-shadow: 0 1px 4px rgb(0 174 236 / 12%);
      color: #00aeec;
      outline: none;
    }

    .section-side-action:hover .section-side-action-icon,
    .section-side-action:focus-visible .section-side-action-icon {
      animation: shuffleSpin 500ms ease;
    }

    .section-side-action:active {
      transform: scale(0.96);
    }

    .section-side-action:focus-visible {
      outline: 2px solid rgb(0 174 236 / 35%);
      outline-offset: 2px;
    }

    .section-side-action-icon {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      justify-content: center;
      height: 0.65rem;
      order: -1;
      width: 0.65rem;
    }

    .section-side-action-icon ::ng-deep svg {
      display: block;
      height: 100% !important;
      stroke-width: 2.2;
      width: 100% !important;
    }

    .section-side-action-label {
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-orientation: mixed;
      writing-mode: vertical-rl;
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
      .section-with-side-action { padding-right: 3.1rem; }
      .section-side-action { min-width: 2.75rem; width: 2.75rem; }
      .game-grid { gap: 0.4rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 450px) {
      .game-grid { gap: 0.35rem; }
    }
  ` ]
})
export class GameSectionComponent {
  readonly games = input<Game[]>([])
  readonly heading = input('')
  readonly searchTerm = input<string>('')
  /** When set, renders the side "换一批" action with this vertical label. */
  readonly shuffleLabel = input<string | undefined>(undefined)
  readonly compact = input(false)
  /** Extra class(es) applied to the inner <section> for parent SCSS hooks. */
  readonly sectionClass = input<string>('')
  readonly shuffle = output()
}
