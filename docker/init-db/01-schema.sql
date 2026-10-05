-- BYB Database Schema - Phase 0
-- Markets, Products, Merchants, Offers, Categories

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Markets table
CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(2) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    language VARCHAR(10) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    currency_symbol VARCHAR(5) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Merchants table
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market-Merchant relationship (which merchants are enabled for which markets)
CREATE TABLE market_merchants (
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (market_id, merchant_id)
);

-- Products table (canonical products)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(200) NOT NULL,
    name VARCHAR(300) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    model VARCHAR(100),
    category_id UUID REFERENCES categories(id),
    image_url VARCHAR(500),
    attributes JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on slug per category for cleaner URLs
CREATE UNIQUE INDEX idx_products_slug_category ON products(slug, category_id) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX idx_products_slug_no_category ON products(slug) WHERE category_id IS NULL;

-- Offers table (merchant-specific offers for products)
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    external_product_id VARCHAR(200) NOT NULL,
    price_amount INTEGER NOT NULL, -- Price in minor units (cents, tetri, etc.)
    currency_code VARCHAR(3) NOT NULL,
    availability VARCHAR(50) NOT NULL DEFAULT 'unknown', -- in_stock, out_of_stock, limited, pre_order, unknown
    shipping_info JSONB NOT NULL DEFAULT '{}',
    destination_url VARCHAR(1000) NOT NULL,
    affiliate_metadata JSONB NOT NULL DEFAULT '{}',
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, merchant_id, market_id, external_product_id)
);

-- Indexes for common queries
CREATE INDEX idx_offers_product_id ON offers(product_id);
CREATE INDEX idx_offers_merchant_id ON offers(merchant_id);
CREATE INDEX idx_offers_market_id ON offers(market_id);
CREATE INDEX idx_offers_price_amount ON offers(price_amount);
CREATE INDEX idx_offers_is_active ON offers(is_active) WHERE is_active = true;
CREATE INDEX idx_offers_last_checked ON offers(last_checked_at);

-- Product-Market relationship (which products are available in which markets)
CREATE TABLE product_markets (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, market_id)
);

-- Search analytics (optional, for future trending/popular)
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID REFERENCES markets(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    normalized_query TEXT,
    intent_json JSONB,
    results_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_queries_market ON search_queries(market_id);
CREATE INDEX idx_search_queries_created ON search_queries(created_at);

-- Insert initial markets
INSERT INTO markets (code, name, locale, language, currency_code, currency_symbol) VALUES
    ('GE', 'Georgia', 'ka-GE', 'ka', 'GEL', '₾'),
    ('AM', 'Armenia', 'hy-AM', 'hy', 'AMD', '֏'),
    ('AZ', 'Azerbaijan', 'az-AZ', 'az', 'AZN', '₼')
ON CONFLICT (code) DO NOTHING;

-- Insert initial merchants
INSERT INTO merchants (code, name, logo_url, website_url) VALUES
    ('amazon', 'Amazon', '/logos/amazon.svg', 'https://www.amazon.com'),
    ('temu', 'Temu', '/logos/temu.svg', 'https://www.temu.com'),
    ('aliexpress', 'AliExpress', '/logos/aliexpress.svg', 'https://www.aliexpress.com'),
    ('ebay', 'eBay', '/logos/ebay.svg', 'https://www.ebay.com')
ON CONFLICT (code) DO NOTHING;

-- Enable all merchants for all markets by default
INSERT INTO market_merchants (market_id, merchant_id, is_enabled, priority)
SELECT m.id, merch.id, true, 0
FROM markets m
CROSS JOIN merchants merch
ON CONFLICT (market_id, merchant_id) DO NOTHING;

-- Insert sample categories
INSERT INTO categories (slug, name, description) VALUES
    ('electronics', 'Electronics', 'Electronic devices and accessories'),
    ('headphones', 'Headphones', 'Headphones and earphones'),
    ('smartphones', 'Smartphones', 'Mobile phones and accessories'),
    ('laptops', 'Laptops', 'Laptops and notebooks'),
    ('home-appliances', 'Home Appliances', 'Home and kitchen appliances'),
    ('fashion', 'Fashion', 'Clothing and accessories'),
    ('beauty', 'Beauty', 'Beauty and personal care'),
    ('sports', 'Sports', 'Sports and outdoor equipment')
ON CONFLICT (slug) DO NOTHING;

-- Set up parent-child relationships for categories
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'electronics')
WHERE slug IN ('headphones', 'smartphones', 'laptops');