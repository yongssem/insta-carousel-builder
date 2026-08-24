# 캐러셀 본문 폰트 — IBM Plex Sans KR

`build-v5-slides.mjs` 가 `@font-face` 로 직접 불러 씁니다.
**시스템에 설치돼 있지 않아도** 이 파일들만 있으면 어느 PC에서든 같은 결과가 나옵니다.

| 파일 | 두께 |
|---|---|
| `IBMPlexSansKR-Regular.ttf` | 400 |
| `IBMPlexSansKR-SemiBold.ttf` | 600 |
| `IBMPlexSansKR-Bold.ttf` | 700 |

## 왜 이 폰트인가

원래 CSS 는 jsdelivr 에서 Pretendard 를 `@import` 하고 있었는데,
그 주소가 막힌 환경에서는 **조용히 실패**하고 한글이 시스템 폴백으로 떨어졌습니다.
한글 폰트가 없는 리눅스에서는 **중국어 폰트(WenQuanYi)가 한글을 그려서**
자형이 어색해졌습니다. 그게 "폰트가 별로"의 원인이었습니다.

네트워크에 의존하는 `@import` 를 없애고 파일을 저장소에 넣은 이유입니다.

## 출처

Google Fonts (IBM Plex Sans KR) · SIL Open Font License 1.1
`https://fonts.google.com/specimen/IBM+Plex+Sans+KR`
2026-08-24 내려받음. 한글 서브셋 포함본입니다.

## ⚠️ 두께는 700 까지입니다

이 폰트에는 800·900 이 없습니다. CSS 에서 800 을 쓰면 브라우저가
가짜 굵기를 합성해 글자가 뭉갭니다. **헤드라인도 700 을 쓰세요.**

## Pretendard 를 쓰고 싶다면

선생님 PC 에 Pretendard 를 설치하고 `build-v5-slides.mjs` 의
`--font` 기본값만 바꾸면 됩니다. 이 저장소에 안 넣은 건
받는 주소(jsdelivr·GitHub)가 이 작업 환경에서 막혀 있기 때문입니다.
