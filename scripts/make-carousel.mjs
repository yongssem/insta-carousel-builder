#!/usr/bin/env node
/**
 * insta-carousel-builder — 움직이는 캐러셀 원스톱 파이프라인 (기본 산출 경로)
 *
 * 슬라이드 데이터 JSON 하나로 **업로드 폴더까지** 만들어 줍니다.
 *
 *   node scripts/make-carousel.mjs --data templates/slides.v5.<topic>.json --topic <topic>
 *
 * 하는 일 (순서대로, 전부 동기):
 *   1) 정적 HTML  → PNG 9장            (영상이 안 도는 환경 대비 백업)
 *   2) 애니 HTML  → MP4 9장            (H.264 / yuv420p / faststart)
 *   3) 엔드카드   → slide-10.png       (assets/book-promo-endcard.png 있을 때만)
 *   4) 업로드 폴더 조립 output/<topic>/upload/
 *        01-cover.png   ← 커버는 정적. 피드 썸네일이 되는 장이라 영상으로 두지 않음
 *        02.mp4 ~ 09.mp4
 *        10-endcard.png ← 있을 때만
 *   5) 검증: MP4 가 HTML 보다 최신인지 + 첫 프레임이 비어 있지 않은지
 *
 * 왜 한 명령인가:
 *   단계를 따로 돌리면 "재인코딩이 끝나기 전에 이전 파일을 묶는" 사고가 납니다.
 *   실제로 그 사고가 한 번 났고, 그래서 이 스크립트는 전부 동기로 실행한 뒤
 *   산출물의 최신성까지 확인하고 끝냅니다.
 *
 * 옵션:
 *   --motion <spec>  어느 장을 움직일지 선택 (기본: alt)
 *       alt            짝수 장만 (2,4,6,8) — 정적/모션 교차로 리듬  ← 기본값
 *       all            본문 2~9 전부 모션
 *       data           시각 요소(막대/스탯/도트/플로우)가 있는 장만
 *       last           마지막 장(Outro)만
 *       2,5,8          번호 직접 지정
 *       none           전부 정적 (= --skip-video)
 *       first,last     첫 장과 마지막 장 (커버 모션은 썸네일 손해 — 권장 안 함)
 *   --skip-video     PNG 9장만 (빠른 시안 확인용, --motion none 과 동일)
 *   --duration 3.5   영상 길이(초). 인스타 피드 최소 3초이므로 그 밑으로 내리지 말 것
 *   --gif 1          블로그/스레드용 GIF 동시 출력 (인스타 피드는 GIF 미지원)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
      a[k] = v;
    }
  }
  return a;
}

function run(label, cmd, cmdArgs) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: REPO_ROOT });
  if (r.status !== 0) {
    console.error(`\n❌ 실패: ${label}`);
    process.exit(r.status ?? 1);
  }
}

const args = parseArgs(process.argv);
if (!args.data) {
  console.error('❌ --data <templates/slides.v5.*.json> 필수');
  process.exit(1);
}
const topic = args.topic;
if (!topic) {
  console.error('❌ --topic <폴더명> 필수');
  process.exit(1);
}
const dataPath = args.data;
if (!existsSync(join(REPO_ROOT, dataPath)) && !existsSync(dataPath)) {
  console.error(`❌ 데이터 파일 없음: ${dataPath}`);
  process.exit(1);
}

const outRoot = join(REPO_ROOT, 'output', topic);
const NODE = process.execPath;

// 슬라이드 데이터에서 번호/시각요소 정보를 읽어 모션 대상 결정
const dataAbs = existsSync(dataPath) ? dataPath : join(REPO_ROOT, dataPath);
const slideData = JSON.parse(readFileSync(dataAbs, 'utf-8'));
const allNums = slideData.slides.map((s) => s.n);
const lastNum = Math.max(...allNums);
const withVisual = slideData.slides.filter((s) => s.visual).map((s) => s.n);

function resolveMotion(spec) {
  const t = String(spec || 'alt').trim().toLowerCase();
  if (t === 'none') return [];
  if (t === 'all') return allNums.filter((n) => n !== 1); // 커버는 정적 유지
  if (t === 'data') return withVisual;
  if (t === 'alt') return allNums.filter((n) => n % 2 === 0);
  const parts = t.split(',').map((x) => x.trim()).filter(Boolean);
  const out = new Set();
  for (const part of parts) {
    if (part === 'first') out.add(1);
    else if (part === 'last') out.add(lastNum);
    else if (/^\d+$/.test(part)) out.add(Number(part));
    else {
      console.error(`❌ --motion 값을 이해할 수 없습니다: "${part}"`);
      console.error('   사용 가능: all | none | data | alt | first | last | 2,5,8');
      process.exit(1);
    }
  }
  const bad = [...out].filter((n) => !allNums.includes(n));
  if (bad.length) {
    console.error(`❌ 존재하지 않는 슬라이드 번호: ${bad.join(', ')}`);
    process.exit(1);
  }
  return [...out].sort((a, b) => a - b);
}

const motion = args['skip-video'] ? [] : resolveMotion(args.motion);
const wantVideo = motion.length > 0;

console.log(`\n캐러셀 생성: ${topic}`);
console.log(`데이터: ${dataPath}`);
console.log(
  wantVideo
    ? `모드: 움직이는 캐러셀 — 모션 슬라이드 ${motion.join(', ')} (나머지는 정적 PNG)`
    : '모드: 정적 시안만 (PNG)'
);
if (motion.includes(1)) {
  console.log(
    '⚠️ 1장(커버)을 모션으로 지정했습니다. 커버는 피드 썸네일이 되는데\n' +
      '   영상의 첫 프레임이 썸네일로 쓰여 거의 빈 화면이 노출될 수 있습니다.'
  );
}

// 1) 정적 PNG
run('정적 슬라이드 HTML 생성', NODE, ['scripts/build-v5-slides.mjs', '--data', dataPath, '--topic', topic]);
run('PNG 캡처', NODE, ['scripts/html-carousel-gen.js', '--topic', topic]);

// 2) 모션 MP4
if (wantVideo) {
  run('애니메이션 HTML 생성', NODE, [
    'scripts/build-v5-slides.mjs', '--data', dataPath, '--topic', topic, '--animate', '1',
  ]);
  const animArgs = ['scripts/animate-slides.mjs', '--topic', topic, '--only', motion.join(',')];
  if (args.duration) animArgs.push('--duration', args.duration);
  if (args.gif) animArgs.push('--gif', '1');
  run('MP4 인코딩', NODE, animArgs);
}

// 3) 엔드카드 (원본이 있을 때만)
const promo = join(REPO_ROOT, 'assets', 'book-promo-endcard.png');
let hasEndcard = false;
if (existsSync(promo)) {
  run('엔드카드 4:5 변환', NODE, ['scripts/make-endcard.js', '--topic', topic]);
  hasEndcard = existsSync(join(outRoot, 'slide-10.png'));
} else {
  console.log('\n▶ 엔드카드 건너뜀 — assets/book-promo-endcard.png 없음 (assets/README.md 참고)');
}

// 4) 업로드 폴더 조립
const uploadDir = join(outRoot, 'upload');
if (existsSync(uploadDir)) rmSync(uploadDir, { recursive: true, force: true });
mkdirSync(uploadDir, { recursive: true });

// 커버는 정적 PNG — 피드 썸네일이 되는 장
for (const n of allNums) {
  const nn = String(n).padStart(2, '0');
  const base = n === 1 ? '01-cover' : nn;
  if (motion.includes(n)) {
    copyFileSync(join(outRoot, 'video', `slide-${nn}.mp4`), join(uploadDir, `${base}.mp4`));
  } else {
    copyFileSync(join(outRoot, `slide-${nn}.png`), join(uploadDir, `${base}.png`));
  }
}
if (hasEndcard) copyFileSync(join(outRoot, 'slide-10.png'), join(uploadDir, '10-endcard.png'));

// 5) 검증 — 오래된 산출물이 섞이지 않았는지
const problems = [];
if (wantVideo) {
  const animDir = join(outRoot, 'slides-anim');
  for (const n of motion) {
    const nn = String(n).padStart(2, '0');
    const html = join(animDir, `slide-${nn}.html`);
    const mp4 = join(outRoot, 'video', `slide-${nn}.mp4`);
    if (!existsSync(mp4)) {
      problems.push(`slide-${nn}.mp4 없음`);
      continue;
    }
    if (statSync(mp4).mtimeMs < statSync(html).mtimeMs) {
      problems.push(`slide-${nn}.mp4 가 HTML 보다 오래됨 (재인코딩 필요)`);
    }
    if (statSync(mp4).size < 20 * 1024) problems.push(`slide-${nn}.mp4 용량 비정상`);
  }
}

console.log('\n────────────────────────────');
if (problems.length) {
  console.error('❌ 검증 실패:');
  problems.forEach((p) => console.error(`   - ${p}`));
  process.exit(1);
}

const files = readdirSync(uploadDir).sort();
console.log(`✅ 업로드 폴더 준비 완료 — ${uploadDir}`);
files.forEach((f) => console.log(`   ${f}`));
console.log('\n올리는 순서대로 파일명이 정렬돼 있습니다.');
if (!motion.includes(1)) {
  console.log('커버(01)는 정적 PNG — 피드 썸네일이 되는 장이라 영상으로 두지 않았습니다.');
}
console.log(`모션 ${motion.length}장 / 정적 ${allNums.length - motion.length}장`);
if (!hasEndcard) console.log('⚠️ 책 홍보 엔드카드가 빠져 있습니다 (assets/book-promo-endcard.png).');
console.log('⚠️ 캡션의 프로필 링크를 이번 게시물에 맞게 교체했는지 확인하세요.\n');
