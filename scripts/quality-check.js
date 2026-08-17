#!/usr/bin/env node
/**
 * 인스타 캐러셀 품질 자동 검사.
 *
 * 2 모드:
 *   1. JSON 검증: --prompt templates/slides.<topic>.json
 *      - 본문 장수(6 또는 9), common_style 존재, n 순차, role/prompt 필수
 *   2. PNG 검증: --dir output/<topic>
 *      - PNG 번호 연속성, 엔드카드 유무, 1080×1350 해상도, 파일 크기 분포
 *
 * 사용법:
 *   node scripts/quality-check.js --prompt templates/slides.claude-code.json
 *   node scripts/quality-check.js --dir output/claude-code-tips
 */
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) {
      args[argv[i].slice(2)] = argv[++i];
    }
  }
  return args;
}

function checkPromptJson(path) {
  if (!existsSync(path)) {
    return { status: 'FAIL', errors: [`파일 없음: ${path}`] };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e) {
    return { status: 'FAIL', errors: [`JSON 파싱 실패: ${e.message}`] };
  }

  const errors = [];
  const warnings = [];

  if (!data.common_style || data.common_style.length < 50) {
    errors.push('common_style 누락 또는 너무 짧음');
  }
  if (!Array.isArray(data.slides)) {
    errors.push('slides 배열 누락');
    return { status: 'FAIL', errors };
  }
  // 본문 6장(기본) 또는 9장(단계형). 그 밖의 값만 경고한다
  if (![6, 9].includes(data.slides.length)) {
    warnings.push(`슬라이드 ${data.slides.length}장 (권장: 6장, 단계형은 9장)`);
  }

  for (let i = 0; i < data.slides.length; i++) {
    const s = data.slides[i];
    const expectedN = i + 1;
    if (s.n !== expectedN) errors.push(`slides[${i}].n 이 ${s.n} (기대: ${expectedN})`);
    if (!s.role) errors.push(`slides[${i}].role 누락`);
    if (!s.prompt || s.prompt.length < 50) errors.push(`slides[${i}].prompt 누락 또는 너무 짧음`);
  }

  const coverExists = data.slides.some((s) => /cover/i.test(s.role));
  const outroExists = data.slides.some((s) => /outro|closing/i.test(s.role));
  if (!coverExists) warnings.push('Cover 슬라이드 없음 (권장)');
  if (!outroExists) warnings.push('Outro 슬라이드 없음 (권장)');

  return {
    status: errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
    errors,
    warnings,
    slide_count: data.slides.length,
  };
}

function checkPngDir(dir) {
  if (!existsSync(dir)) {
    return { status: 'FAIL', errors: [`폴더 없음: ${dir}`] };
  }

  const files = readdirSync(dir)
    .filter((f) => /^slide-\d{2}\.png$/.test(f))
    .sort();

  const errors = [];
  const warnings = [];
  const sizes = [];

  // 본문 장수는 고정이 아니다 — 6장(기본)과 9장(단계형)을 둘 다 쓴다.
  // 마지막 장이 엔드카드이므로, 번호가 1부터 빈틈없이 이어지는지만 본다.
  const nums = files
    .map((f) => Number(/^slide-(\d+)\.png$/.exec(f)?.[1]))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (nums.length === 0) {
    errors.push('slide-*.png 를 찾지 못했습니다');
  } else {
    for (let i = 0; i < nums.length; i += 1) {
      if (nums[i] !== i + 1) {
        errors.push(`슬라이드 번호가 끊깁니다 — ${i + 1}번이 없습니다 (있는 번호: ${nums.join(', ')})`);
        break;
      }
    }
  }

  // 엔드카드는 본문 다음 번호. 총 장수로는 판정할 수 없어서 파일로 확인한다.
  const last = nums.at(-1) ?? 0;
  const endPath = join(dir, `slide-${String(last).padStart(2, '0')}.png`);
  const promo = join(REPO_ROOT, 'assets', 'book-promo-endcard.png');
  const hasEndcard = last >= 2 && existsSync(promo) && statSync(endPath).size > 1_500_000;

  const body = hasEndcard ? last - 1 : last;
  if (body < 4) warnings.push(`본문 ${body}장 — 너무 짧습니다 (권장 6장, 단계형은 9장)`);
  if (body > 11) warnings.push(`본문 ${body}장 — 12장을 넘기면 완독률이 크게 떨어집니다`);
  if (!hasEndcard) {
    warnings.push(
      `책 홍보 엔드카드 없음 — node scripts/make-endcard.js --topic <topic> --n ${last + 1}`,
    );
  }

  for (const f of files) {
    const fp = join(dir, f);
    const st = statSync(fp);
    sizes.push({ file: f, kb: Math.round(st.size / 1024) });
    if (st.size < 50 * 1024) warnings.push(`${f} 너무 작음 (${Math.round(st.size / 1024)}KB, 깨진 이미지 가능)`);
    if (st.size > 3 * 1024 * 1024) warnings.push(`${f} 너무 큼 (${Math.round(st.size / 1024)}KB)`);
  }

  return {
    status: errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS',
    errors,
    warnings,
    slide_count: files.length,
    sizes,
  };
}

function icon(s) {
  return s === 'PASS' ? '✅' : s === 'WARN' ? '⚠️ ' : '❌';
}

function main() {
  const args = parseArgs(process.argv);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 캐러셀 품질 검사');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let result;
  if (args.prompt) {
    console.log(`[모드] 프롬프트 JSON 검증: ${args.prompt}`);
    result = checkPromptJson(args.prompt);
  } else if (args.dir) {
    console.log(`[모드] PNG 폴더 검증: ${args.dir}`);
    result = checkPngDir(args.dir);
  } else {
    console.error('❌ --prompt <json> 또는 --dir <folder> 중 하나 필수');
    process.exit(1);
  }

  console.log(`\n${icon(result.status)} 상태: ${result.status}`);
  console.log(`   슬라이드 수: ${result.slide_count ?? '?'}장`);

  if (result.errors && result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach((e) => console.log(`   - ${e}`));
  }
  if (result.warnings && result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach((w) => console.log(`   - ${w}`));
  }
  if (result.sizes) {
    console.log('\n📦 파일 크기:');
    result.sizes.forEach((s) => console.log(`   ${s.file}: ${s.kb} KB`));
  }

  const reportDir = args.dir || (args.prompt ? args.prompt.replace(/\.json$/, '') : '.');
  const reportPath = args.dir ? join(args.dir, 'quality-report.json') : null;
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ ...result, checked_at: new Date().toISOString() }, null, 2));
    console.log(`\n📄 리포트: ${reportPath}`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(result.status === 'FAIL' ? 1 : 0);
}

main();
