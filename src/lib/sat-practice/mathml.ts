function parseMathAttrs(raw: string) {
  const out: Record<string, string> = {};
  String(raw || "").replace(
    /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    (_, k: string, dq?: string, sq?: string, bare?: string) => {
      out[String(k).toLowerCase()] = dq ?? sq ?? bare ?? "";
      return "";
    },
  );
  return out;
}

function escapeMathText(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isVoidMathTag(name: string) {
  return /^(?:mspace|none|mprescripts|malignmark|maligngroup)$/i.test(name || "");
}

function splitMathSiblings(xml: string) {
  const s = String(xml || "");
  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] !== "<") {
      const next = s.indexOf("<", i);
      const text = s.slice(i, next < 0 ? s.length : next);
      if (text.trim()) parts.push(text);
      i = next < 0 ? s.length : next;
      continue;
    }
    const start = i;
    const gt = s.indexOf(">", i);
    if (gt < 0) {
      parts.push(s.slice(i));
      break;
    }
    const token = s.slice(i, gt + 1);
    const name = (token.match(/^<\/?\s*([a-zA-Z0-9:-]+)/) || [])[1] || "";
    const self = /\/>$/.test(token) || isVoidMathTag(name);
    if (token.startsWith("</") || self) {
      parts.push(token);
      i = gt + 1;
      continue;
    }
    let depth = 1;
    i = gt + 1;
    while (i < s.length && depth > 0) {
      const lt = s.indexOf("<", i);
      if (lt < 0) {
        i = s.length;
        break;
      }
      const g2 = s.indexOf(">", lt);
      if (g2 < 0) {
        i = s.length;
        break;
      }
      const t = s.slice(lt, g2 + 1);
      const n = (t.match(/^<\/?\s*([a-zA-Z0-9:-]+)/) || [])[1] || "";
      const same = n.toLowerCase() === name.toLowerCase();
      const tSelf = /\/>$/.test(t) || isVoidMathTag(n);
      if (same && t.startsWith("</")) depth--;
      else if (same && !t.startsWith("</") && !tSelf) depth++;
      i = g2 + 1;
    }
    parts.push(s.slice(start, i));
  }
  return parts.filter((p) => String(p).trim());
}

function fenceMo(ch: string) {
  return `<mo stretchy="false">${escapeMathText(ch)}</mo>`;
}

function expandMfenced(html: string) {
  const innermost =
    /<mfenced(\s[^>]*)?>((?:(?!<mfenced)[\s\S])*?)<\/mfenced>/gi;
  let s = String(html || "");
  let prev = "";
  let guard = 0;
  while (s !== prev && guard++ < 80) {
    prev = s;
    s = s.replace(innermost, (_full, attr: string, inner: string) => {
      const attrs = parseMathAttrs(attr);
      const open = attrs.open ?? "(";
      const close = attrs.close ?? ")";
      const seps = (attrs.separators == null ? "," : attrs.separators).replace(
        /\s+/g,
        "",
      );
      const kids = splitMathSiblings(inner);
      let body = "";
      if (!kids.length) body = inner || "";
      else {
        kids.forEach((kid, i) => {
          if (i > 0 && seps) {
            const ch = seps[Math.min(i - 1, seps.length - 1)] || "";
            if (ch) body += fenceMo(ch);
          }
          body += kid;
        });
      }
      return `<mrow>${fenceMo(open)}${body}${fenceMo(close)}</mrow>`;
    });
  }
  return s;
}

const FENCE_CHAR =
  "(?:[()\\[\\]{}|\\uFF08\\uFF09]|\\&(?:lpar|rpar|lsqb|rsqb|lcub|rcub);|\\&#(?:0*40|0*41|0*91|0*93|0*123|0*125);|\\&#x0*(?:28|29|5b|5d|7b|7d);)";

function unstretchFenceMos(html: string) {
  const re = new RegExp("<mo(\\s[^>]*)?>\\s*(" + FENCE_CHAR + ")\\s*</mo>", "gi");
  return String(html || "").replace(
    re,
    (_full, attr: string, ch: string) => {
      const a = attr || "";
      if (/stretchy\s*=\s*(['"]?)false\1/i.test(a)) return `<mo${a}>${ch}</mo>`;
      const cleaned = a.replace(/\s+stretchy\s*=\s*(["'][^"']*["']|[^\s>]+)/i, "");
      return `<mo${cleaned} stretchy="false">${ch}</mo>`;
    },
  );
}

function stripSrOnly(html: string) {
  return String(html || "").replace(
    /<(span|div|p|section)([^>]*?(?:sr-only|visually-hidden|visuallyHidden|screen-reader-only|cb-sr-only|sat-sr-only|ada-hidden|hidden-accessible)[^>]*)>[\s\S]*?<\/\1>/gi,
    "",
  );
}

function fixBlankMarkers(html: string) {
  let s = String(html || "");
  s = s.replace(
    /<math\b[^>]*\balttext\s*=\s*(['"])\s*blank\s*\1[^>]*>[\s\S]*?<\/math>/gi,
    "___",
  );
  s = s.replace(/<(mtext|mi|mn)(\s[^>]*)?>\s*blank\s*<\/\1>/gi, "___");
  s = s.replace(
    /<(span|div)(\s[^>]*)?>\s*blank\s*<\/\1>/gi,
    (full, _tag: string, attrs: string) => {
      if (
        /sr-only|visually-hidden|aria-hidden\s*=\s*['"]true['"]|class\s*=\s*['"][^'"]*\bblank\b/i.test(
          attrs || "",
        )
      ) {
        return "";
      }
      return full;
    },
  );
  s = s.replace(/_{2,}\s*blank\b/gi, "___");
  s = s.replace(/(&nbsp;|\s|_)*_{2,}(&nbsp;|\s|_)*___/g, "___");
  s = s.replace(/_{6,}/g, "___");
  return s;
}

export function fixMathHtml(html: string) {
  const raw = String(html || "");
  if (!raw) return raw;
  let s = stripSrOnly(raw);
  s = fixBlankMarkers(s);
  if (/<mfenced|<mo[\s>]/i.test(s)) s = unstretchFenceMos(expandMfenced(s));
  return s;
}
