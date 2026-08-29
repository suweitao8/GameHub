import express from 'express'
import { generateAuthCaptcha } from '@server/lib/auth/captcha.js'

async function generateUserAuthCaptcha (req: express.Request, res: express.Response) {
  const captcha = await generateAuthCaptcha()

  return res.json(captcha)
}

export {
  generateUserAuthCaptcha
}
