# 🎃 Fill My Pumpkin

친구들이 내 호박에 익명 사탕 쪽지를 넣고, **할로윈(10/31) 전까지는 못 열어 보는** 웹앱.

- 배포: **Vercel** (화면 + API) + **Supabase** (데이터베이스)
- 로컬: Supabase 키 없이 실행하면 자동으로 로컬 SQLite 사용

## 로컬 실행

설치할 것 없음 (Node 22.5 이상).

```bash
npm start            # http://localhost:3000
npm run dev:unlocked # 할로윈이 이미 지난 것처럼 테스트 (별도 DB)
```

## 구조

```
public/          화면 (index.html, pumpkin.html, 유령·사운드·스타일)
lib/api.js       API 로직 (로컬 서버와 Vercel이 같이 씀)
lib/store.js     저장소: SUPABASE_URL 있으면 Supabase, 없으면 SQLite
api/handler.js   Vercel 서버리스 함수 입구
server.js        로컬 개발 서버
supabase/schema.sql  Supabase 테이블 생성 SQL
```

## 동작

- `/` : 이름 넣고 호박 만들기 → 공유 링크 + **비밀 주인 링크** 발급
- `/p/<id>` : 친구는 사탕 고르고 쪽지 남김 / 주인은 사탕 개수와 카운트다운만 보임
- 10/31 00:00 (태평양 시간) 이후 주인만 쪽지를 열 수 있음 (서버에서 막음)
- Supabase 테이블은 RLS가 켜져 있고 정책이 없어서, 공개 키로는 아무것도 못 읽음. 서버(비밀 키)만 접근 가능

## 배포

1. **Supabase**: SQL Editor에서 `supabase/schema.sql` 실행
2. **Supabase**: Project Settings → API Keys에서 Project URL과 **Secret key** 복사
3. **Vercel**: New Project → 이 저장소 Import → Environment Variables에 추가 → Deploy
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (새 `sb_secret_...` 키 또는 예전 `service_role` 키 둘 다 됨)

⚠️ Secret key는 절대 코드나 GitHub에 넣지 말 것. Vercel 환경변수에만.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SUPABASE_URL` | (없음) | 설정하면 Supabase 사용 |
| `SUPABASE_SECRET_KEY` | (없음) | Supabase 비밀 키 |
| `UNLOCK_AT` | `2026-10-31T00:00:00-07:00` | 쪽지 열리는 시각 |
| `DB_PATH` | `./pumpkins.db` | 로컬 SQLite 파일 위치 |
| `PORT` | `3000` | 로컬 서버 포트 |

## 데이터 보기

Supabase 대시보드 → Table Editor에서 `pumpkins`, `candies` 테이블 확인.
익명 쪽지라 내용은 되도록 열어 보지 말고 개수만 보기 👀
