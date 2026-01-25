import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts, getCategories, getWeeklyBestProducts } from "../services/api";
import ProductCard from "../components/ProductCard";
import "./Products.css";

const Products = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [products, setProducts] = useState([]);
	const [sortedProducts, setSortedProducts] = useState([]);
	const [bestProducts, setBestProducts] = useState([]);
	const [bestIndex, setBestIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [pagination, setPagination] = useState({});
	const [sortOption, setSortOption] = useState("recent");
	const [categoryTree, setCategoryTree] = useState([]);  // 3뎁스 카테고리 트리
	const [selectedDepth2, setSelectedDepth2] = useState(null);  // 선택된 중분류

	const category = searchParams.get("category") || "";
	const search = searchParams.get("search") || "";
	const page = parseInt(searchParams.get("page") || "1");

	// 대분류 추출 (men, women, domestic 등)
	const deriveMain = useMemo(() => {
		const mainCategoryMap = {
			bags: "bags",
			clothing: "clothing",
			shoes: "shoes",
			acc: "acc",
			men: "men",
			women: "women",
			domestic: "domestic",
			recommend: "recommend",
			hot: "hot",
			popular: "popular",
			notice: "notice",
		};
		if (!category) return "men";
		const base = category.split("-")[0];
		return mainCategoryMap[base] || base || "men";
	}, [category]);

	// 현재 선택된 중분류 추출 (men-bag, men-wallet 등)
	const currentDepth2Slug = useMemo(() => {
		if (!category) return null;
		const parts = category.split("-");
		if (parts.length >= 2) {
			return `${parts[0]}-${parts[1]}`;
		}
		return null;
	}, [category]);

	// 카테고리 트리에서 현재 대분류 찾기
	const currentMainCategory = useMemo(() => {
		return categoryTree.find(cat => cat.slug === deriveMain);
	}, [categoryTree, deriveMain]);

	// 현재 중분류의 하위 카테고리(소분류) 찾기
	const currentDepth3Categories = useMemo(() => {
		if (!currentMainCategory || !selectedDepth2) return [];
		const depth2Cat = currentMainCategory.children?.find(c => c.slug === selectedDepth2);
		return depth2Cat?.children || [];
	}, [currentMainCategory, selectedDepth2]);

	const bannerByMain = {
		bags:
			"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1800&q=80",
		clothing:
			"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=80",
		shoes:
			"https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1800&q=80",
		acc:
			"https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1800&q=80",
		men:
			"https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1800&q=80",
		women:
			"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=80",
		domestic:
			"https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1800&q=80",
		recommend:
			"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1800&q=80",
		hot:
			"https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1800&q=80",
		popular:
			"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1800&q=80",
		notice:
			"https://images.unsplash.com/photo-1520975922090-7c74c260d81c?auto=format&fit=crop&w=1800&q=80",
	};

	const bannerTitleMap = {
		bags: "BAGS",
		clothing: "CLOTHING",
		shoes: "SHOES",
		acc: "ACC",
		men: "HIGH-END-MEN",
		women: "HIGH-END-WOMEN",
		domestic: "HIGH-END-DOMESTIC",
		recommend: "RECOMMENDED",
		hot: "HIT PRODUCTS",
		popular: "POPULAR",
		notice: "NOTICE",
	};

	// 중분류 카테고리 아이콘 이미지 매핑
	const categoryIconImages = {
		"clothing": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=200&h=200&fit=crop",
		"bag": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop",
		"shoes": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop",
		"watch": "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=200&h=200&fit=crop",
		"wallet": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=200&h=200&fit=crop",
		"belt": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop",
		"hat": "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=200&h=200&fit=crop",
		"accessory": "https://images.unsplash.com/photo-1611923134239-b9be5816e23c?w=200&h=200&fit=crop",
		"glasses": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=200&h=200&fit=crop",
		"etc": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop",
		"bag-wallet": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop",
		"fashion": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop",
		"home": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop",
		"perfume": "https://images.unsplash.com/photo-1541643600914-78b084683601?w=200&h=200&fit=crop",
		"lighter": "https://images.unsplash.com/photo-1567197427669-a0d3603a3586?w=200&h=200&fit=crop",
	};

	// 중분류 한글 이름 매핑
	const categoryKoreanNames = {
		"bag": "가방",
		"wallet": "지갑",
		"bag-wallet": "가방&지갑",
		"watch": "시계",
		"shoes": "신발",
		"belt": "벨트",
		"accessory": "악세사리",
		"hat": "모자",
		"clothing": "의류",
		"glasses": "안경",
		"etc": "기타",
		"fashion": "패션잡화",
		"home": "생활&주방용품",
		"perfume": "향수",
		"lighter": "라이터",
	};

	// slug에서 한글 이름 가져오기
	const getKoreanCategoryName = (slug, originalName) => {
		// 이미 한글이면 그대로
		if (/[가-힣]/.test(originalName)) return originalName;
		
		const parts = slug.split("-");
		const subType = parts.slice(1).join("-");
		return categoryKoreanNames[subType] || originalName;
	};

	// 중분류 순서 정의 (대분류별)
	const subCategoryOrder = {
		// 남성, 여성: 가방, 지갑, 시계, 신발, 벨트, 악세서리, 모자, 의류, 선글라스&안경, 기타
		'men': ['bag', 'wallet', 'watch', 'shoes', 'belt', 'accessory', 'hat', 'clothing', 'glasses', 'etc'],
		'women': ['bag', 'wallet', 'watch', 'shoes', 'belt', 'accessory', 'hat', 'clothing', 'glasses', 'etc'],
		// 국내출고상품: 가방&지갑, 의류, 신발, 모자, 악세서리, 시계, 패션잡화, 생활&주방용품, 벨트, 향수, 라이터
		'domestic': ['bag-wallet', 'clothing', 'shoes', 'hat', 'accessory', 'watch', 'fashion-acc', 'home-kitchen', 'belt', 'perfume', 'lighter']
	};

	// 현재 대분류의 중분류 목록 (카테고리 아이콘용)
	const depth2Categories = useMemo(() => {
		if (!currentMainCategory || !currentMainCategory.children) return [];
		
		const categories = currentMainCategory.children.map(cat => {
			const parts = cat.slug.split("-");
			const subType = parts.slice(1).join("-");
			const image = categoryIconImages[subType] || categoryIconImages["etc"];
			const koreanName = getKoreanCategoryName(cat.slug, cat.name);
			return {
				...cat,
				subType,
				image,
				label: `하이엔드 ${koreanName}`
			};
		});

		// 순서 정렬
		const order = subCategoryOrder[deriveMain];
		if (order) {
			categories.sort((a, b) => {
				const aIdx = order.indexOf(a.subType);
				const bIdx = order.indexOf(b.subType);
				if (aIdx === -1 && bIdx === -1) return 0;
				if (aIdx === -1) return 1;
				if (bIdx === -1) return -1;
				return aIdx - bIdx;
			});
		}

		return categories;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentMainCategory, deriveMain]);

	const sortOptions = [
		{ value: "recent", label: "등록순" },
		{ value: "popular", label: "인기순" },
		{ value: "price-asc", label: "낮은가격순" },
		{ value: "price-desc", label: "높은가격순" },
		{ value: "review", label: "상품평 많은순" },
		{ value: "name-asc", label: "이름순" },
		{ value: "name-desc", label: "이름역순" },
	];

	// 카테고리 트리 로드
	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const response = await getCategories({ tree: true });
				const tree = response.data.categories || [];
				console.log('Category tree loaded:', tree);
				console.log('Men category:', tree.find(c => c.slug === 'men'));
				setCategoryTree(tree);
			} catch (error) {
				console.error("Failed to fetch categories:", error);
			}
		};
		fetchCategories();
	}, []);

	// 선택된 중분류 동기화
	useEffect(() => {
		if (currentDepth2Slug) {
			setSelectedDepth2(currentDepth2Slug);
		} else if (deriveMain && !category.includes("-")) {
			// 대분류만 선택된 경우, 첫 번째 중분류 선택
			setSelectedDepth2(null);
		}
	}, [currentDepth2Slug, deriveMain, category]);

	useEffect(() => {
		fetchProducts();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [category, search, page]);

	const fetchProducts = async () => {
		try {
			setLoading(true);
			const response = await getProducts({ category, search, page, limit: 20 });
			const list = response.data.products || [];
			setProducts(list);
			setPagination(response.data.pagination);
		} catch (error) {
			console.error("Failed to fetch products:", error);
		} finally {
			setLoading(false);
		}
	};

	// Weekly Best 상품 로드 (대분류별 수동 선택된 상품)
	useEffect(() => {
		const fetchWeeklyBest = async () => {
			// 대분류가 men, women, domestic 중 하나일 때만 Weekly Best 로드
			const mainCategories = ['men', 'women', 'domestic'];
			if (mainCategories.includes(deriveMain)) {
				try {
					const response = await getWeeklyBestProducts(deriveMain, 12);
					setBestProducts(response.data.products || []);
				} catch (error) {
					console.error("Failed to fetch weekly best:", error);
					setBestProducts([]);
				}
			} else {
				setBestProducts([]);
			}
		};
		fetchWeeklyBest();
	}, [deriveMain]);

	const applySort = (items, option) => {
		const arr = [...items];
		switch (option) {
			case "price-asc":
				return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
			case "price-desc":
				return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
			case "popular":
				return arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
			case "review":
				return arr.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
			case "name-asc":
				return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
			case "name-desc":
				return arr.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
			case "recent":
			default:
				return arr;
		}
	};

	useEffect(() => {
		setSortedProducts(applySort(products, sortOption));
	}, [products, sortOption]);

	const handleCategoryChange = (newCategory) => {
		const params = new URLSearchParams();
		if (newCategory) params.set("category", newCategory);
		if (search) params.set("search", search);
		setSearchParams(params);
	};

	const handlePageChange = (newPage) => {
		const params = new URLSearchParams(searchParams);
		params.set("page", newPage.toString());
		setSearchParams(params);
		window.scrollTo(0, 0);
	};

	const bestSlides = [];
	for (let i = 0; i < bestProducts.length; i += 4) {
		bestSlides.push(bestProducts.slice(i, i + 4));
	}

	const prevBest = () => {
		if (bestSlides.length === 0) return;
		setBestIndex((prev) => (prev - 1 + bestSlides.length) % bestSlides.length);
	};
	const nextBest = () => {
		if (bestSlides.length === 0) return;
		setBestIndex((prev) => (prev + 1) % bestSlides.length);
	};

	// 자동 슬라이드 (5초마다)
	useEffect(() => {
		if (bestSlides.length <= 1) return;
		const timer = setInterval(() => {
			setBestIndex((prev) => (prev + 1) % bestSlides.length);
		}, 5000);
		return () => clearInterval(timer);
	}, [bestSlides.length]);

	return (
		<div className="products-page">
			{/* 상단 배너 (PC/모바일 공통) */}
			<div
				className="category-banner"
				style={{ backgroundImage: `url(${bannerByMain[deriveMain] || bannerByMain.men})` }}>
				<div className="category-banner-overlay" />
				<div className="category-banner-content">
					<h1>{bannerTitleMap[deriveMain] || "HIGH-END"}</h1>
				</div>
			</div>

			{/* 중분류 카테고리 아이콘 그리드 (PC/모바일 공통) */}
			{depth2Categories.length > 0 && (
				<div className="products-cat-section">
					<div className="products-cat-grid">
						{depth2Categories.map((cat) => (
							<button
								key={cat.slug}
								className={`products-cat-item ${selectedDepth2 === cat.slug || category === cat.slug ? "active" : ""}`}
								onClick={() => {
									setSelectedDepth2(cat.slug);
									handleCategoryChange(cat.slug);
								}}>
								<div className="products-cat-img">
									<img src={cat.image} alt={cat.label} />
								</div>
								<span>{cat.label}</span>
							</button>
						))}
					</div>
				</div>
			)}

			<div className="container">
				{/* 소분류/브랜드 필터 (표 형태) - 항상 3뎁스(브랜드) 표시 */}
				{selectedDepth2 && (
					<div className="subcategory-bar">
						{/* Show All 버튼 */}
						<button
							className={`subcategory-btn ${category === selectedDepth2 ? "active" : ""}`}
							onClick={() => handleCategoryChange(selectedDepth2)}>
							Show All
						</button>
						{/* 소분류(브랜드 등) 목록 */}
						{currentDepth3Categories.length > 0 && (
							currentDepth3Categories.map((item) => (
								<button
									key={item.slug}
									className={`subcategory-btn ${category === item.slug ? "active" : ""}`}
									onClick={() => handleCategoryChange(item.slug)}>
									{item.name}
								</button>
							))
						) }
					</div>
				)}

				{/* 공지사항 전용 레이아웃 */}
				{deriveMain === "notice" ? (
					<div className="notice-board">
						<div className="notice-head">
							<h3>공지사항</h3>
						</div>
						{loading ? (
							<div className="loading">불러오는 중...</div>
						) : sortedProducts.length === 0 ? (
							<div className="no-products">공지사항이 없습니다.</div>
						) : (
							<table className="notice-table">
								<thead>
									<tr>
										<th>번호</th>
										<th>제목</th>
										<th>가격/정보</th>
									</tr>
								</thead>
								<tbody>
									{sortedProducts.map((item, idx) => (
										<tr key={item.id || idx}>
											<td>{idx + 1}</td>
											<td className="notice-title">{item.name}</td>
											<td className="notice-meta">
												{item.price ? `${item.price?.toLocaleString()}원` : "-"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				) : (
					<>
						{/* 주간 베스트 슬라이드 */}
						{!loading && bestProducts.length > 0 && (
							<section className="weekly-best">
								<div className="weekly-head">
									<img 
										src="https://cdn.imweb.me/thumbnail/20251207/a0e50eaa9bfeb.png" 
										alt="WEEKLY BEST" 
										className="weekly-title-img"
									/>
								</div>
								<div className="weekly-slider">
									<button className="weekly-nav prev" onClick={prevBest}>
										‹
									</button>
									<div className="weekly-slider-inner">
										<div
											className="weekly-track"
											style={{ transform: `translateX(-${bestIndex * 100}%)` }}>
											{bestSlides.map((group, idx) => (
												<div className="weekly-slide" key={idx}>
													{group.map((product) => (
														<div key={product.id} className="weekly-card">
															<ProductCard product={product} />
														</div>
													))}
												</div>
											))}
										</div>
									</div>
									<button className="weekly-nav next" onClick={nextBest}>
										›
									</button>
								</div>
							</section>
						)}

						{/* 정렬 & 결과 */}
						<div className="products-toolbar">
							<div className="toolbar-left">
								<p>
									총 <strong>{sortedProducts.length}</strong> 개
								</p>
							</div>
							<div className="toolbar-right">
								<select
									value={sortOption}
									onChange={(e) => setSortOption(e.target.value)}
									className="sort-select">
									{sortOptions.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{loading ? (
							<div className="loading">상품을 불러오는 중...</div>
						) : sortedProducts.length === 0 ? (
							<div className="no-products">상품이 없습니다.</div>
						) : (
							<>
						<div className="grid grid-4 products-grid">
							{sortedProducts.map((product) => (
								<ProductCard key={product.id} product={product} />
							))}
						</div>

								{pagination.totalPages > 1 && (
									<div className="pagination">
										<button
											className="pagination-btn"
											onClick={() => handlePageChange(page - 1)}
											disabled={page === 1}>
											이전
										</button>

										<div className="pagination-numbers">
											{Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
												(num) => (
													<button
														key={num}
														className={`pagination-number ${
															num === page ? "active" : ""
														}`}
														onClick={() => handlePageChange(num)}>
														{num}
													</button>
												)
											)}
										</div>

										<button
											className="pagination-btn"
											onClick={() => handlePageChange(page + 1)}
											disabled={page === pagination.totalPages}>
											다음
										</button>
									</div>
								)}
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default Products;

