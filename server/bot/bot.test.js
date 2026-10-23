// Run with: npm test
// Checks that the rule-based bot understands common shopping questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config.js';
import { generateReply } from './index.js';
import { getProductById } from './search.js';

// Test the rule-based bot only: no network calls, no Groq quota used, same result every run.
config.llm.apiKey = '';

async function ask(message, context = {}) {
  const reply = await generateReply({ message, context });
  return { ...reply, products: reply.productIds.map(getProductById) };
}

test('"shirts" finds shirts instead of a greeting', async () => {
  const { products, text } = await ask('show me shirts');
  assert.ok(products.length > 0, text);
  for (const p of products) assert.match(p.name, /shirt/i);
});

test('"laptop" finds both laptops', async () => {
  const names = (await ask('I need a laptop')).products.map((p) => p.name);
  assert.deepEqual(names.sort(), ['Dell XPS 13', 'MacBook Pro 16-inch']);
});

test('"headphones" does not return phones', async () => {
  const { products } = await ask('headphones');
  assert.ok(products.length > 0);
  for (const p of products) assert.doesNotMatch(p.name, /iphone|galaxy/i);
});

test('budgets are respected', async () => {
  const laptops = (await ask('laptop under 1500')).products;
  assert.deepEqual(laptops.map((p) => p.name), ['Dell XPS 13']);
  for (const p of (await ask('anything under $30')).products) assert.ok(p.price <= 30);
  for (const p of (await ask('books between $30 and $40')).products) {
    assert.equal(p.category, 'Books');
    assert.ok(p.price >= 30 && p.price <= 40);
  }
});

test('categories and sorting', async () => {
  const { products } = await ask('cheapest electronics');
  assert.ok(products.every((p) => p.category === 'Electronics'));
  const prices = products.map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('in-stock filter hides out-of-stock items', async () => {
  const { products } = await ask('gaming in stock');
  assert.ok(products.length > 0);
  assert.ok(products.every((p) => p.inStock));
});

test('greeting, help and policy questions get no products', async () => {
  for (const message of ['hi', 'help', 'what is your return policy']) {
    const { products, text } = await ask(message);
    assert.equal(products.length, 0, message);
    assert.ok(text.length > 0);
  }
});

test('product details and comparisons', async () => {
  const details = await ask('tell me about the macbook');
  assert.equal(details.products[0].name, 'MacBook Pro 16-inch');
  assert.match(details.text, /\$2,499\.99/);

  const compare = await ask('compare iphone 15 pro vs galaxy s24');
  assert.deepEqual(compare.products.map((p) => p.name), ['iPhone 15 Pro', 'Samsung Galaxy S24 Ultra']);
});

test('follow-ups: show more and cheaper', async () => {
  const first = await ask('electronics');
  const more = await ask('show more', first.context);
  assert.equal(more.products.length, 3);
  assert.ok(more.products.every((p) => !first.productIds.includes(p.id)));

  const cheaper = await ask('cheaper', first.context);
  const lowestShown = Math.min(...first.products.map((p) => p.price));
  assert.ok(cheaper.products.length > 0);
  assert.ok(cheaper.products.every((p) => p.price < lowestShown && p.category === 'Electronics'));
});

test('a budget on its own refines the previous search', async () => {
  const first = await ask('books');
  const next = await ask('under $30', first.context);
  assert.ok(next.products.length > 0);
  assert.ok(next.products.every((p) => p.category === 'Books' && p.price <= 30));
});