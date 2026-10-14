async function fetch(url, opts = {}) {
  const res = await globalThis.fetch(url, { credentials: "same-origin", ...opts });
  const ct = res.headers.get("content-type") || "";
  return {
    ok: res.ok,
    status: res.status,
    async json() {
      return res.json();
    },
    async text() {
      return res.text();
    },
    headers: res.headers,
    _ct: ct
  };
}
export {
  fetch
};
