# 🚀 빠른 시작 가이드

이 가이드를 따라 5분 안에 쇼핑몰을 실행해보세요!

## 1️⃣ PostgreSQL 설치 (이미 설치되어 있다면 건너뛰기)

### Windows
1. [PostgreSQL 공식 사이트](https://www.postgresql.org/download/windows/)에서 다운로드
2. 설치 중 비밀번호 설정 (기억해두세요!)
3. 포트는 기본값 5432 사용

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 2️⃣ 데이터베이스 생성

PostgreSQL에 접속:
```bash
# Windows/Linux
psql -U postgres

# macOS
psql postgres
```

데이터베이스 생성:
```sql
CREATE DATABASE modern_shop;
\q
```

## 3️⃣ 프로젝트 설정

### 모든 의존성 설치
```bash
npm run install-all
```

이 명령은 루트, 백엔드, 프론트엔드의 모든 패키지를 자동으로 설치합니다.

### 환경 변수 설정

`backend/.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=modern_shop
DB_USER=postgres
DB_PASSWORD=여기에_PostgreSQL_비밀번호_입력
JWT_SECRET=any_random_secure_string_here
PORT=5000
NODE_ENV=development
```

**중요**: `DB_PASSWORD`를 PostgreSQL 설치 시 설정한 비밀번호로 변경하세요!

## 4️⃣ 데이터베이스 초기화

```bash
cd backend
npm run init-db
```

이 명령은 다음을 자동으로 생성합니다:
- ✅ 모든 필요한 테이블
- ✅ 관리자 계정 (admin@shop.com / admin123)
- ✅ 테스트 사용자 계정 (user@shop.com / user123)
- ✅ 4개의 샘플 카테고리
- ✅ 8개의 샘플 상품

## 5️⃣ 서버 실행

루트 디렉토리로 돌아가서:
```bash
cd ..
npm run dev
```

이 명령은 백엔드와 프론트엔드를 동시에 실행합니다!

## 6️⃣ 브라우저에서 확인

자동으로 브라우저가 열리지 않으면 다음 주소로 접속하세요:

🌐 **http://localhost:3000**

## 7️⃣ 로그인

### 일반 사용자로 체험
- 이메일: `user@shop.com`
- 비밀번호: `user123`

### 관리자로 체험
- 이메일: `admin@shop.com`
- 비밀번호: `admin123`

관리자로 로그인하면 상단 메뉴에 "관리자" 링크가 나타납니다!

## ✅ 확인 사항

### 백엔드가 정상 작동하는지 확인
브라우저에서 http://localhost:5000/api/health 접속

다음과 같은 응답이 나오면 성공:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### 데이터베이스 연결 확인
터미널에서 다음 메시지를 확인:
```
✅ Database connected successfully
🚀 Server is running on port 5000
```

## 🐛 문제 해결

### "Error: connect ECONNREFUSED"
- PostgreSQL이 실행 중인지 확인
- `.env` 파일의 비밀번호가 정확한지 확인

### "Port 3000 is already in use"
- 다른 프로그램이 포트를 사용 중입니다
- 해당 프로그램을 종료하거나 다른 포트를 사용하세요

### "Module not found"
```bash
npm run install-all
```
다시 실행해보세요.

## 🎉 다음 단계

1. **상품 둘러보기**: 홈페이지에서 샘플 상품들을 확인하세요
2. **장바구니 테스트**: 상품을 장바구니에 담아보세요
3. **주문 해보기**: 테스트 주문을 완료해보세요
4. **관리자 패널**: 관리자로 로그인하여 상품을 추가/수정해보세요

## 📚 더 알아보기

- 상세 설치 가이드: [SETUP.md](SETUP.md)
- 프로젝트 문서: [README.md](README.md)

## 💡 팁

- 관리자 패널에서 새로운 상품을 추가할 수 있습니다
- 이미지 URL은 Unsplash 등의 무료 이미지 서비스를 활용하세요
- 카테고리는 자유롭게 추가/수정 가능합니다

즐거운 쇼핑몰 체험 되세요! 🛍️

