/*
  # Create products table for Bazar Retro catalog
  1. New Tables
    - `products`
      - `id` (uuid, primary key) - Unique identifier for each product
      - `name` (text) - Product name
      - `quantity` (integer) - Stock quantity
      - `price` (numeric) - Product price
      - `category` (text) - Product category
      - `images` (text[]) - Array of image URLs
      - `videos` (text[]) - Array of video URLs
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
  2. Security
    - Enable RLS but allow public access for INSERT (temporal para migración)
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity integer DEFAULT 0,
  price numeric NOT NULL,
  category text DEFAULT 'Adornos',
  images text[] DEFAULT '{}',
  videos text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can view products
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  USING (true);

-- TEMPORAL: Permitir INSERT público para la migración
CREATE POLICY "Anyone can insert products"
  ON products FOR INSERT
  TO public
  WITH CHECK (true);

-- TEMPORAL: Permitir UPDATE público
CREATE POLICY "Anyone can update products"
  ON products FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- TEMPORAL: Permitir DELETE público
CREATE POLICY "Anyone can delete products"
  ON products FOR DELETE
  TO public
  USING (true);

-- Eliminar el producto de ejemplo si existe
DELETE FROM products WHERE name = 'Ejemplo Producto Vintage';