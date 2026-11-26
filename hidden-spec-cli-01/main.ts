// main.ts is mend, the CLI SPEC.md specifies, and this is the kit's starting point for it (MIT). It does sections 1 to 4, 9 and 10 of SPEC.md: the command line, the output and
// exit codes, safe paths, format detection, JSON edits and the all-or-nothing write. The other three formats are
// detected and then read as holding no edit, so they answer `error: parse 1`: reading unified diffs (section 6),
// SEARCH/REPLACE blocks (section 7) and V4A patches (section 8), and matching lines at three tiers (section 5), are
// yours to write. Node 22, the standard library alone; run it as `node main.ts [options] [PATCH]`.
//
// In a trial the grader runs `node /bot/main.ts` with MAKEFUN_ENV_URL set, and then this file hands over to runner.ts
// (the last lines below): keep that hand-over and runner.ts as they are, and write the CLI.

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

const FORMATS = ['auto', 'unified', 'search-replace', 'v4a', 'json'];

class Exit2 {
  readonly line: string;
  constructor(line: string) {
    this.line = line;
  }
}
class Fail {
  readonly code: string;
  readonly path: string;
  constructor(code: string, path: string) {
    this.code = code;
    this.path = path;
  }
}

const blank = (s: string): boolean => s.trim() === '';

function splitLines(text: string): { lines: string[]; br: '\n' | '\r\n'; finalBreak: boolean } {
  if (text === '') return { lines: [], br: '\n', finalBreak: false };
  const nl = text.indexOf('\n');
  const br: '\n' | '\r\n' = nl > 0 && text[nl - 1] === '\r' ? '\r\n' : '\n';
  const lines = text.split(br);
  const finalBreak = text.endsWith(br);
  if (finalBreak) lines.pop();
  return { lines, br, finalBreak };
}

function joinLines(lines: string[], br: '\n' | '\r\n', finalBreak: boolean): string {
  if (lines.length === 0) return '';
  return lines.join(br) + (finalBreak ? br : '');
}

function patchLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

function safe(p: string): boolean {
  return p !== '' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

/** The tree as the edits leave it: changed paths in `now` (null: deleted), the rest read from disk. */
class Tree {
  private readonly orig = new Map<string, string | null>();
  readonly now = new Map<string, string | null>();
  readonly moves: Array<{ old: string; new: string }> = [];
  original(p: string): string | null {
    if (!this.orig.has(p)) {
      let v: string | null = null;
      try {
        if (statSync(p).isFile()) v = readFileSync(p, 'utf8');
      } catch {
        v = null;
      }
      this.orig.set(p, v);
    }
    return this.orig.get(p)!;
  }
  get(p: string): string | null {
    return this.now.has(p) ? this.now.get(p)! : this.original(p);
  }
}

type Edit = (tree: Tree) => void;

type Op = { kind: 'ctx' | 'del' | 'add'; text: string };
type TaggedN = { kind: 'ctx'; oIdx: number } | { kind: 'add'; text: string };

const isSpaceOrTab = (c: number): boolean => c === 32 || c === 9;

function leadingIndent(s: string): string {
  let i = 0;
  while (i < s.length && isSpaceOrTab(s.charCodeAt(i))) i += 1;
  return s.slice(0, i);
}

function stripTrail(s: string): string {
  let j = s.length;
  while (j > 0 && isSpaceOrTab(s.charCodeAt(j - 1))) j -= 1;
  return j === s.length ? s : s.slice(0, j);
}

function stripBoth(s: string): string {
  let i = 0;
  while (i < s.length && isSpaceOrTab(s.charCodeAt(i))) i += 1;
  let j = s.length;
  while (j > i && isSpaceOrTab(s.charCodeAt(j - 1))) j -= 1;
  return i === 0 && j === s.length ? s : s.slice(i, j);
}

function linesEqualAtTier(
  fileLines: string[],
  start: number,
  oNorm: string[],
  tier: 0 | 1 | 2,
  fCache: (string | undefined)[] | null,
): boolean {
  for (let k = 0; k < oNorm.length; k += 1) {
    const idx = start + k;
    let fLine: string;
    if (tier === 0) {
      fLine = fileLines[idx]!;
    } else {
      let cached = fCache![idx];
      if (cached === undefined) {
        cached = tier === 1 ? stripTrail(fileLines[idx]!) : stripBoth(fileLines[idx]!);
        fCache![idx] = cached;
      }
      fLine = cached;
    }
    if (fLine !== oNorm[k]) return false;
  }
  return true;
}

function findOccurrences(lines: string[], o: string[], tier: 0 | 1 | 2, minPos: number, maxPos: number): number[] {
  if (o.length === 0 || o.length > lines.length) return [];
  const lo = Math.max(0, minPos);
  const hi = Math.min(lines.length - o.length, maxPos);
  if (lo > hi) return [];
  const oNorm = tier === 0 ? o : o.map(tier === 1 ? stripTrail : stripBoth);
  const fCache = tier === 0 ? null : new Array<string | undefined>(lines.length);
  const positions: number[] = [];
  for (let pos = lo; pos <= hi; pos += 1) {
    if (linesEqualAtTier(lines, pos, oNorm, tier, fCache)) positions.push(pos);
  }
  return positions;
}

function matchTier(
  lines: string[],
  o: string[],
  minPos: number,
  maxPos: number,
  strict: boolean,
): { tier: 0 | 1 | 2; positions: number[] } | null {
  const maxTier: 0 | 1 | 2 = strict ? 0 : 2;
  for (let t = 0; t <= maxTier; t += 1) {
    const tier = t as 0 | 1 | 2;
    const positions = findOccurrences(lines, o, tier, minPos, maxPos);
    if (positions.length > 0) return { tier, positions };
  }
  return null;
}

function splitOps(ops: Op[]): { o: string[]; taggedN: TaggedN[] } {
  const o: string[] = [];
  const taggedN: TaggedN[] = [];
  for (const op of ops) {
    if (op.kind === 'ctx') {
      taggedN.push({ kind: 'ctx', oIdx: o.length });
      o.push(op.text);
    } else if (op.kind === 'del') {
      o.push(op.text);
    } else {
      taggedN.push({ kind: 'add', text: op.text });
    }
  }
  return { o, taggedN };
}

function renderN(
  taggedN: TaggedN[],
  fileLines: string[],
  matchPos: number,
  tier: 0 | 1 | 2,
  pIndent: string,
  fIndent: string,
): string[] {
  const out: string[] = [];
  for (const entry of taggedN) {
    if (entry.kind === 'ctx') {
      out.push(fileLines[matchPos + entry.oIdx]!);
    } else if (tier < 2 || blank(entry.text)) {
      out.push(entry.text);
    } else {
      out.push(entry.text.startsWith(pIndent) ? fIndent + entry.text.slice(pIndent.length) : entry.text);
    }
  }
  return out;
}

function nearestTo(positions: number[], target: number): number {
  let best = positions[0]!;
  let bestDist = Math.abs(best - target);
  for (let i = 1; i < positions.length; i += 1) {
    const p = positions[i]!;
    const dist = Math.abs(p - target);
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function firstAtOrAfter(positions: number[], cursor: number): number | null {
  for (const p of positions) {
    if (p >= cursor) return p;
  }
  return null;
}

interface UnifiedHunk {
  aStart: number;
  ops: Op[];
  backslashAfterLastCtxOrAdd: boolean;
  hasAdd: boolean;
  backslashAfterLastAdd: boolean;
}

interface UnifiedSection {
  kind: 'create' | 'delete' | 'move' | 'change';
  oldPath: string | null;
  newPath: string | null;
  hunks: UnifiedHunk[];
}

function parseDiffGitLine(line: string, lineNo: number): { oldPath: string; newPath: string } {
  const prefix = 'diff --git a/';
  if (!line.startsWith(prefix)) throw new Exit2(`error: parse ${lineNo}`);
  const rest = line.slice(prefix.length);
  const sep = rest.indexOf(' b/');
  if (sep < 0) throw new Exit2(`error: parse ${lineNo}`);
  const oldPath = rest.slice(0, sep).trim();
  const newPath = rest.slice(sep + 3).trim();
  if (oldPath === '' || newPath === '') throw new Exit2(`error: parse ${lineNo}`);
  return { oldPath, newPath };
}

function parseUnifiedHeaderPath(line: string): string {
  let raw = line.slice(4);
  const tab = raw.indexOf('\t');
  if (tab >= 0) raw = raw.slice(0, tab);
  raw = raw.trim();
  if (raw === '/dev/null') return '/dev/null';
  if (raw.startsWith('a/') || raw.startsWith('b/')) raw = raw.slice(2);
  return raw;
}

function finalizeUnifiedHunk(aStart: number, rawBody: string[]): UnifiedHunk {
  while (rawBody.length > 0 && rawBody[rawBody.length - 1] === '') rawBody.pop();
  const ops: Op[] = [];
  let backslashAfterLastCtxOrAdd = false;
  let hasAdd = false;
  let backslashAfterLastAdd = false;
  let prevKind: 'none' | 'ctxOrAdd' | 'del' | 'bs' = 'none';
  let prevWasAdd = false;
  for (const raw of rawBody) {
    if (raw === '') {
      ops.push({ kind: 'ctx', text: '' });
      backslashAfterLastCtxOrAdd = false;
      prevKind = 'ctxOrAdd';
      prevWasAdd = false;
    } else if (raw[0] === ' ') {
      ops.push({ kind: 'ctx', text: raw.slice(1) });
      backslashAfterLastCtxOrAdd = false;
      prevKind = 'ctxOrAdd';
      prevWasAdd = false;
    } else if (raw[0] === '-') {
      ops.push({ kind: 'del', text: raw.slice(1) });
      prevKind = 'del';
      prevWasAdd = false;
    } else if (raw[0] === '+') {
      ops.push({ kind: 'add', text: raw.slice(1) });
      backslashAfterLastCtxOrAdd = false;
      hasAdd = true;
      backslashAfterLastAdd = false;
      prevKind = 'ctxOrAdd';
      prevWasAdd = true;
    } else {
      if (prevKind === 'ctxOrAdd') backslashAfterLastCtxOrAdd = true;
      if (prevWasAdd) backslashAfterLastAdd = true;
      prevKind = 'bs';
      prevWasAdd = false;
    }
  }
  return { aStart, ops, backslashAfterLastCtxOrAdd, hasAdd, backslashAfterLastAdd };
}

function parseUnified(lines: string[]): UnifiedSection[] {
  interface DraftSection {
    inHeader: boolean;
    hasDashPair: boolean;
    gitOld: string | null;
    gitNew: string | null;
    dashOld: string | null;
    dashNew: string | null;
    renameFrom: string | null;
    renameTo: string | null;
    isNewFile: boolean;
    isDeletedFile: boolean;
    hunks: UnifiedHunk[];
  }

  const drafts: DraftSection[] = [];
  let active: DraftSection | null = null;
  let openHunk: { aStart: number; rawBody: string[] } | null = null;

  const closeHunk = (): void => {
    if (openHunk !== null && active !== null) {
      active.hunks.push(finalizeUnifiedHunk(openHunk.aStart, openHunk.rawBody));
      openHunk = null;
    }
  };
  const closeSection = (): void => {
    closeHunk();
    if (active !== null) {
      drafts.push(active);
      active = null;
    }
  };
  const makeDraft = (): DraftSection => ({
    inHeader: true,
    hasDashPair: false,
    gitOld: null,
    gitNew: null,
    dashOld: null,
    dashNew: null,
    renameFrom: null,
    renameTo: null,
    isNewFile: false,
    isDeletedFile: false,
    hunks: [],
  });

  const hunkHeaderRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const next = lines[i + 1];
    const ln = i + 1;
    const isGit = line === 'diff --git' || line.startsWith('diff --git ');
    const isDashPair = line.startsWith('--- ') && next !== undefined && next.startsWith('+++ ');

    if (openHunk !== null) {
      if (!isGit && !isDashPair && (line === '' || line[0] === ' ' || line[0] === '-' || line[0] === '+' || line[0] === '\\')) {
        openHunk.rawBody.push(line);
        continue;
      }
      closeHunk();
    }

    if (isGit) {
      const { oldPath, newPath } = parseDiffGitLine(line, ln);
      closeSection();
      active = makeDraft();
      active.gitOld = oldPath;
      active.gitNew = newPath;
      continue;
    }

    if (isDashPair) {
      if (active === null || !active.inHeader || active.hasDashPair) {
        closeSection();
        active = makeDraft();
      }
      active.dashOld = parseUnifiedHeaderPath(line);
      active.dashNew = parseUnifiedHeaderPath(next!);
      active.hasDashPair = true;
      i += 1;
      continue;
    }

    if (line.startsWith('--- ')) {
      if (active !== null && active.inHeader && !active.hasDashPair) {
        throw new Exit2(`error: parse ${ln + 1}`);
      }
      continue;
    }

    if (line.startsWith('@@')) {
      if (active === null) throw new Exit2(`error: parse ${ln}`);
      const m = hunkHeaderRe.exec(line);
      if (m === null) throw new Exit2(`error: parse ${ln}`);
      active.inHeader = false;
      openHunk = { aStart: Number(m[1]), rawBody: [] };
      continue;
    }

    if (active !== null && active.inHeader) {
      if (line.startsWith('rename from ')) active.renameFrom = line.slice('rename from '.length).trim();
      else if (line.startsWith('rename to ')) active.renameTo = line.slice('rename to '.length).trim();
      else if (line === 'new file mode' || line.startsWith('new file mode ')) active.isNewFile = true;
      else if (line === 'deleted file mode' || line.startsWith('deleted file mode ')) active.isDeletedFile = true;
    }
  }
  closeSection();

  return drafts.map((d) => {
    let oldPath: string | null = null;
    let newPath: string | null = null;
    if (d.hasDashPair) {
      oldPath = d.dashOld;
      newPath = d.dashNew;
    } else if (d.renameFrom !== null && d.renameTo !== null) {
      oldPath = d.renameFrom;
      newPath = d.renameTo;
    } else {
      oldPath = d.gitOld;
      newPath = d.gitNew;
    }
    let kind: UnifiedSection['kind'];
    if (oldPath === '/dev/null' || d.isNewFile) kind = 'create';
    else if (newPath === '/dev/null' || d.isDeletedFile) kind = 'delete';
    else if (oldPath !== newPath) kind = 'move';
    else kind = 'change';
    return { kind, oldPath, newPath, hunks: d.hunks };
  });
}

function applyHunkToLines(
  lines: string[],
  hunk: UnifiedHunk,
  d: number,
  sectionFinalBreak: boolean,
  strict: boolean,
  filePath: string,
): { lines: string[]; d: number; finalBreak: boolean } {
  const { o, taggedN } = splitOps(hunk.ops);
  if (o.length === 0) {
    if (taggedN.length === 0) return { lines, d, finalBreak: sectionFinalBreak };
    const insertIdx = Math.max(0, Math.min(hunk.aStart + d, lines.length));
    const added = taggedN.map((e) => (e as { kind: 'add'; text: string }).text);
    const atEnd = insertIdx === lines.length;
    const nextLines = lines.slice();
    nextLines.splice(insertIdx, 0, ...added);
    return {
      lines: nextLines,
      d: d + added.length,
      finalBreak: atEnd ? !hunk.backslashAfterLastCtxOrAdd : sectionFinalBreak,
    };
  }
  const match = matchTier(lines, o, 0, lines.length - o.length, strict);
  if (match === null) throw new Fail('no-match', filePath);
  const pos = nearestTo(match.positions, hunk.aStart - 1 + d);
  const pIndent = leadingIndent(o[0]!);
  const fIndent = leadingIndent(lines[pos]!);
  const rendered = renderN(taggedN, lines, pos, match.tier, pIndent, fIndent);
  const atEnd = pos + o.length === lines.length;
  const nextLines = lines.slice();
  nextLines.splice(pos, o.length, ...rendered);
  return {
    lines: nextLines,
    d: d + (taggedN.length - o.length),
    finalBreak: atEnd ? !hunk.backslashAfterLastCtxOrAdd : sectionFinalBreak,
  };
}

function applyUnified(sec: UnifiedSection, tree: Tree, strict: boolean): void {
  if (sec.kind === 'create') {
    const p = sec.newPath!;
    if (!safe(p)) throw new Fail('unsafe', p);
    if (tree.get(p) !== null) throw new Fail('exists', p);
    const addLines: string[] = [];
    let noBreak = false;
    for (const h of sec.hunks) {
      for (const op of h.ops) {
        if (op.kind === 'add') addLines.push(op.text);
      }
      if (h.hasAdd) noBreak = h.backslashAfterLastAdd;
    }
    tree.now.set(p, joinLines(addLines, '\n', !noBreak));
    return;
  }
  if (sec.kind === 'delete') {
    const p = sec.oldPath!;
    if (!safe(p)) throw new Fail('unsafe', p);
    if (tree.get(p) === null) throw new Fail('missing', p);
    tree.now.set(p, null);
    return;
  }
  const src = sec.oldPath!;
  const dst = sec.newPath!;
  if (!safe(src)) throw new Fail('unsafe', src);
  if (sec.kind === 'move' && !safe(dst)) throw new Fail('unsafe', dst);
  const before = tree.get(src);
  if (before === null) throw new Fail('missing', src);
  if (sec.kind === 'move' && tree.get(dst) !== null) throw new Fail('exists', dst);
  let { lines, br, finalBreak } = splitLines(before);
  let d = 0;
  for (const h of sec.hunks) {
    const res = applyHunkToLines(lines, h, d, finalBreak, strict, src);
    lines = res.lines;
    d = res.d;
    finalBreak = res.finalBreak;
  }
  const after = joinLines(lines, br, finalBreak);
  if (sec.kind === 'move') {
    tree.now.set(src, null);
    tree.now.set(dst, after);
    tree.moves.push({ old: src, new: dst });
  } else {
    tree.now.set(dst, after);
  }
}

interface SrBlock {
  path: string;
  oldLines: string[];
  newLines: string[];
}

function parseSearchReplace(lines: string[]): SrBlock[] {
  const blocks: SrBlock[] = [];
  let lastEnd = -1;
  let prevPath: string | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.trimEnd() !== '<<<<<<< SEARCH') continue;
    const searchLn = i + 1;
    let resolvedPath: string | null = null;
    for (let k = i - 1; k > lastEnd; k -= 1) {
      const cand = lines[k]!;
      if (blank(cand)) continue;
      const trimmed = cand.trim();
      if (trimmed.startsWith('```')) continue;
      resolvedPath = trimmed;
      break;
    }
    if (resolvedPath === null) {
      if (prevPath !== null) resolvedPath = prevPath;
      else throw new Exit2(`error: parse ${searchLn}`);
    }
    const oldLines: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const endTrimmed = lines[j]!.trimEnd();
      if (endTrimmed === '=======') break;
      if (endTrimmed === '>>>>>>> REPLACE') throw new Exit2(`error: parse ${searchLn}`);
      oldLines.push(lines[j]!);
    }
    if (j >= lines.length) throw new Exit2(`error: parse ${searchLn}`);
    const newLines: string[] = [];
    let m = j + 1;
    for (; m < lines.length; m += 1) {
      if (lines[m]!.trimEnd() === '>>>>>>> REPLACE') break;
      newLines.push(lines[m]!);
    }
    if (m >= lines.length) throw new Exit2(`error: parse ${searchLn}`);
    blocks.push({ path: resolvedPath, oldLines, newLines });
    prevPath = resolvedPath;
    lastEnd = m;
    i = m;
  }
  return blocks;
}

function applySearchReplace(block: SrBlock, tree: Tree, strict: boolean): void {
  if (!safe(block.path)) throw new Fail('unsafe', block.path);
  if (block.oldLines.length === 0) {
    if (tree.get(block.path) !== null) throw new Fail('exists', block.path);
    tree.now.set(block.path, joinLines(block.newLines, '\n', true));
    return;
  }
  const before = tree.get(block.path);
  if (before === null) throw new Fail('missing', block.path);
  const { lines, br, finalBreak } = splitLines(before);
  const match = matchTier(lines, block.oldLines, 0, lines.length - block.oldLines.length, strict);
  if (match === null) throw new Fail('no-match', block.path);
  if (match.positions.length > 1) throw new Fail('ambiguous', block.path);
  const pos = match.positions[0]!;
  const pIndent = leadingIndent(block.oldLines[0]!);
  const fIndent = leadingIndent(lines[pos]!);
  const taggedN: TaggedN[] = block.newLines.map((text) => ({ kind: 'add', text }));
  const rendered = renderN(taggedN, lines, pos, match.tier, pIndent, fIndent);
  const nextLines = lines.slice();
  nextLines.splice(pos, block.oldLines.length, ...rendered);
  tree.now.set(block.path, joinLines(nextLines, br, finalBreak));
}

interface V4aChunk {
  anchor: string | null;
  ops: Op[];
  eof: boolean;
}

type V4aSection =
  | { kind: 'add'; path: string; lines: string[] }
  | { kind: 'delete'; path: string }
  | { kind: 'update'; path: string; moveTo: string | null; chunks: V4aChunk[] };

function parseV4a(lines: string[]): V4aSection[] {
  const firstNonBlank = lines.findIndex((l) => !blank(l));
  if (firstNonBlank < 0) throw new Exit2('error: parse 1');
  if (lines[firstNonBlank]!.trim() !== '*** Begin Patch') {
    throw new Exit2(`error: parse ${firstNonBlank + 1}`);
  }
  let lastNonBlank = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!blank(lines[i]!)) {
      lastNonBlank = i;
      break;
    }
  }
  if (lastNonBlank < 0 || lines[lastNonBlank]!.trim() !== '*** End Patch') {
    throw new Exit2(`error: parse ${lines.length + 1}`);
  }

  type RawSection = {
    kind: 'add' | 'delete' | 'update';
    path: string;
    headerLn: number;
    body: { text: string; ln: number }[];
  };

  const rawSections: RawSection[] = [];
  let current: RawSection | null = null;

  for (let i = firstNonBlank + 1; i < lastNonBlank; i += 1) {
    const text = lines[i]!;
    const ln = i + 1;
    if (text.startsWith('*** Add File:')) {
      if (current !== null) rawSections.push(current);
      current = { kind: 'add', path: text.slice('*** Add File:'.length).trim(), headerLn: ln, body: [] };
    } else if (text.startsWith('*** Delete File:')) {
      if (current !== null) rawSections.push(current);
      current = { kind: 'delete', path: text.slice('*** Delete File:'.length).trim(), headerLn: ln, body: [] };
    } else if (text.startsWith('*** Update File:')) {
      if (current !== null) rawSections.push(current);
      current = { kind: 'update', path: text.slice('*** Update File:'.length).trim(), headerLn: ln, body: [] };
    } else if (current === null) {
      if (!blank(text)) throw new Exit2(`error: parse ${ln}`);
    } else {
      current.body.push({ text, ln });
    }
  }
  if (current !== null) rawSections.push(current);

  const sections: V4aSection[] = [];
  for (const raw of rawSections) {
    while (raw.body.length > 0 && blank(raw.body[raw.body.length - 1]!.text)) {
      raw.body.pop();
    }
    if (raw.kind === 'add') {
      const addLines: string[] = [];
      for (const item of raw.body) {
        if (item.text === '') addLines.push('');
        else if (item.text[0] === '+') addLines.push(item.text.slice(1));
        else throw new Exit2(`error: parse ${item.ln}`);
      }
      sections.push({ kind: 'add', path: raw.path, lines: addLines });
    } else if (raw.kind === 'delete') {
      if (raw.body.length > 0) throw new Exit2(`error: parse ${raw.body[0]!.ln}`);
      sections.push({ kind: 'delete', path: raw.path });
    } else {
      let moveTo: string | null = null;
      let idx = 0;
      if (raw.body.length > 0 && raw.body[0]!.text.startsWith('*** Move to:')) {
        moveTo = raw.body[0]!.text.slice('*** Move to:'.length).trim();
        idx = 1;
      }
      const chunks: V4aChunk[] = [];
      let activeChunk: V4aChunk | null = null;
      let hasAnyChunk = false;
      let closedByEof = false;

      for (let k = idx; k < raw.body.length; k += 1) {
        const { text, ln } = raw.body[k]!;
        if (text.startsWith('*** Move to:')) {
          throw new Exit2(`error: parse ${ln}`);
        }
        if (text === '*** End of File') {
          if (activeChunk === null) throw new Exit2(`error: parse ${ln}`);
          activeChunk.eof = true;
          chunks.push(activeChunk);
          activeChunk = null;
          closedByEof = true;
          continue;
        }
        if (text.startsWith('@@')) {
          if (activeChunk !== null) chunks.push(activeChunk);
          const anchor = text.slice(2).trim();
          activeChunk = { anchor: anchor === '' ? null : anchor, ops: [], eof: false };
          hasAnyChunk = true;
          closedByEof = false;
          continue;
        }
        let op: Op;
        if (text === '') op = { kind: 'ctx', text: '' };
        else if (text[0] === ' ') op = { kind: 'ctx', text: text.slice(1) };
        else if (text[0] === '-') op = { kind: 'del', text: text.slice(1) };
        else if (text[0] === '+') op = { kind: 'add', text: text.slice(1) };
        else throw new Exit2(`error: parse ${ln}`);

        if (activeChunk !== null) {
          activeChunk.ops.push(op);
        } else if (closedByEof) {
          if (!blank(text)) throw new Exit2(`error: parse ${ln}`);
        } else if (!hasAnyChunk) {
          activeChunk = { anchor: null, ops: [op], eof: false };
          hasAnyChunk = true;
        }
      }
      if (activeChunk !== null) chunks.push(activeChunk);
      if (chunks.length === 0 && moveTo === null) {
        throw new Exit2(`error: parse ${raw.headerLn}`);
      }
      sections.push({ kind: 'update', path: raw.path, moveTo, chunks });
    }
  }
  return sections;
}

function applyV4a(sec: V4aSection, tree: Tree, strict: boolean): void {
  if (sec.kind === 'add') {
    if (!safe(sec.path)) throw new Fail('unsafe', sec.path);
    if (tree.get(sec.path) !== null) throw new Fail('exists', sec.path);
    tree.now.set(sec.path, joinLines(sec.lines, '\n', true));
    return;
  }
  if (sec.kind === 'delete') {
    if (!safe(sec.path)) throw new Fail('unsafe', sec.path);
    if (tree.get(sec.path) === null) throw new Fail('missing', sec.path);
    tree.now.set(sec.path, null);
    return;
  }
  if (!safe(sec.path)) throw new Fail('unsafe', sec.path);
  if (sec.moveTo !== null && !safe(sec.moveTo)) throw new Fail('unsafe', sec.moveTo);
  const before = tree.get(sec.path);
  if (before === null) throw new Fail('missing', sec.path);
  if (sec.moveTo !== null && tree.get(sec.moveTo) !== null) throw new Fail('exists', sec.moveTo);

  const { lines, br, finalBreak } = splitLines(before);
  let cursor = 0;
  for (const chunk of sec.chunks) {
    if (chunk.anchor !== null) {
      const anchorMatch = matchTier(lines, [chunk.anchor], cursor, lines.length - 1, strict);
      if (anchorMatch === null) throw new Fail('no-match', sec.path);
      const anchorPos = firstAtOrAfter(anchorMatch.positions, cursor);
      if (anchorPos === null) throw new Fail('no-match', sec.path);
      cursor = anchorPos + 1;
    }
    const { o, taggedN } = splitOps(chunk.ops);
    if (o.length === 0) {
      const insertIdx = chunk.eof ? lines.length : cursor;
      const added = taggedN.map((e) => (e as { kind: 'add'; text: string }).text);
      lines.splice(insertIdx, 0, ...added);
      cursor = insertIdx + added.length;
    } else {
      const minPos = chunk.eof ? Math.max(cursor, lines.length - o.length) : cursor;
      const maxPos = lines.length - o.length;
      const match = matchTier(lines, o, minPos, maxPos, strict);
      if (match === null) throw new Fail('no-match', sec.path);
      const pos = firstAtOrAfter(match.positions, minPos);
      if (pos === null) throw new Fail('no-match', sec.path);
      const pIndent = leadingIndent(o[0]!);
      const fIndent = leadingIndent(lines[pos]!);
      const rendered = renderN(taggedN, lines, pos, match.tier, pIndent, fIndent);
      lines.splice(pos, o.length, ...rendered);
      cursor = pos + rendered.length;
    }
  }
  const after = joinLines(lines, br, finalBreak);
  if (sec.moveTo !== null) {
    tree.now.set(sec.path, null);
    tree.now.set(sec.moveTo, after);
    tree.moves.push({ old: sec.path, new: sec.moveTo });
  } else {
    tree.now.set(sec.path, after);
  }
}

function detect(lines: string[]): string | null {
  const first = lines.findIndex((l) => !blank(l));
  if (first < 0) return null;
  if (lines[first]!.trim() === '*** Begin Patch') return 'v4a';
  const c = lines[first]!.trimStart()[0];
  if (c === '[' || c === '{') return 'json';
  if (lines.some((l) => l.trimEnd() === '<<<<<<< SEARCH')) return 'search-replace';
  if (lines.some((l, i) => l.startsWith('diff --git ') || (l.startsWith('--- ') && (lines[i + 1] ?? '').startsWith('+++ ')))) return 'unified';
  return null;
}

/** One JSON edit object (SPEC.md section 9), or null when it is not one. */
function jsonEdit(v: unknown): Edit | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const p = o.path;
  if (typeof p !== 'string') return null;
  const exists = (tree: Tree): string => {
    if (!safe(p)) throw new Fail('unsafe', p);
    const t = tree.get(p);
    if (t === null) throw new Fail('missing', p);
    return t;
  };
  if (o.command === 'create' && typeof o.file_text === 'string') {
    const text = o.file_text;
    return (tree) => {
      if (!safe(p)) throw new Fail('unsafe', p);
      if (tree.get(p) !== null) throw new Fail('exists', p);
      tree.now.set(p, text);
    };
  }
  if (o.command === 'str_replace' && typeof o.old_str === 'string' && o.old_str !== '' && (o.new_str === undefined || typeof o.new_str === 'string')) {
    const oldStr = o.old_str;
    const newStr = (o.new_str as string | undefined) ?? '';
    return (tree) => {
      const before = exists(tree);
      const nl = before.indexOf('\n');
      const crlf = nl > 0 && before[nl - 1] === '\r';
      const lf = (s: string): string => (crlf ? s.replaceAll('\r\n', '\n') : s);
      const t = lf(before);
      const old = lf(oldStr);
      let count = 0;
      for (let k = t.indexOf(old); k >= 0; k = t.indexOf(old, k + 1)) count += 1;
      if (count === 0) throw new Fail('no-match', p);
      if (count > 1) throw new Fail('ambiguous', p);
      const at = t.indexOf(old);
      const out = t.slice(0, at) + lf(newStr) + t.slice(at + old.length);
      tree.now.set(p, crlf ? out.replaceAll('\n', '\r\n') : out);
    };
  }
  if (o.command === 'insert' && typeof o.insert_line === 'number' && Number.isInteger(o.insert_line) && typeof o.new_str === 'string') {
    const line = o.insert_line;
    const add = patchLines(o.new_str);
    return (tree) => {
      const before = exists(tree);
      const nl = before.indexOf('\n');
      const br = nl > 0 && before[nl - 1] === '\r' ? '\r\n' : '\n';
      const lines = before === '' ? [] : before.split(br);
      const final = before !== '' && before.endsWith(br);
      if (final) lines.pop();
      if (line < 0 || line > lines.length) throw new Fail('no-match', p);
      lines.splice(line, 0, ...add);
      tree.now.set(p, lines.length === 0 ? '' : lines.join(br) + (final ? br : ''));
    };
  }
  return null;
}

function jsonEdits(text: string, lines: string[]): Edit[] {
  const first = lines.findIndex((l) => !blank(l));
  if (first < 0) throw new Exit2('error: parse 1');
  const edits: Edit[] = [];
  if (lines[first]!.trimStart().startsWith('[')) {
    let v: unknown;
    try {
      v = JSON.parse(text);
    } catch {
      throw new Exit2(`error: parse ${first + 1}`);
    }
    if (!Array.isArray(v)) throw new Exit2(`error: parse ${first + 1}`);
    for (const x of v) {
      const e = jsonEdit(x);
      if (e === null) throw new Exit2(`error: parse ${first + 1}`);
      edits.push(e);
    }
    return edits;
  }
  lines.forEach((l, i) => {
    if (blank(l)) return;
    let e: Edit | null = null;
    try {
      e = jsonEdit(JSON.parse(l));
    } catch {
      e = null;
    }
    if (e === null) throw new Exit2(`error: parse ${i + 1}`);
    edits.push(e);
  });
  return edits;
}

function run(args: string[]): { code: number; out: string[] } {
  let format: string | null = null;
  let check = false;
  let strict = false;
  const pos: string[] = [];
  let ended = false;
  for (const a of args) {
    if (!ended && a === '--') ended = true;
    else if (!ended && a.startsWith('-') && a !== '-') {
      if (a.startsWith('--format=') && format === null && FORMATS.includes(a.slice(9))) format = a.slice(9);
      else if (a === '--check' && !check) check = true;
      else if (a === '--strict' && !strict) strict = true;
      else return { code: 2, out: ['error: usage'] };
    } else pos.push(a);
  }
  if (pos.length > 1) return { code: 2, out: ['error: usage'] };
  const file = pos.length === 0 || pos[0] === '-' ? null : pos[0]!;
  let text = '';
  try {
    text = readFileSync(file ?? 0, 'utf8');
  } catch {
    if (file !== null) return { code: 2, out: ['error: no-patch'] };
  }
  const lines = patchLines(text);
  const kind = format === null || format === 'auto' ? detect(lines) : format;
  if (kind === null) return { code: 2, out: ['error: format'] };
  let edits: Edit[];
  try {
    if (kind === 'json') edits = jsonEdits(text, lines);
    else if (kind === 'unified') edits = parseUnified(lines).map((sec) => (tree: Tree) => applyUnified(sec, tree, strict));
    else if (kind === 'search-replace') edits = parseSearchReplace(lines).map((blk) => (tree: Tree) => applySearchReplace(blk, tree, strict));
    else if (kind === 'v4a') edits = parseV4a(lines).map((sec) => (tree: Tree) => applyV4a(sec, tree, strict));
    else edits = [];
    if (edits.length === 0) throw new Exit2('error: parse 1');
  } catch (e) {
    if (e instanceof Exit2) return { code: 2, out: [e.line] };
    throw e;
  }
  const tree = new Tree();
  const fails: Fail[] = [];
  for (const edit of edits) {
    const before = new Map(tree.now);
    const beforeMoves = tree.moves.length;
    try {
      edit(tree);
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      tree.now.clear();
      for (const [k, v] of before) tree.now.set(k, v);
      tree.moves.length = beforeMoves;
      fails.push(e);
    }
  }
  if (fails.length > 0) return { code: 1, out: [...fails.map((f) => `error: ${f.code} ${f.path}`), `failed: ${fails.length} of ${edits.length} edits`] };

  const changedPaths = [...tree.now.keys()]
    .filter((p) => tree.original(p) !== tree.now.get(p)!)
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));

  const dMap = new Map<string, string>();
  const aMap = new Map<string, string>();
  const rowItems: Array<{ sortKey: string; line: string }> = [];

  for (const p of changedPaths) {
    const was = tree.original(p);
    const now = tree.now.get(p)!;
    if (was === null) aMap.set(p, `A ${p}`);
    else if (now === null) dMap.set(p, `D ${p}`);
    else rowItems.push({ sortKey: p, line: `M ${p}` });
  }

  for (const m of tree.moves) {
    if (dMap.has(m.old) && aMap.has(m.new)) {
      dMap.delete(m.old);
      aMap.delete(m.new);
      rowItems.push({ sortKey: m.new, line: `R ${m.old} -> ${m.new}` });
    }
  }
  for (const [p, line] of dMap) rowItems.push({ sortKey: p, line });
  for (const [p, line] of aMap) rowItems.push({ sortKey: p, line });

  rowItems.sort((a, b) => Buffer.compare(Buffer.from(a.sortKey), Buffer.from(b.sortKey)));
  const rows = rowItems.map((r) => r.line);

  if (!check) {
    for (const p of changedPaths) {
      if (tree.now.get(p)! === null) rmSync(p, { force: true });
    }
    for (const p of changedPaths) {
      const now = tree.now.get(p)!;
      if (now !== null) {
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, now);
      }
    }
  }
  return { code: 0, out: [...rows, `ok: ${rows.length} ${rows.length === 1 ? 'file' : 'files'}`] };
}


const trialEnv = process.env.MAKEFUN_ENV_URL;
if (trialEnv !== undefined && trialEnv !== '') {
  // A trial: the kit's runner reads the checks from the env and runs this file on each one, without this variable.
  const { runTrial } = await import('./runner.ts');
  await runTrial(trialEnv);
} else {
  const r = run(process.argv.slice(2));
  writeSync(1, r.out.map((l) => `${l}\n`).join(''));
  process.exitCode = r.code;
}
