"""
insta-carousel-builder — 브랜드 3D 치비 캐릭터 생성기 (나노바나나 2 Lite)

캐러셀 슬라이드마다 1명씩 배치할 캐릭터를 **한 번만** 생성해 자산으로 굳힙니다.

왜 슬라이드 안에서 같이 안 만드나:
    9장을 각각 통째로 이미지 생성하면 캐릭터 얼굴/옷/비율이 장마다 달라집니다.
    캐릭터를 먼저 고정 자산으로 뽑고 HTML 합성 단계에서 얹으면 9장 내내 동일합니다.

배경은 디자인 시스템의 크림색(#F3EEE2)으로 생성됩니다.
슬라이드 배경과 같은 색이라 누끼(컷아웃) 없이 그대로 얹어도 이음매가 안 보입니다.

사용법:
    python scripts/nanobanana-characters.py                 # 전체 생성
    python scripts/nanobanana-characters.py --only teacher  # 1명만 재생성

결과:
    assets/characters/{id}.png
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
DEFAULT_JSON = REPO_ROOT / "templates" / "characters.json"
OUT_DIR = REPO_ROOT / "assets" / "characters"
DEFAULT_MODEL = "gemini-3.1-flash-lite-image"


def main():
    ap = argparse.ArgumentParser(description="브랜드 3D 치비 캐릭터 생성기")
    ap.add_argument("--characters", default=str(DEFAULT_JSON), help="characters.json 경로")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"모델 ID (기본: {DEFAULT_MODEL})")
    ap.add_argument("--only", default=None, help="해당 id 캐릭터만 생성 (예: --only teacher)")
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
        sys.exit(1)

    data = json.loads(Path(args.characters).read_text(encoding="utf-8"))
    common = data.get("common_style", "")
    chars = data.get("characters", [])

    if args.only:
        chars = [c for c in chars if c.get("id") == args.only]
        if not chars:
            print(f"[ERROR] '{args.only}' 캐릭터가 {args.characters} 에 없습니다.")
            sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        for c in chars:
            print(f"\n--- {c['id']} ({c.get('role','?')}) ---")
            print(f"{common}\n\n{c['prompt']}"[:600])
        return

    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        response_modalities=["Image"],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K"),
    )

    print(f"\n모델: {args.model}  |  {len(chars)}명 생성\n")
    summary = []

    for c in chars:
        cid = c["id"]
        out_path = OUT_DIR / f"{cid}.png"
        prompt = f"{common}\n\n{c['prompt']}"

        print(f"[{cid}] {c.get('role','')}...", end=" ", flush=True)
        t0 = time.time()
        try:
            resp = client.models.generate_content(
                model=args.model, contents=[prompt], config=config
            )
            saved = False
            for part in resp.candidates[0].content.parts:
                if getattr(part, "inline_data", None) and part.inline_data.data:
                    blob = part.inline_data.data
                    if isinstance(blob, str):
                        blob = base64.b64decode(blob)
                    out_path.write_bytes(blob)
                    saved = True
                    break
            dt = time.time() - t0
            if saved:
                kb = out_path.stat().st_size / 1024
                print(f"OK ({dt:.1f}s, {kb:.0f}KB) -> {out_path.name}")
                summary.append((cid, "OK"))
            else:
                print(f"FAIL ({dt:.1f}s, no image)")
                summary.append((cid, "FAIL"))
        except Exception as e:
            dt = time.time() - t0
            print(f"ERR ({dt:.1f}s): {e}")
            summary.append((cid, "ERR"))

    print("\n=== SUMMARY ===")
    for cid, st in summary:
        print(f"  {cid:10} {st}")
    print(f"\nOutput: {OUT_DIR}")


if __name__ == "__main__":
    main()
