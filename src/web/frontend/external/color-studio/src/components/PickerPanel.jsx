import { jsx, jsxs } from "react/jsx-runtime";
import { useColorStudio } from "../state/useColorStudio";
import { useEyedropper } from "../hooks/useEyedropper";
import { addEntryToActivePalette } from "../utils/paletteActions";
import { Btn } from "./ui/Btn";
import { ImageColorPicker } from "./ImageColorPicker";
function PickerPanel({ onPicked }) {
  const { setDoc } = useColorStudio();
  const { isSupported, open } = useEyedropper();
  const addPicked = (hex) => {
    if (!hex) return;
    setDoc((d) => addEntryToActivePalette(d, hex, "eyedropper"));
    onPicked?.(hex);
  };
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-picker", children: [
    /* @__PURE__ */ jsx(
      Btn,
      {
        variant: "secondary",
        icon: "eyedropper",
        disabled: !isSupported,
        onClick: () => open().then((h) => h && addPicked(h)),
        title: isSupported ? "\u6D4F\u89C8\u5668\u539F\u751F\u5C4F\u5E55\u53D6\u8272" : "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301 EyeDropper API",
        "aria-label": "\u5C4F\u5E55\u53D6\u8272",
        children: isSupported ? "\u5C4F\u5E55\u53D6\u8272" : "\u4E0D\u652F\u6301\u53D6\u8272\u5668"
      }
    ),
    /* @__PURE__ */ jsx(ImageColorPicker, { onPick: addPicked })
  ] });
}
export {
  PickerPanel
};
