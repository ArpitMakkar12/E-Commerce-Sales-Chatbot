import React, { useState } from 'react';
import { Star, ShoppingCart, Eye, Heart } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  features: string[];
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAddToCart = () => {
    // In a real app, this would add to cart
    alert(`Added ${product.name} to cart!`);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image */}
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-40 object-cover"
        />
        {!product.inStock && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
        {isHovered && product.inStock && (
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200">
              <Heart className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {product.category}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
          {product.name}
        </h3>
        
        <p className="text-gray-600 text-xs mb-2 line-clamp-2">
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center space-x-1 mb-2">
          <div className="flex space-x-0.5">
            {renderStars(product.rating)}
          </div>
          <span className="text-xs text-gray-500">
            {product.rating} ({product.reviews})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
          {product.inStock && (
            <span className="text-xs text-green-600 font-medium">In Stock</span>
          )}
        </div>

        {/* Features (collapsed by default) */}
        {showDetails && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-700 mb-1">Features:</h4>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {product.features.slice(0, 3).map((feature, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1 h-1 bg-blue-600 rounded-full mr-2"></span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
            product.inStock
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-md'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ShoppingCart className="h-3 w-3" />
          <span>{product.inStock ? 'Add to Cart' : 'Out of Stock'}</span>
        </button>
      </div>
    </div>
  );
}