import { useEffect, useState } from 'react';
import { Star, ShoppingCart, Heart, ChevronDown, Check, Cpu, BookOpen, Shirt, Home, Dumbbell, Package } from 'lucide-react';
import type { Product } from '../types';

// Shown in place of the photo if an image fails to load.
const CATEGORY_ICONS: Record<string, typeof Package> = {
  Electronics: Cpu,
  Books: BookOpen,
  Clothing: Shirt,
  'Home & Garden': Home,
  'Sports & Outdoors': Dumbbell,
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// "Saved" (heart) products are remembered in this browser.
const SAVED_KEY = 'savedProducts';
function readSaved(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable: the heart still toggles for this visit */
  }
}

export function ProductCard({ product }: { product: Product }) {
  const [showDetails, setShowDetails] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [saved, setSaved] = useState(() => readSaved().includes(product.id));
  const [added, setAdded] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[product.category] ?? Package;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  const toggleSaved = () => {
    const ids = readSaved().filter((id) => id !== product.id);
    writeSaved(saved ? ids : [...ids, product.id]);
    setSaved(!saved);
  };

  return (
    <div className="flex flex-col overflow-hidden text-gray-900 transition-all duration-300 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg">
      {/* Image */}
      <div className="relative">
        {imageFailed ? (
          <div className="flex flex-col items-center justify-center w-full h-40 text-blue-700 bg-gradient-to-br from-blue-100 to-purple-100">
            <CategoryIcon className="w-10 h-10 mb-2" />
            <span className="px-4 text-xs font-medium text-center line-clamp-1">{product.name}</span>
          </div>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="object-cover w-full h-40"
          />
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
            <span className="font-semibold text-white">Out of Stock</span>
          </div>
        )}
        <span className="absolute px-2 py-1 text-xs text-white bg-blue-600 rounded-full top-2 left-2">
          {product.category}
        </span>
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
          className="absolute p-2 transition-colors duration-200 rounded-full shadow-sm top-2 right-2 bg-white/90 hover:bg-white"
        >
          <Heart className={`h-4 w-4 ${saved ? 'text-red-500 fill-current' : 'text-gray-700'}`} />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="mb-1 text-sm font-semibold line-clamp-1" title={product.name}>
          {product.name}
        </h3>
        <p className="mb-2 text-xs text-gray-600 line-clamp-2">{product.description}</p>

        <div className="flex items-center mb-2 space-x-1" aria-label={`Rated ${product.rating} out of 5`}>
          <div className="flex space-x-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < Math.round(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {product.rating} ({product.reviews.toLocaleString('en-US')})
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold">{usd.format(product.price)}</span>
          <span className={`text-xs font-medium ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
          className="flex items-center self-start mb-3 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {showDetails ? 'Hide features' : 'Show features'}
          <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
        {showDetails && (
          <ul className="mb-3 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-0.5">
            {product.features.map((feature) => (
              <li key={feature} className="flex items-center">
                <span className="w-1 h-1 mr-2 bg-blue-600 rounded-full shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setAdded(true)}
          disabled={!product.inStock}
          className={`mt-auto w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
            !product.inStock
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : added
                ? 'bg-green-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-md'
          }`}
        >
          {added ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
          <span>{!product.inStock ? 'Out of Stock' : added ? 'Added to cart' : 'Add to Cart'}</span>
        </button>
      </div>
    </div>
  );
}