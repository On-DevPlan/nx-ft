// ESLint 扁平配置。
//
// 这里主要管的不是代码风格（那个交给约定与编辑器），而是**分层约束**：
// 把「谁可以依赖谁」写成机器可检查的规则。架构意图一旦只写在文档里，
// 就会随提交次数慢慢衰减；写成 lint 规则会当场拦下。
import { defineConfig } from 'eslint/config';

const BASE_RULES = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  // 全仓默认关（Node/浏览器全局混用，globals 包不值当）；前端目录单独开，见下方
  // 「前端 no-undef」块——那才是漏 import 会炸的地方。
  'no-undef': 'off',
  eqeqeq: ['error', 'smart'],
  'prefer-const': 'error',
  'no-var': 'error',
  'no-console': 'off', // CLI 工具，输出就是产品
};

export default defineConfig([
  { ignores: [
    'src/web/public/**',
    'src/studio/public/**',
    'temp/**',
    'node_modules/**',
    // Flutter showcase 的产物与 SDK 缓存（.gitignore 同款清单）：本机跑过
    // `pnpm showcase:build` 后才有，全是生成/第三方 js，lint 只会刷屏。
    'tools/flutter-showcase/build/**',
    'tools/flutter-showcase/.dart_tool/**',
  ] },
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }, // .jsx 与 .js 里的 JSX（视图层）
    },
    rules: {
      ...BASE_RULES,
      // JSX 里 <App /> 这种「使用」不被裸 espree 记账（没有 JSX 作用域分析），
      // 组件 import 会被误报 unused。约定：**组件名一律大写开头**（React 官方惯例），
      // 大写开头的 import 不参与 unused 检查。
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^[A-Z_]',
      }],
    },
  },

  // ---- 分层约束（依赖只能向下 core ← modules ← runtime）----

  {
    // core 是最底层：零业务语义的基础设施。它一旦依赖上层，分层就塌了。
    files: ['src/core/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../modules/**', '../runtime/**', '../web/**'],
              message: 'core 是最底层，不得依赖 modules / runtime / web。',
            },
          ],
        },
      ],
    },
  },

  {
    // 通用块：业务模块之间禁止互相依赖。
    //
    // ⚠️ 为什么是「枚举 + 一致性测试」而不是否定式 glob：
    // 试过 gitignore 式白名单（`['../*/**', '!../core/**']`），
    // eslint 9 实测负模式对 `../` 相对路径**全部失效**（同 group / 独立条目
    // / 字符串 allow 都试过）——白名单写不进去，否定式就只剩「全禁」。
    // 退回枚举式，但配一致性测试（tests/unit/lint-enumeration.test.mjs）
    // 断言「枚举清单 == 实际业务模块目录」：新增模块忘补清单时测试直接红，
    // 把「静默失效」变成「响亮失效」。
    //
    // 新增业务模块记得在 files 与 group 里各补一行（一致性测试盯着）。
    files: [
      'src/modules/studio/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../studio/*', '../studio/**'],
              message: '模块之间不得互相依赖；共享逻辑请下沉到 core/。',
            },
          ],
        },
      ],
    },
  },

  {
    // 前端：这条规则的价值最高——把 Node 侧代码 import 进视图，
    // Vite 会把 node: 内置模块一起打进浏览器包，构建期报错或运行期炸掉。
    files: ['src/studio/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message: '前端不能引用 Node 内置模块。',
            },
            {
              group: ['**/modules/*/index.js', '**/modules/*/service.js', '**/runtime/**', '**/core/**'],
              message:
                '前端只能 import 模块的 view.jsx。index.js/service.js/runtime/core 是 Node 侧代码，拖进浏览器包会把 node: 内置模块一起带进来。',
            },
          ],
        },
      ],
    },
  },

  {
    // 前端 no-undef：ComponentDoc 缺 lazy、StyleLab 缺 useMemo 各炸过一次——
    // 漏 import 的 hook 躲过 lint（此处原本 no-undef off）也躲过 build
    // （bundler 不解析全局引用），只有浏览器打开才响亮失败。
    // 前端目录的浏览器全局可枚举，遂单独打开（沿用本配置的枚举哲学，
    // 不引 globals 包）：用到新全局时 lint 会点名标识符，来这里补一行。
    // modules/*/view.jsx 同为前端，一并守。
    files: ['src/studio/**/*.{js,jsx}', 'src/modules/*/view.jsx'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        alert: 'readonly',
        clearTimeout: 'readonly',
        confirm: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },

  // ---- 骨架专属区域：tools/ 是生成时的独立小工具，不受分层约束 ----
  { files: ['tools/**/*.{js,mjs}'], rules: { 'no-restricted-imports': 'off' } },
]);
