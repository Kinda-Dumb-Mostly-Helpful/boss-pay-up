# 项目字体

本项目使用 Helvetica（英文）和小米 MiSans（中文）。字体从本机已安装字体复制到此目录，通过 fonts.css 加载，不依赖访问者安装字体或外部字体服务。

- `helvetica/`：常规、粗体、斜体、粗斜体。
- `misans/`：完整的 10 个已安装字重；MiSans 官方许可保存在 `misans/LICENSE.pdf`。
- 页面和打印预览共用字体声明；浏览器按实际使用的字重请求文件。

MiSans 官方来源：https://hyperos.mi.com/font/

柬文和印地语分别使用 `noto/NotoSansKhmer.ttf`、`noto/NotoSansDevanagari.ttf`，来自 Google Fonts 官方仓库（`google/fonts` 的 `ofl/notosanskhmer` 和 `ofl/notosansdevanagari`）。字体遵循 SIL Open Font License 1.1，许可副本与字体保存在同一目录。

字体文件保留原样，Vite 构建时将此目录复制到 dist/fonts。

## 开源分发

项目 MIT 许可证仅适用于项目源码，不覆盖第三方字体。MiSans 遵循目录内官方许可。

Helvetica 文件来自本机安装，其 Web 嵌入和再分发授权未随文件提供，因此该目录已加入 Git 忽略规则，保留本机使用，不默认随公开仓库分发。缺少 Helvetica 时会回退到 MiSans 等备用字体。不要将包含本机 Helvetica 文件的 dist 构建包直接作为开源发布附件。
