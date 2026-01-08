import React, { useEffect, useState } from 'react';
import { getProducts, getOrders, getCategories } from '../../services/api';

const AdminHome = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalCategories: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [productsRes, ordersRes, categoriesRes] = await Promise.all([
        getProducts({ limit: 1000 }),
        getOrders({ limit: 1000 }),
        getCategories()
      ]);

      const pendingOrders = ordersRes.data.orders.filter(
        order => order.status === 'pending'
      ).length;

      setStats({
        totalProducts: productsRes.data.pagination.total,
        totalOrders: ordersRes.data.pagination.total,
        totalCategories: categoriesRes.data.categories.length,
        pendingOrders
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">통계를 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>대시보드</h1>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <h3>전체 상품</h3>
          <p>{stats.totalProducts}</p>
        </div>
        <div className="admin-stat-card">
          <h3>전체 주문</h3>
          <p>{stats.totalOrders}</p>
        </div>
        <div className="admin-stat-card">
          <h3>카테고리</h3>
          <p>{stats.totalCategories}</p>
        </div>
        <div className="admin-stat-card">
          <h3>대기중인 주문</h3>
          <p>{stats.pendingOrders}</p>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '32px', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
          관리자 패널에 오신 것을 환영합니다
        </h2>
        <p style={{ color: 'var(--secondary-color)', lineHeight: '1.8' }}>
          왼쪽 메뉴에서 상품, 카테고리, 주문을 관리할 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default AdminHome;

