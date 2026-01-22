import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUsers } from '../../services/api';
import { formatPrice } from '../../utils/format';
import './AdminDashboard.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getUsers({
        search: params.search !== undefined ? params.search : searchText || undefined,
        role: params.role !== undefined ? params.role : roleFilter || undefined,
        page: params.page || 1,
        limit: 50
      });
      setUsers(response.data.users || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers({ search: searchText, role: roleFilter, page: 1 });
  };

  const handleReset = () => {
    setSearchText('');
    setRoleFilter('');
    fetchUsers({ search: '', role: '', page: 1 });
  };

  const handlePageChange = (newPage) => {
    fetchUsers({ page: newPage });
  };

  if (loading && users.length === 0) {
    return <div className="loading">회원 목록을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>회원 관리</h1>
          <span style={{ fontSize: '14px', color: '#666', marginLeft: '8px' }}>
            총 {pagination.total}명
          </span>
        </div>
      </div>

      {/* 검색 필터 */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        marginBottom: '20px', 
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                검색어
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="이메일, 이름, 연락처"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                권한
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">전체</option>
                <option value="user">일반회원</option>
                <option value="admin">관리자</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                검색
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </form>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>이메일</th>
            <th>이름</th>
            <th>연락처</th>
            <th>적립금</th>
            <th>주문수</th>
            <th>총 구매액</th>
            <th>권한</th>
            <th>상태</th>
            <th>가입일</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>
                <Link 
                  to={`/admin/users/${user.id}`}
                  style={{ color: '#007bff', textDecoration: 'none' }}
                >
                  {user.email}
                </Link>
              </td>
              <td>{user.name}</td>
              <td>{user.phone || '-'}</td>
              <td style={{ color: '#28a745', fontWeight: '500' }}>
                {(user.points || 0).toLocaleString()}P
              </td>
              <td>{user.order_count || 0}건</td>
              <td>{formatPrice(user.total_spent || 0)}</td>
              <td>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: user.role === 'admin' ? '#dc3545' : '#6c757d',
                  color: 'white'
                }}>
                  {user.role === 'admin' ? '관리자' : '일반회원'}
                </span>
              </td>
              <td>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: user.is_active !== false ? '#28a745' : '#dc3545',
                  color: 'white'
                }}>
                  {user.is_active !== false ? '활성' : '비활성'}
                </span>
              </td>
              <td style={{ fontSize: '13px' }}>
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td>
                <Link
                  to={`/admin/users/${user.id}`}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    textDecoration: 'none'
                  }}
                >
                  상세보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          회원이 없습니다.
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '8px', 
          marginTop: '24px',
          padding: '16px'
        }}>
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: pagination.page === 1 ? '#f5f5f5' : 'white',
              cursor: pagination.page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            이전
          </button>
          
          <span style={{ padding: '8px 16px', color: '#666' }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: pagination.page === pagination.totalPages ? '#f5f5f5' : 'white',
              cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
