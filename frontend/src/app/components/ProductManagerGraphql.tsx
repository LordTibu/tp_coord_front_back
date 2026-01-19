'use client';

import { useEffect, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { ProductsDocument, type ProductsQuery } from '@/graphql';

const hasuraUrl =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';
const hasuraAdminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET;

type ProductItem = ProductsQuery['product'][number];

export default function ProductManagerGraphql() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const client = new GraphQLClient(hasuraUrl, {
      headers: hasuraAdminSecret
        ? { 'x-hasura-admin-secret': hasuraAdminSecret }
        : undefined,
    });

    client
      .request(ProductsDocument)
      .then((data) => {
        setProducts(data.product);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load products.');
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="p-4">Loading products...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Failed to load products: {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Product List (GraphQL)</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id} className="mb-2">
            <span className="font-bold">{product.name ?? 'Unnamed'}</span> - {' '}
            {product.comment ?? 'No comment'} ({product.quantity ?? 0}) from{' '}
            {product.company?.name ?? 'Unknown company'} ({product.company_id})
          </li>
        ))}
      </ul>
    </div>
  );
}
