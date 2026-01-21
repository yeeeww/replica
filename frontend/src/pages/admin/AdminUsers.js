import React, { useEffect, useState } from 'react';
import { getUsers } from '../../services/api';
import './AdminDashboard.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">회원 목록을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>회원 관리</h1>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>이메일</th>
            <th>이름</th>
            <th>권한</th>
            <th>가입일</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.email}</td>
              <td>{user.name}</td>
              <td>{user.role}</td>
              <td>{new Date(user.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          회원이 없습니다.
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
