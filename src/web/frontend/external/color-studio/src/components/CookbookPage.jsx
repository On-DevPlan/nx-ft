import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Icon } from "./ui/Icon";
import { Btn } from "./ui/Btn";
import { useEscClose } from "../hooks/useEscClose";
const CHAPTERS = [
  { id: "basics", title: "\u8272\u5F69\u57FA\u7840", brief: "HSB / \u8272\u8F6E / \u683C\u5F0F" },
  { id: "harmony", title: "\u951A\u8272\u4E0E\u548C\u58F0", brief: "5 \u79CD\u89C4\u5219\u4E0E\u573A\u666F" },
  { id: "filters", title: "\u6EE4\u955C", brief: "7 \u79CD\u53C2\u6570\u4E0E\u573A\u666F" }
];
function CookbookPage({ open, onClose }) {
  const [chapter, setChapter] = useState("basics");
  // useEscClose 必须在早退之前调用（同 ExportModal：Shell 无条件挂载，hook 在
  // return 之后会在开→关切换时报 React #310）。
  useEscClose(open, onClose);
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-cookbook", role: "dialog", "aria-modal": "true", "aria-label": "色彩工坊 · 案例手册", children: [
    /* @__PURE__ */ jsxs("header", { className: "sl-cs-cookbook__head", children: [
      /* @__PURE__ */ jsxs("h2", { children: [
        /* @__PURE__ */ jsx(Icon, { name: "book", size: 16 }),
        " 色彩工坊 · 案例手册"
      ] }),
      /* @__PURE__ */ jsx(
        Btn,
        {
          variant: "ghost",
          size: "sm",
          iconOnly: true,
          icon: "close",
          onClick: onClose,
          "aria-label": "\u5173\u95ED",
          className: "sl-cs-cookbook__close"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-cookbook__body", children: [
      /* @__PURE__ */ jsx("nav", { className: "sl-cs-cookbook__nav", "aria-label": "\u7AE0\u8282", children: /* @__PURE__ */ jsx("ul", { children: CHAPTERS.map((c, i) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: `sl-cs-cookbook__navbtn ${chapter === c.id ? "is-active" : ""}`,
          onClick: () => setChapter(c.id),
          children: [
            /* @__PURE__ */ jsx("span", { className: "sl-cs-cookbook__navnum", children: String(i + 1).padStart(2, "0") }),
            /* @__PURE__ */ jsx("span", { className: "sl-cs-cookbook__navtitle", children: c.title }),
            /* @__PURE__ */ jsx("span", { className: "sl-cs-cookbook__navbrief", children: c.brief })
          ]
        }
      ) }, c.id)) }) }),
      /* @__PURE__ */ jsxs("article", { className: "sl-cs-cookbook__article", children: [
        chapter === "basics" && /* @__PURE__ */ jsx(BasicsChapter, {}),
        chapter === "harmony" && /* @__PURE__ */ jsx(HarmonyChapter, {}),
        chapter === "filters" && /* @__PURE__ */ jsx(FiltersChapter, {})
      ] })
    ] })
  ] });
}
function BasicsChapter() {
  return /* @__PURE__ */ jsxs(Section, { title: "\u8272\u5F69\u57FA\u7840", subtitle: "HSB\u3001\u8272\u8F6E\u4E0E\u8272\u5F69\u683C\u5F0F", children: [
    /* @__PURE__ */ jsx(Block, { title: "\u8272\u5F69\u4E09\u8981\u7D20(HSB)", children: /* @__PURE__ */ jsxs("ul", { children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "Hue \u8272\u76F8" }),
        ":\u989C\u8272\u79CD\u7C7B,0\xB0 \u7EA2 \u2192 120\xB0 \u7EFF \u2192 240\xB0 \u84DD \u2192 360\xB0 \u56DE\u5230\u7EA2\u3002"
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "Saturation \u9971\u548C\u5EA6" }),
        ":\u989C\u8272\u7EAF\u5EA6,0% \u7070 \u2192 100% \u7EAF\u8272\u3002"
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "Brightness \u660E\u5EA6" }),
        ":\u660E\u6697,0% \u9ED1 \u2192 100% \u4EAE\u3002"
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Block, { title: "\u8272\u76D8\u4E0A\u7684\u6620\u5C04", children: /* @__PURE__ */ jsxs("p", { children: [
      "Color Studio \u8272\u76D8\u7528 ",
      /* @__PURE__ */ jsx("b", { children: "\u89D2\u5EA6=\u8272\u76F8" }),
      "\u3001",
      /* @__PURE__ */ jsx("b", { children: "\u534A\u5F84=\u9971\u548C\u5EA6" }),
      "\u3001",
      /* @__PURE__ */ jsx("b", { children: "\u660E\u5EA6\u6ED1\u6746" }),
      "\u63A7\u5236\u660E\u5EA6\u3002 \u4E2D\u5FC3\u662F\u7070\u767D(s=0),\u8FB9\u7F18\u662F\u5168\u9971\u548C\u7EAF\u8272(s=1)\u3002"
    ] }) }),
    /* @__PURE__ */ jsxs(Block, { title: "\u8BE6\u60C5\u9762\u677F\u683C\u5F0F", children: [
      /* @__PURE__ */ jsx("p", { children: "\u8BE6\u60C5\u9762\u677F\u652F\u6301 6 \u79CD\u683C\u5F0F\u4E92\u8F6C:HEX / RGB / HSL / LAB / LCH / OKLCH\u3002\u590D\u5236\u6309\u94AE\u4EE5\u4F60\u9009\u7684\u683C\u5F0F\u590D\u5236(\u6240\u89C1\u5373\u6240\u590D\u5236)\u3002" }),
      /* @__PURE__ */ jsxs("ul", { children: [
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "HEX/RGB" }),
          ":\u5C4F\u5E55\u5E38\u7528,\u76F4\u89C2\u3002"
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "HSL" }),
          ":\u8272\u76F8/\u9971\u548C\u5EA6/\u660E\u5EA6,\u9002\u5408\u548C\u58F0\u8BA1\u7B97(\u672C\u7EC4\u4EF6\u7684 5 \u79CD\u548C\u58F0\u89C4\u5219\u90FD\u5728 HSL \u7A7A\u95F4\u751F\u6210)\u3002"
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "LAB / LCH" }),
          ":\u611F\u77E5\u5747\u5300,\u505A\u8272\u5F69\u5BF9\u6BD4\u4E0E\u8272\u5DEE\u8BA1\u7B97\u66F4\u51C6\u3002"
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "OKLCH" }),
          ":\u73B0\u4EE3\u611F\u77E5\u8272\u5F69\u7A7A\u95F4,\u6E10\u53D8\u4E0E\u6697\u8272\u6A21\u5F0F\u66F4\u53CB\u597D\u3002"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Block, { title: "WCAG \u5BF9\u6BD4\u5EA6", children: /* @__PURE__ */ jsx("p", { children: "\u8BE6\u60C5\u9762\u677F\u5E95\u90E8\u663E\u793A\u5F53\u524D\u8272\u5BF9\u9ED1/\u5BF9\u767D\u7684 WCAG \u7B49\u7EA7(AAA/AA/AA Large/A)\u3002 \u4E00\u822C UI \u6B63\u6587\u5EFA\u8BAE \u2265 AA(\u5BF9\u6BD4\u5EA6 \u2265 4.5);\u6807\u9898/\u5927\u5B57 \u2265 AA Large(3.0)\u3002" }) })
  ] });
}
function HarmonyChapter() {
  return /* @__PURE__ */ jsxs(Section, { title: "\u951A\u8272\u4E0E\u548C\u58F0", subtitle: "5 \u79CD\u89C4\u5219\u5404\u81EA\u7684\u751F\u6210\u673A\u5236\u4E0E\u6700\u4F73\u573A\u666F", children: [
    /* @__PURE__ */ jsxs(Block, { title: "\u4EC0\u4E48\u662F\u951A\u8272(anchor)", children: [
      /* @__PURE__ */ jsx("p", { children: "\u951A\u8272\u662F\u6D3E\u751F\u89C4\u5219\u7684\u57FA\u51C6\u8272\u3002\u8272\u76D8\u4E0A\u7684\u6807\u8BB0:" }),
      /* @__PURE__ */ jsxs("ul", { children: [
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "\u5B9E\u5FC3\u767D\u8FB9\u70B9" }),
          ":\u5F53\u524D\u9009\u4E2D\u8272\u5361(\u951A\u70B9)\u5728\u8272\u76D8\u4E0A\u7684\u4F4D\u7F6E\u3002"
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "\u7A7A\u5FC3\u5C0F\u5706\u70B9" }),
          ":\u6D3E\u751F\u8272\u5728\u8272\u76D8\u4E0A\u7684\u9884\u6D4B\u4F4D\u7F6E \u2014\u2014 \u89D2\u5EA6\u76F8\u5BF9\u951A\u70B9\u8272\u76F8\u504F\u79FB,\u6DF1\u5EA6=\u951A\u70B9\u9971\u548C\u5EA6\u3002"
        ] }),
        /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("b", { children: "\u5355\u8272\u89C4\u5219" }),
          "\u4E0D\u753B\u70B9,\u6539\u753B 4 \u5708\u540C\u5FC3\u865A\u7EBF\u5706(\u660E\u5EA6\u68AF\u5EA6\u793A\u610F)\u3002"
        ] })
      ] }),
      /* @__PURE__ */ jsx("p", { children: "\u951A\u8272\u53D8\u5316\u65F6,\u6D3E\u751F\u8272\u8DDF\u7740\u53D8(\u5F00 autoFill \u65F6\u5B9E\u65F6\u843D\u8272)\u3002" })
    ] }),
    /* @__PURE__ */ jsx(Block, { title: "5 \u79CD\u548C\u58F0\u89C4\u5219", children: /* @__PURE__ */ jsxs("table", { className: "sl-cs-cookbook__table", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: "\u89C4\u5219" }),
        /* @__PURE__ */ jsx("th", { children: "\u8272\u76F8\u504F\u79FB" }),
        /* @__PURE__ */ jsx("th", { children: "\u8F93\u51FA\u6570" }),
        /* @__PURE__ */ jsx("th", { children: "\u89C6\u89C9\u7279\u5F81" })
      ] }) }),
      /* @__PURE__ */ jsxs("tbody", { children: [
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "\u4E92\u8865" }),
          /* @__PURE__ */ jsx("td", { children: "+180\xB0" }),
          /* @__PURE__ */ jsx("td", { children: "2" }),
          /* @__PURE__ */ jsx("td", { children: "\u6700\u5F3A\u5BF9\u6BD4\u3001\u5BF9\u7ACB\u611F" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "\u4E09\u89D2" }),
          /* @__PURE__ */ jsx("td", { children: "+120\xB0 / +240\xB0" }),
          /* @__PURE__ */ jsx("td", { children: "3" }),
          /* @__PURE__ */ jsx("td", { children: "\u5E73\u8861\u53C8\u6709\u6D3B\u529B" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "\u5206\u88C2\u4E92\u8865" }),
          /* @__PURE__ */ jsx("td", { children: "+150\xB0 / +210\xB0" }),
          /* @__PURE__ */ jsx("td", { children: "3" }),
          /* @__PURE__ */ jsx("td", { children: "\u4E92\u8865\u7684\u67D4\u548C\u7248,\u6709\u5BF9\u6BD4\u4F46\u4E0D\u523A\u773C" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "\u7C7B\u4F3C" }),
          /* @__PURE__ */ jsx("td", { children: "\u221230\xB0 / +30\xB0" }),
          /* @__PURE__ */ jsx("td", { children: "3" }),
          /* @__PURE__ */ jsx("td", { children: "\u548C\u8C10\u7EDF\u4E00,\u7F3A\u4E4F\u5BF9\u6BD4" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "\u5355\u8272" }),
          /* @__PURE__ */ jsx("td", { children: "(\u4EC5\u660E\u5EA6)" }),
          /* @__PURE__ */ jsx("td", { children: "5" }),
          /* @__PURE__ */ jsx("td", { children: "\u6700\u7A33,\u9760\u660E\u5EA6\u5C42\u6B21" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(RuleScenarios, {})
  ] });
}
function RuleScenarios() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Block, { title: "\u4E92\u8865 \u2014 \u6700\u5F3A\u5BF9\u6BD4", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9002\u5408:" }),
        "CTA \u6309\u94AE\u3001\u5F3A\u8C03\u6587\u5B57\u3001\u5355\u70B9\u7126\u70B9\u7684\u54C1\u724C\u8272\u3001\u4F20\u5355/\u6D77\u62A5\u4E3B\u8272\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F\u611F:" }),
        '\u5496\u5561\u5E97\u7684"\u7279\u4EF7\u6807\u7B7E"\u3001\u7535\u5546\u4E3B\u6309\u94AE\u3001\u79D1\u6280\u54C1\u724C\u7684\u5F3A\u8C03\u8272(\u84DD\u2194\u6A59)\u3002'
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6CE8\u610F:" }),
        "50/50 \u5E73\u5206\u4F1A\u5F88\u624E\u773C;\u5EFA\u8BAE\u4E3B\u8272 70%,\u8865\u8272 30%,\u6216\u7528\u5176\u4E2D\u4E00\u8272\u505A\u80CC\u666F/\u8FB9\u6846\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "\u4E09\u89D2 \u2014 \u5E73\u8861\u53C8\u6D3B\u6CFC", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9002\u5408:" }),
        "\u63D2\u753B\u3001\u5361\u901A/\u513F\u7AE5\u5411\u3001\u6E38\u620F UI\u3001\u54C1\u724C\u4E3B\u8F85\u8272\u642D\u914D(3 \u8272\u4E3B\u9898)\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F\u611F:" }),
        "\u513F\u7AE5 App \u4E3B\u9898\u8272\u3001\u73AF\u4FDD\u54C1\u724C(\u7EFF/\u9EC4/\u84DD)\u3001\u8282\u65E5\u8FD0\u8425\u6D3B\u52A8\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6CE8\u610F:" }),
        "\u4E09\u8272\u5747\u5300\u4E5F\u5BB9\u6613\u4E71;\u901A\u5E38\u9009\u4E00\u8272\u4F5C\u4E3B(60%),\u5176\u4ED6\u4E24\u8272\u4F5C\u8F85(\u5404 20%)\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "\u5206\u88C2\u4E92\u8865 \u2014 \u4E92\u8865\u7684\u67D4\u548C\u7248", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9002\u5408:" }),
        "UI \u4E3B\u9898(\u80CC\u666F+\u5F3A\u8C03)\u3001\u4EEA\u8868\u76D8\u3001\u62A5\u544A\u56FE\u8868\u3001\u6574\u4F53\u54C1\u724C\u7684\u8FDB\u9636\u7248\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F\u611F:" }),
        '\u8F6F\u4EF6\u54C1\u724C\u8272(Slack \u7D2B)\u3001\u6570\u636E\u53EF\u89C6\u5316"\u4E3B+\u8F851+\u8F852"\u3001\u5E7F\u544A banner\u3002'
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u63A8\u8350:" }),
        "\u8FD9\u662F ",
        /* @__PURE__ */ jsx("b", { children: "\u6700\u5E38\u7528" }),
        " \u7684\u8FDB\u9636\u9009\u62E9 \u2014\u2014 \u6709\u5BF9\u6BD4,\u4F46\u4E0D\u523A\u773C;\u6BD4\u4E92\u8865\u7A33\u3001\u6BD4\u4E09\u89D2\u6709\u5BF9\u6BD4\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "\u7C7B\u4F3C \u2014 \u548C\u8C10\u7EDF\u4E00", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9002\u5408:" }),
        "\u80CC\u666F\u3001\u6E10\u53D8\u3001\u5927\u9762\u79EF\u6C1B\u56F4\u8272\u3001UI \u4E2D\u6027\u533A\u3001\u8F7B\u76C8\u63D2\u753B\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F\u611F:" }),
        "\u767B\u5F55\u9875\u80CC\u666F\u6E10\u53D8\u3001\u9605\u8BFB\u7C7B App\u3001\u51A5\u60F3/\u5065\u5EB7\u7C7B\u54C1\u724C\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6CE8\u610F:" }),
        "\u7C7B\u4F3C\u8272\u5BF9\u6BD4\u5EA6\u4F4E,\u6587\u5B57\u5C42\u9700\u8981\u9760 ",
        /* @__PURE__ */ jsx("b", { children: "\u660E\u5EA6\u5DEE" }),
        " \u62C9\u5F00(\u6DF1\u5E95\u6D45\u5B57)\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "\u5355\u8272 \u2014 \u6700\u7A33\u7684\u9009\u62E9", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9002\u5408:" }),
        "\u6781\u7B80\u98CE\u3001\u6570\u636E\u53EF\u89C6\u5316(\u540C\u7CFB\u5217\u591A\u6863)\u3001\u72B6\u6001\u8272(\u6DF1\u6D45\u8868\u793A\u91CD\u8981\u6027)\u3001\u8868\u5355 hover/disabled\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F\u611F:" }),
        "\u4F01\u4E1A SaaS \u4E3B\u8272(\u84DD\u8272 + 5 \u6863\u660E\u5EA6)\u3001Material/iOS \u98CE\u683C\u6309\u94AE\u3001\u53EF\u8BBF\u95EE\u6027\u9AD8\u7684 UI\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6CE8\u610F:" }),
        "\u5168\u9760\u660E\u5EA6,\u4E2D\u95F4\u6863\u5BB9\u6613\u7CCA\u5728\u4E00\u8D77;\u5EFA\u8BAE\u8DF3\u6863(\u7528 1/3/5 \u6863\u800C\u975E 2/3/4)\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "autoFill \u5F00\u5173", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        "\u5F00:\u951A\u8272\u53D8\u5316 \u2192 \u6D3E\u751F\u8272\u5B9E\u65F6\u8DDF\u7740\u53D8(\u4FDD\u6301\u51E0\u4F55\u5173\u7CFB)\u3002\u9002\u5408 ",
        /* @__PURE__ */ jsx("b", { children: "\u63A2\u7D22\u9636\u6BB5" }),
        ",\u5FEB\u901F\u6D4F\u89C8\u53D8\u4F53\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        "\u5173:\u6D3E\u751F\u8272\u56FA\u5B9A\u4E0D\u53D8\u3002\u9002\u5408 ",
        /* @__PURE__ */ jsx("b", { children: "\u5FAE\u8C03\u9636\u6BB5" }),
        ",\u4F60\u60F3\u9501\u5B9A\u6D3E\u751F\u8272\u624B\u52A8\u8C03\u6BCF\u4E00\u4E2A\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u63A8\u8350\u6D41\u7A0B:" }),
        "\u5148\u9009\u951A\u8272 \u2192 \u9009\u89C4\u5219 \u2192 \u5F00 autoFill \u62D6\u951A\u8272\u6D4F\u89C8\u53D8\u4F53 \u2192 \u6EE1\u610F\u540E\u5173 autoFill \u2192 \u624B\u52A8\u5FAE\u8C03\u6BCF\u4E2A\u8272\u5361\u3002"
      ] })
    ] })
  ] });
}
function FiltersChapter() {
  return /* @__PURE__ */ jsxs(Section, { title: "\u6EE4\u955C\u6808", subtitle: "7 \u79CD\u53C2\u6570\u3001\u975E\u7834\u574F\u6027\u3001\u53EF\u70D8\u7119", children: [
    /* @__PURE__ */ jsxs(Block, { title: "\u4EC0\u4E48\u662F\u975E\u7834\u574F\u6027\u6EE4\u955C", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        "\u6EE4\u955C\u6808\u53EA\u5B58",
        /* @__PURE__ */ jsx("b", { children: "\u53C2\u6570" }),
        ",\u4E0D\u6539\u8272\u5361 hex;\u9884\u89C8\u65F6\u901A\u8FC7 CSS filter \u5B9E\u65F6\u6D3E\u751F\u3002 \u6EE1\u610F\u540E\u53EF\u4EE5 ",
        /* @__PURE__ */ jsx("b", { children: "\u70D8\u7119(bake)" }),
        ",\u628A\u7ED3\u679C\u5199\u56DE hex,\u6C38\u4E45\u751F\u6548\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        "\u6EE4\u955C\u6808",
        /* @__PURE__ */ jsx("b", { children: "\u6709\u5E8F" }),
        ":\u62D6\u52A8\u987A\u5E8F\u4F1A\u6539\u53D8\u7ED3\u679C\u3002\u5148 brightness(0) \u518D invert =\u767D;\u5148 invert \u518D brightness(0) =\u9ED1\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsx(Block, { title: "7 \u79CD\u53C2\u6570", children: /* @__PURE__ */ jsxs("table", { className: "sl-cs-cookbook__table", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: "\u53C2\u6570" }),
        /* @__PURE__ */ jsx("th", { children: "\u8303\u56F4" }),
        /* @__PURE__ */ jsx("th", { children: "\u4F5C\u7528" })
      ] }) }),
      /* @__PURE__ */ jsxs("tbody", { children: [
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "brightness" }),
          /* @__PURE__ */ jsx("td", { children: "0..300 (100 \u4E2D\u6027)" }),
          /* @__PURE__ */ jsx("td", { children: "\u538B\u6697/\u63D0\u4EAE" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "contrast" }),
          /* @__PURE__ */ jsx("td", { children: "0..300 (100 \u4E2D\u6027)" }),
          /* @__PURE__ */ jsx("td", { children: "\u589E\u5F3A/\u51CF\u5F31\u660E\u6697\u5DEE" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "saturate" }),
          /* @__PURE__ */ jsx("td", { children: "0..300 (100 \u4E2D\u6027)" }),
          /* @__PURE__ */ jsx("td", { children: "\u9971\u548C\u5EA6(0=\u7070)" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "hue-rotate" }),
          /* @__PURE__ */ jsx("td", { children: "0..360 \u5EA6" }),
          /* @__PURE__ */ jsx("td", { children: "\u6574\u6279\u8F6C\u8272\u76F8" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "grayscale" }),
          /* @__PURE__ */ jsx("td", { children: "0..100 %" }),
          /* @__PURE__ */ jsx("td", { children: "\u53BB\u8272" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "sepia" }),
          /* @__PURE__ */ jsx("td", { children: "0..100 %" }),
          /* @__PURE__ */ jsx("td", { children: "\u6696\u9EC4/\u590D\u53E4" })
        ] }),
        /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: "invert" }),
          /* @__PURE__ */ jsx("td", { children: "0..100 %" }),
          /* @__PURE__ */ jsx("td", { children: "\u53CD\u8272" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(FilterScenarios, {}),
    /* @__PURE__ */ jsx(Block, { title: "\u4F7F\u7528\u6D41\u7A0B", children: /* @__PURE__ */ jsxs("ul", { children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u63A2\u7D22" }),
        ":\u52A0\u53C2\u6570\u3001\u62D6\u52A8\u987A\u5E8F\u770B\u6548\u679C,\u4E0D\u7834\u574F\u539F hex\u3002"
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u9884\u89C8" }),
        ":\u6EE1\u610F\u540E\u518D\u5F00/\u5173,\u5B9E\u65F6\u770B\u771F\u5B9E\u6548\u679C\u3002"
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u70D8\u7119" }),
        ":\u5B9A\u7A3F\u540E\u7528\u70D8\u7119\u529F\u80FD\u628A\u7ED3\u679C\u5199\u56DE hex,\u5BFC\u51FA\u65F6\u5C31\u662F\u65B0\u8272\u3002"
      ] })
    ] }) })
  ] });
}
function FilterScenarios() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Block, { title: "brightness / contrast \u2014 \u6574\u4F53\u8C03\u5B50", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "brightness" }),
        ":<100 \u538B\u6697\u3001>100 \u63D0\u4EAE\u3002\u7ED9\u56FE\u7247\u8272\u677F\u7EDF\u4E00\u6574\u4F53\u4EAE\u5EA6\u540E\u518D\u5206\u7EC4\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "contrast" }),
        ":>100 \u589E\u5F3A\u660E\u6697\u3001<100 \u62C9\u5E73\u3002CTA/\u6807\u9898\u8C03\u9AD8\u5BF9\u6BD4\u63D0\u9AD8\u53EF\u8BFB;\u80CC\u666F\u8C03\u4F4E\u5BF9\u6BD4\u8BA9\u524D\u666F\u66F4\u7A81\u51FA\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "saturate \u2014 \u8272\u5F69\u7EDF\u4E00", children: [
      /* @__PURE__ */ jsx("p", { children: "\u7EDF\u4E00\u591A\u6765\u6E90\u56FE\u7247/\u622A\u56FE\u7684\u8272\u5F69\u611F:\u591A\u5F20\u56FE\u8272\u8C03\u4E0D\u7EDF\u4E00\u65F6,\u7528 saturate \u628A\u5B83\u4EEC\u8C03\u5230\u540C\u4E00\u9971\u548C\u5EA6\u6863\u3002" }),
      /* @__PURE__ */ jsx("p", { children: "0 = \u7EAF\u7070(\u770B\u660E\u5EA6\u5206\u5E03),>100 \u8BA9\u8272\u5F69\u66F4\u8273\u3002" })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "hue-rotate \u2014 \u5FEB\u901F\u6362\u4E3B\u9898", children: [
      /* @__PURE__ */ jsx("p", { children: '\u6574\u6279\u989C\u8272\u8F6C\u8272\u76F8\u3002\u9002\u5408\u5FEB\u901F\u5C1D\u8BD5"\u5982\u679C\u4E3B\u8272\u662F\u7EA2\u800C\u975E\u84DD\u4F1A\u600E\u6837"\u3002' }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6CE8\u610F:" }),
        "hue-rotate \u4E0E HSL \u8272\u76F8\u504F\u79FB\u4E0D\u662F\u7CBE\u786E\u5BF9\u5E94(\u4E00\u4E2A\u662F HSL,\u4E00\u4E2A\u662F YIQ \u8FD1\u4F3C),\u8F6C\u51FA\u7684\u8272\u76F8\u4F1A\u504F\u79FB\u4F46\u4E0D\u4F1A\u7CBE\u51C6\u547D\u4E2D\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "grayscale / sepia \u2014 \u72B6\u6001\u8272/\u6000\u65E7", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "grayscale 100%" }),
        ":\u505A\u7981\u7528\u6001\u3001\u5355\u8272\u6A21\u5F0F\u3001\u6697\u8272 UI\u3002"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "sepia" }),
        ":\u6000\u65E7/\u6696\u8C03/\u505A\u65E7\u7167\u7247\u6548\u679C\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "invert \u2014 \u53CD\u8272\u9884\u89C8", children: [
      /* @__PURE__ */ jsx("p", { children: "\u53CD\u8F6C\u5168\u90E8\u901A\u9053(\u767D\u53D8\u9ED1\u3001\u7EA2\u53D8\u9752\u7B49)\u3002" }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u573A\u666F:" }),
        "\u6697\u8272\u6A21\u5F0F\u5FEB\u901F\u9884\u89C8(\u6D4B\u8BD5\u8BBE\u8BA1\u5728\u6697\u5E95\u4E0B\u7684\u53EF\u8BFB\u6027)\u3001\u7279\u6B8A\u827A\u672F\u6548\u679C\u3002"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Block, { title: "\u7EC4\u5408 \u2014 \u5B9E\u7528\u914D\u65B9", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u67D4\u548C\u6696\u8272\u7167\u7247:" }),
        " saturate 110 + sepia 20 + brightness 105 + contrast 105"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u6697\u591C\u4E3B\u9898\u9884\u89C8:" }),
        " invert 100(\u6574\u6279\u53CD\u8272\u540E,\u518D\u4EBA\u4E3A\u8C03\u5355\u8272)"
      ] }),
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "\u7EDF\u4E00\u4F4E\u9971\u548C:" }),
        " saturate 70(\u6574\u4F53\u504F\u67D4\u548C)"
      ] })
    ] })
  ] });
}
function Section({ title, subtitle, children }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("header", { className: "sl-cs-cookbook__secthead", children: [
      /* @__PURE__ */ jsx("h3", { children: title }),
      /* @__PURE__ */ jsx("p", { className: "sl-cs-cookbook__subtitle", children: subtitle })
    ] }),
    children
  ] });
}
function Block({ title, children }) {
  return /* @__PURE__ */ jsxs("section", { className: "sl-cs-cookbook__block", children: [
    /* @__PURE__ */ jsx("h4", { children: title }),
    children
  ] });
}
export {
  CookbookPage
};
