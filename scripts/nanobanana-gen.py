"""
insta-carousel-builder — 나노바나나 2 Lite(Gemini 3.1 Flash-Lite Image) 인스타 캐러셀 생성기

사용법:
    # 1. .env 에 GEMINI_API_KEY=... 추가 (.env.example 참고)
    # 2. slides.json 에 9장 프롬프트 수정 (또는 기본 예제 그대로 사용)
    # 3. 실행:
    python scripts/nanobanana-gen.py --topic my-topic

    # 특정 슬라이드만 재생성 (오타 발생 시):
    python scripts/nanobanana-gen.py --topic my-topic --only 3

결과:
    output/{topic}/slide-01.png ~ slide-09.png

참고:
    - 기본 모델: gemini-3.1-flash-lite-image (나노바나나 2 Lite)
      Google 이미지 모델 중 가장 빠르고 저렴한 티어. 1장당 약 4초.
    - 인스타 캐러셀용으로 aspect_ratio 를 4:5 로 고정 요청 (1080×1350 비율)
    - ⚠️ Lite 는 1K 해상도만 지원 → 4:5 기준 약 896×1152 로 나옵니다.
      인스타 권장 1080×1350 보다 작으므로 업로드 시 약간 업스케일됩니다.
      원본 해상도가 중요하면 --model gemini-3.1-flash-image-preview --image-size 2K 사용.
    - 다른 모델을 쓰려면 --model 로 교체:
        gemini-3.1-flash-image-preview   (나노바나나 2 — 고품질/그라운딩, 2K 가능)
        gemini-3-pro-image-preview       (나노바나나 Pro — 구 기본값)
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    from google import genai
    from google.genai import types
except ImportError as e:
    print(f"[ERROR] 의존성 누락: {e}")
    print("        pip install python-dotenv google-genai")
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SLIDES_JSON = REPO_ROOT / "templates" / "slides.example.json"
DEFAULT_MODEL = "gemini-3.1-flash-lite-image"  # 나노바나나 2 Lite


def load_slides(slides_path: Path) -> list[dict]:
    if not slides_path.exists():
        print(f"[ERROR] slides 파일 없음: {slides_path}")
        print(f"        templates/slides.example.json 을 복사해서 수정하세요.")
        sys.exit(1)
    with slides_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    slides = data.get("slides", [])
    if len(slides) != 9:
        print(f"[WARN] 슬라이드 개수 {len(slides)} (권장: 9장 — 인스타 캐러셀 최대)")
    return slides


def render_prompt(slide: dict, common_style: str) -> str:
    return f"{common_style}\n\n{slide['prompt']}"


def build_config(aspect_ratio: str, image_size: str):
    """이미지 전용 응답 + 4:5 비율 요청. SDK가 지원하지 않으면 None 으로 폴백."""
    try:
        return types.GenerateContentConfig(
            response_modalities=["Image"],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
            ),
        )
    except (AttributeError, TypeError, ValueError) as e:
        print(f"[WARN] image_config 미지원 SDK — 비율 지정 없이 진행합니다 ({e})")
        return None


def main():
    ap = argparse.ArgumentParser(description="나노바나나 2 Lite 인스타 캐러셀 생성기")
    ap.add_argument("--topic", default="default", help="출력 폴더명. output/{topic}/ 에 저장")
    ap.add_argument("--slides", default=str(DEFAULT_SLIDES_JSON), help="slides.json 경로")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini 이미지 모델 ID (기본: {DEFAULT_MODEL})")
    ap.add_argument("--aspect-ratio", default="4:5", help="이미지 비율 (인스타 캐러셀 기본: 4:5)")
    ap.add_argument("--image-size", default="1K", help="해상도 티어. Lite 는 1K 만 지원 (Pro 는 2K/4K 가능)")
    ap.add_argument("--only", type=int, default=None, help="해당 번호 슬라이드만 생성 (예: --only 3)")
    ap.add_argument("--dry-run", action="store_true", help="API 호출 없이 프롬프트만 출력")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    load_dotenv(REPO_ROOT / ".env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        print("[ERROR] GEMINI_API_KEY not found in .env or environment.")
        print("        .env.example 을 복사해서 .env 를 만들고 키를 추가하세요.")
        print("        키 발급: https://aistudio.google.com/apikey")
        sys.exit(1)

    slides_path = Path(args.slides)
    if not slides_path.exists():
        print(f"[ERROR] slides 파일 없음: {slides_path}")
        sys.exit(1)
    data = json.loads(slides_path.read_text(encoding="utf-8"))
    common_style = data.get("common_style", "")
    slides = data.get("slides", [])

    if args.only is not None:
        slides = [s for s in slides if s.get("n") == args.only]
        if not slides:
            print(f"[ERROR] slide-{args.only:02d} 이(가) {slides_path} 에 없습니다.")
            sys.exit(1)

    out_dir = REPO_ROOT / "output" / args.topic
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        print(f"[DRY RUN] model={args.model}  aspect={args.aspect_ratio}  size={args.image_size}")
        print(f"[DRY RUN] {len(slides)} slides, output: {out_dir}")
        for slide in slides:
            print(f"\n--- slide-{slide['n']:02d} ({slide.get('role','?')}) ---")
            print(render_prompt(slide, common_style)[:500])
        return

    client = genai.Client(api_key=api_key)
    config = build_config(args.aspect_ratio, args.image_size)
    summary = []

    print(f"\n모델: {args.model}  |  비율: {args.aspect_ratio}  |  해상도: {args.image_size}\n")

    for slide in slides:
        n = slide["n"]
        out_path = out_dir / f"slide-{n:02d}.png"
        prompt = render_prompt(slide, common_style)

        print(f"[{n}/9] generating {slide.get('role','?')}...", end=" ", flush=True)
        t0 = time.time()
        try:
            kwargs = {"model": args.model, "contents": [prompt]}
            if config is not None:
                kwargs["config"] = config
            resp = client.models.generate_content(**kwargs)
            image_saved = False
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    blob = part.inline_data.data
                    if isinstance(blob, str):
                        blob = base64.b64decode(blob)
                    with open(out_path, "wb") as f:
                        f.write(blob)
                    image_saved = True
                    break
            dt = time.time() - t0
            if image_saved:
                kb = out_path.stat().st_size / 1024
                print(f"OK ({dt:.1f}s, {kb:.0f}KB) -> {out_path.name}")
                summary.append((n, "OK", f"{dt:.1f}s", f"{kb:.0f}KB"))
            else:
                print(f"FAIL ({dt:.1f}s, no image in response)")
                summary.append((n, "FAIL_NO_IMG", f"{dt:.1f}s", "-"))
        except Exception as e:
            dt = time.time() - t0
            print(f"ERR ({dt:.1f}s): {e}")
            summary.append((n, "ERR", f"{dt:.1f}s", str(e)[:60]))

    print("\n=== SUMMARY ===")
    for n, status, dt, info in summary:
        print(f"  slide-{n:02d}  {status:12}  {dt:>7}  {info}")
    print(f"\nOutput: {out_dir}")


if __name__ == "__main__":
    main()
