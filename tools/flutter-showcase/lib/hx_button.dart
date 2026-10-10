// hx_button.dart — 真实的 Flutter 按钮：映射 registry/flutter/button/theme.json 的
// nx tokens 词汇。路由参数 → widget 行为一一对应（variant / size / disabled）。
import 'package:flutter/material.dart';

class HxTokens {
  // 与 registry/flutter/button/theme.json 一一对应
  static const ink = Color(0xFF0B57D0);
  static const paper = Colors.white;
  static const soft = Color(0xFFF1F4F9);
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
    return Container(
      height: h,
      padding: EdgeInsets.symmetric(horizontal: size == 'sm' ? 8 : 10),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(h / 2)),
      alignment: Alignment.center,
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: fs, fontWeight: FontWeight.w500, fontFamily: HxTokens.fontFamily),
      ),
    );
  }
}
