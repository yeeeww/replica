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
export const getCategories = () => axios.get(`/categories`);
export const createCategory = (data) => axios.post(`/categories`, data);
export const updateCategory = (id, data) =>
	axios.put(`/categories/${id}`, data);
export const deleteCategory = (id) => axios.delete(`/categories/${id}`);

// Orders
export const getOrders = (params) => axios.get(`/orders`, { params });
export const getOrder = (id) => axios.get(`/orders/${id}`);
export const createOrder = (data) => axios.post(`/orders`, data);
export const updateOrderStatus = (id, status) =>
	axios.patch(`/orders/${id}/status`, { status });
