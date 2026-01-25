import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts, getBanners, getImageUrl } from "../services/api";
import "./Home.css";

const Home = () => {
	const [products, setProducts] = useState([]);
	const [hitProducts, setHitProducts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [hitLoading, setHitLoading] = useState(true);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [newVisibleCount, setNewVisibleCount] = useState(4);
	const [hitSlideIndex, setHitSlideIndex] = useState(0);
	const [popularLoading, setPopularLoading] = useState(false);
	const [popularItems, setPopularItems] = useState({});
	const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
	
	// 배너 데이터 (DB에서 로드)
	const [bannerSlides, setBannerSlides] = useState([]);
	const [categoryBanners, setCategoryBanners] = useState([]);

	// 화면 크기 감지
	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth <= 768);
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// 배너 데이터 로드
	useEffect(() => {
		const fetchBanners = async () => {
			try {
				// 메인 슬라이드 배너
				const mainRes = await getBanners('main');
				const mainBanners = (mainRes.data.banners || []).map(b => ({
					id: b.id,
					image: b.image_url,
					mobileImage: b.mobile_image_url || b.image_url,
					link: b.link_url
				}));
				setBannerSlides(mainBanners);

				// 카테고리 섹션 배너
				const catRes = await getBanners('category');
				const catBanners = (catRes.data.banners || []).map(b => ({
					slug: b.category_slug,
					title: b.title,
					subtitle: b.subtitle,
					banner: b.image_url,
					mobileBanner: b.mobile_image_url || b.image_url,
					link: b.link_url
				}));
				setCategoryBanners(catBanners);
			} catch (error) {
				console.error('Failed to fetch banners:', error);
				// 기본값 유지 (빈 배열)
			}
		};
		fetchBanners();
	}, []);

	useEffect(() => {
		fetchFeaturedProducts();
		fetchHitProducts();
	}, []);

	const fetchHitProducts = async () => {
		try {
			// 히트상품: 관리자가 수동 추가한 상품 (category=hot)
			const response = await getProducts({ category: 'hot', limit: 15 });
			setHitProducts(response.data.products || []);
		} catch (error) {
			console.error("Failed to fetch hit products:", error);
		} finally {
			setHitLoading(false);
		}
	};

	useEffect(() => {
		const slidesLen = bannerSlides.length > 0 ? bannerSlides.length : 4; // 기본 4개
		const timer = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % slidesLen);
		}, 5000);

		return () => clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bannerSlides.length]);

	const fetchFeaturedProducts = async () => {
		try {
			// 신상품: 최신 등록 순으로 30개 (백엔드에서 created_at DESC로 정렬)
			const response = await getProducts({ limit: 30 });
			setProducts(response.data.products);
		} catch (error) {
			console.error("Failed to fetch products:", error);
		} finally {
			setLoading(false);
		}
	};

	const nextSlide = () => {
		const len = bannerSlides.length > 0 ? bannerSlides.length : 4;
		setCurrentSlide((prev) => (prev + 1) % len);
	};

	const prevSlide = () => {
		const len = bannerSlides.length > 0 ? bannerSlides.length : 4;
		setCurrentSlide((prev) => (prev - 1 + len) % len);
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

	// 인기상품 중 카테고리별 BEST 섹션 (DB 배너가 없으면 기본값 사용)
	const popularSections = categoryBanners.length > 0 ? categoryBanners : [
		{
			slug: "bag",
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
			slug: "watch",
			title: "BEST Watch Collection",
			subtitle: "베스트 시계 모아보기",
			banner: "https://jpound2024.cafe24.com/images/slider/main/4_1.webp",
			mobileBanner: "https://jpound2024.cafe24.com/images/slider/main/4_1.webp"
		},
	];

	const handleLoadMoreNew = () => {
		setNewVisibleCount((prev) => Math.min(prev + 4, products.length));
	};

	const visibleNewItems = products.slice(0, newVisibleCount);
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
				// 인기상품(is_popular=true) 중 해당 카테고리 상품만 가져오기
				const results = await Promise.all(
					popularSections.map(async (section) => {
						const res = await getProducts({ popular_category: section.slug, limit: 4 });
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

	// 기본 슬라이드 배너 (DB에서 로드 전 또는 실패 시)
	const defaultBannerSlides = [
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

	const activeBannerSlides = bannerSlides.length > 0 ? bannerSlides : defaultBannerSlides;

	return (
		<div className="home">
			{/* 이미지 슬라이드 배너 */}
			<section className="hero-slider">
				<div className="slider-container">
					{activeBannerSlides.map((slide, index) => {
						const imageUrl = getImageUrl(isMobile ? slide.mobileImage : slide.image);
						const slideContent = (
							<div
								key={slide.id}
								className={`slide ${index === currentSlide ? "active" : ""}`}
								style={{ backgroundImage: isMobile ? 'none' : `url(${imageUrl})` }}>
								{isMobile && <img src={imageUrl} alt={slide.title || '배너'} />}
							</div>
						);
						
						return slide.link ? (
							<Link key={slide.id} to={slide.link} style={{ display: index === currentSlide ? 'block' : 'none' }}>
								{slideContent}
							</Link>
						) : slideContent;
					})}
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
					{activeBannerSlides.map((_, index) => (
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

			{/* HIT PRODUCTS 섹션 - 관리자가 수동 추가한 히트상품 */}
			<section className="celeb-picks">
				<div className="container">
					<div className="section-header-simple">
						<h2>
							<Link to="/products?category=hot" className="section-link">
								HIT PRODUCTS
							</Link>
						</h2>
					</div>
					{hitLoading ? (
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
				const linkUrl = section.link || `/products?category=${section.slug}`;
				return (
					<section className="popular-section" key={section.slug}>
						<Link
							to={linkUrl}
							className="popular-hero"
							style={{ backgroundImage: `url(${getImageUrl(bannerUrl)})` }}>
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
