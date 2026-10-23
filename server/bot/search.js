// Product search engine: filters (category, price, rating, stock) plus
// keyword scoring. Used by both the chatbot and GET /api/products.
import { products } from '../data/products.js';
import { tokenize, SYNONYMS } from './text.js';

export const CATEGORY_NAMES = [...new Set(products.map((p) => p.category))];

const productsById = new Map(products.map((p) => [p.id, p]));
export const getProductById = (id) => productsById.get(String(id)) ?? null;

// A word found in the product name counts more than one found in the description.
const FIELD_WEIGHTS = { name: 3, features: 2, description: 1.5, category: 1 };
const SYNONYM_WEIGHT = 0.7;
const PREFIX_WEIGHT = 0.6;

// Accessories ("Phone Stand") rank below the real thing ("iPhone") unless asked for.
const ACCESSORY_WORDS = new Set([
  'stand', 'case', 'charger', 'charging', 'cable', 'holder', 'mount', 'adapter', 'cover', 'protector', 'strap', 'hub', 'pad', 'bank',
]);

// Pre-split every product once at startup, so searching is just set lookups.
const INDEX = products.map((product) => {
  const fields = {
    name: new Set(tokenize(product.name)),
    features: new Set(tokenize(product.features.join(' '))),
    description: new Set(tokenize(product.description)),
    category: new Set(tokenize(product.category)),
  };
  return {
    product,
    fields,
    all: new Set(Object.values(fields).flatMap((set) => [...set])),
    isAccessory: [...fields.name].some((word) => ACCESSORY_WORDS.has(word)),
  };
});

// How well one search word matches one product (0 = not at all).
function termScore(entry, term) {
  const variants = [[term, 1], ...(SYNONYMS[term] ?? []).map((word) => [word, SYNONYM_WEIGHT])];
  let best = 0;
  for (const [word, weight] of variants) {
    for (const [field, fieldWeight] of Object.entries(FIELD_WEIGHTS)) {
      if (entry.fields[field].has(word)) best = Math.max(best, weight * fieldWeight);
    }
  }
  // Partial match for longer words: "program" finds "programming".
  if (best === 0 && term.length >= 5) {
    for (const [field, fieldWeight] of Object.entries(FIELD_WEIGHTS)) {
      for (const token of entry.fields[field]) {
        if (token.length > term.length && token.startsWith(term)) best = Math.max(best, PREFIX_WEIGHT * fieldWeight);
      }
    }
  }
  return best;
}

const SORTERS = {
  relevance: (a, b) => b.score - a.score || b.product.rating - a.product.rating || b.product.reviews - a.product.reviews,
  'price-asc': (a, b) => a.product.price - b.product.price,
  'price-desc': (a, b) => b.product.price - a.product.price,
  rating: (a, b) => b.product.rating - a.product.rating || b.product.reviews - a.product.reviews,
  popular: (a, b) => b.product.reviews - a.product.reviews,
};

const isNumber = (word) => /^\d+$/.test(word);

// maxExclusive/minExclusive mean "strictly cheaper/pricier than" (used by "cheaper").
export function searchCatalog({
  categories = [],
  keywords = [],
  minPrice,
  maxPrice,
  minExclusive = false,
  maxExclusive = false,
  minRating,
  inStockOnly = false,
  sort = 'relevance',
} = {}) {
  const accessoryQuery = keywords.some((word) => ACCESSORY_WORDS.has(word));
  const hasTextTerms = keywords.some((word) => !isNumber(word));
  const hitsPerTerm = new Map(keywords.map((word) => [word, 0]));
  let scored = [];

  for (const entry of INDEX) {
    const { product } = entry;
    if (categories.length && !categories.includes(product.category)) continue;
    if (minPrice != null && (minExclusive ? product.price <= minPrice : product.price < minPrice)) continue;
    if (maxPrice != null && (maxExclusive ? product.price >= maxPrice : product.price > maxPrice)) continue;
    if (minRating != null && product.rating < minRating) continue;
    if (inStockOnly && !product.inStock) continue;

    let score = 0;
    let matchedTerms = 0;
    let matchedText = false;
    for (const term of keywords) {
      const termPoints = termScore(entry, term);
      if (termPoints > 0) {
        score += termPoints;
        matchedTerms += 1;
        if (!isNumber(term)) matchedText = true;
        hitsPerTerm.set(term, hitsPerTerm.get(term) + 1);
      }
    }

    if (keywords.length) {
      // A bare number ("15", "4") only counts alongside a real word match.
      if (score === 0 || (hasTextTerms && !matchedText)) continue;
      score *= 0.5 + 0.5 * (matchedTerms / keywords.length); // reward matching every word
      if (entry.isAccessory && !accessoryQuery) score *= 0.35;
    }
    scored.push({ product, score });
  }

  // Drop weak matches that only share a minor word with the query.
  if (keywords.length && scored.length) {
    const topScore = Math.max(...scored.map((item) => item.score));
    scored = scored.filter((item) => item.score >= topScore * 0.4);
  }

  // With no search words, "relevance" means best rated first.
  const sortKey = sort === 'relevance' && !keywords.length ? 'rating' : sort;
  scored.sort(SORTERS[sortKey] ?? SORTERS.relevance);

  return {
    results: scored.map((item) => item.product),
    total: scored.length,
    unmatchedTerms: keywords.filter((word) => hitsPerTerm.get(word) === 0),
  };
}

// Products whose name mentions the given words, best first ("macbook" -> MacBook Pro).
export function findProductsByName(terms) {
  return INDEX.map((entry) => {
    let nameHits = 0;
    let otherHits = 0;
    for (const term of terms) {
      const variants = [term, ...(SYNONYMS[term] ?? [])];
      if (variants.some((word) => entry.fields.name.has(word))) nameHits += 1;
      else if (variants.some((word) => entry.all.has(word))) otherHits += 1;
    }
    return {
      product: entry.product,
      nameHits,
      score: nameHits * 2 + otherHits * 0.5 + nameHits / entry.fields.name.size,
    };
  })
    .filter((match) => match.nameHits > 0)
    .sort((a, b) => b.score - a.score);
}

// Returns the single product clearly meant by the words, or null if it's ambiguous.
export function findOneProduct(terms) {
  const [first, second] = findProductsByName(terms);
  if (!first) return null;
  if (!second || first.nameHits > second.nameHits || first.score - second.score >= 0.5) return first.product;
  return null;
}

export function listCategories() {
  return CATEGORY_NAMES.map((name) => {
    const items = products.filter((p) => p.category === name);
    const prices = items.map((p) => p.price);
    return { name, count: items.length, minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
  });
}

export function topRated({ limit = 3, perCategory = false, exclude = [], ...filters } = {}) {
  const { results } = searchCatalog({ ...filters, sort: 'rating' });
  const pool = results.filter((p) => !exclude.includes(p.id));
  if (!perCategory) return pool.slice(0, limit);
  // One per category first, for a varied set (gift ideas, "popular picks").
  const picks = [];
  for (const category of CATEGORY_NAMES) {
    const best = pool.find((p) => p.category === category);
    if (best) picks.push(best);
  }
  return [...picks, ...pool.filter((p) => !picks.includes(p))].slice(0, limit);
}