// 面板入口：Provider 组装（store → toast → App）。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { ToastProvider } from './components/ui.jsx';

// 三层样式纪律：tokens → atomic strategies → layout
// 1. tokens 来自 src/tokens/<default>.css（与 defaultTokens 选项对应；palette 轴与 pack 正交）
// 2. atomic 来自 src/styles/<pack>/（与 defaultStyle 选项对应；hairline 不含 tokens.css）
// 3. layout 来自 src/studio/layout.css（studio 自身的版式，最后压住组件策略）
//
// 基线：studio 自身的 chrome 用 hairline 方言（01-hairline 原型落地的基线克制）。
// 用户在 StyleLab 里可以预览其他方言——这正是库的多风格价值所在。
import '../tokens/light.css';
import '../styles/hairline/btn.css';
import '../styles/hairline/tag.css';
import '../styles/hairline/card.css';
import '../styles/hairline/colhead.css';
import '../styles/hairline/row.css';
import '../styles/hairline/kv.css';
import '../styles/hairline/toast.css';
import '../styles/hairline/snippet-box.css';
import '../styles/hairline/cli-hint.css';
import '../styles/hairline/dlg.css';
import './style.css';
import './layout.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>
);
