# Security Policy

我们重视 GameHub 用户的安全与隐私，欢迎以善意方式研究并负责任地披露漏洞的安全研究者。

## 上游平台漏洞

GameHub 的部分基础能力源自 [PeerTube](https://github.com/Chocobozzz/PeerTube)（AGPL-3.0）。
如你发现的问题同样影响上游代码，建议同时向上游报告：
[peertube-security@framasoft.org](mailto:peertube-security@framasoft.org)，详见
[PeerTube SECURITY.md](https://github.com/Chocobozzz/PeerTube/blob/develop/SECURITY.md)。

## 报告渠道

请通过 GitHub 的
[私有安全通告](https://github.com/suweitao8/GameHub/security/advisories/new)
提交漏洞报告；无法使用时可通过仓库维护者的 GitHub 账号（`suweitao8`）私下联系。

**请勿在公开 Issue 中披露未修复的漏洞细节。**

## 期望

- 我们会与你一起确认和复现问题，并在合理时间内修复；
- 在问题修复并发布前，请不要公开披露技术细节；
- 请仅在获得授权的前提下测试部署实例，避免影响真实用户数据与服务可用性。

## 范围

- `server/`、`client/`、游戏运行时（game runtime）、上传与权限控制为核心关注面；
- 针对示例数据的注入、越权访问、XSS、SSRF 等均在欢迎范围内；
- 对自动化扫描器产生的批量低价值报告恕难逐一回应。
