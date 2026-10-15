var stdin_default = {
  id: "color-studio",
  name: "ColorStudio",
  title: "\u8272\u5F69\u7BA1\u7406\u5DE5\u4F5C\u53F0",
  description: "HSB \u5706\u76D8 + \u53D6\u8272 + \u8C03\u8272\u677F + \u548C\u58F0\u6D3E\u751F + JSON \u6574\u4F53\u8BFB\u5199\u3002",
  version: "0.1.0",
  framework: "react",
  entry: "./index.tsx",
  platform: "both",
  group: "\u8BBE\u8BA1",
  category: "\u8272\u5F69\u7BA1\u7406",
  tags: ["color", "picker", "palette", "harmony"],
  status: "experimental",
  route: { path: "/components/color-studio", title: "\u8272\u5F69\u7BA1\u7406\u5DE5\u4F5C\u53F0" },
  mount: { kind: "react", propsMode: "default" },
  isolation: { mode: "shadow-dom" },
  theme: { mode: "css-variables", namespace: "sl" },
  capabilities: { fullscreen: true, fullscreenMode: "viewport", resizable: false }
};
export {
  stdin_default as default
};
