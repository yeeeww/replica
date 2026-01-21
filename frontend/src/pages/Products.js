import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getProducts } from "../services/api";
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

	const category = searchParams.get("category") || "";
	const search = searchParams.get("search") || "";
	const page = parseInt(searchParams.get("page") || "1");

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

	// 카테고리 아이콘 데이터
	const categoryIcons = [
		{ label: "하이엔드 의류", slug: "men-clothing", image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=200&h=200&fit=crop" },
		{ label: "하이엔드 가방", slug: "men-bag", image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=200&h=200&fit=crop" },
		{ label: "하이엔드 신발", slug: "men-shoes", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop" },
		{ label: "하이엔드 시계", slug: "men-watch", image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=200&h=200&fit=crop" },
		{ label: "하이엔드 지갑", slug: "men-wallet", image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=200&h=200&fit=crop" },
		{ label: "하이엔드 벨트", slug: "men-belt", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop" },
		{ label: "하이엔드 모자", slug: "men-hat", image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=200&h=200&fit=crop" },
		{ label: "하이엔드 ACC", slug: "men-accessory", image: "https://images.unsplash.com/photo-1611923134239-b9be5816e23c?w=200&h=200&fit=crop" },
	];

	const subcategories = {
		men: [
			{ label: "Show All", slug: "men" },
			{ label: "가방", slug: "men-bag" },
			{ label: "지갑", slug: "men-wallet" },
			{ label: "시계", slug: "men-watch" },
			{ label: "신발", slug: "men-shoes" },
			{ label: "벨트", slug: "men-belt" },
			{ label: "악세서리", slug: "men-accessory" },
			{ label: "모자", slug: "men-hat" },
			{ label: "의류", slug: "men-clothing" },
			{ label: "선글라스&안경", slug: "men-glasses" },
			{ label: "기타", slug: "men-etc" },
		],
		women: [
			{ label: "전체", slug: "women" },
			{ label: "가방", slug: "women-bag" },
			{ label: "지갑", slug: "women-wallet" },
			{ label: "시계", slug: "women-watch" },
			{ label: "신발", slug: "women-shoes" },
			{ label: "벨트", slug: "women-belt" },
			{ label: "악세서리", slug: "women-accessory" },
			{ label: "모자", slug: "women-hat" },
			{ label: "의류", slug: "women-clothing" },
			{ label: "선글라스&안경", slug: "women-glasses" },
			{ label: "기타", slug: "women-etc" },
		],
		domestic: [
			{ label: "전체", slug: "domestic" },
			{ label: "가방&지갑", slug: "domestic-bag-wallet" },
			{ label: "의류", slug: "domestic-clothing" },
			{ label: "신발", slug: "domestic-shoes" },
			{ label: "모자", slug: "domestic-hat" },
			{ label: "악세사리", slug: "domestic-accessory" },
			{ label: "시계", slug: "domestic-watch" },
			{ label: "패션잡화", slug: "domestic-fashion-acc" },
			{ label: "생활&주방용품", slug: "domestic-home-kitchen" },
			{ label: "벨트", slug: "domestic-belt" },
			{ label: "향수", slug: "domestic-perfume" },
			{ label: "라이터", slug: "domestic-lighter" },
		],
		bags: [
			{ label: "전체", slug: "bags" },
			{ label: "백팩", slug: "bags-backpack" },
			{ label: "크로스백", slug: "bags-cross" },
			{ label: "지갑", slug: "bags-wallet" },
			{ label: "토트/쇼퍼", slug: "bags-tote" },
			{ label: "클러치", slug: "bags-clutch" },
			{ label: "미니백", slug: "bags-mini" },
		],
		clothing: [
			{ label: "전체", slug: "clothing" },
			{ label: "아우터", slug: "clothing-outer" },
			{ label: "탑/티셔츠", slug: "clothing-top" },
			{ label: "셔츠", slug: "clothing-shirt" },
			{ label: "니트", slug: "clothing-knit" },
			{ label: "후드/맨투맨", slug: "clothing-hood" },
			{ label: "팬츠", slug: "clothing-pants" },
			{ label: "드레스", slug: "clothing-dress" },
		],
		shoes: [
			{ label: "전체", slug: "shoes" },
			{ label: "스니커즈", slug: "shoes-sneakers" },
			{ label: "로퍼", slug: "shoes-loafer" },
			{ label: "부츠", slug: "shoes-boots" },
			{ label: "샌들/슬리퍼", slug: "shoes-sandal" },
			{ label: "러닝/트레이너", slug: "shoes-runner" },
		],
		acc: [
			{ label: "전체", slug: "acc" },
			{ label: "시계", slug: "acc-watch" },
			{ label: "모자", slug: "acc-cap" },
			{ label: "벨트", slug: "acc-belt" },
			{ label: "선글라스", slug: "acc-sunglasses" },
			{ label: "주얼리", slug: "acc-jewelry" },
			{ label: "기타", slug: "acc-etc" },
		],
		popular: [
			{ label: "전체", slug: "popular" },
			{ label: "가방", slug: "popular-bags" },
			{ label: "의류", slug: "popular-clothing" },
			{ label: "신발", slug: "popular-shoes" },
			{ label: "ACC", slug: "popular-acc" },
		],
	};

	const sortOptions = [
		{ value: "recent", label: "등록순" },
		{ value: "popular", label: "인기순" },
		{ value: "price-asc", label: "낮은가격순" },
		{ value: "price-desc", label: "높은가격순" },
		{ value: "review", label: "상품평 많은순" },
		{ value: "name-asc", label: "이름순" },
		{ value: "name-desc", label: "이름역순" },
	];

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
			setBestProducts(list.slice(0, 12));
			setPagination(response.data.pagination);
		} catch (error) {
			console.error("Failed to fetch products:", error);
		} finally {
			setLoading(false);
		}
	};

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

			{/* 카테고리 아이콘 그리드 (PC/모바일 공통) */}
			<div className="products-cat-section">
				<div className="products-cat-grid">
					{categoryIcons.map((cat) => (
						<button
							key={cat.slug}
							className={`products-cat-item ${category === cat.slug ? "active" : ""}`}
							onClick={() => handleCategoryChange(cat.slug)}>
							<div className="products-cat-img">
								<img src={cat.image} alt={cat.label} />
							</div>
							<span>{cat.label}</span>
						</button>
					))}
				</div>
			</div>

			<div className="container">
				{/* 하위 카테고리 바 (있는 경우만) */}
				{(subcategories[deriveMain] || []).length > 0 && (
					<div className="subcategory-bar">
						{(subcategories[deriveMain] || []).map((item) => (
							<button
								key={item.slug}
								className={`subcategory-btn ${category === item.slug ? "active" : ""} ${
									!category && item.label === "Show All" ? "active" : ""
								}`}
								onClick={() =>
									handleCategoryChange(item.slug === deriveMain ? deriveMain : item.slug)
								}>
								{item.label}
							</button>
						))}
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

