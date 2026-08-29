import express from 'express'
import { body } from 'express-validator'
import { HttpStatusCode } from '@peertube/peertube-models'
import { exists } from '../../helpers/custom-validators/misc.js'
import { checkAuthCaptcha } from '../../lib/auth/captcha.js'
import { areValidationErrors } from './shared/index.js'

// 登录与注册共用：要求 body 携带一次性图形验证码并通过校验
const authCaptchaValidator = [
  body('captchaId').custom(exists),
  body('captchaToken').custom(exists),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await checkAuthCaptcha(req.body.captchaId, req.body.captchaToken)) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: '验证码错误或已过期，请刷新后重试。'
      })
    }

    return next()
  }
]

// OAuth 令牌端点：仅密码授权（grant_type=password，即登录）要求验证码，
// refresh_token 等其他授权类型不受影响
const oauthPasswordGrantCaptchaValidator = [
  body('captchaId').optional().custom(exists),
  body('captchaToken').optional().custom(exists),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.body?.grant_type !== 'password') return next()

    if (areValidationErrors(req, res)) return

    if (!await checkAuthCaptcha(req.body.captchaId, req.body.captchaToken)) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: '验证码错误或已过期，请刷新后重试。'
      })
    }

    return next()
  }
]

export {
  authCaptchaValidator,
  oauthPasswordGrantCaptchaValidator
}
