import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-info">
            <h3>고객센터</h3>
            <div className="footer-hours">
              <p>운영시간 : 평일 10시~18시</p>
              <p>토 · 일 · 공휴일 휴무</p>
            </div>
            
            <div className="footer-kakao">
              <div className="kakao-link">
                <svg className="kakao-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.714c0 2.677 1.782 5.03 4.469 6.37-.17.614-.61 2.223-.7 2.566-.11.422.156.416.328.303.135-.09 2.15-1.46 3.023-2.052.602.088 1.222.134 1.88.134 5.523 0 10-3.463 10-7.321S17.523 3 12 3z"/>
                </svg>
                <span>카카오 고객센터 : wiznoble</span>
              </div>
            </div>

            <div className="footer-account">
              <p>계좌번호 : im뱅크 262-13-084376</p>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} WIZNOBLE. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
