'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { ProductsDocument, type ProductsQuery } from '@/graphql';
import JwtLogin from './JwtLogin';

const hasuraUrl =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';
const hasuraWsUrl =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_WS_URL ?? hasuraUrl.replace(/^http/, 'ws');
const hasuraAdminSecret = process.env.NEXT_PUBLIC_HASURA_ADMIN_SECRET;
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5005';

type ProductItem = ProductsQuery['product'][number];

const productsSubscription = `
  subscription ProductsSubscription {
    product {
      comment
      company_id
      created_at
      id
      name
      quantity
      updated_at
      company {
        id
        name
      }
    }
  }
`;

export default function ProductManagerGraphql() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const hasDataRef = useRef(false);

  const handleProductsUpdate = useCallback((nextProducts: ProductItem[]) => {
    setProducts(nextProducts);
    setError(null);
    if (!hasDataRef.current) {
      hasDataRef.current = true;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('jwt_token');
    setJwtToken(storedToken);
    setIsAuthenticated(Boolean(storedToken));
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthenticated) {
      setProducts([]);
      setError(null);
      setIsLoading(false);
    }
  }, [authChecked, isAuthenticated]);

  const handleLoginSuccess = (token: string) => {
    setJwtToken(token);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setIsLoading(true);
    setError(null);
    hasDataRef.current = false;
    window.localStorage.setItem('jwt_token', token);
  };

  const handleLogout = () => {
    setJwtToken(null);
    setIsAuthenticated(false);
    setProducts([]);
    setError(null);
    setIsLoading(false);
    hasDataRef.current = false;
    window.localStorage.removeItem('jwt_token');
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    const client = new GraphQLClient(hasuraUrl, {
      headers: hasuraAdminSecret
        ? { 'x-hasura-admin-secret': hasuraAdminSecret }
        : undefined,
    });

    client
      .request(ProductsDocument)
      .then((data) => {
        handleProductsUpdate(data.product);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load products.');
        setIsLoading(false);
      });
  }, [authChecked, handleProductsUpdate, isAuthenticated]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    const socket = new WebSocket(hasuraWsUrl, 'graphql-transport-ws');
    const subscriptionId = 'products-subscription';

    const sendMessage = (message: Record<string, unknown>) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    socket.onopen = () => {
      const payload = hasuraAdminSecret
        ? { headers: { 'x-hasura-admin-secret': hasuraAdminSecret } }
        : undefined;
      sendMessage(payload ? { type: 'connection_init', payload } : { type: 'connection_init' });
    };

    socket.onmessage = (event) => {
      let message: { type?: string; payload?: any } | null = null;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message?.type === 'connection_ack') {
        sendMessage({
          id: subscriptionId,
          type: 'subscribe',
          payload: { query: productsSubscription },
        });
        return;
      }

      if (message?.type === 'next') {
        const nextProducts = message.payload?.data?.product;
        if (Array.isArray(nextProducts)) {
          handleProductsUpdate(nextProducts);
        }
        return;
      }

      if (message?.type === 'error') {
        setError('Subscription error while listening for updates.');
        setIsLoading(false);
      }
    };

    socket.onerror = () => {
      setError('WebSocket connection error.');
      setIsLoading(false);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        sendMessage({ id: subscriptionId, type: 'complete' });
      }
      socket.close();
    };
  }, [authChecked, handleProductsUpdate, isAuthenticated]);

  return (
    <div className="p-4">
      <JwtLogin
        backendUrl={backendUrl}
        token={jwtToken}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        title="JWT Login (GraphQL)"
      />
      <h1 className="text-xl font-bold mb-4">Product List (GraphQL)</h1>
      {!authChecked && <div>Checking authentication...</div>}
      {authChecked && !isAuthenticated && (
        <div className="text-gray-600">
          Please sign in to view products in real time.
        </div>
      )}
      {authChecked && isAuthenticated && isLoading && (
        <div>Loading products...</div>
      )}
      {authChecked && isAuthenticated && error && (
        <div className="text-red-600">
          Failed to load products: {error}
        </div>
      )}
      {authChecked && isAuthenticated && !isLoading && !error && (
        <ul>
          {products.map((product) => (
            <li key={product.id} className="mb-2">
              <span className="font-bold">{product.name ?? 'Unnamed'}</span> -{' '}
              {product.comment ?? 'No comment'} ({product.quantity ?? 0}) from{' '}
              {product.company?.name ?? 'Unknown company'} ({product.company_id})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
