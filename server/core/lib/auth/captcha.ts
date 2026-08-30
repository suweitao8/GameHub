import { buildUUID } from '@peertube/peertube-node-utils'
import { Redis } from '@server/lib/redis.js'

// 去除易混淆字符(0/o、1/l/i)，降低人工辨认出错率
const CAPTCHA_CHARS = '23456789abcdefghjkmnpqrstuvwxyz'
const CAPTCHA_LENGTH = 4
const CAPTCHA_TTL_MS = 5 * 60 * 1000

// 使用品牌深色变体，保证浅色验证码底上的字符仍然清晰可辨
const CHAR_COLORS = [ '#007aa3', '#005a78', '#de5c83', '#109a76', '#92400e' ]

export interface AuthCaptchaChallenge {
  captchaId: string
  svg: string
}

function randomInt (max: number) {
  return Math.floor(Math.random() * max)
}

function randomCaptchaCode () {
  let code = ''
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    code += CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)]
  }

  return code
}

// 无依赖 SVG 图形验证码：逐字符随机旋转/位移 + 干扰弧线与噪点，答案存 Redis 一次性校验
function renderCaptchaSvg (code: string) {
  const width = 132
  const height = 44
  const step = (width - 32) / CAPTCHA_LENGTH

  let chars = ''
  for (let i = 0; i < code.length; i++) {
    const x = 18 + i * step + randomInt(6) - 3
    const y = height / 2 + 9 + randomInt(9) - 4
    const rotate = randomInt(50) - 25
    const fill = CHAR_COLORS[randomInt(CHAR_COLORS.length)]

    chars += `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" fill="${fill}" ` +
      `font-family="'Courier New',monospace" font-size="27" font-weight="700">${code[i]}</text>`
  }

  let arcs = ''
  for (let i = 0; i < 4; i++) {
    const x1 = randomInt(width)
    const y1 = randomInt(height)
    const x2 = randomInt(width)
    const y2 = randomInt(height)
    const cx = randomInt(width)
    const cy = randomInt(height)

    arcs += `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="#94a3b8" ` +
      `stroke-width="1" stroke-opacity="0.55" stroke-linecap="round" />`
  }

  let dots = ''
  for (let i = 0; i < 32; i++) {
    dots += `<circle cx="${randomInt(width)}" cy="${randomInt(height)}" r="${1 + randomInt(2)}" ` +
      `fill="#64748b" fill-opacity="0.4" />`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true"><rect width="100%" height="100%" fill="#f1f5f9"/>` +
    `${arcs}${dots}${chars}</svg>`
}

export {
  CAPTCHA_TTL_MS
}

export async function generateAuthCaptcha (): Promise<AuthCaptchaChallenge> {
  const code = randomCaptchaCode()
  const captchaId = buildUUID()

  await Redis.Instance.setAuthCaptcha(captchaId, code, CAPTCHA_TTL_MS)

  return { captchaId, svg: renderCaptchaSvg(code) }
}

export async function checkAuthCaptcha (captchaId: string, answer: string): Promise<boolean> {
  if (!captchaId || !answer) return false

  // 一次性消费：读取即删除，防止同一验证码重复提交
  const expected = await Redis.Instance.getAndDeleteAuthCaptcha(captchaId)
  if (!expected) return false

  return expected === String(answer).trim().toLowerCase()
}
