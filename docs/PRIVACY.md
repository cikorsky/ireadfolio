# iReadFolio 隐私与数据说明

适用范围：本仓库构建的 iReadFolio 扩展。更新日期：2026年11月6日。第三方网站、浏览器、系统语音服务和用户选择的 WebDAV 服务有各自的数据处理规则。

## 本机保存的内容

扩展使用浏览器本地存储保存阅读设置、自定义样式、站点规则、文章标题与正文、来源网址、分类、标签和批注。当前阅读会话保存在浏览器会话存储中，并与原标签页关联。网站内容和用户导入的 HTML 会在解析、导入或渲染边界清理。

配置 WebDAV 时，目录 URL、用户名、密码和连接设置保存在扩展的本机存储中。密码不进入完整 JSON 备份，不回传给普通网页，也不在重载后回填明文到密码输入框。保留密码的空输入框只适用于相同的连接目标和用户名；修改目标需重新输入。

浏览器本地存储不是独立的加密密码保险库。能读取浏览器配置文件的本机人员或软件可能获得其中数据。文章备份和导出文件也可能含有正文、来源网址及批注，应按其内容选择保存位置。

## 网络访问

源码没有配置开发者托管的文章上传服务、广告或行为分析服务。下列操作仍可能访问网络：

- 阅读和导出原文图片、背景图或其他原文资源。资源提供方会接收到正常网络请求；图片内嵌会主动下载资源。
- 追加下一页正文。后台仅允许获取与文章同源的 HTML，拒绝重定向；同源请求可以携带该站点已有的浏览器凭据。跨源图片请求不附带站点凭据。
- 浏览器或系统语音合成。不同声音是否使用联网服务由浏览器和操作系统决定。
- 用户保存 WebDAV 配置后主动测试连接、备份、查看历史或恢复版本。没有后台定时上传或实时多设备同步。
- 点击“查看原文”等外部链接，或使用保留外链图片的导出文件。

WebDAV 使用配置目录下的版本文件保存完整备份，包括设置、样式、文章、分类及批注；备份不包含 WebDAV 密码。扩展不对备份 JSON 做端到端加密，服务端可读取备份。HTTPS 保护传输；允许非加密 HTTP 时，备份和鉴权信息可能以未加密方式经过网络。扩展拒绝将 WebDAV 凭据通过重定向发送到另一个站点。

## 浏览器权限

| 权限 | 用途 |
| --- | --- |
| `<all_urls>` | 在不同站点显示阅读入口、提取用户当前访问的文章，以及获取所需原文或导出资源。此权限不绕过浏览器内部页面、网站登录或访问限制。 |
| `storage` | 保存配置、文章、批注和 WebDAV 连接信息；存储当前阅读会话。 |
| `unlimitedStorage` | 支持较大的本地文章库；不代表所有磁盘和浏览器限制均被取消。 |
| `contextMenus` | 提供进入阅读、手动选择、偏好设置和稍后读等右键菜单。 |
| `fontSettings`（Chrome） | 查询系统已安装字体，供排版选择；不修改浏览器全局字体设置，不上传字体列表或字体文件。 |

Firefox 没有可用系统字体列表接口时，界面提供通用字体选择。默认样式中的字体名称是引用，不是字体文件的再分发。

## 备份与删除

“配置管理”可导出完整本地 JSON 备份并合并恢复。完整备份不是加密容器，请勿把包含私人文章、网址和批注的备份附在公开问题报告中。

删除文章后通常进入本地回收站；超过30天的回收站记录会在后续读取文章库时清理，或由用户主动永久删除。“恢复默认设置”只恢复设置，不清空文章和批注。

移除 WebDAV 配置会移除当前保存的连接凭据，不会删除 WebDAV 远端备份。删除本地文章也不会删除已有远端备份或已下载的导出文件。远端文件请在自己的 WebDAV 服务中管理；清除整个扩展数据可使用浏览器提供的扩展卸载或站点数据管理方式，并根据浏览器实际行为检查结果。

## 安全反馈与变更

普通网页不应通过阅读框架或消息接口读取私人文章库、批注或凭据。若发现这类问题，请按 [SECURITY.md](../SECURITY.md) 私下报告。新增权限、数据收集或网络服务应同步修改此说明；本说明描述当前实现，不替代对目标版本源码和构建产物的检查。

## English summary

iReadFolio stores settings, styles, articles, annotations, and optional WebDAV credentials in browser-local storage. Credentials are excluded from full JSON backups and are not returned to ordinary web pages. The source has no configured developer article-upload, advertising, or analytics service. Original page resources, next-page requests, system speech, and user-triggered WebDAV operations may still use the network.

WebDAV is manual backup, not real-time synchronization. Backup JSON is not end-to-end encrypted; the configured server can read it. Local storage is not a separate encrypted secrets vault. Removing local records or WebDAV credentials does not remove remote backups or downloaded files. Treat article backups as potentially private, and report security issues through [SECURITY.md](../SECURITY.md).
