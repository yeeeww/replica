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
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
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
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        image_url TEXT,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create cart_items table
    await client.query(`
      CREATE TABLE cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
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
        shipping_address TEXT NOT NULL,
        shipping_name VARCHAR(255) NOT NULL,
        shipping_phone VARCHAR(50) NOT NULL,
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
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Insert sample categories
    await client.query(`
      INSERT INTO categories (name, slug, description) VALUES
      ('의류', 'clothing', '패션 의류'),
      ('가방', 'bags', '핸드백 및 백팩'),
      ('신발', 'shoes', '스니커즈 및 구두'),
      ('액세서리', 'accessories', '시계, 지갑 등');
    `);

    console.log('✅ Sample categories created');

    // Insert sample products
    await client.query(`
      INSERT INTO products (name, description, price, category_id, image_url, stock) VALUES
      ('클래식 티셔츠', '편안한 면 소재의 클래식 티셔츠', 29000, 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500', 50),
      ('데님 재킷', '빈티지 스타일의 데님 재킷', 89000, 1, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500', 30),
      ('레더 백팩', '고급 가죽 백팩', 159000, 2, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500', 20),
      ('크로스백', '실용적인 크로스백', 79000, 2, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500', 40),
      ('스니커즈', '편안한 캐주얼 스니커즈', 119000, 3, 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500', 60),
      ('로퍼', '클래식 레더 로퍼', 139000, 3, 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=500', 25),
      ('레더 지갑', '심플한 디자인의 지갑', 49000, 4, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500', 80),
      ('선글라스', '클래식 선글라스', 69000, 4, 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500', 45);
    `);

    console.log('✅ Sample products created');
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

