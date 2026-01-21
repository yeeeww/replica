import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";
axios.defaults.baseURL = API_BASE_URL;

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

// Admin
export const getUsers = () => axios.get(`/admin/users`);

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
