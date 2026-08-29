import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function collectTextFiles(directory, pattern = /\.(?:html|js)$/) {
  if (!existsSync(directory)) return []

  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(entryPath, pattern))
    } else if (pattern.test(entry.name)) {
      files.push(entryPath)
    }
  }
  return files
}

const angularConfig = JSON.parse(read('client/angular.json'))
const clientProject = Object.values(angularConfig.projects ?? {}).find(project => project?.architect?.build)
const buildConfigurations = clientProject?.architect?.build?.configurations ?? {}
const zhHansLight = buildConfigurations['zh-Hans-light']

assert(
  Array.isArray(zhHansLight?.localize) && zhHansLight.localize.length === 1 && zhHansLight.localize[0] === 'zh-Hans-CN',
  'Angular 必须提供只构建简体中文的 zh-Hans-light 配置'
)

const lightBuildScript = read('scripts/build/client-light.ps1')
assert(
  /--configuration\s+production,zh-Hans-light/.test(lightBuildScript),
  '轻量客户端构建必须选择 zh-Hans-light 配置'
)
assert(
  lightBuildScript.includes("dist/browser/en-US"),
  '轻量客户端必须继续输出到兼容的 en-US 静态目录'
)

const outputDirectory = join(root, 'client', 'dist', 'browser', 'en-US')
const outputFiles = collectTextFiles(outputDirectory)
assert(outputFiles.some(file => file.endsWith('index.html')), '轻量客户端必须生成 en-US/index.html')

const sourceText = collectTextFiles(join(root, 'client', 'src'), /\.(?:html|ts)$/)
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')

const serverSourceText = [
  ...collectTextFiles(join(root, 'server', 'core', 'controllers', 'api', 'games'), /\.ts$/),
  join(root, 'server', 'core', 'middlewares', 'auth.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'shared', 'utils.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'shared', 'users.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'users', 'user-email-verification.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'users', 'user-registrations.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'users', 'shared', 'user-registrations.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'users', 'users.ts'),
  join(root, 'server', 'core', 'middlewares', 'validators', 'follows.ts'),
  join(root, 'server', 'core', 'lib', 'auth', 'oauth.ts'),
  join(root, 'server', 'core', 'controllers', 'api', 'users', 'two-factor.ts')
]
  .filter(file => existsSync(file))
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')

const builtText = outputFiles
  .map(file => readFileSync(file, 'utf8'))
  .join('\n')
  .replace(/\\u([0-9a-f]{4})/gi, (_, codePoint) => String.fromCharCode(Number.parseInt(codePoint, 16)))
const forbiddenEnglishMessages = [
  'Your authentication has expired, you need to reconnect.',
  'You need to reconnect',
  'Cannot retrieve OAuth Client credentials',
  'Videos feed',
  'Author space',
  'Creator center',
  'Analytics dashboard',
  'GameHub notifications',
  'Edit game',
  'My games',
  'Upload game',
  'Moderate games',
  'Game rankings',
  'Community activity',
  'My reservations',
  'Game collections',
  'Game articles',
  'Write game article',
  'Edit game article',
  'Popular tags',
  'Game events',
  'Event detail',
  'Event admin',
  'My following',
  'Watch later',
  'Search games',
  'GameHub community',
  'Discover games',
  'Play game',
  'Close this dialog',
  'Click here to reset your password',
  'Close this modal',
  'Account request sent',
  'Your account request has been sent!',
  'Your account has been created!',
  'Check your email',
  'Email verified!',
  'Your email has been verified',
  'Request email for account verification',
  'Email address',
  'Send verification email',
  'Unable to find user id or verification string.',
  'Your password has been successfully reset!',
  'You must agree with the platform terms in order to register on it.',
  'Registration reason is required.',
  'Registration reason must be at least 2 characters long.',
  'Registration reason cannot be more than 3000 characters long.',
  'Server is unavailable. Please retry later.',
  'Copied!',
  'No items available'
]

const serverTranslatedMessages = [
  'text must contain 1-2000 characters',
  'text must contain 1-5000 characters',
  'text and commentId are required',
  'liked must be boolean',
  'Authors cannot rate their own game',
  'Authors cannot coin their own game',
  'rating must be like or none',
  'amount must be 1 or 2',
  'favorite must be boolean',
  'Cannot follow yourself',
  'following must be boolean',
  'Game author account is unavailable',
  'Event is not open for registration',
  'Already joined',
  'Event is full',
  'gamefile is required',
  'Each account can maintain at most {count} games',
  'Upload rate limit reached',
  'Account game storage quota reached',
  'Invalid game moderation transition',
  'featured must be boolean',
  'reason is required',
  'Cannot ask verification email of a user that uses a plugin authentication.',
  'Invalid verification string.',
  'Registration with this username, channel name or email already exists.',
  'Cannot recover password of a user that uses a plugin authentication.',
  'Follow is not in pending/rejected state.',
  'Follow is not in pending/accepted state.',
  'Cannot follow on a non HTTPS web server.',
  'You must provide at least one handle or one host.',
  'Invalid request: method must be POST',
  'Invalid request: content must be application/x-www-form-urlencoded',
  'Invalid client: cannot retrieve client credentials',
  'Invalid client: client is invalid',
  'Missing parameter: `grant_type`',
  'Unsupported grant type: `grant_type` is invalid',
  'Unauthorized client: `grant_type` is invalid',
  'Invalid request token',
  'Invalid OTP token',
  'Should have a valid email',
  'Should have a valid id',
  'Should have a valid verification string',
  'Should have a valid registrationId',
  'Should have preventEmailDelivery boolean',
  'Should be a valid blocked boolean',
  'Should have a valid username (lowercase alphanumeric characters)',
  'Cannot remove the root user',
  'Cannot block the root user',
  'You cannot delete your root account.',
  'Cannot change root role.',
  'Should have a valid p2p enabled boolean',
  'Should have a valid videos history enabled boolean',
  'Should have a valid noInstanceConfigWarningModal boolean',
  'Should have a valid noWelcomeModal boolean',
  'Should have a valid noAccountSetupWarningModal boolean',
  'Should have a valid autoPlayNextVideo boolean',
  'Should have a valid withStats boolean',
  'Should have a valid channelNameOneOf array',
  'currentPassword is missing',
  'Comment image cannot exceed 5 MB',
  'Comment image upload failed',
  'Users can only be managed by moderators or admins.',
  'Only administrators can assign admin or moderator roles',
  'Should have an array of unique hosts',
  'Should have an array of handles',
  'Follow {hostOrHandle} not found.',
  'Follower {handle} not found.',
  'Incorrect request parameters: {parameters}',
  'Should have a valid video id (id, short UUID or UUID)',
  'Should have a valid playlist id (id, short UUID or UUID)',
  'Registration with this username, channel name or email already exists.',
  'Registration not found',
  'User not found'
]

for (const message of forbiddenEnglishMessages) {
  assert(!sourceText.includes(message), `中文客户端源码仍包含英文提示：${message}`)
  assert(!builtText.includes(message), `中文客户端产物仍包含英文提示：${message}`)
}

const serverTranslations = JSON.parse(read('server/locales/zh-Hans-CN/translation.json'))
for (const message of serverTranslatedMessages) {
  assert(
    typeof serverTranslations[message] === 'string' && /[\u4e00-\u9fff]/.test(serverTranslations[message]),
    `服务端中文翻译缺少有效文案：${message}`
  )
  assert(!serverSourceText.includes(`error: '${message}'`) && !serverSourceText.includes(`message: '${message}'`) && !serverSourceText.includes(`withMessage('${message}')`), `游戏接口仍直接返回英文提示：${message}`)
}

assert(builtText.includes('您的身份验证已过期，您需要重新连接。'), '中文客户端产物必须包含身份验证过期的中文提示')
assert(sourceText.includes("emptyMessage: '暂无结果'") && sourceText.includes("emptyFilterMessage: '筛选后暂无结果'"), 'PrimeNG 全局空结果提示必须使用中文')

for (const key of [
  'Token is invalid',
  'Account not found',
  'Authentication is required',
  'Authentication is required.',
  'currentPassword is invalid.',
  'currentPassword parameter is missing',
  'Signup approval is not enabled on this instance',
  'This registration is already accepted or rejected.',
  'User registration is not allowed',
  'You are not on a network authorized for registration.'
]) {
  assert(
    typeof serverTranslations[key] === 'string' && serverTranslations[key] !== key && /[\u4e00-\u9fff]/.test(serverTranslations[key]),
    `服务端中文翻译缺少有效文案：${key}`
  )
}

for (const key of [
  'User with this username or email already exists.',
  'Another actor (account/channel) with this name on this instance already exists or has already existed.',
  'Cannot use same flags in nsfwFlagsDisplayed, nsfwFlagsHidden, nsfwFlagsBlurred and nsfwFlagsWarned at the same time',
  'Only a user with sufficient right can manage this account resource.',
  'User and token mismatch',
  'User with this email already exists.',
  'You cannot update your email or password that is associated with an external auth system.'
]) {
  assert(
    typeof serverTranslations[key] === 'string' && /[\u4e00-\u9fff]/.test(serverTranslations[key]),
    `服务端中文翻译仍包含英文文案：${key}`
  )
}

if (failures.length > 0) {
  console.error(`GameHub 中文本地化验收失败（${failures.length} 项）：`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('GameHub 中文本地化验收通过')
}
