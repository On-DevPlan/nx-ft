// Hx 组件的 widget 测试：直接 pump 组件本身，不走 HxShowcaseApp——
// App 的 _syncTitle 依赖 dart:html（web 专属），在 flutter test 的 VM 环境里
// 没有 document，pump 整个 App 必炸。组件是纯 widget，这里测它们的
// 参数 → 渲染契约（label 出现、disabled 生效、variant 分支）。
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hx_showcase/hx_button.dart';

Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('HxButton：label 渲染、disabled 时不可点', (tester) async {
    await tester.pumpWidget(wrap(HxButton(
      variant: 'primary', size: 'md', disabled: false, label: '确定',
    )));
    expect(find.text('确定'), findsOneWidget);

    await tester.pumpWidget(wrap(HxButton(
      variant: 'primary', size: 'md', disabled: true, label: '禁用',
    )));
    final btn = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(btn.onPressed, isNull, reason: 'disabled=true 时 onPressed 应为 null');
  });

  testWidgets('HxTag：四种状态色分支都能渲染', (tester) async {
    for (final v in ['info', 'ok', 'warn', 'err']) {
      await tester.pumpWidget(wrap(HxTag(
        variant: v, size: 'md', label: '标签-$v',
      )));
      expect(find.text('标签-$v'), findsOneWidget);
    }
  });

  testWidgets('HxCard：titled 出头部、plain 不出、padded=false 无留白', (tester) async {
    await tester.pumpWidget(wrap(const HxCard(
      variant: 'titled', padded: true, title: '标题', child: '内容',
    )));
    expect(find.text('标题'), findsOneWidget);
    expect(find.text('内容'), findsOneWidget);

    await tester.pumpWidget(wrap(const HxCard(
      variant: 'plain', padded: false, title: '标题', child: '内容',
    )));
    expect(find.text('标题'), findsNothing, reason: 'plain 不渲染头部');
  });
}
