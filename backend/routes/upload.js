const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');

// AWS S3 클라이언트 설정
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'wiznoble-image';

// 파일 필터 (이미지만 허용)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, png, gif, webp)'), false);
  }
};

// Multer S3 설정
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .substring(0, 50);
      cb(null, `uploads/${uniqueSuffix}_${baseName}${ext}`);
    }
  }),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// 단일 이미지 업로드
router.post('/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
    }

    // S3 URL 반환 (이미 절대 URL)
    const fileUrl = req.file.location;
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.key,
      originalname: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 다중 이미지 업로드 (최대 10개)
router.post('/images', upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: '파일이 업로드되지 않았습니다.' });
    }

    const uploadedFiles = req.files.map(file => ({
      url: file.location,  // S3 URL
      filename: file.key,
      originalname: file.originalname,
      size: file.size
    }));

    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

// 에러 핸들러
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '파일 크기는 10MB를 초과할 수 없습니다.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: '최대 10개의 파일만 업로드할 수 있습니다.' });
    }
  }
  res.status(400).json({ message: error.message });
});

module.exports = router;
