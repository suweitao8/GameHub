import { Component, ElementRef, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { ActivatedRoute, RouterOutlet } from '@angular/router'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { ResolverData } from './about-instance.resolver'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    HorizontalMenuComponent,
    RouterOutlet
  ]
})
export class AboutInstanceComponent implements OnInit {
  private route = inject(ActivatedRoute)

  readonly descriptionWrapper = viewChild<ElementRef<HTMLInputElement>>('descriptionWrapper')

  aboutHTML: AboutHTML
  menuEntries: HorizontalMenuEntry[] = []

  ngOnInit () {
    const {
      aboutHTML
    }: ResolverData = this.route.snapshot.data.instanceData

    this.aboutHTML = aboutHTML

    this.menuEntries = [
      {
        label: $localize`General`,
        routerLink: '/about/instance/home'
      }
    ]

    if (aboutHTML.administrator || aboutHTML.creationReason || aboutHTML.maintenanceLifetime || aboutHTML.businessModel) {
      this.menuEntries.push({
        label: $localize`Team`,
        routerLink: '/about/instance/team'
      })
    }

    if (aboutHTML.moderationInformation || aboutHTML.codeOfConduct) {
      this.menuEntries.push({
        label: $localize`Moderation and code of conduct`,
        routerLink: '/about/instance/moderation'
      })
    }

    // Always displayed, we have the "features found on this instance" table on this page
    this.menuEntries.push({
      label: $localize`Technical information`,
      routerLink: '/about/instance/tech'
    })
  }
}
