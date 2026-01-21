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

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await getOrders({ limit: 1000 });
      const fetchedOrders = response.data.orders;
      setOrders(fetchedOrders);
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
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>주문일시</th>
            <th>수령인</th>
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
                  to={`/orders/${order.id}`}
                  style={{ color: 'var(--primary-color)', fontWeight: '500' }}
                >
                  #{order.id}
                </Link>
              </td>
              <td>{formatDate(order.created_at)}</td>
              <td>{order.shipping_name}</td>
              <td>{formatPrice(order.total_amount)}</td>
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
    </div>
  );
};

export default AdminOrders;

