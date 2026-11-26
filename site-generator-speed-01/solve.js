// Stage 6: Flat inlineSpanInto/escapeHtmlSpanInto buffer emission, tight ASCII fast-skip guards,
// and fast paragraph continuation line loop.

const REPORT_FILE = 'build-report.txt';
const RESERVED = Object.freeze(['posts', 'tags', 'page']);
const EMPTY_ARR = Object.freeze([]);
const SLUG_MAX = 64;
const INCLUDE_DEPTH = 8;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;

// 128-entry ASCII dispatch table for the 9 inline interrupt characters:
// 1 = HTML escape (& < > " '), 2 = \, 3 = `, 4 = *, 5 = [
const CHAR_CLASS = new Uint8Array(128);
CHAR_CLASS[38] = 1;
CHAR_CLASS[60] = 1;
CHAR_CLASS[62] = 1;
CHAR_CLASS[34] = 1;
CHAR_CLASS[39] = 1;
CHAR_CLASS[92] = 2;
CHAR_CLASS[96] = 3;
CHAR_CLASS[42] = 4;
CHAR_CLASS[91] = 5;

// 14 backslash-escapable characters: \ ` * _ [ ] ( ) # + - . ! >
const UINT8_ESCAPABLE = new Uint8Array(128);
for (const ch of '\\`*_[]()#+-.!>') UINT8_ESCAPABLE[ch.charCodeAt(0)] = 1;

/** Push HTML-escaped `text[start..end)` slices/entities directly into `out`. */
function escapeHtmlSpanInto(text, start, end, out) {
  let last = start;
  for (let i = start; i < end; i++) {
    const c = text.charCodeAt(i);
    if (c > 62 || c < 34) continue;
    let ent;
    if (c === 38) ent = '&amp;';
    else if (c === 60) ent = '&lt;';
    else if (c === 62) ent = '&gt;';
    else if (c === 34) ent = '&quot;';
    else if (c === 39) ent = '&#39;';
    else continue;
    if (last < i) out.push(text.slice(last, i));
    out.push(ent);
    last = i + 1;
  }
  if (last === start) {
    out.push(start === 0 && end === text.length ? text : text.slice(start, end));
  } else if (last < end) {
    out.push(text.slice(last, end));
  }
}

/** Escape HTML special characters (& < > " ') in a whole string; zero allocation when clean. */
function escapeHtml(text) {
  const len = text.length;
  let out = '';
  let last = 0;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c > 62 || c < 34) continue;
    let ent;
    if (c === 38) ent = '&amp;';
    else if (c === 60) ent = '&lt;';
    else if (c === 62) ent = '&gt;';
    else if (c === 34) ent = '&quot;';
    else if (c === 39) ent = '&#39;';
    else continue;
    if (last < i) out += text.slice(last, i);
    out += ent;
    last = i + 1;
  }
  if (last === 0) return text;
  if (last < len) out += text.slice(last);
  return out;
}

/** Code-unit comparator (never locale-dependent). */
const byCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const SLUG_MAP = new Uint8Array(128);
const SLUG_CHARS = new Array(128).fill('');
const DASH_SLUG_CHARS = new Array(128).fill('');
for (let c = 48; c <= 57; c++) {
  SLUG_MAP[c] = c;
  SLUG_CHARS[c] = String.fromCharCode(c);
  DASH_SLUG_CHARS[c] = `-${SLUG_CHARS[c]}`;
}
for (let c = 65; c <= 90; c++) SLUG_MAP[c] = c + 32;
for (let c = 97; c <= 122; c++) {
  SLUG_MAP[c] = c;
  SLUG_CHARS[c] = String.fromCharCode(c);
  DASH_SLUG_CHARS[c] = `-${SLUG_CHARS[c]}`;
}

/** Match JS regex `\s` for c >= 160 across BMP (zero surrogate-pair whitespace exists). */
function isBmpExtraSpace(c) {
  return (
    c >= 160 &&
    ((c >= 0x2000 && c <= 0x200a) ||
      c === 0xa0 ||
      c === 0x1680 ||
      c === 0x2028 ||
      c === 0x2029 ||
      c === 0x202f ||
      c === 0x205f ||
      c === 0x3000 ||
      c === 0xfeff)
  );
}

/** Match JS regex `\s` exactly across BMP. */
function isSpaceCode(c) {
  if (c > 32 && c < 160) return false;
  return c === 32 || (c >= 9 && c <= 13) || isBmpExtraSpace(c);
}

function slugifyUnicode(text) {
  const plain = text.normalize('NFKD').replace(/\p{M}/gu, '');
  const len = plain.length;
  let out = '';
  let gap = false;
  for (let i = 0; i < len; i++) {
    const c = plain.charCodeAt(i);
    const m = c < 128 ? SLUG_MAP[c] : 0;
    if (m === 0) {
      if (out.length > 0) gap = true;
      continue;
    }
    if (gap) {
      if (out.length >= 63) break;
      out += DASH_SLUG_CHARS[m];
      gap = false;
    } else {
      out += SLUG_CHARS[m];
      if (out.length === 64) break;
    }
  }
  return out === '' ? 'untitled' : out;
}

/** Produce slug over text[start..end), using ASCII fast path only when all code units < 128. */
function slugifySpan(text, start, end) {
  let out = '';
  let gap = false;
  for (let i = start; i < end; i++) {
    const c = text.charCodeAt(i);
    if (c >= 128) {
      return slugifyUnicode(start === 0 && end === text.length ? text : text.slice(start, end));
    }
    const m = SLUG_MAP[c];
    if (m === 0) {
      if (out.length > 0) gap = true;
      continue;
    }
    if (gap) {
      if (out.length >= 63) {
        for (let k = i; k < end; k++) {
          if (text.charCodeAt(k) >= 128) {
            return slugifyUnicode(start === 0 && end === text.length ? text : text.slice(start, end));
          }
        }
        break;
      }
      out += DASH_SLUG_CHARS[m];
      gap = false;
    } else {
      out += SLUG_CHARS[m];
      if (out.length === 64) {
        for (let k = i + 1; k < end; k++) {
          if (text.charCodeAt(k) >= 128) {
            return slugifyUnicode(start === 0 && end === text.length ? text : text.slice(start, end));
          }
        }
        break;
      }
    }
  }
  return out === '' ? 'untitled' : out;
}

/** Produce slug using ASCII fast path or NFKD fallback. */
function slugify(text) {
  return slugifySpan(text, 0, text.length);
}

/** Deduplicate slug within a Set of taken slugs. */
function uniqueSlug(slug, taken) {
  let out = slug;
  for (let n = 2; taken.has(out); n++) out = `${slug}-${n}`;
  taken.add(out);
  return out;
}

/** Format YYYY-MM-DD into "<day> <Month> <year>". */
function longDate(date) {
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Count whitespace-delimited words in text (exact /\S+/g BMP scanner). */
function wordsOf(text) {
  const len = text.length;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c > 32 && c < 160) {
      if (!inWord) {
        inWord = true;
        count++;
      }
    } else if (c === 32 || c === 10 || (c >= 9 && c <= 13) || isBmpExtraSpace(c)) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------- front matter

const FM_LINE = /^([a-z_]+):(?: (.*))?$/;
const FM_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FM_NAME = /^[a-z0-9-]+$/;
const FM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FM_TAG = /^[^"[\]]+$/;

function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

function fmStringOf(raw) {
  if (raw.charCodeAt(0) === 34) {
    if (raw.length < 2 || raw.charCodeAt(raw.length - 1) !== 34) return 'a quoted string is not closed';
    let out = '';
    for (let i = 1; i < raw.length - 1; i++) {
      const c = raw[i];
      if (c === '\\') {
        const n = raw[i + 1];
        if ((n !== '"' && n !== '\\') || i + 1 === raw.length - 1) {
          return 'a quoted string holds an escape other than \\" or \\\\';
        }
        out += n;
        i++;
      } else if (c === '"') {
        return 'a quoted string holds a stray quote';
      } else {
        out += c;
      }
    }
    return { value: out };
  }
  if (raw.charCodeAt(0) === 91) return 'a bare string opens on [';
  return { value: raw };
}

/** Validate and store one front-matter key/value into `s`. Returns null on success, or error string. */
function parseFmField(key, raw, s) {
  switch (key) {
    case 'title': {
      if (s.title !== undefined) return 'key "title" is given twice';
      if (raw === '') return 'key "title" has no value';
      const r = fmStringOf(raw);
      if (typeof r === 'string') return `key "title": ${r}`;
      s.title = r.value;
      return null;
    }
    case 'summary': {
      if (s.summary !== undefined) return 'key "summary" is given twice';
      if (raw === '') return 'key "summary" has no value';
      const r = fmStringOf(raw);
      if (typeof r === 'string') return `key "summary": ${r}`;
      s.summary = r.value;
      return null;
    }
    case 'date': {
      if (s.date !== undefined) return 'key "date" is given twice';
      if (raw === '') return 'key "date" has no value';
      const dm = FM_DATE.exec(raw);
      const y = dm ? Number(dm[1]) : 0;
      const mo = dm ? Number(dm[2]) : 0;
      const d = dm ? Number(dm[3]) : 0;
      if (!dm || y < 1970 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) {
        return 'key "date": not a date from 1970-01-01 to 2099-12-31 (YYYY-MM-DD)';
      }
      s.date = raw;
      return null;
    }
    case 'tags': {
      if (s.tags !== undefined) return 'key "tags" is given twice';
      if (raw === '') return 'key "tags" has no value';
      if (raw.charCodeAt(0) !== 91 || raw.charCodeAt(raw.length - 1) !== 93) return 'key "tags": not a list [a, b]';
      const inner = raw.slice(1, -1);
      if (inner.trim() === '') {
        s.tags = [];
      } else {
        const parts = inner.split(',');
        for (let j = 0; j < parts.length; j++) {
          const t = parts[j].trim();
          if (t === '' || !FM_TAG.test(t)) return 'key "tags": an empty tag, or one holding " [ or ]';
          parts[j] = t;
        }
        s.tags = parts;
      }
      return null;
    }
    case 'draft': {
      if (s.draft !== undefined) return 'key "draft" is given twice';
      if (raw === '') return 'key "draft" has no value';
      if (raw === 'true') s.draft = true;
      else if (raw === 'false') s.draft = false;
      else return 'key "draft": true or false';
      return null;
    }
    case 'layout': {
      if (s.layout !== undefined) return 'key "layout" is given twice';
      if (raw === '') return 'key "layout" has no value';
      if (!FM_NAME.test(raw)) return 'key "layout": not a template name';
      s.layout = raw;
      return null;
    }
    case 'slug': {
      if (s.slug !== undefined) return 'key "slug" is given twice';
      if (raw === '') return 'key "slug" has no value';
      if (!FM_SLUG.test(raw) || raw.length > 64) return 'key "slug": not a slug';
      s.slug = raw;
      return null;
    }
    default:
      return `unknown key "${key}"`;
  }
}

function parseFrontMatterInto(text, s) {
  const len = text.length;
  const nl0 = text.indexOf('\n');
  if (nl0 === -1) return text === '---' ? 'the front matter is not closed' : 'no front matter';
  if (nl0 !== 3 || text.charCodeAt(0) !== 45 || text.charCodeAt(1) !== 45 || text.charCodeAt(2) !== 45) {
    return 'no front matter';
  }
  let searchFrom = nl0;
  let closeStart = -1;
  let bodyStart = len;
  while (true) {
    const hit = text.indexOf('\n---', searchFrom);
    if (hit === -1) return 'the front matter is not closed';
    const after = hit + 4;
    if (after === len || text.charCodeAt(after) === 10) {
      closeStart = hit + 1;
      bodyStart = after === len ? len : after + 1;
      break;
    }
    searchFrom = after;
  }

  let lineStart = nl0 + 1;
  let lineNum = 2;
  while (lineStart < closeStart) {
    const nl = text.indexOf('\n', lineStart);
    if (lineStart < nl && text.charCodeAt(lineStart) === 35) {
      lineStart = nl + 1;
      lineNum++;
      continue;
    }
    if (isLineBlank(text, lineStart, nl)) {
      lineStart = nl + 1;
      lineNum++;
      continue;
    }
    const line = text.slice(lineStart, nl);
    const m = FM_LINE.exec(line);
    if (!m) return `line ${lineNum} is not "key: value"`;
    let raw = m[2] ?? '';
    let rEnd = raw.length;
    while (rEnd > 0) {
      const c = raw.charCodeAt(rEnd - 1);
      if (c !== 32 && c !== 9) break;
      rEnd--;
    }
    if (rEnd !== raw.length) raw = raw.slice(0, rEnd);

    const err = parseFmField(m[1], raw, s);
    if (err !== null) return err;

    lineStart = nl + 1;
    lineNum++;
  }

  if (s.title === undefined) return 'no title';
  return bodyStart;
}

// ---------------------------------------------------------------- link resolver (hoisted module-level)

function resolvePathParts(dirParts, rel) {
  const parts = dirParts.slice();
  let start = 0;
  while (start <= rel.length) {
    const slash = rel.indexOf('/', start);
    const seg = slash === -1 ? rel.slice(start) : rel.slice(start, slash);
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else if (seg !== '' && seg !== '.') {
      parts.push(seg);
    }
    if (slash === -1) break;
    start = slash + 1;
  }
  return parts.join('/');
}

/** Resolve one Markdown link target in `linkCtx`. */
function resolveLink(target, linkCtx) {
  const c0 = target.charCodeAt(0);
  if (c0 === 47 || c0 === 35) return target;
  if (((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122)) && target.indexOf(':') !== -1 && SCHEME_RE.test(target)) {
    return target;
  }
  const hash = target.indexOf('#');
  const rel = hash === -1 ? target : target.slice(0, hash);
  const frag = hash === -1 ? '' : target.slice(hash);
  let resolved = null;
  if (rel !== '') {
    if (
      rel.charCodeAt(0) !== 46 &&
      rel.charCodeAt(rel.length - 1) !== 47 &&
      rel.indexOf('/.') === -1 &&
      rel.indexOf('//') === -1
    ) {
      resolved = linkCtx.curSrcDir === '' ? rel : `${linkCtx.curSrcDir}/${rel}`;
    } else {
      if (linkCtx.curDirParts === null) {
        linkCtx.curDirParts = linkCtx.curSrcDir === '' ? EMPTY_ARR : linkCtx.curSrcDir.split('/');
      }
      resolved = resolvePathParts(linkCtx.curDirParts, rel);
    }
  }
  if (resolved !== null) {
    const dst = linkCtx.bySource.get(resolved);
    if (dst !== undefined) return `${dst.url}${frag}`;
    if (linkCtx.staticPaths.has(resolved)) return `${linkCtx.base}/${resolved}${frag}`;
  }
  linkCtx.broken.add(`broken-link ${linkCtx.curPath} -> ${target}`);
  return target;
}

// ---------------------------------------------------------------- markdown (split small helpers)

function isLineBlank(src, a, b) {
  for (let k = a; k < b; k++) {
    const c = src.charCodeAt(k);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}

function hasLineBreakChar(src, a, b) {
  for (let k = a; k < b; k++) {
    const c = src.charCodeAt(k);
    if (c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

function matchFenceOpen(src, a, b) {
  if (b - a < 3 || src.charCodeAt(a) !== 96 || src.charCodeAt(a + 1) !== 96 || src.charCodeAt(a + 2) !== 96) {
    return -1;
  }
  let k = a + 3;
  while (k < b) {
    const c = src.charCodeAt(k);
    if (
      (c >= 97 && c <= 122) ||
      (c >= 65 && c <= 90) ||
      (c >= 48 && c <= 57) ||
      c === 95 ||
      c === 43 ||
      c === 45
    ) {
      k++;
    } else break;
  }
  return isLineBlank(src, k, b) ? k : -1;
}

function isFenceClose(src, a, b) {
  return (
    b - a >= 3 &&
    src.charCodeAt(a) === 96 &&
    src.charCodeAt(a + 1) === 96 &&
    src.charCodeAt(a + 2) === 96 &&
    isLineBlank(src, a + 3, b)
  );
}

function isHeadingLine(src, a, b) {
  if (a >= b || src.charCodeAt(a) !== 35) return false;
  let k = a + 1;
  while (k < b && k - a < 7 && src.charCodeAt(k) === 35) k++;
  const depth = k - a;
  if (depth > 6 || k >= b) return false;
  const sp = src.charCodeAt(k);
  if (sp !== 32 && sp !== 9) return false;
  let tStart = k + 1;
  while (tStart < b && (src.charCodeAt(tStart) === 32 || src.charCodeAt(tStart) === 9)) tStart++;
  let tEnd = b;
  while (tEnd > tStart && (src.charCodeAt(tEnd - 1) === 32 || src.charCodeAt(tEnd - 1) === 9)) tEnd--;
  if (tEnd <= tStart) return false;
  return !hasLineBreakChar(src, tStart, tEnd);
}

function isHrLine(src, a, b) {
  if (b - a < 3) return false;
  const c = src.charCodeAt(a);
  return (c === 45 || c === 42) && src.charCodeAt(a + 1) === c && src.charCodeAt(a + 2) === c && isLineBlank(src, a + 3, b);
}

function endsParagraphLine(src, a, b) {
  if (isLineBlank(src, a, b)) return true;
  if (a >= b) return true;
  const c = src.charCodeAt(a);
  if (c === 96) return matchFenceOpen(src, a, b) !== -1;
  if (c === 35) return isHeadingLine(src, a, b);
  if (c === 45 || c === 42) return isHrLine(src, a, b);
  return false;
}

function isContinuedLine(src, a, b) {
  if (b - a < 3 || src.charCodeAt(a) !== 32 || src.charCodeAt(a + 1) !== 32) return false;
  let k = a + 2;
  while (k < b && src.charCodeAt(k) === 32) k++;
  if (k >= b) return false;
  return !isSpaceCode(src.charCodeAt(k));
}

function matchOrderedStart(src, a, b) {
  let k = a;
  while (k < b) {
    const c = src.charCodeAt(k);
    if (c >= 48 && c <= 57) k++;
    else break;
  }
  const dLen = k - a;
  if (dLen < 1 || dLen > 9 || k + 1 >= b) return -1;
  if (src.charCodeAt(k) !== 46 || src.charCodeAt(k + 1) !== 32) return -1;
  if (hasLineBreakChar(src, k + 2, b)) return -1;
  return k;
}

function findUnescapedDoubleStar(s, from, end) {
  const limit = end - 2;
  for (let j = from; j <= limit; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < end) {
      const n = s.charCodeAt(j + 1);
      if (n < 128 && UINT8_ESCAPABLE[n] === 1) {
        j++;
        continue;
      }
    }
    if (c === 42 && s.charCodeAt(j + 1) === 42) return j;
  }
  return -1;
}

function findUnescapedCloseBracket(s, from, end) {
  for (let j = from; j < end; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < end) {
      const n = s.charCodeAt(j + 1);
      if (n < 128 && UINT8_ESCAPABLE[n] === 1) {
        j++;
        continue;
      }
    }
    if (c === 93) return j;
  }
  return -1;
}

function findSingleStar(s, from, end) {
  for (let j = from; j < end; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < end) {
      const n = s.charCodeAt(j + 1);
      if (n < 128 && UINT8_ESCAPABLE[n] === 1) {
        j++;
        continue;
      }
    }
    if (c !== 42) continue;
    if (j + 1 < end && s.charCodeAt(j + 1) === 42) {
      j++;
      continue;
    }
    return j;
  }
  return -1;
}

/** Index-bounded CHAR_CLASS inline scanner emitting slices/entities directly into `out`. */
function inlineSpanInto(s, start, end, linkCtx, out) {
  let plainStart = start;
  let i = start;
  while (i < end) {
    const c = s.charCodeAt(i);
    if (c > 96 || c === 32) {
      i++;
      continue;
    }
    const cls = CHAR_CLASS[c];
    if (cls === 0) {
      i++;
      continue;
    }
    if (cls === 1) {
      if (plainStart < i) out.push(s.slice(plainStart, i));
      out.push(c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;');
      i++;
      plainStart = i;
      continue;
    }
    if (cls === 2) {
      if (i + 1 < end) {
        const n = s.charCodeAt(i + 1);
        if (n < 128 && UINT8_ESCAPABLE[n] === 1) {
          if (plainStart < i) out.push(s.slice(plainStart, i));
          out.push(n === 62 ? '&gt;' : s[i + 1]);
          i += 2;
          plainStart = i;
          continue;
        }
      }
      i++;
      continue;
    }
    if (cls === 3) {
      const j = s.indexOf('`', i + 1);
      if (j > i + 1 && j < end) {
        if (plainStart < i) out.push(s.slice(plainStart, i));
        out.push('<code>');
        escapeHtmlSpanInto(s, i + 1, j, out);
        out.push('</code>');
        i = j + 1;
        plainStart = i;
      } else {
        i++;
      }
      continue;
    }
    if (cls === 4) {
      if (i + 1 < end && s.charCodeAt(i + 1) === 42) {
        const j = findUnescapedDoubleStar(s, i + 2, end);
        if (j > i + 2) {
          if (plainStart < i) out.push(s.slice(plainStart, i));
          out.push('<strong>');
          inlineSpanInto(s, i + 2, j, linkCtx, out);
          out.push('</strong>');
          i = j + 2;
          plainStart = i;
        } else {
          i += 2;
        }
        continue;
      }
      const j = findSingleStar(s, i + 1, end);
      if (j > i + 1) {
        if (plainStart < i) out.push(s.slice(plainStart, i));
        out.push('<em>');
        inlineSpanInto(s, i + 1, j, linkCtx, out);
        out.push('</em>');
        i = j + 1;
        plainStart = i;
      } else {
        i++;
      }
      continue;
    }
    // cls === 5: '[' link
    const k = findUnescapedCloseBracket(s, i + 1, end);
    if (k !== -1 && k + 1 < end && s.charCodeAt(k + 1) === 40) {
      const m = s.indexOf(')', k + 2);
      if (m !== -1 && m < end && m > k + 2) {
        let valid = true;
        for (let p = k + 2; p < m; p++) {
          if (isSpaceCode(s.charCodeAt(p))) {
            valid = false;
            break;
          }
        }
        if (valid) {
          if (plainStart < i) out.push(s.slice(plainStart, i));
          out.push('<a href="');
          out.push(escapeHtml(resolveLink(s.slice(k + 2, m), linkCtx)));
          out.push('">');
          inlineSpanInto(s, i + 1, k, linkCtx, out);
          out.push('</a>');
          i = m + 1;
          plainStart = i;
          continue;
        }
      }
    }
    i++;
  }
  if (plainStart < end) {
    out.push(plainStart === 0 && end === s.length ? s : s.slice(plainStart, end));
  }
}

/** Return flat inline HTML string for s[start..end) (used for excerpt and toc). */
function inlineSpan(s, start, end, linkCtx) {
  const tmp = [];
  inlineSpanInto(s, start, end, linkCtx, tmp);
  return tmp.length === 1 ? tmp[0] : tmp.join('');
}

function renderFenceBlock(src, len, pos, nextPos, lineEnd, langEnd, out) {
  const lang = langEnd === pos + 3 ? '' : src.slice(pos + 3, langEnd);
  out.push(lang === '' ? '<pre><code>' : `<pre><code class="language-${lang}">`);
  pos = nextPos;
  while (pos <= len) {
    const nl2 = src.indexOf('\n', pos);
    const le2 = nl2 === -1 ? len : nl2;
    const np2 = nl2 === -1 ? len + 1 : nl2 + 1;
    if (isFenceClose(src, pos, le2)) {
      pos = np2;
      break;
    }
    if (pos < le2) escapeHtmlSpanInto(src, pos, le2, out);
    out.push('\n');
    pos = np2;
  }
  out.push('</code></pre>\n');
  return pos;
}

function renderBlockquoteBlock(src, len, pos, nextPos, lineEnd, linkCtx, out) {
  let qCount = 0;
  let q0Start = 0;
  let q0End = 0;
  let qLines = null;

  let qStart = pos + 1;
  if (qStart < lineEnd && src.charCodeAt(qStart) === 32) qStart++;
  while (qStart < lineEnd && (src.charCodeAt(qStart) === 32 || src.charCodeAt(qStart) === 9)) qStart++;
  let qEnd = lineEnd;
  while (qEnd > qStart && (src.charCodeAt(qEnd - 1) === 32 || src.charCodeAt(qEnd - 1) === 9)) qEnd--;
  if (qEnd > qStart) {
    q0Start = qStart;
    q0End = qEnd;
    qCount = 1;
  }
  pos = nextPos;
  while (pos <= len) {
    const nl2 = src.indexOf('\n', pos);
    const le2 = nl2 === -1 ? len : nl2;
    if (pos >= le2 || src.charCodeAt(pos) !== 62) break;
    let qs = pos + 1;
    if (qs < le2 && src.charCodeAt(qs) === 32) qs++;
    while (qs < le2 && (src.charCodeAt(qs) === 32 || src.charCodeAt(qs) === 9)) qs++;
    let qe = le2;
    while (qe > qs && (src.charCodeAt(qe - 1) === 32 || src.charCodeAt(qe - 1) === 9)) qe--;
    if (qe > qs) {
      if (qCount === 0) {
        q0Start = qs;
        q0End = qe;
        qCount = 1;
      } else {
        if (qLines === null) qLines = [src.slice(q0Start, q0End)];
        qLines.push(src.slice(qs, qe));
        qCount++;
      }
    }
    pos = nl2 === -1 ? len + 1 : nl2 + 1;
  }
  if (qCount === 0) {
    out.push('<blockquote>\n</blockquote>\n');
  } else {
    out.push('<blockquote>\n<p>');
    if (qCount === 1) {
      inlineSpanInto(src, q0Start, q0End, linkCtx, out);
    } else {
      const joined = qLines.join('\n');
      inlineSpanInto(joined, 0, joined.length, linkCtx, out);
    }
    out.push('</p>\n</blockquote>\n');
  }
  return pos;
}

function renderListBlock(src, len, pos, nextPos, lineEnd, isOrdered, ordDot, linkCtx, out) {
  const startNum = isOrdered ? Number(src.slice(pos, ordDot)) : 1;
  out.push(isOrdered ? (startNum !== 1 ? `<ol start="${startNum}">\n` : '<ol>\n') : '<ul>\n');

  let itemStart = isOrdered ? ordDot + 2 : pos + 2;
  while (itemStart < lineEnd && (src.charCodeAt(itemStart) === 32 || src.charCodeAt(itemStart) === 9)) itemStart++;
  let itemEnd = lineEnd;
  while (itemEnd > itemStart && (src.charCodeAt(itemEnd - 1) === 32 || src.charCodeAt(itemEnd - 1) === 9)) itemEnd--;
  let itemParts = null;
  pos = nextPos;

  while (pos <= len) {
    const nl2 = src.indexOf('\n', pos);
    const le2 = nl2 === -1 ? len : nl2;
    let matched = false;
    let itStart = 0;
    if (isOrdered) {
      const dot = pos < le2 && src.charCodeAt(pos) >= 48 && src.charCodeAt(pos) <= 57 ? matchOrderedStart(src, pos, le2) : -1;
      if (dot !== -1) {
        matched = true;
        itStart = dot + 2;
      }
    } else if (
      pos + 1 < le2 &&
      (src.charCodeAt(pos) === 45 || src.charCodeAt(pos) === 42) &&
      src.charCodeAt(pos + 1) === 32 &&
      !hasLineBreakChar(src, pos + 2, le2)
    ) {
      matched = true;
      itStart = pos + 2;
    }

    if (matched) {
      out.push('<li>');
      if (itemParts === null) {
        inlineSpanInto(src, itemStart, itemEnd, linkCtx, out);
      } else {
        const joined = itemParts.join('\n');
        inlineSpanInto(joined, 0, joined.length, linkCtx, out);
      }
      out.push('</li>\n');
      while (itStart < le2 && (src.charCodeAt(itStart) === 32 || src.charCodeAt(itStart) === 9)) itStart++;
      let itEnd = le2;
      while (itEnd > itStart && (src.charCodeAt(itEnd - 1) === 32 || src.charCodeAt(itEnd - 1) === 9)) itEnd--;
      itemStart = itStart;
      itemEnd = itEnd;
      itemParts = null;
      pos = nl2 === -1 ? len + 1 : nl2 + 1;
    } else if (isContinuedLine(src, pos, le2)) {
      let cs = pos;
      while (cs < le2 && (src.charCodeAt(cs) === 32 || src.charCodeAt(cs) === 9)) cs++;
      let ce = le2;
      while (ce > cs && (src.charCodeAt(ce - 1) === 32 || src.charCodeAt(ce - 1) === 9)) ce--;
      if (itemParts === null) itemParts = [src.slice(itemStart, itemEnd), src.slice(cs, ce)];
      else itemParts.push(src.slice(cs, ce));
      pos = nl2 === -1 ? len + 1 : nl2 + 1;
    } else {
      break;
    }
  }
  out.push('<li>');
  if (itemParts === null) {
    inlineSpanInto(src, itemStart, itemEnd, linkCtx, out);
  } else {
    const joined = itemParts.join('\n');
    inlineSpanInto(joined, 0, joined.length, linkCtx, out);
  }
  out.push(isOrdered ? '</li>\n</ol>\n' : '</li>\n</ul>\n');
  return pos;
}

function renderParagraphBlock(src, len, pos, nextPos, lineEnd, linkCtx, out, needExcerpt) {
  let tStart = pos;
  while (tStart < lineEnd && (src.charCodeAt(tStart) === 32 || src.charCodeAt(tStart) === 9)) tStart++;
  let tEnd = lineEnd;
  while (tEnd > tStart && (src.charCodeAt(tEnd - 1) === 32 || src.charCodeAt(tEnd - 1) === 9)) tEnd--;

  let cleanStart = 0;
  let cleanEnd = 0;
  let pLines = null;
  if (tStart === pos && tEnd === lineEnd) {
    cleanStart = pos;
    cleanEnd = lineEnd;
  } else {
    pLines = [src.slice(tStart, tEnd)];
  }
  pos = nextPos;

  while (pos <= len) {
    const nl2 = src.indexOf('\n', pos);
    const le2 = nl2 === -1 ? len : nl2;
    if (pos < le2) {
      const fc = src.charCodeAt(pos);
      if (fc !== 32 && fc !== 9 && fc !== 96 && fc !== 35 && fc !== 45 && fc !== 42) {
        const lc = src.charCodeAt(le2 - 1);
        if (lc !== 32 && lc !== 9 && pLines === null) {
          cleanEnd = le2;
          pos = nl2 === -1 ? len + 1 : nl2 + 1;
          continue;
        }
      }
    }
    if (endsParagraphLine(src, pos, le2)) break;
    let ls = pos;
    while (ls < le2 && (src.charCodeAt(ls) === 32 || src.charCodeAt(ls) === 9)) ls++;
    let le = le2;
    while (le > ls && (src.charCodeAt(le - 1) === 32 || src.charCodeAt(le - 1) === 9)) le--;
    if (pLines === null) {
      if (ls === pos && le === le2) {
        cleanEnd = le2;
      } else {
        pLines = src.slice(cleanStart, cleanEnd).split('\n');
        pLines.push(src.slice(ls, le));
      }
    } else {
      pLines.push(src.slice(ls, le));
    }
    pos = nl2 === -1 ? len + 1 : nl2 + 1;
  }

  if (needExcerpt) {
    let html;
    if (pLines === null) {
      html = inlineSpan(src, cleanStart, cleanEnd, linkCtx);
    } else {
      const joined = pLines.join('\n');
      html = inlineSpan(joined, 0, joined.length, linkCtx);
    }
    out.push('<p>');
    out.push(html);
    out.push('</p>\n');
    return { pos, excerpt: html };
  }
  out.push('<p>');
  if (pLines === null) {
    inlineSpanInto(src, cleanStart, cleanEnd, linkCtx, out);
  } else {
    const joined = pLines.join('\n');
    inlineSpanInto(joined, 0, joined.length, linkCtx, out);
  }
  out.push('</p>\n');
  return pos;
}

/** Fused single-pass Markdown block cursor -> per-file local output array + toc + excerpt. */
function renderMarkdown(src, linkCtx) {
  const len = src.length;
  const ids = new Set();
  const out = [];
  const toc = [];
  let excerpt = null;
  let pos = 0;

  while (pos <= len) {
    const nl = src.indexOf('\n', pos);
    const lineEnd = nl === -1 ? len : nl;
    const nextPos = nl === -1 ? len + 1 : nl + 1;

    if (isLineBlank(src, pos, lineEnd)) {
      pos = nextPos;
      continue;
    }

    const c0 = src.charCodeAt(pos);

    if (c0 === 96) {
      const langEnd = matchFenceOpen(src, pos, lineEnd);
      if (langEnd !== -1) {
        pos = renderFenceBlock(src, len, pos, nextPos, lineEnd, langEnd, out);
        continue;
      }
    }

    if (c0 === 35) {
      let k = pos + 1;
      while (k < lineEnd && k - pos < 7 && src.charCodeAt(k) === 35) k++;
      const depth = k - pos;
      if (depth <= 6 && k < lineEnd && (src.charCodeAt(k) === 32 || src.charCodeAt(k) === 9)) {
        let tStart = k + 1;
        while (tStart < lineEnd && (src.charCodeAt(tStart) === 32 || src.charCodeAt(tStart) === 9)) tStart++;
        let tEnd = lineEnd;
        while (tEnd > tStart && (src.charCodeAt(tEnd - 1) === 32 || src.charCodeAt(tEnd - 1) === 9)) tEnd--;
        if (tEnd > tStart && !hasLineBreakChar(src, tStart, tEnd)) {
          const id = uniqueSlug(slugifySpan(src, tStart, tEnd), ids);
          if (depth === 2 || depth === 3) {
            const html = inlineSpan(src, tStart, tEnd, linkCtx);
            out.push(`<h${depth} id="${id}">`);
            out.push(html);
            out.push(`</h${depth}>\n`);
            toc.push({ level: depth, id, html });
          } else {
            out.push(`<h${depth} id="${id}">`);
            inlineSpanInto(src, tStart, tEnd, linkCtx, out);
            out.push(`</h${depth}>\n`);
          }
          pos = nextPos;
          continue;
        }
      }
    }

    if ((c0 === 45 || c0 === 42) && isHrLine(src, pos, lineEnd)) {
      out.push('<hr>\n');
      pos = nextPos;
      continue;
    }

    if (c0 === 62) {
      pos = renderBlockquoteBlock(src, len, pos, nextPos, lineEnd, linkCtx, out);
      continue;
    }

    const isBullet =
      (c0 === 45 || c0 === 42) &&
      pos + 1 < lineEnd &&
      src.charCodeAt(pos + 1) === 32 &&
      !hasLineBreakChar(src, pos + 2, lineEnd);
    const ordDot = !isBullet && c0 >= 48 && c0 <= 57 ? matchOrderedStart(src, pos, lineEnd) : -1;

    if (isBullet || ordDot !== -1) {
      pos = renderListBlock(src, len, pos, nextPos, lineEnd, ordDot !== -1, ordDot, linkCtx, out);
      continue;
    }

    const res = renderParagraphBlock(src, len, pos, nextPos, lineEnd, linkCtx, out, excerpt === null);
    if (excerpt === null) {
      excerpt = res.excerpt;
      pos = res.pos;
    } else {
      pos = res;
    }
  }

  return { html: out.join(''), toc, excerpt: excerpt ?? '' };
}

// ---------------------------------------------------------------- templates (hoisted module-level AST walker)

const TMPL_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const TMPL_FOR = /^for ([A-Za-z_][A-Za-z0-9_]*) in (\S+)$/;
const TMPL_IF = /^if (not )?(\S+)$/;
const TMPL_INCLUDE = /^include "([a-z0-9-]+)"$/;

const OP_TEXT = 0;
const OP_VAR = 1;
const OP_RAW = 2;
const OP_IF = 3;
const OP_FOR = 4;
const OP_INCLUDE = 5;

class TemplateError extends Error {}

function pathOf(name, text) {
  if (!TMPL_PATH.test(text)) throw new TemplateError(`template "${name}": ${JSON.stringify(text)} is not a path`);
  return text.split('.');
}

function tokenizeTemplate(name, src) {
  const len = src.length;
  const tokens = [];
  let text = '';
  let i = 0;
  while (i < len) {
    const open = src.indexOf('{', i);
    if (open === -1 || open === len - 1) {
      text += src.slice(i);
      break;
    }
    const next = src.charCodeAt(open + 1);
    if (next !== 123 && next !== 37) {
      text += src.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    text += src.slice(i, open);
    if (next === 123) {
      const raw = src.charCodeAt(open + 2) === 123;
      const close = src.indexOf(raw ? '}}}' : '}}', open + (raw ? 3 : 2));
      if (close === -1) throw new TemplateError(`template "${name}": a ${raw ? '{{{' : '{{'} is not closed`);
      if (text !== '') tokens.push({ t: 'text', text });
      text = '';
      tokens.push({ t: raw ? 'raw' : 'var', path: pathOf(name, src.slice(open + (raw ? 3 : 2), close).trim()) });
      i = close + (raw ? 3 : 2);
      continue;
    }
    const close = src.indexOf('%}', open + 2);
    if (close === -1) throw new TemplateError(`template "${name}": a {% is not closed`);
    const end = close + 2;
    const lineStart = src.lastIndexOf('\n', open - 1) + 1;
    const nl = src.indexOf('\n', end);
    const lineEnd = nl === -1 ? len : nl;
    const standalone = isLineBlank(src, lineStart, open) && isLineBlank(src, end, lineEnd);
    if (standalone) text = text.slice(0, text.length - (open - lineStart));
    if (text !== '') tokens.push({ t: 'text', text });
    text = '';
    tokens.push({ t: 'tag', tag: src.slice(open + 2, close).trim() });
    i = standalone ? (nl === -1 ? len : nl + 1) : end;
  }
  if (text !== '') tokens.push({ t: 'text', text });
  return tokens;
}

function pushTextNode(body, text) {
  const n = body.length;
  if (n > 0 && body[n - 1].op === OP_TEXT) {
    body[n - 1].text += text;
  } else {
    body.push({ op: OP_TEXT, text });
  }
}

function parseTemplate(name, src) {
  const root = { kind: 'root', body: [] };
  const stack = [root];
  let body = root.body;
  const tokens = tokenizeTemplate(name, src);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.t === 'text') {
      pushTextNode(body, tok.text);
    } else if (tok.t === 'var') {
      const p = tok.path;
      body.push({ op: OP_VAR, p0: p[0], p1: p.length > 1 ? p[1] : undefined, plen: p.length, path: p });
    } else if (tok.t === 'raw') {
      const p = tok.path;
      body.push({ op: OP_RAW, p0: p[0], p1: p.length > 1 ? p[1] : undefined, plen: p.length, path: p });
    } else {
      const tag = tok.tag;
      const top = stack[stack.length - 1];
      let m;
      if ((m = TMPL_FOR.exec(tag)) !== null) {
        const p = pathOf(name, m[2]);
        const node = { op: OP_FOR, kind: 'for', name: m[1], p0: p[0], p1: p.length > 1 ? p[1] : undefined, plen: p.length, path: p, body: [] };
        body.push(node);
        stack.push(node);
        body = node.body;
      } else if ((m = TMPL_IF.exec(tag)) !== null) {
        const p = pathOf(name, m[2]);
        const node = { op: OP_IF, kind: 'if', not: m[1] !== undefined, p0: p[0], p1: p.length > 1 ? p[1] : undefined, plen: p.length, path: p, then: [], else: null };
        body.push(node);
        stack.push(node);
        body = node.then;
      } else if (tag === 'else') {
        if (top.kind !== 'if' || top.else !== null) throw new TemplateError(`template "${name}": an else outside an if`);
        top.else = [];
        body = top.else;
      } else if (tag === 'endfor' || tag === 'endif') {
        if (top.kind !== (tag === 'endfor' ? 'for' : 'if')) {
          throw new TemplateError(`template "${name}": an ${tag} with no open ${tag.slice(3)}`);
        }
        stack.pop();
        const parent = stack[stack.length - 1];
        body = parent.kind === 'root' ? parent.body : parent.kind === 'for' ? parent.body : parent.else ?? parent.then;
      } else if ((m = TMPL_INCLUDE.exec(tag)) !== null) {
        body.push({ op: OP_INCLUDE, name: m[1], target: null });
      } else {
        throw new TemplateError(`template "${name}": {% ${tag} %} is not a tag`);
      }
    }
  }
  if (stack.length > 1) throw new TemplateError(`template "${name}": a ${stack[stack.length - 1].kind} is not closed`);
  return root.body;
}

function linkIncludes(nodes, templates) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.op === OP_INCLUDE) {
      n.target = templates.get(n.name) ?? null;
    } else if (n.op === OP_IF) {
      linkIncludes(n.then, templates);
      if (n.else !== null) linkIncludes(n.else, templates);
    } else if (n.op === OP_FOR) {
      linkIncludes(n.body, templates);
    }
  }
}

function textOf(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    const len = v.length;
    if (len === 0) return '';
    let s = textOf(v[0]);
    for (let i = 1; i < len; i++) s += `, ${textOf(v[i])}`;
    return s;
  }
  return '';
}

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== false && v !== '' && v !== 0;
}

/** Module-level template path lookup against per-case render state `rt`. */
function tmplLookup(n, rt) {
  const p0 = n.p0;
  let v;
  if (rt.loopDepth > 0) {
    let found = false;
    const stack = rt.loopStack;
    for (let d = rt.loopDepth - 1; d >= 0; d--) {
      const slot = stack[d];
      if (p0 === 'loop') {
        v = slot.loop;
        found = true;
        break;
      }
      if (p0 === slot.name) {
        v = slot.value;
        found = true;
        break;
      }
    }
    if (!found) {
      if (!Object.hasOwn(rt.rootVars, p0)) return undefined;
      v = rt.rootVars[p0];
    }
  } else {
    if (!Object.hasOwn(rt.rootVars, p0)) return undefined;
    v = rt.rootVars[p0];
  }
  const plen = n.plen;
  if (plen === 1) return v;
  if (v === null || typeof v !== 'object' || !Object.hasOwn(v, n.p1)) return undefined;
  v = v[n.p1];
  if (plen === 2) return v;
  const path = n.path;
  for (let k = 2; k < plen; k++) {
    if (v === null || typeof v !== 'object' || !Object.hasOwn(v, path[k])) return undefined;
    v = v[path[k]];
  }
  return v;
}

/** Module-level pre-linked AST walker. */
function execNodes(nodes, depth, out, rt) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    switch (n.op) {
      case OP_TEXT:
        out.push(n.text);
        break;
      case OP_VAR: {
        const v = tmplLookup(n, rt);
        if (typeof v === 'string') {
          if (v !== '') out.push(escapeHtml(v));
        } else if (typeof v === 'number') {
          out.push(String(v));
        } else if (typeof v === 'boolean') {
          out.push(v ? 'true' : 'false');
        } else if (Array.isArray(v) && v.length > 0) {
          out.push(escapeHtml(textOf(v)));
        }
        break;
      }
      case OP_RAW: {
        const v = tmplLookup(n, rt);
        if (typeof v === 'string') {
          if (v !== '') out.push(v);
        } else if (typeof v === 'number') {
          out.push(String(v));
        } else if (typeof v === 'boolean') {
          out.push(v ? 'true' : 'false');
        } else if (Array.isArray(v) && v.length > 0) {
          out.push(textOf(v));
        }
        break;
      }
      case OP_IF: {
        const branch = truthy(tmplLookup(n, rt)) !== n.not ? n.then : n.else;
        if (branch !== null) execNodes(branch, depth, out, rt);
        break;
      }
      case OP_FOR: {
        const xs = tmplLookup(n, rt);
        if (!Array.isArray(xs)) break;
        const len = xs.length;
        if (len === 0) break;
        let slot = rt.loopStack[rt.loopDepth];
        if (slot === undefined) {
          slot = { name: '', value: undefined, loop: { index: 0, first: false, last: false, length: 0 } };
          rt.loopStack.push(slot);
        }
        slot.name = n.name;
        const lp = slot.loop;
        lp.length = len;
        rt.loopDepth++;
        for (let k = 0; k < len; k++) {
          slot.value = xs[k];
          lp.index = k + 1;
          lp.first = k === 0;
          lp.last = k === len - 1;
          execNodes(n.body, depth, out, rt);
        }
        rt.loopDepth--;
        slot.value = undefined;
        break;
      }
      case OP_INCLUDE: {
        if (n.target !== null && depth < INCLUDE_DEPTH) {
          execNodes(n.target, depth + 1, out, rt);
        }
        break;
      }
    }
  }
}

function renderTemplateTree(nodes, rt) {
  const out = [];
  execNodes(nodes, 0, out, rt);
  return out.join('');
}

// ---------------------------------------------------------------- pipeline

const dirOf = (path) => {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
};

function readAndFrontMatter(b) {
  const files = b.input.files.slice().sort((x, y) => byCodeUnits(x.path, y.path));
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const path = f.path;
    if (!path.endsWith('.md')) {
      b.statics.push({ path, content: f.content });
      continue;
    }
    const rawContent = f.content;
    const text = rawContent.indexOf('\r') === -1 ? rawContent : rawContent.replace(/\r\n?/g, '\n');
    const post = path.startsWith('posts/');
    const srcDir = dirOf(path);
    const s = {
      path,
      post,
      srcDir,
      outBase: post ? 'posts' : srcDir,
      slug: undefined,
      outDir: '',
      url: '',
      body: '',
      html: '',
      toc: null,
      excerpt: '',
      readingMinutes: 1,
      title: undefined,
      date: undefined,
      tags: undefined,
      draft: undefined,
      layout: undefined,
      summary: undefined,
      tagRefs: null,
      newer: null,
      older: null,
      card: null,
      linkRec: null,
    };
    const fmRes = parseFrontMatterInto(text, s);
    if (typeof fmRes === 'string') {
      b.report.push(`refused ${path}: ${fmRes}`);
      continue;
    }
    if (path.startsWith('tags/')) {
      b.report.push(`refused ${path}: tags/ is the generator's own`);
      continue;
    }
    if (path.startsWith('page/')) {
      b.report.push(`refused ${path}: page/ is the generator's own`);
      continue;
    }
    if (post && s.date === undefined) {
      b.report.push(`refused ${path}: a post needs a date`);
      continue;
    }
    const layout = s.layout !== undefined ? s.layout : (post ? 'post' : 'page');
    if (!b.templates.has(layout)) {
      b.report.push(`refused ${path}: layout "${layout}" is no template that parses`);
      continue;
    }
    s.layout = layout;
    if (s.draft === true) {
      b.report.push(`draft ${path}`);
      continue;
    }
    s.body = text.slice(fmRes);
    b.sources.push(s);
  }
}

function permalinks(b) {
  const taken = new Map();
  for (let i = 0; i < b.sources.length; i++) {
    const s = b.sources[i];
    const dir = s.outBase;
    let dirTaken = taken.get(dir);
    if (dirTaken === undefined) {
      dirTaken = new Set(dir === '' ? RESERVED : undefined);
      taken.set(dir, dirTaken);
    }
    const baseSlug = s.slug !== undefined ? s.slug : slugify(s.title);
    const slug = uniqueSlug(baseSlug, dirTaken);
    s.slug = slug;
    s.outDir = dir === '' ? slug : `${dir}/${slug}`;
    s.url = `${b.base}/${s.outDir}/`;
    b.bySource.set(s.path, s);
  }
}

function markdown(b) {
  const staticPaths = new Set();
  for (let i = 0; i < b.statics.length; i++) staticPaths.add(b.statics[i].path);

  const linkCtx = {
    curPath: '',
    curSrcDir: '',
    curDirParts: null,
    base: b.base,
    bySource: b.bySource,
    staticPaths,
    broken: b.broken,
  };

  for (let i = 0; i < b.sources.length; i++) {
    const s = b.sources[i];
    linkCtx.curPath = s.path;
    linkCtx.curSrcDir = s.srcDir;
    linkCtx.curDirParts = null;
    const body = s.body;
    const md = renderMarkdown(body, linkCtx);
    s.html = md.html;
    s.toc = md.toc;
    s.excerpt = md.excerpt;
    s.readingMinutes = Math.max(1, Math.ceil(wordsOf(body) / 200));
    s.body = '';
  }
}

function collections(b) {
  const posts = [];
  for (let i = 0; i < b.sources.length; i++) {
    if (b.sources[i].post) posts.push(b.sources[i]);
  }
  posts.sort((x, y) => byCodeUnits(y.date, x.date) || byCodeUnits(x.slug, y.slug));
  b.posts = posts;
  for (let k = 0; k < posts.length; k++) {
    const p = posts[k];
    p.newer = k === 0 ? null : posts[k - 1];
    p.older = k === posts.length - 1 ? null : posts[k + 1];
    p.linkRec = {
      title: p.title,
      url: p.url,
      date: p.date ?? '',
      date_long: p.date === undefined ? '' : longDate(p.date),
    };
  }
}

function slugForTag(name, tagSlugCache) {
  let sl = tagSlugCache.get(name);
  if (sl === undefined) {
    sl = slugify(name);
    tagSlugCache.set(name, sl);
  }
  return sl;
}

function tags(b) {
  const bySlug = new Map();
  const tagSlugCache = new Map();

  for (let i = 0; i < b.posts.length; i++) {
    const p = b.posts[i];
    const rawTags = p.tags;
    if (rawTags === undefined || rawTags.length === 0) {
      p.tagRefs = EMPTY_ARR;
      continue;
    }
    const seen = new Set();
    const refs = [];
    for (let j = 0; j < rawTags.length; j++) {
      const name = rawTags[j];
      const slug = slugForTag(name, tagSlugCache);
      if (seen.has(slug)) continue;
      seen.add(slug);
      let tag = bySlug.get(slug);
      if (tag === undefined) {
        const url = `${b.base}/tags/${slug}/`;
        tag = { name, slug, url, posts: [], card: { name, slug, url } };
        bySlug.set(slug, tag);
      }
      tag.posts.push(p);
      refs.push(tag);
    }
    p.tagRefs = refs;
  }

  for (let i = 0; i < b.sources.length; i++) {
    const s = b.sources[i];
    if (s.post) continue;
    const rawTags = s.tags;
    if (rawTags === undefined || rawTags.length === 0) {
      s.tagRefs = EMPTY_ARR;
      continue;
    }
    const seen = new Set();
    const refs = [];
    for (let j = 0; j < rawTags.length; j++) {
      const name = rawTags[j];
      const slug = slugForTag(name, tagSlugCache);
      if (seen.has(slug)) continue;
      seen.add(slug);
      const postTag = bySlug.get(slug);
      refs.push(postTag !== undefined ? postTag.card : { name, slug, url: '' });
    }
    s.tagRefs = refs;
  }

  b.tags = Array.from(bySlug.values()).sort((x, y) => y.posts.length - x.posts.length || byCodeUnits(x.slug, y.slug));
}

function layouts(b) {
  const posts = b.posts;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const lr = p.linkRec;
    const tRefs = p.tagRefs;
    const tCards = new Array(tRefs.length);
    for (let j = 0; j < tRefs.length; j++) tCards[j] = tRefs[j].card;
    p.card = {
      title: lr.title,
      url: lr.url,
      date: lr.date,
      date_long: lr.date_long,
      summary: p.summary ?? '',
      excerpt: p.excerpt,
      reading_minutes: p.readingMinutes,
      tags: tCards,
    };
  }

  const site = { title: b.input.site.title, base_url: b.base };
  const allTags = new Array(b.tags.length);
  for (let i = 0; i < b.tags.length; i++) {
    const t = b.tags[i];
    allTags[i] = { name: t.name, slug: t.slug, url: t.url, count: t.posts.length };
  }
  const recentCount = Math.min(b.input.site.recent, posts.length);
  const recent = new Array(recentCount);
  for (let i = 0; i < recentCount; i++) recent[i] = posts[i].card;

  const rootVars = {
    site,
    tags: allTags,
    recent,
    page: undefined,
    posts: undefined,
    pager: undefined,
    tag: undefined,
  };
  const rt = { rootVars, loopStack: [], loopDepth: 0 };

  const pageRec = {
    title: '',
    url: '',
    date: '',
    date_long: '',
    summary: '',
    excerpt: '',
    reading_minutes: 1,
    tags: EMPTY_ARR,
    slug: '',
    content: '',
    toc: EMPTY_ARR,
    newer: null,
    older: null,
    is_post: false,
  };
  rootVars.page = pageRec;

  for (let i = 0; i < b.sources.length; i++) {
    const s = b.sources[i];
    const nodes = b.templates.get(s.layout);
    if (nodes === undefined) continue;
    if (s.post) {
      const c = s.card;
      pageRec.title = c.title;
      pageRec.url = c.url;
      pageRec.date = c.date;
      pageRec.date_long = c.date_long;
      pageRec.summary = c.summary;
      pageRec.excerpt = c.excerpt;
      pageRec.reading_minutes = c.reading_minutes;
      pageRec.tags = c.tags;
      pageRec.slug = s.slug;
      pageRec.content = s.html;
      pageRec.toc = s.toc;
      pageRec.newer = s.newer !== null ? s.newer.linkRec : null;
      pageRec.older = s.older !== null ? s.older.linkRec : null;
      pageRec.is_post = true;
    } else {
      pageRec.title = s.title;
      pageRec.url = s.url;
      pageRec.date = s.date ?? '';
      pageRec.date_long = s.date === undefined ? '' : longDate(s.date);
      pageRec.summary = s.summary ?? '';
      pageRec.excerpt = s.excerpt;
      pageRec.reading_minutes = s.readingMinutes;
      pageRec.tags = s.tagRefs;
      pageRec.slug = s.slug;
      pageRec.content = s.html;
      pageRec.toc = s.toc;
      pageRec.newer = null;
      pageRec.older = null;
      pageRec.is_post = false;
    }
    b.output[`${s.outDir}/index.html`] = renderTemplateTree(nodes, rt);
  }
  rootVars.page = undefined;

  const per = b.input.site.per_page;
  const pages = Math.max(1, Math.ceil(posts.length / per));
  const indexNodes = b.templates.get('index');
  if (indexNodes !== undefined) {
    const page1Url = `${b.base}/`;
    const pagerRec = { number: 1, total: pages, url: '', newer_url: '', older_url: '' };
    rootVars.pager = pagerRec;
    for (let k = 1; k <= pages; k++) {
      const start = (k - 1) * per;
      const end = Math.min(k * per, posts.length);
      const pageCards = new Array(Math.max(0, end - start));
      for (let j = start; j < end; j++) pageCards[j - start] = posts[j].card;
      rootVars.posts = pageCards;
      pagerRec.number = k;
      pagerRec.url = k === 1 ? page1Url : `${b.base}/page/${k}/`;
      pagerRec.newer_url = k === 1 ? '' : k === 2 ? page1Url : `${b.base}/page/${k - 1}/`;
      pagerRec.older_url = k === pages ? '' : `${b.base}/page/${k + 1}/`;
      b.output[k === 1 ? 'index.html' : `page/${k}/index.html`] = renderTemplateTree(indexNodes, rt);
    }
    rootVars.posts = undefined;
    rootVars.pager = undefined;
  }

  const tagNodes = b.templates.get('tag');
  if (tagNodes !== undefined) {
    const tagRec = { name: '', slug: '', url: '', count: 0, posts: EMPTY_ARR };
    rootVars.tag = tagRec;
    for (let i = 0; i < b.tags.length; i++) {
      const t = b.tags[i];
      const tPosts = new Array(t.posts.length);
      for (let j = 0; j < t.posts.length; j++) tPosts[j] = t.posts[j].card;
      tagRec.name = t.name;
      tagRec.slug = t.slug;
      tagRec.url = t.url;
      tagRec.count = t.posts.length;
      tagRec.posts = tPosts;
      b.output[`tags/${t.slug}/index.html`] = renderTemplateTree(tagNodes, rt);
    }
    rootVars.tag = undefined;
  }

  const tagsNodes = b.templates.get('tags');
  if (tagsNodes !== undefined) {
    b.output['tags/index.html'] = renderTemplateTree(tagsNodes, rt);
  }

  for (let i = 0; i < b.statics.length; i++) {
    const f = b.statics[i];
    if (Object.hasOwn(b.output, f.path)) b.report.push(`shadowed ${f.path}: a built page has its path`);
    else b.output[f.path] = f.content;
  }
}

function report(b) {
  const lines = b.report.concat(Array.from(b.broken)).sort(byCodeUnits);
  const pages = b.sources.length - b.posts.length;
  lines.push(`built ${pages} pages, ${b.posts.length} posts, ${b.tags.length} tags and ${b.statics.length} static files`);
  b.output[REPORT_FILE] = `${lines.join('\n')}\n`;
}

const PIPELINE = [readAndFrontMatter, permalinks, markdown, collections, tags, layouts, report];

/** Build one site's output tree: path -> text. */
export function run(input) {
  const templates = new Map();
  const rep = [];
  for (const name of Object.keys(input.templates).sort(byCodeUnits)) {
    try {
      templates.set(name, parseTemplate(name, input.templates[name]));
    } catch (err) {
      if (!(err instanceof TemplateError)) throw err;
      rep.push(err.message);
    }
  }
  for (const nodes of templates.values()) linkIncludes(nodes, templates);
  const b = {
    input,
    base: input.site.base_url.replace(/\/+$/, ''),
    templates,
    sources: [],
    statics: [],
    bySource: new Map(),
    broken: new Set(),
    report: rep,
    posts: [],
    tags: [],
    output: {},
  };
  for (const plugin of PIPELINE) plugin(b);
  return b.output;
}
