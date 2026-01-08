# 설치 및 실행 가이드

## 📋 사전 요구사항

- Node.js 16.x 이상
- PostgreSQL 12.x 이상
- npm 또는 yarn

## 🚀 설치 방법

### 1. 저장소 클론 및 의존성 설치

```bash
# 루트 디렉토리에서 모든 의존성 설치
npm run install-all
```

또는 개별적으로 설치:

```bash
# 루트 의존성
npm install

# 백엔드 의존성
cd backend
npm install

# 프론트엔드 의존성
cd ../frontend
npm install
```

### 2. PostgreSQL 데이터베이스 생성

PostgreSQL에 접속하여 데이터베이스를 생성합니다:

```sql
CREATE DATABASE modern_shop;
```

### 3. 환경 변수 설정

백엔드 디렉토리에 `.env` 파일을 생성합니다:

```bash
cd backend
cp .env.example .env
```

`.env` 파일을 열어 데이터베이스 정보를 입력합니다:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=modern_shop
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Secret (보안을 위해 복잡한 문자열로 변경하세요)
JWT_SECRET=your_very_secure_jwt_secret_key_change_this

# Server Port
PORT=5000

# Node Environment
NODE_ENV=development
```

### 4. 데이터베이스 초기화

샘플 데이터와 함께 데이터베이스 테이블을 생성합니다:

```bash
cd backend
npm run init-db
```

이 명령은 다음을 생성합니다:
- 필요한 모든 테이블
- 기본 관리자 계정
- 샘플 카테고리
- 샘플 상품

### 5. 개발 서버 실행

#### 방법 1: 동시 실행 (권장)

루트 디렉토리에서:

```bash
npm run dev
```

이 명령은 백엔드와 프론트엔드를 동시에 실행합니다.

#### 방법 2: 개별 실행

터미널 1 - 백엔드:
```bash
cd backend
npm run dev
```

터미널 2 - 프론트엔드:
```bash
cd frontend
npm start
```

### 6. 애플리케이션 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5000/api
- **헬스 체크**: http://localhost:5000/api/health

## 👤 기본 계정

데이터베이스 초기화 후 다음 계정으로 로그인할 수 있습니다:

### 관리자 계정
- 이메일: `admin@shop.com`
- 비밀번호: `admin123`

### 일반 사용자 계정
- 이메일: `user@shop.com`
- 비밀번호: `user123`

⚠️ **보안 주의**: 프로덕션 환경에서는 반드시 비밀번호를 변경하세요!

## 📁 프로젝트 구조

```
modern-shop/
├── backend/                # Express 백엔드
│   ├── config/            # 데이터베이스 설정
│   ├── controllers/       # 비즈니스 로직
│   ├── middleware/        # 인증 등 미들웨어
│   ├── routes/            # API 라우트
│   ├── scripts/           # 유틸리티 스크립트
│   └── server.js          # 서버 진입점
├── frontend/              # React 프론트엔드
│   ├── public/            # 정적 파일
│   └── src/
│       ├── components/    # 재사용 컴포넌트
│       ├── context/       # Context API
│       ├── pages/         # 페이지 컴포넌트
│       ├── services/      # API 서비스
│       └── utils/         # 유틸리티 함수
└── README.md
```

## 🔧 주요 기능

### 사용자 기능
- ✅ 회원가입 및 로그인
- ✅ 상품 목록 및 상세 조회
- ✅ 카테고리별 필터링
- ✅ 상품 검색
- ✅ 장바구니 관리
- ✅ 주문 및 주문 내역 조회

### 관리자 기능
- ✅ 상품 CRUD (생성, 조회, 수정, 삭제)
- ✅ 카테고리 관리
- ✅ 주문 관리 및 상태 변경
- ✅ 대시보드 통계

## 🛠️ 개발 명령어

### 백엔드

```bash
cd backend

# 개발 서버 실행 (nodemon)
npm run dev

# 프로덕션 서버 실행
npm start

# 데이터베이스 초기화
npm run init-db
```

### 프론트엔드

```bash
cd frontend

# 개발 서버 실행
npm start

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test
```

## 🐛 문제 해결

### 데이터베이스 연결 오류

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**해결 방법**:
1. PostgreSQL이 실행 중인지 확인
2. `.env` 파일의 데이터베이스 정보가 정확한지 확인
3. PostgreSQL 포트가 5432인지 확인

### 포트 충돌

```
Error: listen EADDRINUSE: address already in use :::3000
```

**해결 방법**:
1. 다른 프로세스가 포트를 사용 중인지 확인
2. `.env` 파일에서 다른 포트로 변경

### CORS 오류

백엔드 `server.js`에서 CORS 설정을 확인하세요. 기본적으로 모든 origin을 허용하도록 설정되어 있습니다.

## 📦 프로덕션 배포

### 백엔드 배포

1. 환경 변수 설정
2. 데이터베이스 마이그레이션 실행
3. `npm start`로 서버 실행

### 프론트엔드 배포

1. 프로덕션 빌드 생성:
   ```bash
   cd frontend
   npm run build
   ```

2. `build` 폴더를 웹 서버에 배포 (Nginx, Apache 등)

## 🔐 보안 권장사항

1. **JWT Secret 변경**: `.env`의 `JWT_SECRET`을 복잡한 문자열로 변경
2. **기본 비밀번호 변경**: 관리자 계정 비밀번호를 즉시 변경
3. **HTTPS 사용**: 프로덕션에서는 반드시 HTTPS 사용
4. **환경 변수 보호**: `.env` 파일을 절대 Git에 커밋하지 않기
5. **CORS 설정**: 프로덕션에서는 특정 도메인만 허용하도록 설정

## 📝 API 문서

주요 API 엔드포인트:

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 상품
- `GET /api/products` - 상품 목록
- `GET /api/products/:id` - 상품 상세
- `POST /api/products` - 상품 생성 (관리자)
- `PUT /api/products/:id` - 상품 수정 (관리자)
- `DELETE /api/products/:id` - 상품 삭제 (관리자)

### 카테고리
- `GET /api/categories` - 카테고리 목록
- `POST /api/categories` - 카테고리 생성 (관리자)

### 장바구니
- `GET /api/cart` - 장바구니 조회
- `POST /api/cart` - 장바구니에 추가
- `PUT /api/cart/:id` - 수량 변경
- `DELETE /api/cart/:id` - 항목 삭제

### 주문
- `GET /api/orders` - 주문 목록
- `GET /api/orders/:id` - 주문 상세
- `POST /api/orders` - 주문 생성
- `PATCH /api/orders/:id/status` - 주문 상태 변경 (관리자)

## 💡 추가 기능 아이디어

- 상품 이미지 업로드
- 결제 시스템 통합
- 이메일 알림
- 상품 리뷰 시스템
- 위시리스트
- 쿠폰 및 할인 시스템
- 배송 추적

## 📞 지원

문제가 발생하면 이슈를 등록해주세요.

## 📄 라이선스

MIT License

