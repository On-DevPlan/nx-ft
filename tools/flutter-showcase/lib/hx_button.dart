// hx_button.dart — 真实的 Flutter 按钮：映射 registry/flutter/button/theme.json 的
// nx tokens 词汇。路由参数 → widget 行为一一对应（variant / size / disabled）。
import 'package:flutter/material.dart';

class HxTokens {
  // 与 registry/flutter/theme.json 一一对应
  static const ink = Color(0xFF0B57D0);
  static const paper = Colors.white;
  static const soft = Color(0xFFF1F4F9);
  static const soft2 = Color(0xFFDDE3EC);
  static const mid = Color(0xFF5A6470);
  static const fontFamily = 'Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';
  static const mdHeight = 36.0;
  static const smHeight = 28.0;
  static const radius = 4.0;
}

class HxButton extends StatelessWidget {
  final String variant; // primary | ghost
  final String size; // md | sm
  final bool disabled;
  final String label;
  const HxButton({
    super.key,
    required this.variant,
    required this.size,
    required this.disabled,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isGhost = variant == 'ghost';
    final h = size == 'sm' ? HxTokens.smHeight : HxTokens.mdHeight;
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(HxTokens.radius));
    final padding = EdgeInsets.symmetric(horizontal: size == 'sm' ? 10 : 14);
    final textStyle = TextStyle(
      fontFamily: HxTokens.fontFamily,
      fontSize: 13,
      fontWeight: FontWeight.w500,
    );
    final enabledStyle = ButtonStyle(
      shape: WidgetStatePropertyAll(shape),
      minimumSize: WidgetStatePropertyAll(Size(0, h)),
      padding: WidgetStatePropertyAll(padding),
      backgroundColor: WidgetStatePropertyAll(isGhost ? HxTokens.paper : HxTokens.ink),
      foregroundColor: WidgetStatePropertyAll(isGhost ? HxTokens.ink : HxTokens.paper),
      textStyle: WidgetStatePropertyAll(textStyle),
      side: WidgetStatePropertyAll(
        BorderSide(color: isGhost ? HxTokens.soft : HxTokens.ink),
      ),
      elevation: WidgetStatePropertyAll(0),
    );
    return ElevatedButton(
      onPressed: disabled ? null : () {},
      style: enabledStyle,
      child: Text(label),
    );
  }
}

// HxTag：状态徽章（color-mix 出来的 4 种状态用具体颜色表达——light/dark 都可读）
class HxTag extends StatelessWidget {
  final String variant; // info | ok | warn | err
  final String size; // md | sm
  final String label;
  const HxTag({super.key, required this.variant, required this.size, required this.label});
  @override
  Widget build(BuildContext context) {
    final h = size == 'sm' ? 18.0 : 20.0;
    final fs = size == 'sm' ? 11.0 : 12.0;
    Color bg;
    Color fg;
    switch (variant) {
      case 'ok':   { bg = const Color(0xFFDEF7E6); fg = const Color(0xFF0F7B3B); break; }
      case 'warn': { bg = const Color(0xFFFFF3C4); fg = const Color(0xFF8A6100); break; }
      case 'err':  { bg = const Color(0xFFFFEBE9); fg = const Color(0xFFB3261E); break; }
      case 'info':
      default:     { bg = const Color(0xFFE1EFFE); fg = HxTokens.ink;       break; }
    }
    // 注意不能用 Container(alignment: ...) 做竖直居中——alignment 会把容器
    // 撑满可用宽度（playground 里就是通栏色条）。Row(min) 收缩到内容宽，
    // crossAxisAlignment.center 负责在固定高度内竖直居中。
    return Container(
      height: h,
      padding: EdgeInsets.symmetric(horizontal: size == 'sm' ? 8 : 10),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(h / 2)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            label,
            style: TextStyle(color: fg, fontSize: fs, fontWeight: FontWeight.w500, fontFamily: HxTokens.fontFamily),
          ),
        ],
      ),
    );
  }
}

// HxCard：通用容器（registry/flutter/card）——1px 边框圈出版心，
// titled 头部 + 可关的内容留白。结构契约与 web 端 .card 对齐。
class HxCard extends StatelessWidget {
  final String variant; // titled | plain
  final bool padded;
  final String title; // 头部文案（variant=titled 时渲染）
  final String child; // 内容文案（showcase 用字符串代替任意 widget）
  const HxCard({
    super.key,
    required this.variant,
    required this.padded,
    required this.title,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final showHead = variant == 'titled';
    return Container(
      width: 320,
      decoration: BoxDecoration(
        color: HxTokens.paper,
        border: Border.all(color: HxTokens.soft2),
        borderRadius: BorderRadius.circular(HxTokens.radius),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHead)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: HxTokens.soft2)),
              ),
              child: Text(
                title,
                style: TextStyle(
                  color: HxTokens.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFamily: HxTokens.fontFamily,
                ),
              ),
            ),
          Padding(
            padding: padded ? const EdgeInsets.all(14) : EdgeInsets.zero,
            child: Text(
              child,
              style: TextStyle(color: const Color(0xFF1F2430), fontSize: 13, fontFamily: HxTokens.fontFamily),
            ),
          ),
        ],
      ),
    );
  }
}
