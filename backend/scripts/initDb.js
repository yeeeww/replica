const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Initializing database...');

    // Drop existing tables
    await client.query(`
      DROP TABLE IF EXISTS order_items CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS cart_items CASCADE;
      DROP TABLE IF EXISTS product_options CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create users table
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        role VARCHAR(50) DEFAULT 'user',
        points INTEGER DEFAULT 0,
        address TEXT,
        memo TEXT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create points_history table
    await client.query(`
      CREATE TABLE points_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create categories table (4뎁스 지원: 성별 > 상품종류 > 브랜드 > 세부카테고리)
    // 예: 남성 > 가방 > 고야드 > 크로스&숄더백
    await client.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        parent_slug VARCHAR(255),
        depth INTEGER DEFAULT 1,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create products table
    await client.query(`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        department_price DECIMAL(10, 2),
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        image_url TEXT,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create product_options table (사이즈, 컬러 등 옵션)
    await client.query(`
      CREATE TABLE product_options (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        option_name VARCHAR(100) NOT NULL,
        option_value VARCHAR(255) NOT NULL,
        price_adjustment DECIMAL(10, 2) DEFAULT 0,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, option_name, option_value)
      );
    `);

    // Create cart_items table
    await client.query(`
      CREATE TABLE cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        product_option_id INTEGER REFERENCES product_options(id) ON DELETE SET NULL,
        selected_options TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id, product_option_id)
      );
    `);

    // Create orders table
    await client.query(`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        tracking_number VARCHAR(100),
        shipping_carrier VARCHAR(100),
        shipping_address TEXT NOT NULL,
        shipping_name VARCHAR(255) NOT NULL,
        shipping_phone VARCHAR(50) NOT NULL,
        orderer_name VARCHAR(255),
        orderer_phone VARCHAR(50),
        orderer_email VARCHAR(255),
        customs_id VARCHAR(50),
        shipping_memo TEXT,
        depositor_name VARCHAR(255),
        admin_memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create order_items table
    await client.query(`
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        product_price DECIMAL(10, 2) NOT NULL,
        selected_options TEXT,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create reviews table (구매평)
    await client.query(`
      CREATE TABLE reviews (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        content TEXT NOT NULL,
        images TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tables created successfully');

    // Insert admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password, name, role) 
      VALUES ('admin@shop.com', $1, 'Admin', 'admin');
    `, [hashedPassword]);

    // Insert sample user
    const userPassword = await bcrypt.hash('user123', 10);
    await client.query(`
      INSERT INTO users (email, password, name, role) 
      VALUES ('user@shop.com', $1, 'Test User', 'user');
    `, [userPassword]);

    console.log('✅ Default users created');

    // ========== 대분류 (depth 1) ==========
    await client.query(`
      INSERT INTO categories (name, slug, depth, description) VALUES
      ('남성', 'men', 1, '남성 카테고리'),
      ('여성', 'women', 1, '여성 카테고리'),
      ('국내출고상품', 'domestic', 1, '국내출고상품'),
      ('추천상품', 'recommend', 1, '추천상품'),
      ('히트상품', 'hot', 1, '히트상품'),
      ('인기상품', 'popular', 1, '인기상품');
    `);
    console.log('✅ 대분류 카테고리 생성 완료');

    // ========== 중분류 (depth 2) - 남성/여성/추천/히트/인기 공통 ==========
    const commonSubcategories = [
      { name: '가방', slug: 'bag' },
      { name: '지갑', slug: 'wallet' },
      { name: '시계', slug: 'watch' },
      { name: '신발', slug: 'shoes' },
      { name: '벨트', slug: 'belt' },
      { name: '악세서리', slug: 'accessory' },
      { name: '모자', slug: 'hat' },
      { name: '의류', slug: 'clothing' },
      { name: '선글라스&안경', slug: 'glasses' },
      { name: '기타', slug: 'etc' }
    ];

    // 남성, 여성, 추천상품, 히트상품, 인기상품에 공통 중분류 추가
    const parentSlugs = ['men', 'women', 'recommend', 'hot', 'popular'];
    for (const parentSlug of parentSlugs) {
      for (const sub of commonSubcategories) {
        await client.query(`
          INSERT INTO categories (name, slug, parent_slug, depth) 
          VALUES ($1, $2, $3, 2)
        `, [sub.name, `${parentSlug}-${sub.slug}`, parentSlug]);
      }
    }
    console.log('✅ 남성/여성/추천/히트/인기 중분류 생성 완료');

    // ========== 중분류 (depth 2) - 국내출고상품 전용 ==========
    const domesticSubcategories = [
      { name: '가방&지갑', slug: 'bag-wallet' },
      { name: '의류', slug: 'clothing' },
      { name: '신발', slug: 'shoes' },
      { name: '모자', slug: 'hat' },
      { name: '악세사리', slug: 'accessory' },
      { name: '시계', slug: 'watch' },
      { name: '패션잡화', slug: 'fashion-acc' },
      { name: '생활&주방용품', slug: 'home-kitchen' },
      { name: '벨트', slug: 'belt' },
      { name: '향수', slug: 'perfume' },
      { name: '라이터', slug: 'lighter' }
    ];

    for (const sub of domesticSubcategories) {
      await client.query(`
        INSERT INTO categories (name, slug, parent_slug, depth) 
        VALUES ($1, $2, 'domestic', 2)
      `, [sub.name, `domestic-${sub.slug}`]);
    }
    console.log('✅ 국내출고상품 중분류 생성 완료');
    console.log('\n🎉 Database initialized successfully!');
    console.log('\n📝 Default accounts:');
    console.log('   Admin: admin@shop.com / admin123');
    console.log('   User: user@shop.com / user123\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDatabase().catch(console.error);

