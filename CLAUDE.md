# insta-carousel-builder — Claude Code 지시서

> 이 프로젝트는 Claude Code에서 직접 실행하는 인스타 캐러셀 자동 제작 도구입니다.
> 팀원이 "이 주제로 캐러셀 만들어줘"라고 요청하면 **리서치 → 9장 프롬프트 설계 → 나노바나나 2 Lite 생성 → 품질 검증**까지 수행합니다.

---

## 즉시 실행 원칙

사용자가 아래처럼 요청하면 `/carousel-new <주제>` 파이프라인을 실행합니다:

- "바이브코딩으로 캐러셀 만들어줘"
- "AI 글쓰기 7가지 꿀팁으로 인스타 카드뉴스 써줘"
- "챗GPT 프롬프트 주제로 캐러셀 9장 만들자"

수동 호출: `/carousel-research`, `/carousel-prompt`, `/carousel-gen`, `/carousel-quality`

---

## 🔀 듀얼 엔진 — 어느 쪽으로 갈 것인가

이 레포는 **두 가지 이미지 생성 엔진**을 지원합니다. 사용자 요청 의도에 따라 자동 판단:

| 엔진 | 트리거 키워드 | 스크립트 | 서브에이전트 |
|:---|:---|:---|:---|
| 🍌 **나노바나나** | "AI 이미지", "빠르게", "실험", "다양한 시안" | `nanobanana-gen.py` | `carousel-prompt-writer` (JSON) |
| 🎨 **HTML/Puppeteer** | "정확하게", "광고", "법무", "한 글자 수정", "0원" | `html-carousel-gen.js` | `carousel-html-writer` (HTML) |

**자동 판단 안 될 때 — CEO에게 1줄 질문**:
> "🍌 나노바나나(Gemini, 빠른 실험) vs 🎨 HTML(정확/0원) 중 어느 엔진?"

**CEO가 명시 안 하면 기본값**: HTML/Puppeteer (정확도 우선).

### 엔진별 Phase 3 분기

```
Phase 3a (나노바나나):
  python scripts/nanobanana-gen.py --topic <키워드> --slides templates/slides.<topic>.json

Phase 3b (HTML):
  # 1. carousel-html-writer 가 output/<topic>/slides/slide-01~09.html 작성
  # 2. node scripts/html-carousel-gen.js --topic <keyword>
```



---

## 기본 산출물 — 본문 9장 + 엔드카드 1장 = 10장

**모든 캐러셀 요청은 기본적으로 10장 세트를 생산합니다:**
- **slide-01~09 (본문)**: Cover 1장 + 본문 7장 (예: TIP 01~07) + Outro 1장
  - 각 슬라이드는 `templates/slides.*.json` 의 프롬프트로 정의
- **slide-10 (엔드카드)**: 책 홍보 고정 페이지 — **모든 캐러셀에 항상 붙임**
  - `assets/book-promo-endcard.png` 원본을 `node scripts/make-endcard.js --topic <topic>` 로 4:5 변환
  - 생성/AI 개입 없음. 고정 이미지를 캔버스에 맞추기만 함

**왜 10장인가** (2026 실측 기준): 7~10장이 완독률·체류시간 스위트스팟이고,
12장을 넘으면 완독률이 약 40% 떨어집니다. 본문 9 + 엔드카드 1 = 10장이 상한에 딱 맞습니다.
엔드카드를 Outro와 **교체하지 말 것** — 저장 CTA가 사라져 저장률이 떨어집니다.

10장이 아닌 개수 지정은 사용자가 명시한 경우만 수용.

### 캡션

`templates/caption.template.md` 를 `output/<topic>/caption.md` 로 복사해 채웁니다.
책 홍보 블록(구매 링크 포함)은 엔드카드와 세트로 **항상 포함**.
⚠️ 인스타 캡션 본문의 URL은 클릭되지 않습니다 → 프로필 링크 유도 + 책 제목 병기 구조 필수.

---

## 품질 킬라인 (9장 각각에 적용)

| # | 기준 | 허용 범위 |
|:---:|:---|:---|
| 1 | **해상도** | 1080×1350 (4:5 인스타 권장) |
| 2 | **한글 렌더링** | 오타 없어야 함 (`duplicate-check.js` 로 체크) |
| 3 | **디자인 DNA 일관성** | 9장 배경색/폰트/액센트 컬러 통일 |
| 4 | **Cover 후킹** | 3초 내 스크롤 멈춤 가능한 헤드라인 |
| 5 | **1장당 정보 밀도** | 한 슬라이드 = 한 포인트 (여러 개 = 혼란) |
| 6 | **CTA 슬라이드** | Outro 에 저장/공유/팔로우 중 **1개만** |
| 7 | **금칙어** | `knowledge/banned-words.json` 참조 |
| 8 | **톤** | 친근한 전문가. "안녕하세요 오늘은" 같은 filler 금지 |

→ `scripts/quality-check.js` 가 생성 직후 자동 검사. 한글 오타 감지 시 해당 슬라이드만 재생성.

---

## 작성 전 반드시 Read (생략 금지)

**매 작업마다**:
1. `knowledge/brand-facts.md` — 수치/브랜드 SSOT (이 파일 외 숫자 금지)
2. `knowledge/patterns/carousel-structure.md` — 9장 구조 공식
3. `templates/slides.example.json` — 프롬프트 템플릿
4. `output/_index.json` — 최근 패턴 → 의도적으로 다른 구조 선택

**상황별 추가 Read**:
- 주제 리서치: `knowledge/reference/` (있다면)
- 톤 잡기: `knowledge/tone/` (있다면)

---

## 3-Phase Pipeline (carousel-new 풀 파이프라인)

```
Phase 1 [리서치/기획]  → carousel-researcher 서브에이전트 dispatch
                          주제 요약, 9장 구조 초안, hook 후보 생성
Phase 2 [프롬프트 설계] → carousel-prompt-writer 서브에이전트 dispatch
                          9장 프롬프트 JSON 작성 (templates/slides.{topic}.json)
Phase 3 [이미지 생성]  → scripts/nanobanana-gen.py 실행
                          Gemini 3.0 Pro Image 로 9장 PNG 생성
Phase 4 [품질 검증]    → scripts/quality-check.js 자동 실행
                          → carousel-reviewer 서브에이전트 10항목 정성 채점
                          오타 감지 시 해당 슬라이드만 재생성
```

**서브에이전트 원칙**:
- 작성자(writer)와 검증자(reviewer) 분리 — 자기채점 편향 방지
- 메인 Claude는 오케스트레이터, 프롬프트는 writer 가 씀
- 파일 수정은 reviewer 가 아닌 메인/writer 가 함

---

## 출력 구조

```
output/{topic}/
├── slide-01.png ~ slide-09.png   # 1080×1350 PNG 9장
├── prompts.json                  # 사용된 프롬프트 (재현용)
├── metadata.json                 # 생성 시간/비용/품질 리포트
└── README.md                     # 주제 요약 + 사용 가이드
```

**명명 규칙**: `{YYYY-MM-DD}_{주제압축}` (공백 제거, 특수문자 금지)

---

## Zero-Inference 원칙

- 수치는 반드시 `brand-facts.md` 에서만 인용
- 이미지 생성 결과의 한글 오타 판정은 **스크립트가 수행** (LLM 판단 금지)
- 스크립트 경고 발생 시 무시하지 말고 재생성

---

## 환경 설정

`.env` 파일 (git 추적 금지):
```
GEMINI_API_KEY=AIza...         # 나노바나나 엔진(기본: 2 Lite) 사용 시만 필수 (https://aistudio.google.com/apikey)
ANTHROPIC_API_KEY=              # (옵션) reviewer 서브에이전트 API 호출용
```

### 의존성

```bash
# 나노바나나 엔진
pip install python-dotenv google-genai

# HTML/Puppeteer 엔진
npm install   # puppeteer 자동 설치
```

- Python ≥ 3.10 (나노바나나)
- Node.js ≥ 20 (HTML/Puppeteer + 품질 체크 훅)
- (선택) Pretendard 폰트 시스템 설치 — HTML 트랙 한글 렌더링 품질 향상

---

## 주의사항

- 생성된 이미지는 **반드시 육안 검토 후 업로드** — AI 이미지 특유의 미세 왜곡 가능
- 자동 업로드 없음 (의도적 배제 — 인스타 알고리즘 패턴 탐지 회피)
- 하루 1~2 캐러셀 권장 (과도한 업로드 역효과)
- 9장 중 오타가 1~2장 나올 수 있음 (97.8% 실측치 = 9장당 0.2장 기대오류) → 해당 슬라이드만 재생성

---

## 참고

- **기본 엔진**: `gemini-3.1-flash-lite-image` (나노바나나 2 Lite) — 가장 빠르고 저렴한 티어, 1장당 약 4초
- **교체 가능**: `--model gemini-3.1-flash-image-preview` (나노바나나 2, 고품질) / `--model gemini-3-pro-image-preview` (나노바나나 Pro, 구 기본값)
- **비율**: `--aspect-ratio 4:5` 기본 (인스타 캐러셀 1080×1350)
- **⚠️ Lite 해상도 제약**: 1K 만 지원 → 4:5 기준 약 896×1152 출력. 1080×1350 원본이 필요하면 나노바나나 2(`gemini-3.1-flash-image-preview`) + `--image-size 2K`, 또는 HTML 엔진 사용
- **실측(Pro 기준)**: 9/9 성공, 4분 20초, 한글 97.8% (에이나우 2026-04-15). Lite 는 속도·비용 우위, 한글 정확도는 재측정 필요
- **원본 이관**: 에이나우 내부 `nanobanana-carousel` Skill 의 오픈소스 버전
