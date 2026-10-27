/* D3M0N.IN store core.
   Loads data/products.enc, decrypts AES-256-GCM in memory, never writes the JSON back.
   Key is hardcoded on purpose. Casual GitHub reads still see ciphertext. */
(function () {
  var PASS = "d3m0n.in-products-aes-2026";
  var WA = "917078343501";
  var cache = null;

  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  }

  function b64ToBytes(b64) {
    var bin = atob(b64.replace(/\s+/g, ""));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function ytId(value) {
    var s = String(value || "").trim();
    var m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(s) ? s : "";
  }

  function buy(product) {
    var text = "Hi, I want to buy #" + product.id + " " + product.name + ". Please share details.";
    location.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
  }

  function protect() {
    document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    document.addEventListener("dragstart", function (e) {
      if (e.target && e.target.tagName === "IMG") e.preventDefault();
    });
    document.addEventListener("selectstart", function (e) {
      if (!e.target.closest(".copy")) e.preventDefault();
    });
  }

  async function decrypt(b64) {
    var raw = b64ToBytes(b64);
    var iv = raw.slice(0, 12);
    var data = raw.slice(12);
    var key = await crypto.subtle.importKey("raw", await sha256(PASS), "AES-GCM", false, ["decrypt"]);
    var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function load() {
    if (cache) return cache;
    var res = await fetch("data/products.enc", { cache: "no-store" });
    if (!res.ok) throw new Error("products.enc missing");
    var text = await res.text();
    var data = await decrypt(text);
    data.products = (data.products || []).map(function (p) {
      p.youtubeId = ytId(p.youtube);
      p.keywords = p.keywords || [];
      p.images = p.images || [];
      p.comparison = p.comparison || { ai: [], ours: [], others: [] };
      p.marketplaces = p.marketplaces || [];
      return p;
    });
    cache = data;
    return data;
  }

  function byId(data, id) {
    return (data.products || []).filter(function (p) { return p.id === id; })[0] || null;
  }

  window.D3 = { load: load, buy: buy, ytId: ytId, protect: protect, byId: byId, WA: WA };
})();
