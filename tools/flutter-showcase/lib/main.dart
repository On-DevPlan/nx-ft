// 单 playground 入口：状态由父页面 postMessage 驱动。
//   协议：{type:'render', payload:{component, props}} —— 切组件/变体不改 URL，引擎零重载。
//   初始 src = '/flutter/'（无 hash），未收到消息前显示「ready」提示。
//
// 协议兼容：URL 形式 #/preview/<id>?<props> 仍被解析（直接打开/书签）。
import 'dart:convert';
import 'dart:html' show window, document;
import 'package:flutter/material.dart';
import 'hx_button.dart';

void main() {
  runApp(const HxShowcaseApp());
}

class HxShowcaseApp extends StatelessWidget {
  const HxShowcaseApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HxShowcase',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: HxTokens.ink,
          surface: HxTokens.paper,
        ),
        scaffoldBackgroundColor: HxTokens.paper,
        fontFamily: HxTokens.fontFamily,
      ),
      home: const _Showcase(),
    );
  }
}

class _Showcase extends StatefulWidget {
  const _Showcase();
  @override
  State<_Showcase> createState() => _ShowcaseState();
}

class _ShowcaseState extends State<_Showcase> {
  String _id = '';
  Map<String, String> _props = {};

  @override
  void initState() {
    super.initState();
    _initFromLocation();
    window.addEventListener('message', _onMessage);
    // 握手：Flutter 的 Dart main() 是异步引导的，父页面在 iframe onLoad 时
    // postMessage 会早于本 listener 注册而丢消息——所以注册完主动报 ready，
    // 父页面等到 ready 再发 render（iframe src 里也带首屏路由兜底）。
    window.parent?.postMessage({'type': 'ready'}, '*');
  }

  @override
  void dispose() {
    window.removeEventListener('message', _onMessage);
    super.dispose();
  }

  void _onMessage(dynamic e) {
    final raw = e.data;
    try {
      // postMessage 走结构化克隆——同窗口/父子 iframe 的 data 进来是 Map/JSObject
      // 不是 String（URL 协议是 String）。两种都要吃。
      final m = raw is String
          ? jsonDecode(raw) as Map
          : (raw is Map ? raw : null);
      if (m == null || m['type'] != 'render') return;
      final payload = m['payload'];
      if (payload is! Map) return;
      setState(() {
        _id = (payload['component'] as String?) ?? _id;
        _props = (payload['props'] as Map?)?.map(
              (k, v) => MapEntry(k.toString(), v.toString()),
            ) ??
            _props;
      });
    } catch (_) { /* 忽略坏消息 */ }
  }

  void _initFromLocation() {
    // 优先读 index.html 内联脚本在**框架启动前**抓下的 URL——Flutter 的 URL
    // 策略会把 hash 归一化掉，main() 里读 window.location 时 hash 已经没了。
    final early = document.documentElement?.dataset['hxRoute'];
    final url = (early != null && early.isNotEmpty) ? early : window.location.href;
    final m = RegExp(r'#/preview/([\w-]+)\?([^#]*)').firstMatch(url);
    if (m == null) return;
    _id = m.group(1)!;
    _props = Uri.splitQueryString(m.group(2) ?? '');
  }

  void _syncTitle() {
    // 状态外显：面板/自动化可直接读 iframe 的 document.title 观测渲染态
    document.title = _id.isEmpty ? 'HxShowcase · ready' : 'HxShowcase · $_id (${_props['variant'] ?? ''})';
  }

  @override
  Widget build(BuildContext context) {
    _syncTitle();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: _id.isEmpty ? const _Ready() : _dispatch(_id, _props),
        ),
      ),
    );
  }

  Widget _dispatch(String id, Map<String, String> p) {
    return switch (id) {
      'button' => HxButton(
        variant: p['variant'] ?? 'primary',
        size: p['size'] ?? 'md',
        disabled: p['disabled'] == 'true',
        label: id,
      ),
      'tag' => HxTag(
        variant: p['variant'] ?? 'info',
        size: p['size'] ?? 'md',
        label: id,
      ),
      _ => _Placeholder(reason: '组件 $id 尚未在本 showcase 中实现（dispatch 已知 id：button / tag）'),
    };
  }
}

class _Ready extends StatelessWidget {
  const _Ready();
  @override
  Widget build(BuildContext context) {
    return Text('HxShowcase ready · waiting for render()',
        style: const TextStyle(color: HxTokens.mid, fontSize: 12));
  }
}

class _Placeholder extends StatelessWidget {
  final String reason;
  const _Placeholder({required this.reason});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Text(reason, style: const TextStyle(color: HxTokens.mid, fontSize: 12)),
    );
  }
}
