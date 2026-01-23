import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "/api";
axios.defaults.baseURL = API_BASE;

const AuthContext = createContext();

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
};

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (token) {
			axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
			fetchCurrentUser();
		} else {
			setLoading(false);
		}
	}, []);

	const fetchCurrentUser = async () => {
		try {
			const response = await axios.get("/auth/me");
			setUser(response.data.user);
		} catch (error) {
			console.error("Failed to fetch user:", error);
			localStorage.removeItem("token");
			delete axios.defaults.headers.common["Authorization"];
		} finally {
			setLoading(false);
		}
	};

	const login = async (email, password) => {
		const response = await axios.post("/auth/login", {
			email,
			password,
		});
		const { token, user } = response.data;
		localStorage.setItem("token", token);
		axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
		setUser(user);
		return response.data;
	};

	const register = async (email, password, name, phone, additionalData = {}) => {
		const response = await axios.post("/auth/register", {
			email,
			password,
			name,
			phone,
			...additionalData, // gender, address, birthDate, referralSource, customsNumber, referrer
		});
		const { token, user } = response.data;
		localStorage.setItem("token", token);
		axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
		setUser(user);
		return response.data;
	};

	const logout = () => {
		localStorage.removeItem("token");
		delete axios.defaults.headers.common["Authorization"];
		setUser(null);
	};

	// 사용자 정보 새로고침 (적립금 등 업데이트 시 사용)
	const refreshUser = async () => {
		try {
			const response = await axios.get("/auth/me");
			setUser(response.data.user);
			return response.data.user;
		} catch (error) {
			console.error("Failed to refresh user:", error);
			return null;
		}
	};

	// 로컬에서 포인트만 업데이트 (API 호출 없이)
	const updateUserPoints = (newPoints) => {
		if (user) {
			setUser({ ...user, points: newPoints });
		}
	};

	const value = {
		user,
		loading,
		login,
		register,
		logout,
		refreshUser,
		updateUserPoints,
		isAuthenticated: !!user,
		isAdmin: user?.role === "admin",
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
