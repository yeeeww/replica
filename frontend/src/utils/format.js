export const formatPrice = (price) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(price);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

export const formatDateShort = (date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date));
};

export const getOrderStatusText = (status) => {
  const statusMap = {
    pending: '주문 접수',
    processing: '처리중',
    shipped: '배송중',
    delivered: '배송 완료',
    cancelled: '취소됨'
  };
  return statusMap[status] || status;
};

export const getOrderStatusColor = (status) => {
  const colorMap = {
    pending: '#ff9800',
    processing: '#2196f3',
    shipped: '#9c27b0',
    delivered: '#4caf50',
    cancelled: '#f44336'
  };
  return colorMap[status] || '#666';
};

