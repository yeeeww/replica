import axios from 'axios';

const API_BASE_URL = '/api';

// Products
export const getProducts = (params) => {
  return axios.get(`${API_BASE_URL}/products`, { params });
};

export const getProduct = (id) => {
  return axios.get(`${API_BASE_URL}/products/${id}`);
};

export const createProduct = (data) => {
  return axios.post(`${API_BASE_URL}/products`, data);
};

export const updateProduct = (id, data) => {
  return axios.put(`${API_BASE_URL}/products/${id}`, data);
};

export const deleteProduct = (id) => {
  return axios.delete(`${API_BASE_URL}/products/${id}`);
};

// Categories
export const getCategories = () => {
  return axios.get(`${API_BASE_URL}/categories`);
};

export const createCategory = (data) => {
  return axios.post(`${API_BASE_URL}/categories`, data);
};

export const updateCategory = (id, data) => {
  return axios.put(`${API_BASE_URL}/categories/${id}`, data);
};

export const deleteCategory = (id) => {
  return axios.delete(`${API_BASE_URL}/categories/${id}`);
};

// Orders
export const getOrders = (params) => {
  return axios.get(`${API_BASE_URL}/orders`, { params });
};

export const getOrder = (id) => {
  return axios.get(`${API_BASE_URL}/orders/${id}`);
};

export const createOrder = (data) => {
  return axios.post(`${API_BASE_URL}/orders`, data);
};

export const updateOrderStatus = (id, status) => {
  return axios.patch(`${API_BASE_URL}/orders/${id}/status`, { status });
};

