#!/usr/bin/env node
/**
 * insta-carousel-builder — 엔드카드(고정 홍보 페이지) 생성기
 *
 * assets/book-promo-endcard.png 를 캐러셀과 같은 4:5(1080×1350) 캔버스에
 * 잘림 없이 얹어 마지막 슬라이드로 만듭니다.
 *
 * 왜 필요한가:
 *   인스타 캐러셀은 한 게시물의 모든 장이 같은 비율이어야 합니다.
 *   본문 9장이 4:5인데 홍보 이미지만 1:1이면 인스타가 강제로 잘라냅니다.
 *   이 스크립트는 원본 비율을 유지한 채 중앙 배치하고 남는 위아래를
 *   브랜드 배경색(#0B0B0E)으로 채웁니다.
 *
 * 사용법:
 *   node scripts/make-endcard.js --topic 2026-08-04_바이브코딩소식
 *   node scripts/make-endcard.js --topic my-topic --n 10   # 슬라이드 번호 지정
 *
 * 결과:
 *   output/{topic}/slide-10.png (1080×1350)
 */
import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const CONFIG = { width: 1080, height: 1350, deviceScaleFactor: 2 };
const PROMO_PATH = join(REPO_ROOT, 'assets', 'book-promo-endcard.png');
const TEMPLATE = join(REPO_ROOT, 'templates', 'endcard.html');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const topic = args.topic || 'default';
  const n = Number(args.n || 10);

  if (!existsSync(PROMO_PATH)) {
    console.error('\n❌ 엔드카드 원본이 없습니다.');
    console.error(`   ${PROMO_PATH}`);
    console.error('\n   홍보 이미지를 위 경로에 저장한 뒤 다시 실행하세요.');
    console.error('   (자세한 내용: assets/README.md)\n');
    process.exit(1);
  }
  if (!existsSync(TEMPLATE)) {
    console.error(`❌ 템플릿 없음: ${TEMPLATE}`);
    process.exit(1);
  }

  const outputDir = join(REPO_ROOT, 'output', topic);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const outName = `slide-${String(n).padStart(2, '0')}.png`;
  const outPath = join(outputDir, outName);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(CONFIG);

    const fileUrl = 'file:///' + TEMPLATE.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    // 이미지가 실제로 로드됐는지 확인 (onerror 폴백이 떴으면 실패로 간주)
    const loaded = await page.evaluate(() => {
      const img = document.querySelector('img.promo');
      return !!img && img.complete && img.naturalWidth > 0;
    });
    if (!loaded) {
      console.error('\n❌ 엔드카드 이미지를 브라우저가 읽지 못했습니다.');
      console.error('   PNG 파일이 손상되지 않았는지 확인하세요.\n');
      process.exit(1);
    }

    const dims = await page.evaluate(() => {
      const img = document.querySelector('img.promo');
      return { w: img.naturalWidth, h: img.naturalHeight };
    });

    await page.screenshot({
      path: outPath,
      type: 'png',
      clip: { x: 0, y: 0, width: CONFIG.width, height: CONFIG.height },
    });

    const ratio = (dims.w / dims.h).toFixed(3);
    const target = (CONFIG.width / CONFIG.height).toFixed(3);
    console.log(`\n✓ ${outName} (1080×1350)`);
    console.log(`  원본 ${dims.w}×${dims.h} (비율 ${ratio})`);
    if (ratio !== target) {
      console.log(`  → 4:5(${target})가 아니라 위아래에 배경 여백을 넣어 맞췄습니다.`);
    }
    console.log(`\n완료! ${outPath}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
