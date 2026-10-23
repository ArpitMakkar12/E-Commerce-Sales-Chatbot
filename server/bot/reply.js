// Builds the bot's answer from a parsed message, using only the catalog.
// Always works, even with no AI key. Also prepares "candidates" (products the
// optional LLM may choose from) so the LLM never invents products.
import { formatPrice } from './text.js';
import { searchCatalog, topRated, listCategories, getProductById } from './search.js';

const PAGE_SIZE = 3;
const EXAMPLES = '“laptops under $1500”, “best rated books”, “running shoes”, or “compare iPhone 15 Pro vs Galaxy S24”';

const plural = (count, one, many) => (count === 1 ? one : many);

function priceText({ minPrice, maxPrice, minExclusive, maxExclusive }) {
  if (minPrice != null && maxPrice != null) return ` between ${formatPrice(minPrice)} and ${formatPrice(maxPrice)}`;
  if (maxPrice != null) return `${maxExclusive ? ' cheaper than' : ' under'} ${formatPrice(maxPrice)}`;
  if (minPrice != null) return `${minExclusive ? ' pricier than' : ' over'} ${formatPrice(minPrice)}`;
  return '';
}

function constraintText(filters) {
  let text = priceText(filters);
  if (filters.minRating != null) text += ` rated ${filters.minRating}★ or higher`;
  if (filters.inStockOnly) text += ' that are in stock';
  return text;
}

const SORT_NOTES = {
  'price-asc': 'cheapest first',
  'price-desc': 'priciest first',
  rating: 'best rated first',
  popular: 'most popular first',
};

function subjectText(filters) {
  const categories = filters.categories?.length ? ` in ${filters.categories.join(' & ')}` : '';
  return filters.keywordText ? `“${filters.keywordText}”${categories}` : categories.trim() || 'products';
}

function catalogSummary() {
  return listCategories().map((c) => c.name).join(', ');
}

// Runs the search; if a category + words find nothing, retries across all categories.
function runSearch(filters) {
  const result = searchCatalog(filters);
  if (!result.total && filters.categories?.length && filters.keywords?.length) {
    const wider = searchCatalog({ ...filters, categories: [] });
    if (wider.total) return { ...wider, droppedCategory: true };
  }
  return result;
}

function searchReply(parsed, page = 0) {
  const filters = parsed.filters;
  const constraints = constraintText(filters);

  // Gift ideas without specific words: a varied set of well-rated items.
  if (filters.gift && !filters.keywords.length) {
    const ideas = topRated({ ...filters, limit: 12, perCategory: true });
    if (ideas.length) {
      return {
        text: `Here are some popular gift ideas${filters.categories.length ? ` in ${filters.categories.join(' & ')}` : ''}${constraints}:`,
        products: ideas.slice(0, PAGE_SIZE),
        candidates: ideas,
        lastSearch: { filters, page: 0 },
      };
    }
  }

  const { results, total, unmatchedTerms, droppedCategory } = runSearch(filters);

  if (total) {
    const start = page * PAGE_SIZE;
    const shown = results.slice(start, start + PAGE_SIZE);
    if (!shown.length) {
      return {
        text: "That's everything I have for that search. Try another category or budget, or ask me something new.",
        products: [],
        candidates: [],
        lastSearch: { filters, page },
      };
    }

    const moreLeft = start + shown.length < total;
    let text;
    if (page > 0) {
      text = `Here are ${shown.length} more (${start + 1}–${start + shown.length} of ${total}).`;
      if (moreLeft) text += ' Say “show more” to keep going.';
    } else {
      const found = filters.keywordText
        ? `I found ${total} ${plural(total, 'match', 'matches')} for ${subjectText(filters)}${constraints}`
        : `I found ${total} ${plural(total, 'product', 'products')}${filters.categories.length ? ` in ${filters.categories.join(' & ')}` : ''}${constraints}`;
      const sortNote = SORT_NOTES[filters.sort] ? `, ${SORT_NOTES[filters.sort]}` : '';
      const lead = moreLeft
        ? `Here are the top ${PAGE_SIZE}${sortNote}. Say “show more” for the rest, or “cheaper” for lower prices.`
        : total === 1 ? 'Here it is:' : 'Here they are:';
      text = `${found}. ${lead}`;
      if (droppedCategory) text = `Nothing matched in ${filters.categories.join(' & ')}, so I looked across the whole store. ${text}`;

      const ignored = unmatchedTerms.filter((term) => !/^\d+$/.test(term)).map((term) => filters.rawByStem?.[term] ?? term);
      if (ignored.length) text += `\n(I didn't find anything for “${ignored.join(' ')}”, so I left that out.)`;
    }

    return { text, products: shown, candidates: results.slice(0, 12), lastSearch: { filters, page } };
  }

  // Nothing found. Were the budget/rating/stock limits too strict?
  const hasLimits = filters.minPrice != null || filters.maxPrice != null || filters.minRating != null || filters.inStockOnly;
  if (hasLimits) {
    const loose = runSearch({ ...filters, minPrice: undefined, maxPrice: undefined, minRating: undefined, inStockOnly: false });
    if (loose.total) {
      const target = filters.maxPrice ?? filters.minPrice;
      const closest = target == null
        ? loose.results
        : [...loose.results].sort((a, b) => Math.abs(a.price - target) - Math.abs(b.price - target));
      return {
        text: `I couldn't find ${subjectText(filters)}${constraints}. These are the closest options:`,
        products: closest.slice(0, PAGE_SIZE),
        candidates: closest.slice(0, 12),
        lastSearch: { filters, page: 0 },
      };
    }
  }

  const popular = topRated({ categories: filters.categories, limit: 12, perCategory: !filters.categories.length });
  return {
    text: `Sorry, I couldn't find anything for ${subjectText(filters)}. We carry ${catalogSummary()}. Here are some popular picks instead:`,
    products: popular.slice(0, PAGE_SIZE),
    candidates: popular,
    lastSearch: null,
  };
}

// "cheaper" / "more expensive": step below or above the prices just shown.
function refineReply(parsed, context) {
  const cheaper = parsed.direction === 'cheaper';
  const shownPrices = (context.lastShownIds ?? []).map(getProductById).filter(Boolean).map((p) => p.price);
  const filters = { ...parsed.filters };

  if (!shownPrices.length) {
    filters.sort = cheaper ? 'price-asc' : 'price-desc';
  } else if (cheaper) {
    filters.maxPrice = Math.min(...shownPrices);
    filters.maxExclusive = true;
    if (filters.minPrice != null && filters.minPrice >= filters.maxPrice) delete filters.minPrice;
    if (filters.sort === 'price-desc') filters.sort = 'relevance';
  } else {
    filters.minPrice = Math.max(...shownPrices);
    filters.minExclusive = true;
    if (filters.maxPrice != null && filters.maxPrice <= filters.minPrice) delete filters.maxPrice;
    if (filters.sort === 'price-asc') filters.sort = 'relevance';
  }

  if (shownPrices.length && !runSearch(filters).total) {
    return {
      text: `Those are already the ${cheaper ? 'cheapest' : 'priciest'} ${subjectText(parsed.filters)} I have. Want to try a different category or budget?`,
      products: [],
      candidates: [],
      lastSearch: context.lastSearch ?? null,
    };
  }
  return searchReply({ ...parsed, filters });
}

function detailsReply(product) {
  const lines = [
    `${product.name}: ${formatPrice(product.price)} (${product.category})`,
    product.description,
    `Rating: ${product.rating}/5 from ${product.reviews.toLocaleString('en-US')} reviews · ${product.inStock ? 'In stock' : 'Out of stock'}`,
    `Key features: ${product.features.join(', ')}`,
  ];
  const similar = topRated({ categories: [product.category], limit: 4, exclude: [product.id] });
  return { text: lines.join('\n'), products: [product], candidates: [product, ...similar] };
}

function compareReply(products) {
  const [a, b] = products;
  const byPrice = [...products].sort((x, y) => x.price - y.price);
  const byRating = [...products].sort((x, y) => y.rating - x.rating || y.reviews - x.reviews);
  const lines = [
    `Here's how they compare:`,
    `• Price: ${products.map((p) => `${p.name} ${formatPrice(p.price)}`).join(' · ')}`,
    `• Rating: ${products.map((p) => `${p.name} ${p.rating}★ (${p.reviews.toLocaleString('en-US')} reviews)`).join(' · ')}`,
    `• Stock: ${products.every((p) => p.inStock) ? 'all in stock' : products.map((p) => `${p.name} ${p.inStock ? 'in stock' : 'out of stock'}`).join(' · ')}`,
    ...products.map((p) => `• ${p.name}: ${p.features.join(', ')}`),
  ];
  const cheapest = byPrice[0];
  const saving = byPrice[byPrice.length - 1].price - cheapest.price;
  let verdict = `${cheapest.name} is the budget pick (${formatPrice(saving)} less than the priciest)`;
  verdict += byRating[0] === cheapest ? ' and also the best rated.' : `, while ${byRating[0].name} has the best rating.`;
  if (products.length === 2 && a.price === b.price) verdict = 'They cost the same, so go with the features that matter most to you.';
  return { text: `${lines.join('\n')}\n\n${verdict}`, products, candidates: products };
}

const SIMPLE_REPLIES = {
  greeting: () => `Hi there! 👋 I'm your shopping assistant. Try ${EXAMPLES}.`,
  help: () =>
    [
      'Here is what I can do:',
      '• Find products by name or type (“wireless earbuds”, “yoga mat”)',
      '• Browse a category (electronics, books, clothing, home & garden, sports & outdoors)',
      '• Stick to a budget (“under $50”, “between $100 and $300”)',
      '• Sort results (“cheapest”, “best rated”, “most popular”)',
      '• Show product details (“tell me about the MacBook Pro”)',
      '• Compare products (“compare iPhone 15 Pro vs Galaxy S24”)',
      '• Follow up: “show more”, “cheaper”, “only in stock”',
    ].join('\n'),
  categories: () =>
    [
      'We have these departments:',
      ...listCategories().map((c) => `• ${c.name}: ${c.count} items, ${formatPrice(c.minPrice)} to ${formatPrice(c.maxPrice)}`),
      'Which one would you like to explore?',
    ].join('\n'),
  thanks: () => "You're welcome! Anything else I can help you find?",
  goodbye: () => 'Thanks for stopping by! Come back anytime. 🛍️',
  policy: () =>
    "I can only help with finding and comparing products here. I don't have information about orders, shipping, returns or payments.",
};

export function buildRulesReply(parsed, context = {}) {
  let reply;
  let lastSearch = context.lastSearch ?? null;

  switch (parsed.intent) {
    case 'search':
    case 'more':
    case 'refine': {
      const result = parsed.intent === 'refine' ? refineReply(parsed, context) : searchReply(parsed, parsed.page ?? 0);
      reply = result;
      lastSearch = result.lastSearch;
      break;
    }
    case 'details':
      reply = detailsReply(parsed.product);
      break;
    case 'compare':
      if (parsed.products.length >= 2) {
        reply = compareReply(parsed.products);
      } else {
        // "compare laptops": compare the top results of that search.
        const { results } = runSearch(parsed.filters ?? {});
        reply = results.length >= 2
          ? compareReply(results.slice(0, 3))
          : { text: `Which products should I compare? For example: “compare MacBook Pro vs Dell XPS 13”.`, products: [], candidates: [] };
      }
      break;
    case 'unknown': {
      const popular = topRated({ limit: 12, perCategory: true });
      reply = {
        text: `I'm not sure I understood that. You can ask for a product, a category, a budget or a comparison, like ${EXAMPLES}. Meanwhile, here are a few popular picks:`,
        products: popular.slice(0, PAGE_SIZE),
        candidates: popular,
      };
      break;
    }
    default:
      reply = { text: SIMPLE_REPLIES[parsed.intent](), products: [], candidates: [] };
  }

  let text = reply.text;
  if (parsed.greeting && parsed.intent !== 'greeting') text = `Hi! ${text}`;
  if (parsed.mentionsRupees) text += '\n(Note: prices in this store are in US dollars.)';

  return {
    text,
    productIds: reply.products.map((p) => p.id),
    candidates: reply.candidates ?? reply.products,
    // Replies without products (thanks, "that's everything") keep the previous ones for follow-ups.
    context: {
      lastSearch,
      lastShownIds: reply.products.length ? reply.products.map((p) => p.id) : (context.lastShownIds ?? []),
    },
  };
}

// Short summary of what the rules understood, handed to the LLM as a hint.
export function describeParse(parsed) {
  const parts = [`intent: ${parsed.intent}`];
  const f = parsed.filters;
  if (f?.categories?.length) parts.push(`categories: ${f.categories.join(', ')}`);
  if (f?.keywordText) parts.push(`search words: ${f.keywordText}`);
  if (f) {
    const limits = constraintText(f).trim();
    if (limits) parts.push(`limits: ${limits}`);
    if (SORT_NOTES[f.sort]) parts.push(`order: ${SORT_NOTES[f.sort]}`);
    if (f.gift) parts.push('looking for a gift');
  }
  return parts.join('; ');
}