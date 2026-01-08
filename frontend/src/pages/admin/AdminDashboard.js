import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <h2>관리자 패널</h2>
        <nav className="admin-nav">
          <Link 
            to="/admin" 
            className={isActive('/admin') && location.pathname === '/admin' ? 'active' : ''}
          >
            대시보드
          </Link>
          <Link 
            to="/admin/products" 
            className={isActive('/admin/products') ? 'active' : ''}
          >
            상품 관리
          </Link>
          <Link 
            to="/admin/categories" 
            className={isActive('/admin/categories') ? 'active' : ''}
          >
            카테고리 관리
          </Link>
          <Link 
            to="/admin/orders" 
            className={isActive('/admin/orders') ? 'active' : ''}
          >
            주문 관리
          </Link>
        </nav>
        <Link to="/" className="back-to-shop">
          ← 쇼핑몰로 돌아가기
        </Link>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;

