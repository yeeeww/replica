-- All categories batch insert
-- Run: psql -U postgres -d modern_shop -f addAllCategories.sql

-- Depth 1 (Main categories)
INSERT INTO categories (name, slug, depth, parent_id, parent_slug, description)
VALUES 
  ('men', 'men', 1, NULL, NULL, 'men category'),
  ('women', 'women', 1, NULL, NULL, 'women category'),
  ('domestic', 'domestic', 1, NULL, NULL, 'domestic category'),
  ('recommend', 'recommend', 1, NULL, NULL, 'recommend category'),
  ('hot', 'hot', 1, NULL, NULL, 'hot category'),
  ('popular', 'popular', 1, NULL, NULL, 'popular category')
ON CONFLICT (slug) DO NOTHING;

-- Men subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'men-bag', 2, 'men', 'men bag'),
  ('wallet', 'men-wallet', 2, 'men', 'men wallet'),
  ('watch', 'men-watch', 2, 'men', 'men watch'),
  ('shoes', 'men-shoes', 2, 'men', 'men shoes'),
  ('belt', 'men-belt', 2, 'men', 'men belt'),
  ('accessory', 'men-accessory', 2, 'men', 'men accessory'),
  ('hat', 'men-hat', 2, 'men', 'men hat'),
  ('clothing', 'men-clothing', 2, 'men', 'men clothing'),
  ('glasses', 'men-glasses', 2, 'men', 'men glasses'),
  ('etc', 'men-etc', 2, 'men', 'men etc')
ON CONFLICT (slug) DO NOTHING;

-- Women subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'women-bag', 2, 'women', 'women bag'),
  ('wallet', 'women-wallet', 2, 'women', 'women wallet'),
  ('watch', 'women-watch', 2, 'women', 'women watch'),
  ('shoes', 'women-shoes', 2, 'women', 'women shoes'),
  ('belt', 'women-belt', 2, 'women', 'women belt'),
  ('accessory', 'women-accessory', 2, 'women', 'women accessory'),
  ('hat', 'women-hat', 2, 'women', 'women hat'),
  ('clothing', 'women-clothing', 2, 'women', 'women clothing'),
  ('glasses', 'women-glasses', 2, 'women', 'women glasses'),
  ('etc', 'women-etc', 2, 'women', 'women etc')
ON CONFLICT (slug) DO NOTHING;

-- Domestic subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'domestic-bag', 2, 'domestic', 'domestic bag'),
  ('wallet', 'domestic-wallet', 2, 'domestic', 'domestic wallet'),
  ('watch', 'domestic-watch', 2, 'domestic', 'domestic watch'),
  ('shoes', 'domestic-shoes', 2, 'domestic', 'domestic shoes'),
  ('belt', 'domestic-belt', 2, 'domestic', 'domestic belt'),
  ('accessory', 'domestic-accessory', 2, 'domestic', 'domestic accessory'),
  ('hat', 'domestic-hat', 2, 'domestic', 'domestic hat'),
  ('clothing', 'domestic-clothing', 2, 'domestic', 'domestic clothing'),
  ('glasses', 'domestic-glasses', 2, 'domestic', 'domestic glasses'),
  ('etc', 'domestic-etc', 2, 'domestic', 'domestic etc')
ON CONFLICT (slug) DO NOTHING;

-- Recommend subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'recommend-bag', 2, 'recommend', 'recommend bag'),
  ('wallet', 'recommend-wallet', 2, 'recommend', 'recommend wallet'),
  ('watch', 'recommend-watch', 2, 'recommend', 'recommend watch'),
  ('shoes', 'recommend-shoes', 2, 'recommend', 'recommend shoes'),
  ('belt', 'recommend-belt', 2, 'recommend', 'recommend belt'),
  ('accessory', 'recommend-accessory', 2, 'recommend', 'recommend accessory'),
  ('hat', 'recommend-hat', 2, 'recommend', 'recommend hat'),
  ('clothing', 'recommend-clothing', 2, 'recommend', 'recommend clothing'),
  ('glasses', 'recommend-glasses', 2, 'recommend', 'recommend glasses'),
  ('etc', 'recommend-etc', 2, 'recommend', 'recommend etc')
ON CONFLICT (slug) DO NOTHING;

-- Hot subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'hot-bag', 2, 'hot', 'hot bag'),
  ('wallet', 'hot-wallet', 2, 'hot', 'hot wallet'),
  ('watch', 'hot-watch', 2, 'hot', 'hot watch'),
  ('shoes', 'hot-shoes', 2, 'hot', 'hot shoes'),
  ('belt', 'hot-belt', 2, 'hot', 'hot belt'),
  ('accessory', 'hot-accessory', 2, 'hot', 'hot accessory'),
  ('hat', 'hot-hat', 2, 'hot', 'hot hat'),
  ('clothing', 'hot-clothing', 2, 'hot', 'hot clothing'),
  ('glasses', 'hot-glasses', 2, 'hot', 'hot glasses'),
  ('etc', 'hot-etc', 2, 'hot', 'hot etc')
ON CONFLICT (slug) DO NOTHING;

-- Popular subcategories (depth = 2)
INSERT INTO categories (name, slug, depth, parent_slug, description)
VALUES 
  ('bag', 'popular-bag', 2, 'popular', 'popular bag'),
  ('wallet', 'popular-wallet', 2, 'popular', 'popular wallet'),
  ('watch', 'popular-watch', 2, 'popular', 'popular watch'),
  ('shoes', 'popular-shoes', 2, 'popular', 'popular shoes'),
  ('belt', 'popular-belt', 2, 'popular', 'popular belt'),
  ('accessory', 'popular-accessory', 2, 'popular', 'popular accessory'),
  ('hat', 'popular-hat', 2, 'popular', 'popular hat'),
  ('clothing', 'popular-clothing', 2, 'popular', 'popular clothing'),
  ('glasses', 'popular-glasses', 2, 'popular', 'popular glasses'),
  ('etc', 'popular-etc', 2, 'popular', 'popular etc')
ON CONFLICT (slug) DO NOTHING;

-- Update parent_id based on parent_slug
UPDATE categories c
SET parent_id = p.id
FROM categories p
WHERE c.parent_slug = p.slug
  AND c.parent_id IS NULL
  AND c.depth > 1;

-- Show results
SELECT slug, name, depth, parent_slug FROM categories WHERE depth <= 2 ORDER BY depth, slug;
