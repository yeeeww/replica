# Modern E-commerce Platform 🛍️

React + Node.js + Express + PostgreSQL 기반의 현대적이고 세련된 풀스택 쇼핑몰 플랫폼

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)

## ✨ 주요 기능

### 👥 사용자 기능
- 🛍️ 상품 목록 및 상세 페이지
- 🔍 상품 검색 및 카테고리 필터링
- 🛒 실시간 장바구니 관리
- 👤 JWT 기반 회원가입 및 로그인
- 📦 주문 및 주문 내역 조회
- 📱 완전한 반응형 디자인

### 🔐 관리자 기능
- ➕ 상품 CRUD (생성, 조회, 수정, 삭제)
- 📊 카테고리 관리
- 📋 주문 관리 및 상태 변경
- 📈 대시보드 통계
- 🎨 직관적인 관리자 패널

## 🚀 기술 스택

### Frontend
- **React 18** - 최신 React 기능 활용
- **React Router v6** - SPA 라우팅
- **Axios** - HTTP 클라이언트
- **Context API** - 전역 상태 관리
- **CSS3** - 모던 스타일링

### Backend
- **Node.js** - 런타임 환경
- **Express.js** - 웹 프레임워크
- **PostgreSQL** - 관계형 데이터베이스
- **JWT** - 토큰 기반 인증
- **bcryptjs** - 비밀번호 암호화

## 📦 빠른 시작

### 사전 요구사항
- Node.js 16.x 이상
- PostgreSQL 12.x 이상
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
```bash
git clone <repository-url>
cd modern-shop
```

2. **의존성 설치**
```bash
npm run install-all
```

3. **데이터베이스 생성**
```sql
CREATE DATABASE modern_shop;
```

4. **환경 변수 설정**
```bash
cd backend
cp .env.example .env
# .env 파일을 열어 데이터베이스 정보 입력
```

5. **데이터베이스 초기화**
```bash
cd backend
npm run init-db
```

6. **개발 서버 실행**
```bash
# 루트 디렉토리에서
npm run dev
```

7. **브라우저에서 접속**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## 👤 기본 계정

### 관리자
- 이메일: `admin@shop.com`
- 비밀번호: `admin123`

### 일반 사용자
- 이메일: `user@shop.com`
- 비밀번호: `user123`

⚠️ **프로덕션 환경에서는 반드시 비밀번호를 변경하세요!**

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
│       │   └── admin/     # 관리자 페이지
│       ├── services/      # API 서비스
│       └── utils/         # 유틸리티 함수
├── package.json           # 루트 패키지 설정
├── README.md             # 프로젝트 문서
└── SETUP.md              # 상세 설치 가이드
```

## 🔌 API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 상품
- `GET /api/products` - 상품 목록 (페이지네이션, 검색, 필터링)
- `GET /api/products/:id` - 상품 상세
- `POST /api/products` - 상품 생성 (관리자)
- `PUT /api/products/:id` - 상품 수정 (관리자)
- `DELETE /api/products/:id` - 상품 삭제 (관리자)

### 카테고리
- `GET /api/categories` - 카테고리 목록
- `POST /api/categories` - 카테고리 생성 (관리자)
- `PUT /api/categories/:id` - 카테고리 수정 (관리자)
- `DELETE /api/categories/:id` - 카테고리 삭제 (관리자)

### 장바구니
- `GET /api/cart` - 장바구니 조회
- `POST /api/cart` - 장바구니에 추가
- `PUT /api/cart/:id` - 수량 변경
- `DELETE /api/cart/:id` - 항목 삭제
- `DELETE /api/cart` - 장바구니 비우기

### 주문
- `GET /api/orders` - 주문 목록
- `GET /api/orders/:id` - 주문 상세
- `POST /api/orders` - 주문 생성
- `PATCH /api/orders/:id/status` - 주문 상태 변경 (관리자)

## 🎨 주요 화면

- **홈페이지** - 히어로 섹션, 인기 상품, 주요 기능 소개
- **상품 목록** - 카테고리 필터, 검색, 페이지네이션
- **상품 상세** - 상품 정보, 장바구니 추가
- **장바구니** - 수량 조절, 주문 요약
- **주문하기** - 배송 정보 입력, 결제
- **주문 내역** - 주문 목록 및 상세 정보
- **관리자 패널** - 상품/카테고리/주문 관리

## 🛠️ 개발 명령어

```bash
# 전체 개발 서버 실행
npm run dev

# 백엔드만 실행
npm run server

# 프론트엔드만 실행
npm run client

# 모든 의존성 설치
npm run install-all

# 데이터베이스 초기화
cd backend && npm run init-db
```

## 📚 상세 문서

더 자세한 설치 및 설정 방법은 [SETUP.md](SETUP.md)를 참고하세요.

## 🔐 보안

- JWT 토큰 기반 인증
- bcrypt를 사용한 비밀번호 해싱
- SQL Injection 방지
- CORS 설정
- 환경 변수를 통한 민감 정보 관리

## 🤝 기여

기여는 언제나 환영합니다! 이슈를 등록하거나 Pull Request를 보내주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🙏 감사의 말

이 프로젝트는 학습 및 포트폴리오 목적으로 제작되었습니다.

