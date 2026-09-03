import assert from 'node:assert/strict'
import {
  averageColorFromPixels,
  buildGameCoverDataUrl,
  getReadableTextColor
} from '../client/src/app/shared/game-cover.ts'

const title = 'A&B <测试>'
const first = buildGameCoverDataUrl(title, 'puzzle')
const second = buildGameCoverDataUrl(title, 'puzzle')
const decoded = decodeURIComponent(first.replace('data:image/svg+xml,', ''))

assert.match(first, /^data:image\/svg\+xml,/, '程序化封面必须返回 SVG data URL')
assert.equal(first, second, '相同标题和分类必须生成稳定的封面')
assert.notEqual(first, buildGameCoverDataUrl('另一个游戏', 'puzzle'), '不同标题必须生成不同的封面')
assert.notEqual(first, buildGameCoverDataUrl(title, 'arcade'), '分类变化应影响封面图形')
assert.match(decoded, /viewBox="0 0 640 360"/, '封面必须使用 16:9 画布')
assert.match(decoded, /A&amp;B &lt;测试&gt;/, '封面标题必须进行 XML 转义')
assert.doesNotMatch(decoded, /A&B <测试>/, '封面 SVG 不能直接拼接未转义的标题')
assert.match(decoded, /GAMEHUB/, '封面必须保留 GameHub 品牌标识')

assert.equal(
  averageColorFromPixels(new Uint8ClampedArray([ 255, 255, 255, 255, 0, 0, 0, 255 ])),
  '#808080',
  '图片平均色必须按不透明像素计算'
)
assert.equal(
  averageColorFromPixels(new Uint8ClampedArray([ 255, 0, 0, 0, 32, 64, 96, 255 ])),
  '#204060',
  '透明像素不能污染图片平均色'
)
assert.equal(getReadableTextColor('#f3f0ec'), '#18191c', '浅色信息栏必须使用深色文字')
assert.equal(getReadableTextColor('#1b2732'), '#ffffff', '深色信息栏必须使用浅色文字')

console.log('✓ game cover generator contract passed')
