import { Directive, ElementRef, inject, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core'

@Directive({
  selector: '[myViewportDefer]',
  standalone: true
})
export class ViewportDeferDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>)
  private readonly templateRef = inject(TemplateRef<unknown>)
  private readonly viewContainer = inject(ViewContainerRef)
  private observer: IntersectionObserver | undefined
  private hasRendered = false

  ngOnInit () {
    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.hasRendered) {
            this.hasRendered = true
            this.viewContainer.createEmbeddedView(this.templateRef)
            // Stop observing once rendered
            this.observer?.unobserve(this.elementRef.nativeElement)
          }
        }
      },
      { rootMargin: '200px 0px', threshold: 0 }
    )

    this.observer.observe(this.elementRef.nativeElement)
  }

  ngOnDestroy () {
    this.observer?.disconnect()
  }
}
