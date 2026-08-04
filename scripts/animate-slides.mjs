#!/usr/bin/env node
/**
 * insta-carousel-builder — 움직이는 캐러셀(모션 슬라이드) 인코더
 *
 * output/<topic>/slides-anim/*.html 를 프레임 단위로 캡처해
 * 인스타 캐러셀에 그대로 올릴 수 있는 MP4(H.264) 로 만듭니다.
 *
 * 왜 되는가:
 *   인스타 캐러셀은 사진과 **동영상을 섞어** 올릴 수 있습니다(최대 20장).
 *   즉 "움직이는 캐러셀"은 특별한 기능이 아니라, 각 장을 짧은 루프 영상으로
 *   만들어 올린 것입니다. 단, 모든 장의 **비율이 같아야** 합니다(4:5 = 1080×1350).
 *
 * 어떻게 결정적으로 캡처하나:
 *   CSS 애니메이션을 그냥 두고 스크린샷을 찍으면 프레임 간격이 들쭉날쭉합니다.
 *   Web Animations API 로 모든 애니메이션을 pause 한 뒤 currentTime 을
 *   직접 지정해 캡처하므로, 몇 번을 돌려도 똑같은 결과가 나옵니다.
 *
 * 사용법:
 *   node scripts/build-v5-slides.mjs --data <json> --topic <t> --animate 1
 *   node scripts/animate-slides.mjs --topic <t>
 *   node scripts/animate-slides.mjs --topic <t> --only 5 --duration 4
 *   node scripts/animate-slides.mjs --topic <t> --only 2,5,8   # 지정 슬라이드만
 *   node scripts/animate-slides.mjs --topic <t> --gif 1     # 블로그용 GIF 동시 출력
 *
 * 결과:
 *   output/<topic>/video/slide-01.mp4 ~ slide-09.mp4
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const W = 1080;
const H = 1350;

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) a[argv[i].slice(2)] = argv[++i];
  }
  return a;
}

/** H.264 인코딩이 가능한 ffmpeg 를 찾는다.
 *  주의: Playwright 번들 ffmpeg 는 VP8/WebM 전용이라 인스타에 못 올립니다. */
async function findFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean);
  for (const c of candidates) {
    const ok = await new Promise((res) => {
      const p = spawn(c, ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('error', () => res(false));
      p.on('close', () => res(out.includes('libx264')));
    });
    if (ok) return c;
  }
  // pip 로 설치되는 imageio-ffmpeg 는 libx264 포함 정적 빌드를 제공한다
  const viaPython = await new Promise((res) => {
    const p = spawn('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => res(null));
    p.on('close', () => res(out.trim() || null));
  });
  if (viaPython && existsSync(viaPython)) return viaPython;
  return null;
}

/** GIF 인코딩 (팔레트 생성 → 적용, 2-pass).
 *  ⚠️ 인스타 피드/캐러셀에는 쓰지 마세요 — GIF 를 올리면 애니메이션이 죽고
 *     첫 프레임만 정지 이미지로 올라갑니다. 블로그·스레드·카톡용입니다. */
function encodeGif(ffmpeg, frames, fps, outPath) {
  return new Promise((resolve2, reject) => {
    const p = spawn(ffmpeg, [
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(fps),
      '-i', '-',
      '-filter_complex',
      // 용량을 위해 폭 540 으로 줄이고 팔레트를 만들어 적용
      `[0:v] fps=${fps},scale=540:-1:flags=lanczos,split [a][b];` +
        `[a] palettegen=stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=3`,
      '-loop', '0',
      outPath,
    ]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve2() : reject(new Error(`ffmpeg(gif) exited ${code}\n${err.slice(-1500)}`))
    );
    (async () => {
      for (const f of frames) {
        if (!p.stdin.write(f)) await new Promise((r) => p.stdin.once('drain', r));
      }
      p.stdin.end();
    })();
  });
}

function encode(ffmpeg, frames, fps, outPath) {
  return new Promise((resolve2, reject) => {
    const p = spawn(ffmpeg, [
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(fps),
      '-i', '-',
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-preset', 'slow',
      '-crf', '18',
      // 인스타/모바일 호환: 짝수 해상도 + yuv420p 필수
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-r', String(fps),
      outPath,
    ]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve2() : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-1500)}`))
    );
    (async () => {
      for (const f of frames) {
        if (!p.stdin.write(f)) await new Promise((r) => p.stdin.once('drain', r));
      }
      p.stdin.end();
    })();
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const topic = args.topic || 'default';
  const fps = Number(args.fps || 30);
  const duration = Number(args.duration || 3.5);
  const total = Math.round(fps * duration);
  const wantGif = args.gif !== undefined;

  const slidesDir = join(REPO_ROOT, 'output', topic, 'slides-anim');
  const outDir = join(REPO_ROOT, 'output', topic, 'video');

  if (!existsSync(slidesDir)) {
    console.error(`❌ 애니메이션 HTML 폴더 없음: ${slidesDir}`);
    console.error('   먼저 실행: node scripts/build-v5-slides.mjs --data <json> --topic <t> --animate 1');
    process.exit(1);
  }

  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    console.error('❌ H.264(libx264) 인코딩이 가능한 ffmpeg 를 찾지 못했습니다.');
    console.error('   설치: pip install imageio-ffmpeg   (또는 시스템 ffmpeg)');
    console.error('   ⚠️ Playwright 번들 ffmpeg 는 VP8/WebM 전용이라 인스타에 못 올립니다.');
    process.exit(1);
  }

  let files = readdirSync(slidesDir).filter((f) => f.endsWith('.html')).sort();
  if (args.only) {
    // 쉼표로 여러 장 지정 가능: --only 2,5,8
    const wanted = String(args.only)
      .split(',')
      .map((x) => `slide-${String(x.trim()).padStart(2, '0')}.html`);
    files = files.filter((f) => wanted.includes(f));
    if (!files.length) {
      console.error(`❌ 해당 슬라이드 없음: ${args.only}`);
      process.exit(1);
    }
  }

  mkdirSync(outDir, { recursive: true });
  console.log(`\nffmpeg: ${ffmpeg}`);
  console.log(`${files.length}장 · ${duration}초 · ${fps}fps · ${total}프레임/장 · ${W}×${H}`);
  console.log(wantGif ? 'MP4 + GIF (GIF 는 인스타 피드 업로드 불가 — 블로그/스레드용)\n' : 'MP4 (인스타 업로드용)\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  // 영상은 1080×1350 실측이어야 하므로 배율 1
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  try {
    for (const file of files) {
      const url = 'file:///' + resolve(slidesDir, file).replace(/\\/g, '/');
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () =>
          new Promise((r) => {
            const imgs = [...document.images].filter((i) => !i.complete);
            if (!imgs.length) return r();
            let n = imgs.length;
            imgs.forEach((i) => i.addEventListener('load', () => --n || r(), { once: true }));
          })
      );

      const frames = [];
      for (let i = 0; i < total; i++) {
        const tMs = (i / fps) * 1000;
        await page.evaluate((t) => {
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = t;
          }
        }, tMs);
        frames.push(await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } }));
      }

      // 정지 검사: 캐러셀 영상은 루프 없이 마지막 프레임에서 멈추므로
      // 끝까지 움직이면 어정쩡한 자세로 얼어붙는다. 마지막 0.4초는 정지여야 한다.
      const holdFrames = Math.max(2, Math.round(fps * 0.4));
      const last = frames[frames.length - 1];
      const stillFrom = frames.length - holdFrames;
      let moving = false;
      for (let i = stillFrom; i < frames.length - 1; i++) {
        if (Buffer.compare(frames[i], last) !== 0) {
          moving = true;
          break;
        }
      }
      if (moving) {
        console.warn(
          `  ⚠ ${file}: 마지막 0.4초가 정지하지 않습니다. ` +
            `infinite 애니메이션이 있는지 확인하세요 (영상은 루프하지 않고 마지막 프레임에서 멈춥니다).`
        );
      }

      const out = join(outDir, file.replace('.html', '.mp4'));
      await encode(ffmpeg, frames, fps, out);
      let line = `  ✓ ${file.replace('.html', '.mp4')}`;
      if (wantGif) {
        const g = join(outDir, file.replace('.html', '.gif'));
        await encodeGif(ffmpeg, frames, fps, g);
        line += ` + ${file.replace('.html', '.gif')}`;
      }
      console.log(line);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n완료! ${outDir}`);
  console.log('업로드 시 주의: 캐러셀 첫 장의 비율이 전체에 적용됩니다. 9장 모두 4:5 로 통일되어 있습니다.\n');
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
