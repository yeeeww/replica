const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');

// Public: Get active banners by type
router.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { type } = req.query;
    
    let query = `
      SELECT * FROM banners 
      WHERE is_active = true
    `;
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    
    query += ` ORDER BY sort_order ASC, id ASC`;
    
    const result = await client.query(query, params);
    res.json({ banners: result.rows });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ message: 'Failed to get banners' });
  } finally {
    client.release();
  }
});

// Admin: Get all banners (including inactive)
router.get('/admin', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type } = req.query;
    
    let query = `SELECT * FROM banners`;
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` WHERE type = $${params.length}`;
    }
    
    query += ` ORDER BY type ASC, sort_order ASC, id ASC`;
    
    const result = await client.query(query, params);
    res.json({ banners: result.rows });
  } catch (error) {
    console.error('Get admin banners error:', error);
    res.status(500).json({ message: 'Failed to get banners' });
  } finally {
    client.release();
  }
});

// Admin: Get single banner
router.get('/admin/:id', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query('SELECT * FROM banners WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    
    res.json({ banner: result.rows[0] });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ message: 'Failed to get banner' });
  } finally {
    client.release();
  }
});

// Admin: Create banner
router.post('/', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      type, 
      title, 
      subtitle, 
      image_url, 
      mobile_image_url, 
      link_url, 
      category_slug,
      sort_order,
      is_active 
    } = req.body;

    if (!image_url) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const result = await client.query(`
      INSERT INTO banners (type, title, subtitle, image_url, mobile_image_url, link_url, category_slug, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      type || 'main',
      title || null,
      subtitle || null,
      image_url,
      mobile_image_url || null,
      link_url || null,
      category_slug || null,
      sort_order || 0,
      is_active !== false
    ]);

    res.status(201).json({ message: 'Banner created', banner: result.rows[0] });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ message: 'Failed to create banner' });
  } finally {
    client.release();
  }
});

// Admin: Update banner
router.put('/:id', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { 
      type, 
      title, 
      subtitle, 
      image_url, 
      mobile_image_url, 
      link_url, 
      category_slug,
      sort_order,
      is_active 
    } = req.body;

    const result = await client.query(`
      UPDATE banners SET
        type = COALESCE($1, type),
        title = $2,
        subtitle = $3,
        image_url = COALESCE($4, image_url),
        mobile_image_url = $5,
        link_url = $6,
        category_slug = $7,
        sort_order = COALESCE($8, sort_order),
        is_active = COALESCE($9, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      type,
      title || null,
      subtitle || null,
      image_url,
      mobile_image_url || null,
      link_url || null,
      category_slug || null,
      sort_order,
      is_active,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    res.json({ message: 'Banner updated', banner: result.rows[0] });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ message: 'Failed to update banner' });
  } finally {
    client.release();
  }
});

// Admin: Delete banner
router.delete('/:id', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    const result = await client.query('DELETE FROM banners WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    res.json({ message: 'Banner deleted' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ message: 'Failed to delete banner' });
  } finally {
    client.release();
  }
});

// Admin: Update banner order
router.put('/order/update', auth, adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { bannerIds } = req.body; // Array of banner IDs in new order

    await client.query('BEGIN');

    for (let i = 0; i < bannerIds.length; i++) {
      await client.query(
        'UPDATE banners SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [i + 1, bannerIds[i]]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Banner order updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update banner order error:', error);
    res.status(500).json({ message: 'Failed to update banner order' });
  } finally {
    client.release();
  }
});

module.exports = router;
