// /api/products: public catalog endpoints, using the same search engine as the bot.
import { Router } from 'express';
import { products } from '../data/products.js';
import { searchCatalog, listCategories, getProductById, CATEGORY_NAMES } from '../bot/search.js';
import { tokenize } from '../bot/text.js';

function toInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
}

function toPrice(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function createProductsRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = toInt(req.query.limit, 1, 50, 20);
    const offset = toInt(req.query.offset, 0, products.length, 0);
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const search = typeof req.query.search === 'string' ? req.query.search : '';

    const matchedCategory = CATEGORY_NAMES.find((name) => name.toLowerCase() === category.toLowerCase());
    if (category && category.toLowerCase() !== 'all' && !matchedCategory) {
      return res.status(400).json({ error: `Unknown category. Use one of: ${CATEGORY_NAMES.join(', ')}` });
    }

    const { results, total } = searchCatalog({
      categories: matchedCategory ? [matchedCategory] : [],
      keywords: tokenize(search),
      minPrice: toPrice(req.query.minPrice),
      maxPrice: toPrice(req.query.maxPrice),
    });

    res.json({ products: results.slice(offset, offset + limit), total, hasMore: offset + limit < total });
  });

  router.get('/categories', (req, res) => {
    res.json(listCategories());
  });

  router.get('/:id', (req, res) => {
    const product = getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });

  return router;
}