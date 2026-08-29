import { APP_BASE_HREF, registerLocaleData } from '@angular/common'
import localeZhHans from '@angular/common/locales/zh-Hans'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import {
  ApplicationRef,
  enableProdMode,
  importProvidersFrom,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection
} from '@angular/core'
import { BrowserModule, bootstrapApplication, enableDebugTools } from '@angular/platform-browser'
import { RouteReuseStrategy, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router'
import { ServiceWorkerModule } from '@angular/service-worker'
import { PTPrimeTheme } from '@app/core/theme/primeng/primeng-theme'
import localeOc from '@app/helpers/locales/oc'
import { getFormProviders } from '@app/shared/shared-forms/shared-form-providers'
import { languageInterceptor } from '@app/shared/shared-main/http/language-interceptor.service'
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap'
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client'
import { PrimeNG, providePrimeNG } from 'primeng/config'
import { ToastModule } from 'primeng/toast'
import { switchMap } from 'rxjs/operators'
import { AppComponent } from './app/app.component'
import routes from './app/app.routes'
import {
  CustomReuseStrategy,
  PluginService,
  PreloadSelectedModulesList,
  RedirectService,
  ServerService,
  ThemeService,
  getCoreProviders
} from './app/core'
import { getMainProviders } from './app/shared/shared-main/main-providers'
import { environment } from './environments/environment'
import { logger } from './root-helpers'

registerLocaleData(localeOc, 'oc')
registerLocaleData(localeZhHans, 'zh-Hans-CN')

const primeNgZhCnTranslation = {
  startsWith: '以此开头',
  contains: '包含',
  notContains: '不包含',
  endsWith: '以此结尾',
  equals: '等于',
  completed: '已完成',
  notEquals: '不等于',
  noFilter: '无筛选',
  lt: '小于',
  lte: '小于或等于',
  gt: '大于',
  gte: '大于或等于',
  is: '是',
  isNot: '不是',
  before: '早于',
  after: '晚于',
  dateIs: '日期为',
  dateIsNot: '日期不为',
  dateBefore: '日期早于',
  dateAfter: '日期晚于',
  clear: '清除',
  apply: '应用',
  matchAll: '匹配全部',
  matchAny: '匹配任意',
  addRule: '添加条件',
  removeRule: '移除条件',
  accept: '接受',
  reject: '拒绝',
  choose: '选择',
  upload: '上传',
  cancel: '取消',
  fileSizeTypes: [ '字节', '千字节', '兆字节', '吉字节', '太字节' ],
  dayNames: [ '星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六' ],
  dayNamesShort: [ '周日', '周一', '周二', '周三', '周四', '周五', '周六' ],
  dayNamesMin: [ '日', '一', '二', '三', '四', '五', '六' ],
  monthNames: [ '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月' ],
  monthNamesShort: [ '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月' ],
  dateFormat: 'yy-mm-dd',
  firstDayOfWeek: 1,
  today: '今天',
  weekHeader: '周',
  weak: '弱',
  medium: '中',
  strong: '强',
  passwordPrompt: '请输入密码',
  emptyMessage: '暂无结果',
  emptyFilterMessage: '筛选后暂无结果',
  fileChosenMessage: '已选择 {0} 个文件',
  noFileChosenMessage: '未选择文件',
  pending: '待处理',
  chooseYear: '选择年份',
  chooseMonth: '选择月份',
  chooseDate: '选择日期',
  prevDecade: '上一个十年',
  nextDecade: '下一个十年',
  prevYear: '上一年',
  nextYear: '下一年',
  prevMonth: '上个月',
  nextMonth: '下个月',
  prevHour: '上一小时',
  nextHour: '下一小时',
  prevMinute: '上一分钟',
  nextMinute: '下一分钟',
  prevSecond: '上一秒',
  nextSecond: '下一秒',
  am: '上午',
  pm: '下午',
  searchMessage: '有 {0} 个结果可供选择',
  selectionMessage: '已选择 {0} 个项目',
  emptySelectionMessage: '未选择项目',
  emptySearchMessage: '未找到结果',
  aria: {
    trueLabel: '是',
    falseLabel: '否',
    nullLabel: '未设置',
    star: '星标',
    stars: '星标',
    selectAll: '全选',
    unselectAll: '取消全选',
    close: '关闭',
    previous: '上一项',
    next: '下一项',
    navigation: '导航',
    scrollTop: '滚动到顶部',
    moveTop: '移到顶部',
    moveUp: '上移',
    moveDown: '下移',
    moveBottom: '移到底部',
    moveToTarget: '移至目标',
    moveToSource: '移至来源',
    moveAllToTarget: '全部移至目标',
    moveAllToSource: '全部移至来源',
    pageLabel: '第 {0} 页',
    firstPageLabel: '首页',
    lastPageLabel: '末页',
    nextPageLabel: '下一页',
    prevPageLabel: '上一页',
    rowsPerPageLabel: '每页行数',
    previousPageLabel: '上一页',
    jumpToPageDropdownLabel: '跳转页码下拉框',
    jumpToPageInputLabel: '跳转页码输入框',
    selectRow: '选择行',
    unselectRow: '取消选择行',
    expandRow: '展开行',
    collapseRow: '收起行',
    showFilterMenu: '显示筛选菜单',
    hideFilterMenu: '隐藏筛选菜单',
    filterOperator: '筛选运算符',
    filterConstraint: '筛选条件',
    editRow: '编辑行',
    saveEdit: '保存编辑',
    cancelEdit: '取消编辑',
    listView: '列表视图',
    gridView: '网格视图',
    slide: '幻灯片',
    slideNumber: '第 {0} 张',
    zoomImage: '放大图片',
    zoomIn: '放大',
    zoomOut: '缩小',
    rotateRight: '顺时针旋转',
    rotateLeft: '逆时针旋转',
    listLabel: '列表',
    selectColor: '选择颜色',
    removeLabel: '移除',
    browseFiles: '浏览文件',
    maximizeLabel: '最大化',
    minimizeLabel: '最小化'
  }
}

function configurePrimeNgTranslation () {
  const localeId = inject(LOCALE_ID)
  if (localeId !== 'zh-Hans' && localeId !== 'zh-Hans-CN') return

  inject(PrimeNG).setTranslation(primeNgZhCnTranslation)
}

export function loadConfigFactory (
  server: ServerService,
  pluginService: PluginService,
  themeService: ThemeService,
  redirectService: RedirectService
) {
  const initializeServices = () => {
    redirectService.init()
    themeService.initialize()

    return pluginService.initializePlugins()
  }

  return () => {
    const result = server.loadHTMLConfig()
    if (result) return result.pipe(switchMap(() => initializeServices()))

    return initializeServices()
  }
}

if (environment.production) {
  enableProdMode()
}

logger.registerServerSending(environment.apiUrl)

const bootstrap = () => {
  return bootstrapApplication(AppComponent, {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),

      importProvidersFrom(
        BrowserModule,
        ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production })
      ),

      provideHttpClient(
        withInterceptors([ languageInterceptor ])
      ),

      importProvidersFrom(
        LoadingBarHttpClientModule,
        ToastModule,
        NgbModalModule
      ),

      getCoreProviders(),
      getMainProviders(),
      getFormProviders(),

      PreloadSelectedModulesList,
      { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },

      provideRouter(
        routes,
        withPreloading(PreloadSelectedModulesList),
        withInMemoryScrolling({
          anchorScrolling: 'disabled',
          // Redefined in app component
          scrollPositionRestoration: 'disabled'
        })
      ),

      {
        provide: APP_BASE_HREF,
        useValue: '/'
      },
      provideAppInitializer(() => {
        const initializerFn = loadConfigFactory(inject(ServerService), inject(PluginService), inject(ThemeService), inject(RedirectService))

        return initializerFn()
      }),

      providePrimeNG({
        theme: {
          preset: PTPrimeTheme
        }
      }),
      provideAppInitializer(configurePrimeNgTranslation)
    ]
  }).then(bootstrapModule => {
    if (!environment.production) {
      const applicationRef = bootstrapModule.injector.get(ApplicationRef)
      const componentRef = applicationRef.components[0]

      // allows to run `ng.profiler.timeChangeDetection();`
      enableDebugTools(componentRef)
    }

    return bootstrapModule
  }).catch(err => {
    try {
      logger.error(err)
    } catch (err2) {
      console.error('Cannot log error', { err, err2 })
    }

    // Ensure we display an "incompatible message" on Angular bootstrap error
    setTimeout(() => {
      if (document.querySelector('my-app').innerHTML === '') {
        throw err
      }
    }, 1000)

    return null as any
  })
}

bootstrap()
