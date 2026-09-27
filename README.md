# 🎃 Fill My Pumpkin

친구들이 내 호박에 익명 사탕 쪽지를 넣고, **할로윈(10/31) 전까지는 못 열어 보는** 웹앱.

## 로컬 실행

설치할 것 없음 (Node 22.5 이상만 있으면 됨).

```bash
npm start            # http://localhost:3000
npm run dev:unlocked # 할로윈이 이미 지난 것처럼 테스트 (별도 DB)
```

## 어떻게 동작하나

- `/` : 이름 넣고 호박 만들기 → 공유 링크 + **비밀 주인 링크** 발급
- `/p/<id>` : 친구는 사탕 고르고 쪽지 남김 / 주인은 사탕 개수와 카운트다운만 보임
- 10/31 00:00 (태평양 시간) 이후 주인만 쪽지를 열 수 있음 (서버에서 막음)
- 주인 인증은 브라우저 localStorage + `#owner=` 비밀 링크 (다른 기기에서 열 때 사용)

## 설정 (환경변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | 포트 |
| `UNLOCK_AT` | `2026-10-31T00:00:00-07:00` | 쪽지 열리는 시각 |
| `DB_PATH` | `./pumpkins.db` | SQLite 파일 위치 |

## 배포

데이터가 SQLite 파일에 저장되니까 **디스크가 유지되는 호스팅**을 써야 함.

- **Railway**: GitHub 연결 → Volume 추가 (예: `/data`) → `DB_PATH=/data/pumpkins.db`
- **Render**: Web Service + Persistent Disk → 같은 방식으로 `DB_PATH` 지정
- **Fly.io**: `fly launch` → volume 생성 후 `DB_PATH` 지정

Vercel/Netlify 같은 서버리스는 파일이 날아가서 그대로는 안 됨.
