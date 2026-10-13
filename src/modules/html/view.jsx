// HTML 渲染面板：CodePen 式三编辑框 + 实时预览。逻辑全在共享的 AssetView 里。
import { AssetView } from '../../web/frontend/components/asset/index.jsx';

export default function HtmlView() {
  return <AssetView kind="html" />;
}
