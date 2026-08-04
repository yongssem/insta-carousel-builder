#!/usr/bin/env node
/**
 * insta-carousel-builder — v5 "웜 크림 에디토리얼" 슬라이드 빌더
 *
 * 슬라이드 데이터(JSON)를 받아 1080×1350 HTML 9장을 생성합니다.
 * 생성된 HTML 은 scripts/html-carousel-gen.js 가 PNG 로 캡처합니다.
 *
 * 왜 HTML 인가:
 *   - 한글 100% 정확 (이미지 모델 오타 없음)
 *   - 캐릭터를 9장 내내 **동일한 자산**으로 재사용 (장마다 얼굴 바뀌지 않음)
 *   - 헤더/페이지번호/푸터 같은 정밀 텍스트가 절대 흔들리지 않음
 *
 * 캐릭터는 assets/characters/*.png (나노바나나 2 Lite 로 1회 생성) 를 씁니다.
 *
 * 사용법:
 *   node scripts/build-v5-slides.mjs --data templates/slides.v5.<topic>.json --topic <topic>
 *   node scripts/html-carousel-gen.js --topic <topic>
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) a[argv[i].slice(2)] = argv[++i];
  }
  return a;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 헤드라인의 *강조* 를 accent 스팬으로, 줄바꿈을 <br> 로. 나머지는 이스케이프. */
function mark(s) {
  return esc(s)
    .replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>')
    .replace(/\n/g, '<br>');
}

const CSS = (T) => `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    width:1080px;height:1350px;background:${T.bg};
    font-family:'Pretendard Variable',sans-serif;color:${T.ink};
    overflow:hidden;position:relative;
  }
  .serif{font-family:Georgia,'Times New Roman',serif}
  .pad{position:absolute;left:72px;right:72px}

  /* 상단 헤더 */
  .head{top:60px;display:flex;justify-content:space-between;align-items:baseline;
        font-size:26px;font-weight:600;letter-spacing:-0.01em}
  .head .rt{font-variant-numeric:tabular-nums;letter-spacing:0.06em}

  /* 배경 고스트 넘버 */
  .ghost{position:absolute;right:56px;top:300px;font-size:300px;font-weight:800;
         line-height:.8;color:rgba(26,26,26,.055);letter-spacing:-0.04em;z-index:0}

  /* 라벨 */
  .label{font-size:23px;font-weight:800;letter-spacing:.18em;color:${T.accent};
         display:flex;align-items:center;gap:14px}
  .label b{font-size:18px;transform:translateY(-1px)}

  /* 헤드라인 */
  h1{font-size:60px;font-weight:800;line-height:1.24;letter-spacing:-0.035em;
     word-break:keep-all;margin-top:18px}
  h1 .hl{color:${T.accent}}
  .rule{height:5px;background:${T.accent};border-radius:3px;margin-top:26px}
  .sub{margin-top:26px;font-size:36px;font-weight:700;color:${T.accent};letter-spacing:-0.025em;line-height:1.35}
  .note{margin-top:16px;font-size:29px;color:${T.muted};letter-spacing:-0.015em;line-height:1.5;white-space:pre-line}

  /* 캐릭터 — 배경이 크림이라 누끼 없이 얹고 가장자리만 부드럽게 지운다 */
  .char{position:absolute;z-index:1;pointer-events:none;
        -webkit-mask-image:radial-gradient(circle at 50% 48%, #000 58%, rgba(0,0,0,0) 76%);
        mask-image:radial-gradient(circle at 50% 48%, #000 58%, rgba(0,0,0,0) 76%)}

  /* 하단 */
  .swipe{bottom:150px;font-size:30px;font-weight:700;color:${T.accent};z-index:2}
  .swipe i{font-size:31px}
  .foot{bottom:64px;display:flex;justify-content:space-between;align-items:baseline;z-index:2}
  .foot .h{font-size:27px;font-weight:800;letter-spacing:-0.01em}
  /* 핸들 옆 표시이름 — 같은 줄, 위계만 낮춤 */
  .foot .h em{font-style:normal;font-weight:600;color:${T.muted};margin-left:12px;font-size:25px}
  .foot .s{font-size:26px;font-weight:600;color:${T.muted}}

  /* ── 시각 요소 ───────────────────────────── */
  .card{background:${T.card};border:1.5px solid ${T.line};border-radius:22px}

  /* 라벨을 막대 위 한 줄로 올린다.
     같은 줄에 두면 라벨 길이에 따라 트랙 폭이 행마다 달라져(실측 417 vs 478px)
     두 막대를 나란히 비교할 수 없게 된다. 위로 올리면 트랙이 항상 전폭이다. */
  .barrow{margin-bottom:32px}
  .brhead{display:flex;justify-content:space-between;align-items:baseline;
          gap:20px;margin-bottom:13px}
  .barrow .k{font-size:29px;font-weight:700;letter-spacing:-0.015em}
  .barrow .v{font-size:29px;font-weight:800;letter-spacing:-0.015em;
             white-space:nowrap;text-align:right}
  .barrow .v.muted{color:${T.muted}}
  .barrow .v.accent{color:${T.accent}}
  .track{display:block;width:100%;height:56px;border-radius:28px;
         background:${T.track};overflow:hidden;position:relative}
  /* span 이므로 display:block 필수 — inline 이면 width/height 가 무시된다 */
  .fill{display:block;height:100%;width:var(--w);border-radius:28px}

  .statwrap{display:flex;gap:22px}
  .stat{flex:1;padding:38px 34px}
  .stat .t{font-size:27px;font-weight:800;letter-spacing:.03em;color:${T.muted}}
  .stat .v{font-size:74px;font-weight:800;letter-spacing:-0.045em;margin:12px 0 8px}
  .stat .d{font-size:25px;color:${T.muted};line-height:1.5;letter-spacing:-0.015em;white-space:pre-line}

  .src{font-size:24px;font-weight:600;color:${T.muted};letter-spacing:.03em;
       font-variant-numeric:tabular-nums}

  .dots{display:grid;grid-template-columns:repeat(10,1fr);gap:13px}
  .dots i{aspect-ratio:1;border-radius:7px;background:${T.track};display:block}
  .dots i.on{background:${T.accent}}

  /* 태그 목록 — 항목 나열용 (데이터가 아니라 범위를 보여줄 때) */
  .chips{display:flex;flex-wrap:wrap;gap:18px;max-width:880px}
  .chips span{padding:19px 32px;border-radius:999px;background:${T.card};
              border:1.5px solid ${T.line};font-size:29px;font-weight:700;
              letter-spacing:-0.015em}
  .chips span.on{background:${T.accent};border-color:${T.accent};color:#fff}

  .flow{display:flex;align-items:center;gap:26px}
  .chip{padding:23px 34px;border-radius:999px;font-size:29px;font-weight:800;letter-spacing:-0.015em}
  .chip.off{background:${T.track};color:${T.muted}}
  .chip.on{background:${T.accent};color:#fff}

  /* ── 애니메이션 (body.anim 일 때만) ─────────────────
     전부 paused 로 두고 Web Animations API 로 시각을 강제 지정해
     프레임 단위 캡처가 결정적(deterministic)이 되게 한다. */
  @keyframes fadeUp{from{opacity:0;transform:translateY(38px)}to{opacity:1;transform:none}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes growW{from{width:0}to{width:var(--w)}}
  @keyframes popIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
  @keyframes charIn{from{opacity:0;transform:translateY(60px) scale(.94)}to{opacity:1;transform:none}}
  @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}

  /* 헤더·푸터·고스트넘버는 절대 페이드하지 않는다.
     인스타에서 자동재생이 막히거나(데이터 절약 모드) 썸네일로 첫 프레임이
     쓰이면 빈 화면이 노출되기 때문. 프레임 구조는 0초부터 보여야 한다. */
  body.anim .label{animation:fadeUp .65s cubic-bezier(.22,1,.36,1) both}
  body.anim h1{animation:fadeUp .8s cubic-bezier(.22,1,.36,1) .14s both}
  body.anim .rule{transform-origin:left center;animation:growX .65s cubic-bezier(.22,1,.36,1) .42s both}
  body.anim .sub{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .56s both}
  body.anim .note{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .68s both}
  body.anim .swipe{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) 1.15s both}

  body.anim .barrow{animation:fadeIn .5s ease-out both}
  body.anim .barrow:nth-of-type(1){animation-delay:.8s}
  body.anim .barrow:nth-of-type(2){animation-delay:.95s}
  body.anim .fill{animation:growW 1.1s cubic-bezier(.22,1,.36,1) .9s both}
  body.anim .brhead{animation:fadeUp .55s cubic-bezier(.22,1,.36,1) .82s both}
  body.anim .barrow:nth-of-type(2) .fill{animation-delay:1.05s}
  body.anim .stat{animation:fadeUp .75s cubic-bezier(.22,1,.36,1) both}
  body.anim .stat:nth-child(1){animation-delay:.85s}
  body.anim .stat:nth-child(2){animation-delay:1s}
  body.anim .dots i{animation:popIn .5s cubic-bezier(.34,1.56,.64,1) both}
  body.anim .chips span{animation:fadeUp .6s cubic-bezier(.22,1,.36,1) both}
  body.anim .chip,
  body.anim .flow svg{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) both}
  body.anim .flow .chip.off{animation-delay:.85s}
  body.anim .flow svg{animation-delay:1s}
  body.anim .flow .chip.on{animation-delay:1.15s}
  body.anim .src{animation:fadeIn .6s ease-out 1.5s both}

  body.anim .char{animation:charIn .9s cubic-bezier(.22,1,.36,1) .5s both}
  /* 요정은 등장 후 한 번만 살짝 떠올랐다 제자리로.
     ⚠️ infinite 금지 — 캐러셀 영상은 루프 없이 마지막 프레임에서 정지하므로
        끝까지 움직이면 어정쩡한 자세로 얼어붙습니다. 영상 종료 전에 반드시 정지. */
  body.anim .char.float{animation:charIn .9s cubic-bezier(.22,1,.36,1) .5s both,
                                  floaty 1.5s ease-in-out 1.45s 1 both}
`;

function visual(v, T) {
  if (!v) return '';
  if (v.type === 'bars') {
    return `<div class="pad" style="top:${v.top}px">
      ${v.rows
        .map(
          (r) => `<div class="barrow">
        <div class="brhead">
          <span class="k">${esc(r.k)}</span>
          <span class="v ${r.tone === 'muted' ? 'muted' : 'accent'}">${esc(r.v)}</span>
        </div>
        <span class="track"><span class="fill" style="--w:${r.pct}%;background:${
            r.tone === 'muted' ? T.inkSoft : T.accent
          }"></span></span>
      </div>`
        )
        .join('\n')}
      <div class="src" style="margin-top:8px">${esc(v.src)}</div>
    </div>`;
  }
  if (v.type === 'stats') {
    return `<div class="pad" style="top:${v.top}px">
      <div class="statwrap">
        ${v.items
          .map(
            (s) => `<div class="stat card">
          <div class="t">${esc(s.t)}</div>
          <div class="v" style="color:${s.tone === 'accent' ? T.accent : T.ink}">${esc(s.v)}</div>
          <div class="d">${esc(s.d)}</div>
        </div>`
          )
          .join('\n')}
      </div>
      <div class="src" style="margin-top:22px">${esc(v.src)}</div>
    </div>`;
  }
  if (v.type === 'dots') {
    const n = v.total ?? 50;
    return `<div class="pad" style="top:${v.top}px">
      <div class="dots" style="max-width:${v.width ?? 620}px">${Array.from(
        { length: n },
        (_, i) =>
          `<i class="${i < v.on ? 'on' : ''}" style="animation-delay:${(0.85 + i * 0.022).toFixed(3)}s"></i>`
      ).join('')}</div>
      <div class="src" style="margin-top:24px">${esc(v.src)}</div>
    </div>`;
  }
  if (v.type === 'chips') {
    return `<div class="pad" style="top:${v.top}px">
      <div class="chips">${v.items
        .map(
          (it, i) =>
            `<span class="${it.on ? 'on' : ''}" style="animation-delay:${(0.85 + i * 0.09).toFixed(
              2
            )}s">${esc(it.t ?? it)}</span>`
        )
        .join('')}</div>
      ${v.src ? `<div class="src" style="margin-top:26px">${esc(v.src)}</div>` : ''}
    </div>`;
  }
  if (v.type === 'flow') {
    return `<div class="pad" style="top:${v.top}px">
      <div class="flow">
        <span class="chip off">${esc(v.from)}</span>
        <svg width="60" height="26" viewBox="0 0 60 26" fill="none"><path d="M2 13h50M44 4l9 9-9 9" stroke="${T.accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="chip on">${esc(v.to)}</span>
      </div>
      <div class="src" style="margin-top:26px">${esc(v.src)}</div>
    </div>`;
  }
  return '';
}

function slideHtml(s, meta, T, charRel, anim) {
  const ch = s.character
    ? `<img class="char${s.character === 'fairy' ? ' float' : ''}" src="${charRel}/${
        s.character
      }.png" style="${s.charStyle}">`
    : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>${CSS(T)}</style>
</head>
<body class="${anim ? 'anim' : ''}">
  <div class="pad head">
    <span>— ${esc(meta.diary)}</span>
    <span class="rt">${String(s.n).padStart(2, '0')} — ${String(meta.total).padStart(2, '0')}</span>
  </div>

  <div class="ghost">${String(s.n).padStart(2, '0')}</div>
  ${ch}

  <div class="pad" style="top:${s.top ?? 150}px;z-index:2">
    ${s.label ? `<div class="label">${esc(s.label)}<b>◆</b></div>` : ''}
    <h1>${mark(s.h1)}</h1>
    <div class="rule" style="width:${s.ruleW ?? 540}px"></div>
    ${s.sub ? `<div class="sub">${mark(s.sub)}</div>` : ''}
    ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
  </div>

  ${visual(s.visual, T)}

  ${
    s.swipe
      ? `<div class="pad swipe">${esc(s.swipe)} <i class="serif" style="font-style:italic">swipe to read →</i></div>`
      : ''
  }

  <div class="pad foot">
    <span class="h">${esc(meta.handle)}${meta.name ? `<em>${esc(meta.name)}</em>` : ''}</span>
    <span class="s">${esc(meta.studio)}</span>
  </div>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv);
  const dataPath = args.data;
  if (!dataPath) {
    console.error('❌ --data <slides.v5.*.json> 필수');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const topic = args.topic || data.topic || 'default';
  const T = data.theme;
  const meta = data.meta;

  const anim = args.animate !== undefined;
  const outDir = join(REPO_ROOT, 'output', topic, anim ? 'slides-anim' : 'slides');
  mkdirSync(outDir, { recursive: true });

  const charDir = join(REPO_ROOT, 'assets', 'characters');
  const charRel = relative(outDir, charDir).replace(/\\/g, '/');

  const missing = new Set();
  for (const s of data.slides) {
    if (s.character && !existsSync(join(charDir, `${s.character}.png`))) missing.add(s.character);
  }
  if (missing.size) {
    console.error(`❌ 캐릭터 자산 없음: ${[...missing].join(', ')}`);
    console.error('   python scripts/nanobanana-characters.py 를 먼저 실행하세요.');
    process.exit(1);
  }

  for (const s of data.slides) {
    const f = join(outDir, `slide-${String(s.n).padStart(2, '0')}.html`);
    writeFileSync(f, slideHtml(s, meta, T, charRel, anim));
  }
  console.log(`✓ ${data.slides.length}장 ${anim ? '애니메이션 ' : ''}HTML 생성 → ${outDir}`);
  console.log(
    anim
      ? `\n다음: node scripts/animate-slides.mjs --topic ${topic}\n`
      : `\n다음: node scripts/html-carousel-gen.js --topic ${topic}\n`
  );
}

main();
