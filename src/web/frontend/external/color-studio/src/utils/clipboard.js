async function writeClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("clipboard API unavailable");
  }
  await navigator.clipboard.writeText(text);
}
export {
  writeClipboard
};
