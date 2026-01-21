import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/api";
import "./Home.css";

const Home = () => {
	const [products, setProducts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [newVisibleCount, setNewVisibleCount] = useState(4);
	const [hitSlideIndex, setHitSlideIndex] = useState(0);
	const [popularLoading, setPopularLoading] = useState(false);
	const [popularItems, setPopularItems] = useState({});
	const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

	// 화면 크기 감지
	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth <= 768);
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const bannerSlides = [
		{
			id: 1,
			image: "https://jpound2024.cafe24.com/images/slider/main/1_2.webp",
			mobileImage: "https://jpound2024.cafe24.com/images/slider/main/1_2_m.webp",
		},
		{
			id: 2,
			image: "https://jpound2024.cafe24.com/images/slider/main/7_4.webp",
			mobileImage: "https://jpound2024.cafe24.com/images/slider/main/7_4_m.webp",
		},
		{
			id: 3,
			image: "https://jpound2024.cafe24.com/images/slider/main/1_898.jpg",
			mobileImage: "https://jpound2024.cafe24.com/images/slider/main/1_898_m.jpg",
		},
		{
			id: 4,
			image: "https://jpound2024.cafe24.com/images/slider/main/1_1.webp",
			mobileImage: "https://jpound2024.cafe24.com/images/slider/main/1_88_m.webp",
		},
	];

	useEffect(() => {
		fetchFeaturedProducts();
	}, []);

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
		}, 5000);

		return () => clearInterval(timer);
	}, [bannerSlides.length]);

	const fetchFeaturedProducts = async () => {
		try {
			const response = await getProducts({ limit: 20 });
			setProducts(response.data.products);
		} catch (error) {
			console.error("Failed to fetch products:", error);
		} finally {
			setLoading(false);
		}
	};

	const nextSlide = () => {
		setCurrentSlide((prev) => (prev + 1) % bannerSlides.length);
	};

	const prevSlide = () => {
		setCurrentSlide(
			(prev) => (prev - 1 + bannerSlides.length) % bannerSlides.length
		);
	};

	const goToSlide = (index) => {
		setCurrentSlide(index);
	};

	const categoryCards = [
		{
			slug: "recommend",
			title: "RECOMMENDED",
			subtitle: "추천상품관",
			image:
				"https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80",
		},
		{
			slug: "men",
			title: "MEN",
			subtitle: "하이엔드 남성관",
			image:
				"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
		},
		{
			slug: "women",
			title: "WOMEN",
			subtitle: "하이엔드 여성관",
			image:
				"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
		},
		{
			slug: "hot",
			title: "HIT PRODUCTS",
			subtitle: "히트상품관",
			image:
				"https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?auto=format&fit=crop&w=800&q=80",
		},
		{
			slug: "notice",
			title: "NOTICE",
			subtitle: "공지사항",
			image:
				"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
		},
	];

	const popularSections = [
		{
			slug: "bags",
			title: "BEST Bags Collection",
			subtitle: "베스트 가방 모아보기",
			banner: "https://jpound2024.cafe24.com/images/slider/main/9_9.webp",
			mobileBanner: "https://jpound2024.cafe24.com/images/slider/main/9_9_m.webp"
		},
		{
			slug: "clothing",
			title: "BEST Clothing Collection",
			subtitle: "베스트 의류 모아보기",
			banner: "https://jpound2024.cafe24.com/images/slider/main/2_3.webp",
			mobileBanner: "https://jpound2024.cafe24.com/images/slider/main/2_3_m.webp"
		},
		{
			slug: "shoes",
			title: "BEST Shoes Collection",
			subtitle: "베스트 신발 모아보기",
			banner: "https://jpound2024.cafe24.com/images/slider/main/5_4.webp",
			mobileBanner: "https://jpound2024.cafe24.com/images/slider/main/5_5.webp"
		},
		{
			slug: "acc",
			title: "BEST ACC Collection",
			subtitle: "베스트 액세서리 모아보기",
			banner: "https://jpound2024.cafe24.com/images/slider/main/4_1.webp",
			mobileBanner: "https://jpound2024.cafe24.com/images/slider/main/4_1.webp"
		},
	];

	const handleLoadMoreNew = () => {
		setNewVisibleCount((prev) => Math.min(prev + 4, products.length));
	};

	const visibleNewItems = products.slice(0, newVisibleCount);
	const hitProducts = products.slice(0, 15);
	const hitSlides = [];
	for (let i = 0; i < hitProducts.length; i += 5) {
		hitSlides.push(hitProducts.slice(i, i + 5));
	}

	const nextHitSlide = () => {
		if (hitSlides.length === 0) return;
		setHitSlideIndex((prev) => (prev + 1) % hitSlides.length);
	};

	const prevHitSlide = () => {
		if (hitSlides.length === 0) return;
		setHitSlideIndex(
			(prev) => (prev - 1 + hitSlides.length) % hitSlides.length
		);
	};

	useEffect(() => {
		if (hitSlides.length === 0) return;
		const timer = setInterval(() => {
			setHitSlideIndex((prev) => (prev + 1) % hitSlides.length);
		}, 4000);
		return () => clearInterval(timer);
	}, [hitSlides.length]);

	useEffect(() => {
		const fetchPopular = async () => {
			try {
				setPopularLoading(true);
				const results = await Promise.all(
					popularSections.map(async (section) => {
						const res = await getProducts({ category: section.slug, limit: 4 });
						return { slug: section.slug, items: res.data.products || [] };
					})
				);
				const map = {};
				results.forEach((r) => {
					map[r.slug] = r.items;
				});
				setPopularItems(map);
			} catch (error) {
				console.error("Failed to fetch popular products:", error);
			} finally {
				setPopularLoading(false);
			}
		};

		fetchPopular();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="home">
			{/* 이미지 슬라이드 배너 */}
			<section className="hero-slider">
				<div className="slider-container">
					{bannerSlides.map((slide, index) => (
						<div
							key={slide.id}
							className={`slide ${index === currentSlide ? "active" : ""}`}
							style={{ backgroundImage: `url(${isMobile ? slide.mobileImage : slide.image})` }}>
						</div>
					))}
				</div>

				{/* 슬라이드 컨트롤 */}
				<button className="slider-btn prev" onClick={prevSlide}>
					‹
				</button>
				<button className="slider-btn next" onClick={nextSlide}>
					›
				</button>

				{/* 슬라이드 인디케이터 */}
				<div className="slider-indicators">
					{bannerSlides.map((_, index) => (
						<button
							key={index}
							className={`indicator ${index === currentSlide ? "active" : ""}`}
							onClick={() => goToSlide(index)}
						/>
					))}
				</div>
			</section>

			{/* 카테고리 아이콘 섹션 */}
			<section className="category-icons">
				<div className="container">
					<div className="category-grid">
						{categoryCards.map((card) => (
							<Link
								key={card.slug}
								to={`/products?category=${card.slug}`}
								className="category-icon-card">
								<div
									className="category-icon-img-home"
									style={{ backgroundImage: `url(${card.image})` }}>
									<span className="category-icon-text">{card.title}</span>
								</div>
								<p>{card.subtitle}</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* NEW ITEM 섹션 */}
			<section className="new-items">
				<div className="container">
					<div className="section-header-simple">
						<h2>NEW ITEM - 신상 제품</h2>
					</div>
					{loading ? (
						<div className="loading">상품을 불러오는 중...</div>
					) : (
						<>
							<div className="new-grid">
								{visibleNewItems.map((product) => (
									<div key={product.id} className="new-card">
										<Link to={`/products/${product.id}`}>
											<div className="new-card-image">
												<img
													src={product.image_url}
													alt={product.name}
													onError={(e) => {
														e.target.style.visibility = "hidden";
													}}
												/>
											</div>
											<div className="new-card-info">
												<p className="new-card-name">{product.name}</p>
												<p className="new-card-price">
													{product.price?.toLocaleString()}원
												</p>
											</div>
										</Link>
									</div>
								))}
							</div>
							{products.length > newVisibleCount && (
								<div className="section-more">
									<button className="btn-load-more" onClick={handleLoadMoreNew}>
										더보기
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</section>

			{/* HIT PRODUCTS 섹션 */}
			<section className="celeb-picks">
				<div className="container">
					<div className="section-header-simple">
						<h2>
							<Link to="/products?category=hot" className="section-link">
								HIT PRODUCTS
							</Link>
						</h2>
					</div>
					{loading ? (
						<div className="loading">상품을 불러오는 중...</div>
					) : (
						<div className="celeb-carousel">
							{hitSlides.length === 0 ? (
								<div className="loading">상품이 없습니다.</div>
							) : (
								<div className="hit-slider-wrapper">
									<button className="hit-nav-btn prev" onClick={prevHitSlide}>
										‹
									</button>
									<div
										className="celeb-grid"
										style={{
											transform: `translateX(-${hitSlideIndex * 100}%)`,
										}}>
										{hitSlides.map((group, slideIdx) => (
											<div key={slideIdx} className="celeb-slide">
												{group.map((product) => (
													<div key={product.id} className="celeb-card">
														<Link to={`/products/${product.id}`}>
															<div className="celeb-image">
																<img
																	src={product.image_url}
																	alt={product.name}
																/>
															</div>
															<div className="celeb-info">
																<p className="celeb-product-name">
																	{product.name}
																</p>
																<p className="celeb-price">
																	{product.price?.toLocaleString()}원
																</p>
															</div>
														</Link>
													</div>
												))}
											</div>
										))}
									</div>
									<button className="hit-nav-btn next" onClick={nextHitSlide}>
										›
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</section>

			{/* 인기 카테고리별 BEST 섹션 */}
			{popularSections.map((section) => {
				const items = popularItems[section.slug] || [];
				const bannerUrl = isMobile ? section.mobileBanner : section.banner;
				return (
					<section className="popular-section" key={section.slug}>
						<Link
							to={`/products?category=${section.slug}`}
							className="popular-hero"
							style={{ backgroundImage: `url(${bannerUrl})` }}>
						</Link>
						<div className="container">
							<div className="popular-body">
								<div className="popular-head">
									<h4>{section.title}</h4>
									<p>{section.subtitle}</p>
								</div>
								{popularLoading ? (
									<div className="loading">상품을 불러오는 중...</div>
								) : (
									<>
										<div className="popular-grid">
											{items.slice(0, 4).map((product) => (
												<div key={product.id} className="popular-card">
													<Link to={`/products/${product.id}`}>
														<div className="popular-card-image">
															<img
																src={product.image_url}
																alt={product.name}
																onError={(e) => {
																	e.target.style.visibility = "hidden";
																}}
															/>
														</div>
														<div className="popular-card-info">
															<p className="popular-card-name">
																{product.name}
															</p>
															<p className="popular-card-price">
																{product.price?.toLocaleString()}원
															</p>
														</div>
													</Link>
												</div>
											))}
										</div>
										<div className="section-more">
											<Link
												to={`/products?category=${section.slug}`}
												className="btn-load-more">
												더보기
											</Link>
										</div>
									</>
								)}
							</div>
						</div>
					</section>
				);
			})}
		</div>
	);
};

export default Home;
