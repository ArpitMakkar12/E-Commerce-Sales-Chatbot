// Text helpers shared by the chatbot and product search.
// Messages and product data both go through the same steps, so "Shirts"
// in a question lines up with "Shirt" in a product name.

// Lowercase, drop apostrophes, and remove thousands separators ("1,500" -> "1500").
export function prepare(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d),(?=\d{3}\b)/g, '$1');
}

// Split into plain words. Keeps numbers like "4k", "12.9" and "20000mah".
export function words(text) {
  return prepare(text)
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(' ')
    .map((word) => word.replace(/^\.+|\.+$/g, ''))
    .filter((word) => word.length > 1 || /\d/.test(word));
}

// Very small "stemmer": turns plurals into singular so both sides compare equally.
export function stem(word) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`; // accessories -> accessory
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2); // watches -> watch
  if (/(ss|us|is|os)$/.test(word)) return word; // glass, tennis
  if (word.endsWith('s')) return word.slice(0, -1); // shirts -> shirt
  return word;
}

export function tokenize(text) {
  return words(text).map(stem);
}

// $1,500 for whole amounts, $1,099.99 otherwise.
export function formatPrice(value) {
  const digits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

// Extra words to try when a customer's word isn't the one used in product data.
// Keys and values are already in stemmed (singular) form.
export const SYNONYMS = {
  phone: ['smartphone', 'iphone', 'galaxy', 'mobile'],
  smartphone: ['phone', 'iphone', 'galaxy', 'android'],
  mobile: ['phone', 'smartphone', 'iphone', 'galaxy'],
  cellphone: ['phone', 'smartphone', 'iphone', 'galaxy'],
  laptop: ['macbook', 'xps', 'notebook', 'ultrabook'],
  notebook: ['laptop', 'macbook', 'xps'],
  computer: ['laptop', 'macbook', 'xps', 'desktop'],
  pc: ['laptop', 'computer', 'desktop'],
  tablet: ['ipad'],
  headphone: ['earbud', 'earphone', 'headset'],
  earbud: ['earphone', 'headphone'],
  earphone: ['earbud', 'headphone'],
  headset: ['headphone', 'earphone'],
  watch: ['smartwatch', 'tracker'],
  smartwatch: ['watch', 'tracker'],
  tv: ['television', 'projector', 'monitor'],
  television: ['tv', 'projector', 'monitor'],
  screen: ['monitor', 'display'],
  camera: ['webcam', 'cam'],
  audio: ['speaker', 'earbud', 'earphone', 'headset'],
  music: ['speaker', 'earbud', 'earphone', 'headset'],
  game: ['gaming'],
  gamer: ['gaming'],
  shoe: ['sneaker', 'trainer', 'footwear'],
  sneaker: ['shoe', 'trainer'],
  trainer: ['sneaker', 'shoe'],
  footwear: ['shoe', 'sneaker'],
  tee: ['shirt', 'tshirt'],
  tshirt: ['shirt', 'tee'],
  pant: ['jean', 'trouser', 'legging', 'short'],
  trouser: ['pant', 'jean'],
  jacket: ['coat', 'hoodie'],
  coat: ['jacket'],
  sweater: ['cardigan', 'hoodie', 'jumper'],
  jumper: ['sweater', 'cardigan'],
  hoodie: ['sweatshirt', 'sweater'],
  novel: ['book'],
  programming: ['code', 'coding', 'programmer', 'developer', 'software', 'javascript', 'python'],
  coding: ['programming', 'code', 'developer'],
  code: ['programming', 'coding'],
  developer: ['programming', 'coding', 'programmer'],
  cooking: ['cookbook', 'recipe', 'kitchen'],
  cook: ['cookbook', 'recipe', 'kitchen'],
  recipe: ['cookbook'],
  kitchen: ['cooking', 'coffee', 'cookbook'],
  coffee: ['espresso', 'mug'],
  gym: ['dumbbell', 'exercise', 'fitness', 'workout'],
  workout: ['exercise', 'fitness', 'gym'],
  fitness: ['exercise', 'workout'],
  exercise: ['fitness', 'workout'],
  bag: ['backpack'],
  backpack: ['bag'],
  light: ['lamp', 'led'],
  lamp: ['light'],
  plant: ['garden', 'pot', 'grow'],
  sleep: ['pillow', 'sheet', 'bed'],
  bed: ['pillow', 'sheet'],
  cleaning: ['vacuum', 'purifier', 'cleaner'],
  vacuum: ['cleaner'],
  security: ['camera', 'doorbell'],
  people: ['person'],
  travel: ['backpack', 'portable'],
  hike: ['hiking'],
  camp: ['camping', 'tent'],
  fish: ['fishing'],
  swim: ['swimming'],
  run: ['running'],
  storage: ['ssd'],
};