import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";
axios.defaults.baseURL = API_BASE_URL;

// 업로드 이미지 URL을 절대 경로로 변환
export const getImageUrl = (url) => {
  if (!url) return 'https://via.placeholder.com/300';
  // 이미 절대 URL이면 그대로 반환
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // /uploads/로 시작하면 백엔드 서버 주소 붙이기
  if (url.startsWith('/uploads/')) {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://13.124.213.199:5000';
    return `${backendUrl}${url}`;
  }
  return url;
};

// Products
export const getProducts = (params) => axios.get(`/products`, { params });
export const getProduct = (id) => axios.get(`/products/${id}`);
export const createProduct = (data) => axios.post(`/products`, data);
export const updateProduct = (id, data) => axios.put(`/products/${id}`, data);
export const deleteProduct = (id) => axios.delete(`/products/${id}`);

// Categories
export const getCategories = (params) => axios.get(`/categories`, { params });
export const createCategory = (data) => axios.post(`/categories`, data);
export const updateCategory = (id, data) =>
	axios.put(`/categories/${id}`, data);
export const deleteCategory = (id) => axios.delete(`/categories/${id}`);

// Orders
export const getOrders = (params) => axios.get(`/orders`, { params });
export const getOrder = (id) => axios.get(`/orders/${id}`);
export const createOrder = (data) => axios.post(`/orders`, data);
export const updateOrderStatus = (id, data) =>
	axios.patch(`/orders/${id}/status`, data);

// Admin - Users
export const getUsers = (params) => axios.get(`/admin/users`, { params });
export const getUser = (id) => axios.get(`/admin/users/${id}`);
export const updateUser = (id, data) => axios.put(`/admin/users/${id}`, data);
export const updateUserPoints = (id, data) => axios.post(`/admin/users/${id}/points`, data);

// Admin - Featured Products (추천/히트/인기)
export const getFeaturedProducts = (type) => axios.get(`/admin/featured/${type}`);
export const searchProductsForFeatured = (params) => axios.get(`/admin/featured-search`, { params });
export const addFeaturedProduct = (type, productId) => axios.post(`/admin/featured/${type}/${productId}`);
export const removeFeaturedProduct = (type, productId) => axios.delete(`/admin/featured/${type}/${productId}`);
export const updateFeaturedOrder = (type, productIds) => axios.put(`/admin/featured/${type}/order`, { productIds });

// Notices (공지사항)
export const getNotices = (params) => axios.get(`/notices`, { params });
export const getNotice = (id) => axios.get(`/notices/${id}`);
export const createNotice = (data) => axios.post(`/notices`, data);
export const updateNotice = (id, data) => axios.put(`/notices/${id}`, data);
export const deleteNotice = (id) => axios.delete(`/notices/${id}`);

// Reviews (구매평)
export const getProductReviews = (productId, params) => 
  axios.get(`/reviews/product/${productId}`, { params });
export const createReview = (productId, data) => 
  axios.post(`/reviews/product/${productId}`, data);
export const updateReview = (id, data) => axios.put(`/reviews/${id}`, data);
export const deleteReview = (id) => axios.delete(`/reviews/${id}`);

// Crawler (크롤링)
export const startCrawl = (data) => axios.post(`/admin/crawl/start`, data);
export const stopCrawl = () => axios.post(`/admin/crawl/stop`);
export const getCrawlStatus = () => axios.get(`/admin/crawl/status`);
export const clearCrawlLogs = () => axios.post(`/admin/crawl/clear-logs`);

// Upload (파일 업로드)
export const uploadImage = (file) => {
  const formData = new FormData();
  formData.append('image', file);
  return axios.post(`/upload/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const uploadImages = (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('images', file));
  return axios.post(`/upload/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
