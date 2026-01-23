'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraphQLClient } from 'graphql-request';
import { ProductsDocument, type ProductsQuery } from '@/graphql';
import JwtLogin from './JwtLogin';

const hasuraUrl =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql';
const hasuraWsUrl =
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_WS_URL ?? hasuraUrl.replace(/^http/, 'ws');
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5005';

type ProductItem = ProductsQuery['product'][number];

const productsSubscription = `
  subscription ProductsSubscription {
    product(order_by: {created_at: desc}) {
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

const insertProductMutation = `
  mutation InsertProduct($object: product_insert_input!) {
    insert_product_one(object: $object) {
      id
      name
      comment
      quantity
      company_id
      created_at
      updated_at
      company {
        id
        name
      }
    }
  }
`;

const updateProductMutation = `
  mutation UpdateProduct($id: Int!, $set: product_set_input!) {
    update_product_by_pk(pk_columns: {id: $id}, _set: $set) {
      id
      name
      comment
      quantity
      company_id
      created_at
      updated_at
      company {
        id
        name
      }
    }
  }
`;

const deleteProductMutation = `
  mutation DeleteProduct($id: Int!) {
    delete_product_by_pk(id: $id) {
      id
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
  const [newProduct, setNewProduct] = useState({
    name: '',
    comment: '',
    quantity: 0,
    company_id: 0
  });
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

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

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.comment || newProduct.quantity <= 0 || newProduct.company_id <= 0) {
      alert('Please fill in all fields correctly.');
      return;
    }

    try {
      const client = new GraphQLClient(hasuraUrl, {
        headers: {
          ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` }),
        },
      });
      const data = await client.request(insertProductMutation, {
        object: newProduct,
      });
      setProducts((prev) => [data.insert_product_one, ...prev]);
      setNewProduct({ name: '', comment: '', quantity: 0, company_id: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product.');
    }
  };

  const updateProduct = async () => {
    if (!editingProduct) return;

    try {
      const client = new GraphQLClient(hasuraUrl, {
        headers: {
          ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` }),
        },
      });
      const data = await client.request(updateProductMutation, {
        id: editingProduct.id,
        set: {
          name: editingProduct.name,
          comment: editingProduct.comment,
          quantity: editingProduct.quantity,
          company_id: editingProduct.company_id,
        },
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? data.update_product_by_pk : p))
      );
      setEditingProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product.');
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      const client = new GraphQLClient(hasuraUrl, {
        headers: {
          ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` }),
        },
      });
      await client.request(deleteProductMutation, { id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product.');
    }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    const client = new GraphQLClient(hasuraUrl, {
      headers: {
        ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` }),
      },
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
  }, [authChecked, handleProductsUpdate, isAuthenticated, jwtToken]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const subscriptionId = 'products-subscription';
    let isReconnecting = false;

    const connect = () => {
      if (socket && socket.readyState === WebSocket.OPEN) return;

      socket = new WebSocket(hasuraWsUrl, 'graphql-ws');

      const sendMessage = (message: Record<string, unknown>) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      };

      socket.onopen = () => {
        console.log('WebSocket connected');
        const payload = {
          headers: {
            ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` }),
          },
        };
        sendMessage({ type: 'connection_init', payload });
      };

      socket.onmessage = (event) => {
        let message: { type?: string; payload?: any; id?: string } | null = null;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          return;
        }

        if (!message) {
          return;
        }

        console.log('WebSocket message received:', message.type, message);

        if (message?.type === 'connection_ack') {
          console.log('WebSocket connection acknowledged, subscribing to products...');
          sendMessage({
            id: subscriptionId,
            type: 'start',
            payload: {
              query: productsSubscription,
              variables: {},
            },
          });
          return;
        }

        if (message?.type === 'ping') {
          console.log('Received ping, sending pong');
          sendMessage({ type: 'pong', payload: message.payload });
          return;
        }

        if ((message?.type === 'data' || message?.type === 'next') && message.id === subscriptionId) {
          const nextProducts = message.payload?.data?.product;
          if (Array.isArray(nextProducts)) {
            console.log('Received products update:', nextProducts.length, 'products');
            handleProductsUpdate(nextProducts);
          }
          return;
        }

        if (message?.type === 'error') {
          console.error('WebSocket subscription error:', message.payload);
          setError('Subscription error while listening for updates.');
          setIsLoading(false);
        }

        if (message?.type === 'complete' && message.id === subscriptionId) {
          console.log('Subscription completed');
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (!isReconnecting) {
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            isReconnecting = true;
            connect();
          }, 5000);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error.');
        setIsLoading(false);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          const sendMessage = (message: Record<string, unknown>) => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(message));
            }
          };
          sendMessage({ id: subscriptionId, type: 'stop' });
        }
        socket.close();
      }
    };
  }, [authChecked, handleProductsUpdate, isAuthenticated, jwtToken]);

  return (
    <div className="p-4">
      <JwtLogin
        backendUrl={backendUrl}
        token={jwtToken}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        title="JWT Login (GraphQL)"
      />
      <h1 className="text-xl font-bold mb-4">Product Manager (GraphQL)</h1>
      {!authChecked && <div>Checking authentication...</div>}
      {authChecked && !isAuthenticated && (
        <div className="text-gray-600">
          Please sign in to manage products.
        </div>
      )}
      {authChecked && isAuthenticated && isLoading && (
        <div>Loading products...</div>
      )}
      {authChecked && isAuthenticated && error && (
        <div className="text-red-600">
          Error: {error}
        </div>
      )}
      {authChecked && isAuthenticated && !isLoading && !error && (
        <>
          {/* Add a New Product */}
          <div className="mb-4">
            <input
              type="text"
              className="border p-2 mr-2"
              placeholder="Product name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            />
            <input
              type="text"
              className="border p-2 mr-2"
              placeholder="Comment"
              value={newProduct.comment}
              onChange={(e) => setNewProduct({ ...newProduct, comment: e.target.value })}
            />
            <input
              type="number"
              className="border p-2 mr-2"
              placeholder="Quantity"
              value={newProduct.quantity}
              onChange={(e) =>
                setNewProduct({ ...newProduct, quantity: parseInt(e.target.value, 10) || 0 })
              }
            />
            <input
              type="number"
              className="border p-2 mr-2"
              placeholder="Company ID"
              value={newProduct.company_id}
              onChange={(e) =>
                setNewProduct({ ...newProduct, company_id: parseInt(e.target.value, 10) || 0 })
              }
            />
            <button
              onClick={addProduct}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Add Product
            </button>
          </div>

          {/* List of Products */}
          <ul>
            {products.map((product) => (
              <li key={product.id} className="mb-2 flex items-center">
                <div className="flex-1">
                  <span className="font-bold">{product.name ?? 'Unnamed'}</span> - {product.comment ?? 'No comment'} (
                  {product.quantity ?? 0}) from {product.company?.name ?? 'Unknown company'} ({product.company_id})
                </div>
                <button
                  onClick={() => setEditingProduct(product)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          {/* Edit Product */}
          {editingProduct && (
            <div className="mt-4">
              <input
                type="text"
                className="border p-2 mr-2"
                placeholder="Product name"
                value={editingProduct.name ?? ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
              />
              <input
                type="text"
                className="border p-2 mr-2"
                placeholder="Comment"
                value={editingProduct.comment ?? ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, comment: e.target.value })
                }
              />
              <input
                type="number"
                className="border p-2 mr-2"
                placeholder="Quantity"
                value={editingProduct.quantity ?? 0}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    quantity: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
              <input
                type="number"
                className="border p-2 mr-2"
                placeholder="Company ID"
                value={editingProduct.company_id}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, company_id: parseInt(e.target.value, 10) || 0 })
                }
              />
              <button
                onClick={updateProduct}
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
              >
                Update Product
              </button>
              <button
                onClick={() => setEditingProduct(null)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
