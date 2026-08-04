# insta-carousel-builder — Claude Code 지시서

> 이 프로젝트는 Claude Code에서 직접 실행하는 인스타 캐러셀 자동 제작 도구입니다.
> 팀원이 "이 주제로 캐러셀 만들어줘"라고 요청하면 **리서치 → 9장 프롬프트 설계 → 나노바나나 2 Lite 생성 → 품질 검증**까지 수행합니다.

---

## 즉시 실행 원칙

### ⭐ 기본 산출 형태 = 움직이는 캐러셀 (v5 모션)

캐러셀 요청이 오면 **기본으로 모션 캐러셀**을 만듭니다. 정적 PNG 만 원한다고
명시한 경우에만 `--skip-video` 를 씁니다.

```bash
# 슬라이드 데이터 JSON 작성 → templates/slides.v5.<topic>.json
node scripts/make-carousel.mjs --data templates/slides.v5.<topic>.json --topic <topic>
```

한 번에 PNG 9장 + MP4 9장 + 엔드카드 + `output/<topic>/upload/` 조립까지 끝납니다.
**단계별로 따로 돌리지 마세요** — 재인코딩이 끝나기 전에 이전 산출물을 묶는
사고가 실제로 났습니다. 이 스크립트는 전부 동기 실행 후 최신성까지 검증합니다.

업로드 폴더 구성: `01-cover.png` (정적, 피드 썸네일) + `02~09.mp4` + `10-endcard.png`

#### 어느 장을 움직일지 고르기 — `--motion`

9장을 다 움직이면 시선이 분산됩니다. 사진과 영상은 한 캐러셀에 섞을 수 있으니
**모션이 의미 있는 장에만** 넣는 편이 낫습니다.

| 값 | 대상 | 언제 |
|:---|:---|:---|
| `all` (기본) | 본문 2~9 전부 | 전 장에 데이터 시각화가 있을 때 |
| `data` | 시각 요소가 있는 장만 | 정보형 기본값 |
| `alt` | 짝수 장 (2,4,6,8) | "중간중간" — 정적/모션 교차로 리듬 |
| `last` | 마지막 장(Outro)만 | 저장 CTA에만 힘 주고 싶을 때 |
| `2,5,8` | 번호 직접 | 후킹·반전·클라이맥스만 |
| `none` | 없음 | 정적 캐러셀 |

⚠️ **`first`(커버)는 권장하지 않습니다.** 커버는 피드 썸네일이 되는데,
영상은 첫 프레임이 썸네일로 쓰여 거의 빈 화면이 노출됩니다.

⚠️ **용량은 모션을 줄인다고 작아지지 않습니다.** PNG 는 2x 레티나(약 600KB),
MP4 는 3.5초에 약 200KB 라 오히려 **모션이 많을수록 가볍습니다**
(실측: 전체 모션 2.7MB / 짝수만 5.0MB / 마지막만 6.2MB).
따라서 모션 장수는 **용량이 아니라 연출 판단**으로 정하세요.

---

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
| ⭐ **v5 하이브리드 (기본)** | 캐릭터가 들어가는 모든 캐러셀 | `build-v5-slides.mjs` → `html-carousel-gen.js` | 없음 (JSON 직접 작성) |
| 🍌 **나노바나나** | "AI 이미지", "빠르게", "실험", "다양한 시안" | `nanobanana-gen.py` | `carousel-prompt-writer` (JSON) |
| 🎨 **HTML/Puppeteer** | "정확하게", "광고", "법무", "한 글자 수정", "0원" | `html-carousel-gen.js` | `carousel-html-writer` (HTML) |

### ⭐ v5 하이브리드가 기본인 이유

캐릭터가 들어가면 **9장을 각각 통째로 이미지 생성하면 안 됩니다.** 장마다 얼굴·옷·비율이
달라져 같은 캐릭터로 안 보입니다. 그래서 역할을 쪼갭니다:

- **캐릭터**: 나노바나나 2 Lite 로 **1회만** 생성 → `assets/characters/*.png` 자산화
- **슬라이드**: HTML/Puppeteer 합성 → 한글 100%, 헤더·페이지번호·푸터 절대 안 흔들림

```
# 1. 캐릭터 자산 (최초 1회, 또는 --only <id> 로 개별 재생성)
python scripts/nanobanana-characters.py

# 2. 슬라이드 데이터 작성 → templates/slides.v5.<topic>.json

# 3. HTML 생성 → PNG 캡처
node scripts/build-v5-slides.mjs --data templates/slides.v5.<topic>.json --topic <topic>
node scripts/html-carousel-gen.js --topic <topic>
```

**캐릭터 배경은 반드시 테마 배경색과 같아야** 합니다 (`templates/characters.json` 의
`common_style` 에 `#F3EEE2` 고정). 다르면 사각형 자국이 보입니다.
가장자리는 CSS radial mask 로 부드럽게 지웁니다.

### 🎬 움직이는 캐러셀 (모션 슬라이드)

인스타 캐러셀은 **사진과 동영상을 섞어** 올릴 수 있습니다(최대 20장).
즉 "움직이는 캐러셀"은 별도 기능이 아니라 **각 장을 짧은 루프 MP4 로 만든 것**입니다.

```bash
node scripts/build-v5-slides.mjs --data <json> --topic <t> --animate 1
node scripts/animate-slides.mjs --topic <t>          # → output/<t>/video/slide-NN.mp4
```

지켜야 할 것:

| 항목 | 규칙 |
|:---|:---|
| **비율 통일** | 캐러셀 **첫 장의 비율이 전체에 강제 적용**됩니다. 9장 전부 1080×1350 |
| **코덱** | H.264 + `yuv420p` + `+faststart`. ⚠️ Playwright 번들 ffmpeg 는 VP8/WebM 전용이라 **인스타 업로드 불가** → `pip install imageio-ffmpeg` |
| **길이** | 3~4초 루프 권장 (캐러셀 1장 체류시간이 2~3초) |
| **결정성** | Web Animations API 로 `currentTime` 을 직접 지정해 캡처 → 몇 번 돌려도 동일 결과 |
| **정적본 병행** | 영상이 안 도는 환경 대비로 PNG 9장도 같이 뽑아둘 것 |

#### ⚠️ GIF 로 올리면 안 됩니다

인스타 **피드/캐러셀은 GIF 애니메이션을 지원하지 않습니다.** GIF 를 올리면
애니메이션이 죽고 **첫 프레임만 정지 이미지로** 올라갑니다.
GIF 가 실제로 움직이는 곳은 스토리·DM 의 GIPHY 스티커뿐입니다.
공식 가이드들도 "GIF 는 MP4 로 변환해서 올려라"로 통일돼 있습니다.

`--gif 1` 옵션은 **블로그(딸깍교실)·스레드·카톡 공유용**입니다. 인스타에는 MP4 를 쓰세요.

```bash
node scripts/animate-slides.mjs --topic <t> --gif 1   # MP4 + GIF 동시 출력
```

피드 영상은 **최소 3초** 규격이 있어 기본 길이를 3.5초로 잡았습니다. 더 줄이지 마세요.

#### 보는 사람 입장에서 어떻게 재생되나

| 항목 | 실제 동작 | 설계에 주는 제약 |
|:---|:---|:---|
| **자동재생** | 넘기면 **음소거 상태로 자동재생** | 소리에 의존하는 연출 금지 |
| **반복** | 캐러셀 영상은 **루프하지 않음**. 1회 재생 후 **마지막 프레임에서 정지** | 마지막 프레임이 **완성된 슬라이드**여야 함 → 모든 등장은 2초 안에 끝내고 나머지는 정지 |
| **첫 프레임** | 자동재생이 막히면(데이터 절약 모드) 첫 프레임이 그대로 노출 | **첫 프레임이 비어 있으면 안 됨.** 헤더·푸터·페이지번호·고스트넘버는 0초부터 표시 (페이드 금지) |
| **커버(1장)** | 피드 썸네일이 됨 | **1장은 정적 PNG 권장.** 영상으로 두면 썸네일이 애매해짐 |

권장 조합: **slide-01 은 PNG, slide-02~09 는 MP4.**
피드 썸네일은 완성된 커버로 고정되고, 넘길 때부터 모션이 붙습니다.

애니메이션 CSS 는 `build-v5-slides.mjs` 안에 `body.anim` 스코프로 들어 있습니다.
정적 빌드(`--animate` 없음)에는 적용되지 않습니다.

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
