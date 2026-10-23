// Understands a customer's message without any AI service:
// what they want (the "intent") and the details (category, budget, sort order,
// search words). It also reads the previous turn so follow-ups like
// "show more" or "cheaper ones" work.
import { prepare, words, stem } from './text.js';
import { findOneProduct, findProductsByName } from './search.js';

const CATEGORY_ALIASES = {
  Electronics: ['electronic', 'electronics', 'gadget', 'tech', 'technology', 'device'],
  Books: ['book', 'novel', 'ebook', 'reading'],
  Clothing: ['clothing', 'clothes', 'apparel', 'fashion', 'outfit', 'wear', 'garment'],
  'Home & Garden': ['home', 'garden', 'gardening', 'house', 'household', 'decor', 'furniture'],
  'Sports & Outdoors': ['sport', 'sports', 'outdoor', 'outdoors', 'sporting'],
};
const ALIAS_TO_CATEGORY = new Map(
  Object.entries(CATEGORY_ALIASES).flatMap(([category, aliases]) => aliases.map((a) => [stem(a), category])),
);

// Filler words that never help a product search.
const STOPWORDS = new Set(`
  a an the and or but of for to in on at by with from about as into than then so if
  is are was were be been am do does did have has had having i im ive me my mine we our us
  you your it its this that these those there here what which who whom whose where when why how
  can could would should will shall may might must please pls plz want wanna need needs needed
  looking look search searching find finding show showing see get give got buy buying purchase
  order recommend recommendation recommendations suggest suggestion suggestions some any anything
  something stuff thing things item items product products option options one ones kind kinds type
  types sort also just really very too much many more most like good nice great cool new list all
  tell know let lets ok okay yes no not hmm maybe now today store shop sell sells selling offer offers
  carry available availability else other another again only price prices priced cost costs range
  dollar dollars usd buck bucks under below over above between around less least up upto within
  compare comparison vs versus difference better details detail info information spec specs specs
  features feature describe cheap cheaper cheapest affordable budget inexpensive low lowest economical
  bargain expensive pricey pricier priciest premium luxury luxurious high highest end fancy best top rated
  rating ratings quality recommended popular trending bestselling bestseller stock star stars hi hello hey
  thanks thank thx please someone them him her people help assist use using gear equipment supplies
  essentials accessories
`.split(/\s+/).filter(Boolean));

// Words that mean "this is a gift": we show varied, well-rated items.
const GIFT_WORDS = new Set(`
  gift gifts present presents birthday anniversary christmas diwali holiday holidays dad mom mum father
  mother parent parents friend friends brother sister wife husband boyfriend girlfriend son daughter kid
  kids child children colleague boss teen men women man woman guy guys girl girls boy boys
`.split(/\s+/).filter(Boolean));

const PATTERNS = {
  greeting: /^(hi+|hello+|hey+|hiya|howdy|yo|namaste|hola|greetings|good (morning|afternoon|evening|day))\b/,
  thanks: /\b(thanks|thank you|thank u|thx|ty|cheers|appreciate it)\b/,
  goodbye: /\b(bye|goodbye|see you|see ya|cya|thats all|thats it for now)\b/,
  help: /\b(help|what can you do|how (does|do) (this|you|it) work|what do you do|how to use)\b/,
  categories: /\b(categor(y|ies)|departments?|what (do|else do) you (sell|have|offer|carry)|what (kinds?|types?|sorts?) of)\b/,
  more: /\b(show more|more options|more results|see more|load more|next (page|ones?|options?)|what else|anything else|other options|more like (this|these|that|those)|any more|more please)\b|^(more|next)[\s.!?]*$/,
  cheaper: /\b(cheaper|less expensive|lower price[d]?|more affordable|lower budget|too expensive|too pricey)\b/,
  pricier: /\b(more expensive|pricier|higher[- ]end|more premium|fancier|better ones?|upgrade|too cheap)\b/,
  compare: /\b(compare|comparison|vs|versus|difference between|which is better)\b/,
  details: /\b(tell me (more )?about|more (info|information|details) (on|about|for)|details? (of|on|about|for)|specs?|specifications|features of|describe|info (on|about)|information (on|about)|how much|price of|cost of|is (the |it )?.* in stock)\b/,
  policy: /\b(return|returns|refund|refunds|shipping|delivery|deliver|track(ing)? (my )?order|order status|payment|pay with|warranty|exchange|cancel (my )?order|discount code|coupon)\b/,
  inStock: /\bin[- ]stock\b|\bavailable now\b/,
  rupees: /₹|\brs\.?\s*\d|\brupees?\b|\binr\b/,
  // "with bluetooth", "only wireless ones" narrow the previous search...
  narrowsPrevious: /^(with|only|and|also)\b|\b(ones?|those|these|them)\b/,
  // ...while "what about books?" switches topic but keeps the budget.
  switchesTopic: /^((what|how) about|any|in)\b/,
};

const SORT_PATTERNS = [
  ['price-asc', /\b(cheap|cheapest|affordable|inexpensive|low[- ]cost|lowest price|economical|bargain)\b/],
  ['price-desc', /\b(expensive|priciest|premium|luxury|luxurious|high[- ]end|highest price|fancy)\b/],
  ['popular', /\b(popular|best[- ]?selling|bestsellers?|trending)\b/],
  ['rating', /\b(best|top[- ]rated|highest[- ]rated|top|well[- ]reviewed|quality|recommended)\b/],
];

// --- Prices and ratings --------------------------------------------------

// One amount like "$50", "1.5k", "200 dollars". Groups: (number)(k).
// The (?![a-z]|\d) stops "1tb" or "16gb" being read as prices.
const AMOUNT = String.raw`\$?\s*(\d+(?:\.\d+)?)(?:\s*(k)\b)?(?![a-z]|\d)(?:\s*(?:dollars?|usd|bucks)\b)?`;
const RANGE_SEP = String.raw`\s*(?:-|to|and)\s*`;

const PRICE_RULES = [
  { kind: 'range', re: new RegExp(String.raw`\bbetween\s+${AMOUNT}${RANGE_SEP}${AMOUNT}`) },
  { kind: 'range', re: new RegExp(String.raw`\b(?:range|budget|price|priced)\s*(?:of|is|from)?\s*${AMOUNT}${RANGE_SEP}${AMOUNT}`) },
  { kind: 'range', re: new RegExp(String.raw`\$\s*(\d+(?:\.\d+)?)(?:\s*(k)\b)?\s*(?:-|to)\s*${AMOUNT}`) },
  { kind: 'max', re: new RegExp(String.raw`\b(?:under|below|less than|cheaper than|lower than|within|max(?:imum)?|up to|upto|at most|no more than|not more than|budget(?: of| is)?)\s*${AMOUNT}|<\s*${AMOUNT}`) },
  { kind: 'min', re: new RegExp(String.raw`\b(?:over|above|more than|greater than|at least|min(?:imum)?|starting (?:at|from)|from)\s*${AMOUNT}|>\s*${AMOUNT}`) },
  { kind: 'around', re: new RegExp(String.raw`\b(?:around|about|approximately|approx|roughly|close to|near)\s*${AMOUNT}|~\s*${AMOUNT}`) },
  { kind: 'max', re: new RegExp(String.raw`\$\s*(\d+(?:\.\d+)?)(?:\s*(k)\b)?(?![a-z]|\d)`) },
  { kind: 'max', re: new RegExp(String.raw`\b(\d+(?:\.\d+)?)(?:\s*(k)\b)?\s*(?:dollars?|usd|bucks)\b`) },
];

function amounts(match) {
  // Groups come in (number, k) pairs; some patterns have alternatives, so skip empty pairs.
  const values = [];
  for (let i = 1; i < match.length; i += 2) {
    if (match[i] !== undefined) values.push(Number.parseFloat(match[i]) * (match[i + 1] ? 1000 : 1));
  }
  return values;
}

function extractConstraints(text) {
  // "top 5 laptops": the 5 is a count, not a product detail.
  let rest = text.replace(/\b(top|best|first)\s+\d{1,2}\b/g, '$1');
  const result = {};

  // Ratings first, so "4 stars" is never mistaken for a price.
  const ratingMatch =
    rest.match(/(\d(?:\.\d)?)\s*\+?\s*stars?\b/) ||
    rest.match(/\brat(?:ed|ing)s?\s*(?:of\s*)?(?:above|over|at least|>=?)?\s*(\d(?:\.\d)?)\s*\+?/);
  if (ratingMatch && Number.parseFloat(ratingMatch[1]) <= 5) {
    result.minRating = Number.parseFloat(ratingMatch[1]);
    rest = rest.replace(ratingMatch[0], ' ');
  }

  for (const { kind, re } of PRICE_RULES) {
    const match = rest.match(re);
    if (!match) continue;
    const values = amounts(match);
    if (kind === 'range' && values.length >= 2) {
      result.minPrice = Math.min(values[0], values[1]);
      result.maxPrice = Math.max(values[0], values[1]);
    } else if (kind === 'max' && result.maxPrice === undefined) {
      result.maxPrice = values[0];
    } else if (kind === 'min' && result.minPrice === undefined) {
      result.minPrice = values[0];
    } else if (kind === 'around' && result.maxPrice === undefined) {
      result.minPrice = Math.round(values[0] * 0.8);
      result.maxPrice = Math.round(values[0] * 1.2);
    } else {
      continue;
    }
    rest = rest.replace(match[0], ' ');
  }
  // A typed amount replaces any "cheaper than what you showed" limit from before.
  if (result.maxPrice !== undefined) result.maxExclusive = false;
  if (result.minPrice !== undefined) result.minExclusive = false;

  if (PATTERNS.inStock.test(rest)) result.inStockOnly = true;
  return { constraints: result, rest };
}

function detectSort(text, constraints) {
  for (const [sort, re] of SORT_PATTERNS) {
    if (re.test(text)) return sort;
  }
  // "budget" alone means cheap; with a number it's just a price limit.
  if (/\bbudget\b/.test(text) && constraints.maxPrice === undefined) return 'price-asc';
  return 'relevance';
}

// --- Words ---------------------------------------------------------------

function readTerms(text) {
  const categories = new Set();
  const keywords = [];
  const rawByStem = {};
  let gift = false;

  for (const raw of words(text)) {
    const stemmed = stem(raw);
    if (ALIAS_TO_CATEGORY.has(stemmed)) {
      categories.add(ALIAS_TO_CATEGORY.get(stemmed));
    } else if (GIFT_WORDS.has(raw) || GIFT_WORDS.has(stemmed)) {
      gift = true;
    } else if (!STOPWORDS.has(raw) && !STOPWORDS.has(stemmed) && !/^\d+(\.\d+)?$/.test(raw) && !keywords.includes(stemmed)) {
      keywords.push(stemmed);
      rawByStem[stemmed] = raw;
    } else if (/^\d+$/.test(raw) && raw.length <= 3 && !keywords.includes(raw)) {
      keywords.push(raw); // model numbers like "15" in "iphone 15"
      rawByStem[raw] = raw;
    }
  }
  return { categories: [...categories], keywords, rawByStem, gift };
}

function keywordText(keywords, rawByStem) {
  return keywords.map((k) => rawByStem[k] ?? k).join(' ');
}

// "compare iphone 15 pro and galaxy s24" -> [iPhone 15 Pro, Galaxy S24 Ultra]
function findComparedProducts(text) {
  const cleaned = text.replace(/\b(compare|comparison|difference between|which is better|between|the)\b/g, ' ');
  const sides = cleaned.split(/\s(?:vs\.?|versus|and|or|with)\s|,|\bvs\b/);
  const found = [];
  for (const side of sides) {
    const { keywords } = readTerms(side);
    if (!keywords.length) continue;
    const product = findOneProduct(keywords) ?? findProductsByName(keywords)[0]?.product;
    if (product && !found.includes(product)) found.push(product);
  }
  return found.slice(0, 3);
}

// --- Main entry ----------------------------------------------------------

export function parseMessage(message, context = {}) {
  const text = prepare(message).trim();
  const { constraints, rest } = extractConstraints(text);
  const terms = readTerms(rest);
  const sort = detectSort(rest, constraints);
  const flags = Object.fromEntries(
    ['greeting', 'thanks', 'goodbye', 'help', 'categories', 'more', 'cheaper', 'pricier', 'compare', 'details', 'policy']
      .map((name) => [name, PATTERNS[name].test(text)]),
  );
  const lastSearch = context.lastSearch ?? null;
  const hasConstraints = Object.keys(constraints).length > 0;
  const hasTerms = terms.categories.length > 0 || terms.keywords.length > 0;

  const base = {
    greeting: flags.greeting,
    mentionsRupees: PATTERNS.rupees.test(text),
    rawByStem: terms.rawByStem,
  };

  let filters = {
    categories: terms.categories,
    keywords: terms.keywords,
    keywordText: keywordText(terms.keywords, terms.rawByStem),
    rawByStem: terms.rawByStem,
    gift: terms.gift,
    sort,
    ...constraints,
  };

  if (flags.compare) {
    const products = findComparedProducts(text);
    if (products.length >= 2) return { ...base, intent: 'compare', products };
    return { ...base, intent: 'compare', products: [], filters };
  }

  if (flags.details && terms.keywords.length) {
    const product = findOneProduct(terms.keywords);
    if (product) return { ...base, intent: 'details', product };
  }

  if (flags.more && lastSearch && !hasTerms) {
    return { ...base, intent: 'more', filters: lastSearch.filters, page: (lastSearch.page ?? 0) + 1 };
  }

  // "cheaper" / "more expensive" step away from the prices just shown.
  // (An explicit amount like "cheaper than $50" is handled as a normal budget below.)
  if ((flags.cheaper || flags.pricier) && lastSearch && !hasTerms && !hasConstraints) {
    return { ...base, intent: 'refine', direction: flags.cheaper ? 'cheaper' : 'pricier', filters: lastSearch.filters };
  }

  // A budget/sort on its own refines the previous search: "under $50", "best rated ones".
  if (lastSearch && !hasTerms && !terms.gift && (hasConstraints || sort !== 'relevance')) {
    filters = { ...lastSearch.filters, ...constraints, sort: sort !== 'relevance' ? sort : lastSearch.filters.sort };
    return { ...base, intent: 'search', filters, refined: true };
  }

  const narrows = PATTERNS.narrowsPrevious.test(text);
  if (lastSearch && hasTerms && (narrows || PATTERNS.switchesTopic.test(text))) {
    const previous = lastSearch.filters;
    if (!hasConstraints) {
      for (const key of ['minPrice', 'maxPrice', 'minRating', 'inStockOnly']) {
        if (previous[key] !== undefined) filters[key] = previous[key];
      }
    }
    if (narrows) {
      if (!filters.categories.length) filters.categories = previous.categories;
      const keywords = [...new Set([...previous.keywords, ...filters.keywords])];
      const rawByStem = { ...previous.rawByStem, ...terms.rawByStem };
      filters = { ...filters, keywords, keywordText: keywordText(keywords, rawByStem), rawByStem };
    }
    return { ...base, intent: 'search', filters, refined: true };
  }

  if (hasTerms || hasConstraints || terms.gift || sort !== 'relevance') {
    if (flags.policy && !terms.categories.length && !hasConstraints) return { ...base, intent: 'policy' };
    return { ...base, intent: 'search', filters };
  }
  if (flags.cheaper || flags.pricier) {
    return { ...base, intent: 'search', filters: { ...filters, sort: flags.cheaper ? 'price-asc' : 'price-desc' } };
  }
  if (flags.policy) return { ...base, intent: 'policy' };
  if (flags.categories || (flags.more && !lastSearch)) return { ...base, intent: 'categories' };
  if (flags.help) return { ...base, intent: 'help' };
  if (flags.thanks) return { ...base, intent: 'thanks' };
  if (flags.goodbye) return { ...base, intent: 'goodbye' };
  if (flags.greeting) return { ...base, intent: 'greeting' };
  return { ...base, intent: 'unknown' };
}