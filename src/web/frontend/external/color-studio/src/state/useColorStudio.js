import { useContext } from "react";
import { ColorStudioContext } from "./ColorStudioContext";
function useColorStudio() {
  const v = useContext(ColorStudioContext);
  if (!v) throw new Error("useColorStudio must be called inside <ColorStudioProvider>");
  return v;
}
export {
  useColorStudio
};
