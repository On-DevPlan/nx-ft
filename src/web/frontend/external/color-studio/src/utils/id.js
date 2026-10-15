const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function makeId(now = Date.now()) {
  return encodeTime(now, 10) + encodeRandom(16);
}
function encodeTime(t, len) {
  let out = "";
  t = Math.max(0, Math.floor(t));
  for (let i = len - 1; i >= 0; i--) {
    const mod = t % 32;
    out = ALPHABET[mod] + out;
    t = (t - mod) / 32;
  }
  return out;
}
function encodeRandom(len) {
  let out = "";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % 32];
  }
  return out;
}
export {
  makeId
};
