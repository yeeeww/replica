const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const pool = require("../config/database");

const CSV_PATH = path.join(__dirname, "..", "..", "replmoa_products.csv");

const slugify = (text = "") =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^-+|-+$/g, "") || "etc";

const cleanPrice = (value = "") => {
  const num = value.replace(/[^\d]/g, "");
  return num ? Number(num) : 0;
};

const main = async () => {
  const client = await pool.connect();
  try {
    const csv = fs.readFileSync(CSV_PATH, "utf8");
    const records = parse(csv, { columns: true, skip_empty_lines: true });

    console.log(`🔄 ${records.length}개 레코드 처리 시작`);

    for (const row of records) {
      const name = row["상품명"] || "이름 없음";
      const categoryName = (row["카테고리"] || "기타").trim();
      const categorySlug = slugify(categoryName);
      const price = cleanPrice(row["판매가격"] || row["시중가격"] || "0");
      const imageUrl = row["대표이미지"] || "";
      const descImages = row["설명이미지들"] || "";
      const sourceUrl = row["URL"] || "";
      const description = `${sourceUrl}\n${descImages}`.trim();

      // 카테고리 upsert
      let categoryId;
      const catResult = await client.query(
        `SELECT id FROM categories WHERE slug = $1`,
        [categorySlug]
      );
      if (catResult.rows.length > 0) {
        categoryId = catResult.rows[0].id;
      } else {
        const insertCat = await client.query(
          `INSERT INTO categories (name, slug, description)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [categoryName, categorySlug, "CSV import"]
        );
        categoryId = insertCat.rows[0].id;
      }

      // 중복 방지: 같은 이름 + 카테고리 있으면 skip
      const dup = await client.query(
        `SELECT id FROM products WHERE name = $1 AND category_id = $2`,
        [name, categoryId]
      );
      if (dup.rows.length > 0) {
        console.log(`↩️  이미 존재: ${name}`);
        continue;
      }

      await client.query(
        `INSERT INTO products (name, description, price, category_id, image_url, stock, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [name, description, price, categoryId, imageUrl, 10]
      );
      console.log(`✅ 등록: ${name}`);
    }

    console.log("🎉 CSV import 완료");
  } catch (err) {
    console.error("❌ Import 실패:", err);
  } finally {
    client.release();
    await pool.end();
  }
};

main();

