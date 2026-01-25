import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, updateOrderStatus } from '../../services/api';
import { formatPrice, formatDate, getOrderStatusText, getOrderStatusColor } from '../../utils/format';

// 택배사 목록
const SHIPPING_CARRIERS = [
  { code: '', name: '택배사 선택' },
  { code: 'cj', name: 'CJ대한통운' },
  { code: 'hanjin', name: '한진택배' },
  { code: 'lotte', name: '롯데택배' },
  { code: 'logen', name: '로젠택배' },
  { code: 'post', name: '우체국택배' },
  { code: 'ems', name: 'EMS' },
  { code: 'fedex', name: 'FedEx' },
  { code: 'ups', name: 'UPS' },
  { code: 'dhl', name: 'DHL' },
  { code: 'sf', name: 'SF익스프레스' },
  { code: 'etc', name: '기타' },
];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingInputs, setTrackingInputs] = useState({});
  const [carrierInputs, setCarrierInputs] = useState({});
  
  // 검색 필터 상태
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getOrders({ 
        limit: 50,
        search: params.search || searchText || undefined,
        status: params.status !== undefined ? params.status : statusFilter || undefined,
        startDate: params.startDate !== undefined ? params.startDate : startDate || undefined,
        endDate: params.endDate !== undefined ? params.endDate : endDate || undefined,
        page: params.page || 1
      });
      const fetchedOrders = response.data.orders;
      setOrders(fetchedOrders);
      setPagination(response.data.pagination);
      
      const trackingMap = {};
      const carrierMap = {};
      fetchedOrders.forEach((order) => {
        trackingMap[order.id] = order.tracking_number || '';
        carrierMap[order.id] = order.shipping_carrier || '';
      });
      setTrackingInputs(trackingMap);
      setCarrierInputs(carrierMap);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders({ search: searchText, status: statusFilter, startDate, endDate, page: 1 });
  };

  const handleReset = () => {
    setSearchText('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    fetchOrders({ search: '', status: '', startDate: '', endDate: '', page: 1 });
  };

  const handlePageChange = (newPage) => {
    fetchOrders({ page: newPage });
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const trackingNumber = trackingInputs[orderId] || null;
      const shippingCarrier = carrierInputs[orderId] || null;
      await updateOrderStatus(orderId, { status: newStatus, tracking_number: trackingNumber, shipping_carrier: shippingCarrier });
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus, tracking_number: trackingNumber, shipping_carrier: shippingCarrier } : order
      ));
      alert('주문 상태가 변경되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '상태 변경에 실패했습니다.');
    }
  };

  const handleTrackingChange = (orderId, value) => {
    setTrackingInputs((prev) => ({
      ...prev,
      [orderId]: value
    }));
  };

  const handleCarrierChange = (orderId, value) => {
    setCarrierInputs((prev) => ({
      ...prev,
      [orderId]: value
    }));
  };

  const handleTrackingSave = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    try {
      const trackingNumber = (trackingInputs[orderId] || '').trim();
      const shippingCarrier = carrierInputs[orderId] || null;
      await updateOrderStatus(orderId, { status: order.status, tracking_number: trackingNumber || null, shipping_carrier: shippingCarrier });
      setOrders(orders.map((o) =>
        o.id === orderId ? { ...o, tracking_number: trackingNumber || null, shipping_carrier: shippingCarrier } : o
      ));
      alert('운송장 정보가 저장되었습니다.');
    } catch (error) {
      alert(error.response?.data?.message || '운송장 저장에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">주문을 불러오는 중...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>주문 관리</h1>
        <span style={{ fontSize: '14px', color: '#666', marginLeft: '16px' }}>
          총 {pagination.total}건
        </span>
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
            {/* 검색어 */}
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                검색어
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="주문번호, 수령인, 연락처, 주문자, 상품명"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 주문 상태 */}
            <div style={{ minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                주문 상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">전체</option>
                <option value="pending">주문 접수</option>
                <option value="processing">처리중</option>
                <option value="shipped">배송중</option>
                <option value="delivered">배송 완료</option>
                <option value="cancelled">취소됨</option>
              </select>
            </div>

            {/* 시작일 */}
            <div style={{ minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 종료일 */}
            <div style={{ minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* 버튼 */}
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
            <th>주문번호</th>
            <th>주문일시</th>
            <th>주문자</th>
            <th>수령인</th>
            <th>상품</th>
            <th>금액</th>
            <th>상태</th>
            <th>택배사</th>
            <th>운송장 번호</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link 
                  to={`/admin/orders/${order.id}`}
                  style={{ color: 'var(--primary-color)', fontWeight: '500' }}
                >
                  #{order.id}
                </Link>
              </td>
              <td>{formatDate(order.created_at)}</td>
              <td>
                <div style={{ fontSize: '13px' }}>
                  <div>{order.user_name || '-'}</div>
                  <div style={{ color: '#888', fontSize: '11px' }}>{order.user_email || ''}</div>
                </div>
              </td>
              <td>
                <div style={{ fontSize: '13px' }}>
                  <div>{order.shipping_name}</div>
                  <div style={{ color: '#888', fontSize: '11px' }}>{order.shipping_phone}</div>
                </div>
              </td>
              <td>
                <div style={{ 
                  maxWidth: '200px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  fontSize: '13px'
                }} title={order.product_names}>
                  {order.product_names || '-'}
                </div>
              </td>
              <td>
                <div style={{ fontSize: '13px' }}>
                  {order.used_points > 0 ? (
                    <>
                      <div style={{ color: '#999', textDecoration: 'line-through', fontSize: '11px' }}>
                        {formatPrice(order.total_amount)}
                      </div>
                      <div style={{ color: '#007bff', fontWeight: '600' }}>
                        {formatPrice(order.total_amount - order.used_points)}
                      </div>
                      <div style={{ color: '#dc3545', fontSize: '11px' }}>
                        (-{order.used_points.toLocaleString()}P)
                      </div>
                    </>
                  ) : (
                    <div style={{ fontWeight: '500' }}>{formatPrice(order.total_amount)}</div>
                  )}
                </div>
              </td>
              <td>
                <span style={{ color: getOrderStatusColor(order.status) }}>
                  {getOrderStatusText(order.status)}
                </span>
              </td>
              <td>
                <select
                  value={carrierInputs[order.id] || ''}
                  onChange={(e) => handleCarrierChange(order.id, e.target.value)}
                  style={{
                    padding: '6px 8px',
                    fontSize: '13px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    minWidth: '100px'
                  }}
                >
                  {SHIPPING_CARRIERS.map((carrier) => (
                    <option key={carrier.code} value={carrier.code}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={trackingInputs[order.id] || ''}
                    onChange={(e) => handleTrackingChange(order.id, e.target.value)}
                    placeholder="운송장 번호 입력"
                    style={{
                      flex: '1 1 auto',
                      padding: '6px 8px',
                      fontSize: '13px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      minWidth: '120px'
                    }}
                  />
                  <button
                    onClick={() => handleTrackingSave(order.id)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '13px',
                      background: 'var(--primary-color)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    저장
                  </button>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="pending">주문 접수</option>
                    <option value="processing">처리중</option>
                    <option value="shipped">배송중</option>
                    <option value="delivered">배송 완료</option>
                    <option value="cancelled">취소됨</option>
                  </select>
                  <Link
                    to={`/admin/orders/${order.id}`}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    상세보기
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--secondary-color)' }}>
          주문 내역이 없습니다.
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
              cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
              color: pagination.page === 1 ? '#999' : '#333'
            }}
          >
            이전
          </button>
          
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter(num => {
              const current = pagination.page;
              return num === 1 || num === pagination.totalPages || 
                     (num >= current - 2 && num <= current + 2);
            })
            .map((num, idx, arr) => (
              <React.Fragment key={num}>
                {idx > 0 && arr[idx - 1] !== num - 1 && (
                  <span style={{ padding: '8px 4px', color: '#999' }}>...</span>
                )}
                <button
                  onClick={() => handlePageChange(num)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid',
                    borderColor: num === pagination.page ? '#007bff' : '#ddd',
                    borderRadius: '4px',
                    backgroundColor: num === pagination.page ? '#007bff' : 'white',
                    color: num === pagination.page ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: num === pagination.page ? '600' : '400'
                  }}
                >
                  {num}
                </button>
              </React.Fragment>
            ))}
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: pagination.page === pagination.totalPages ? '#f5f5f5' : 'white',
              cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer',
              color: pagination.page === pagination.totalPages ? '#999' : '#333'
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

