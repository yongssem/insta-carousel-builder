# 뱀서류 릴스 — 시네마틱 영상 프롬프트

> "선생님이 게임 주인공이 되어 몰려오는 적을 처치하는" 컷.
> 릴스 후킹과 조합할 용도. 작성 2026-08-06

---

## 쓰기 전에 (짧게)

- **9:16 세로**로 생성하세요. 가로로 뽑아 자르면 인물이 잘립니다
- 모든 프롬프트에 `no text, no logos, no watermark` 를 넣었습니다.
  안 넣으면 모델이 상표 비슷한 걸 화면에 그려 넣습니다
- **얼굴을 유지하려면** 텍스트 생성(t2v)이 아니라 **이미지→영상(i2v)** 으로 가세요.
  선생님 사진 한 장을 넣고 아래 프롬프트를 동작 지시로 쓰면 얼굴이 유지됩니다
- 좀비는 일반 개념이라 IP 문제가 없습니다. 다만 **특정 게임의 몹 디자인을 묘사하지는 마세요**

---

## A. 실사 시네마틱 — 히어로 등장 (가장 무난)

**3초 · 후킹 직후 또는 아웃트로**

```
Cinematic vertical shot, 9:16. A Korean male teacher in his 40s wearing a
casual shirt stands calmly in the center of a dim school hallway, holding a
rolled-up attendance book at his side like a weapon. Dozens of blurred zombie
silhouettes shamble toward him from the far end of the corridor, backlit by
flickering fluorescent lights. Slow dolly-in on the teacher's face as he
looks up with quiet confidence. Volumetric haze, teal and orange color grade,
shallow depth of field, film grain. No text, no logos, no watermark.
```

> 정면 히어로 샷. 적은 **뒤에 흐릿하게** 두어 무섭지 않게 처리했습니다.

---

## B. 실사 시네마틱 — 슬로모션 액션

**4초 · 가장 화려함**

```
Cinematic vertical shot, 9:16, slow motion 120fps look. A Korean male teacher
swings a piece of chalk in a wide arc; a glowing white shockwave ripples
outward from him. Zombie figures around him are thrown backward in slow
motion, dissolving into soft particles of light rather than gore. Dust and
paper sheets fly through the air. Low angle, camera slowly orbiting around
him. Dramatic rim lighting, cinematic color grade, lens flare.
No blood, no gore, stylized and playful. No text, no logos, no watermark.
```

> `dissolving into light, no blood, no gore` 를 명시했습니다.
> 교사 계정이라 유혈 표현이 나오면 못 씁니다.

---

## C. 실사 — 몰려오는 적을 위에서 (뱀서류 구도)

**3초 · 게임 화면과 붙였을 때 가장 자연스럽게 이어짐**

```
Cinematic vertical shot, 9:16, high overhead angle looking straight down.
A Korean male teacher stands alone at the center of a large empty gymnasium
floor. A massive ring of zombie figures closes in from every direction,
forming a circular pattern around him. Camera slowly rises higher, revealing
how many there are. Cool blue lighting with a single warm spotlight on the
teacher. Cinematic, high contrast. No text, no logos, no watermark.
```

> 뱀서류의 핵심 구도(탑다운 + 포위)라 실제 게임 화면으로 컷 전환할 때 매끄럽습니다.

---

## D. 3D 치비 — 브랜드 화풍 (기존 캐릭터와 이어짐)

**3초 · `assets/characters/` 5종과 같은 결**

```
3D animated vertical shot, 9:16. A chibi character with an oversized head and
small rounded body, soft matte clay-like material, wearing a navy zip-up
hoodie, stands in a simple stylized arena. Soft purple blob monsters with
simple round eyes hop toward him from all sides. The character calmly raises
one hand and a gentle golden ring of light expands outward, bouncing the
blobs away. Warm soft studio lighting, soft drop shadow, friendly and playful,
Pixar-like. Static camera. No text, no logos, no watermark.
```

> 실사와 섞지 마세요. **한 릴스 안에서는 실사면 실사, 치비면 치비**로 통일해야 합니다.

---

## E. 게임 시네마틱 — 픽셀아트 애니메이션

**3초 · 게임 만드는 콘텐츠와 결이 제일 맞음**

```
Pixel art animated vertical video, 9:16, 16-bit retro game style. A small
pixel-art teacher sprite in a shirt stands at the center of a green field.
Waves of small pixel zombie sprites pour in from all four edges of the screen.
The teacher sprite automatically fires glowing projectiles in all directions,
enemies burst into small pixel particles on hit. A pixel-art HUD bar sits at
the top. Smooth looping animation, vibrant saturated colors, CRT scanline
texture. No text, no logos, no watermark.
```

> **후킹에 쓰기 가장 안전한 안입니다.** 픽셀아트라 "실제 게임 화면"과의 격차가
> 작아서 기대 배반이 덜합니다. 다만 실제 만들 게임도 픽셀 계열이어야 합니다.

---

## F. 아웃트로 — 정리된 교실

**2초 · 릴스 마지막**

```
Cinematic vertical shot, 9:16. A Korean male teacher stands in a bright empty
classroom, afternoon sunlight through the windows. He dusts off his hands and
gives a small satisfied nod to the camera. Everything is calm and tidy.
Warm natural light, soft focus background, gentle push-in.
No text, no logos, no watermark.
```

> 액션 컷으로 열었으면 **조용한 컷으로 닫아야** 잔상이 남습니다.

---

## 조합 예시 (30초 릴스)

| 구간 | 내용 | 소재 |
|:---|:---|:---|
| 0~4초 | 후킹 (증거 → 프롬프트 → 공개 약속) | **실제 게임 화면 녹화** |
| 4~7초 | "제가 이렇게 됐다는 뜻입니다" | 시네마틱 A 또는 C |
| 7~20초 | 프롬프트 3개 그대로 공개 | 화면 녹화 |
| 20~27초 | 배포 → 아이들이 하는 화면 | 화면 녹화 + 교실 |
| 27~30초 | 마무리 | 시네마틱 F |

- 시네마틱은 **후킹 다음**에 넣는 걸 권합니다. 후킹 4초는 실제 화면이 이겨요
- 시네마틱을 넣으면 **AI로 만든 영상이라고 화면이나 캡션에 밝히세요.**
  요즘은 안 밝히면 댓글에서 먼저 지적당합니다

---

## 배경을 교실로 할지

교실 + 좀비 조합이 부담스러우면 배경만 바꾸면 됩니다.
프롬프트에서 `school hallway` / `gymnasium` 을 아래로 바꾸세요.

- `an abstract dark arena with glowing grid floor` — 게임 속 공간 느낌
- `a floating platform in a starry void` — 완전 비현실
- `a cluttered office desk world made of giant paper stacks` — **밀린 업무가 적**

마지막 안은 좀비를 아예 서류 더미로 바꾸는 버전입니다.

```
Cinematic vertical shot, 9:16. A Korean male teacher stands on a giant desk
surface. Towers of paper documents and notice sheets march toward him like
monsters, stacking and toppling. He raises a red pen and a wave of light
sweeps the paper stacks away into scattered sheets. Playful, slightly absurd,
warm office lighting, cinematic depth of field.
No text, no logos, no watermark.
```
