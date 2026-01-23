import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductManagerGraphql from '../ProductManagerGraphql';

const requestMock = vi.fn().mockResolvedValue({ product: [] });

vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn(() => ({ request: requestMock })),
}));

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocols?: string | string[];
  onopen?: () => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  onclose?: () => void;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send() {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

beforeEach(() => {
  requestMock.mockClear();
  window.localStorage.clear();
  window.localStorage.removeItem('jwt_token');
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

const renderAuthed = () => {
  window.localStorage.setItem('jwt_token', 'test-token');
  return render(<ProductManagerGraphql />);
};

const createDeferred = () => {
  let resolve: (value: unknown) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};

describe('ProductManagerGraphql', () => {
  it('renders login prompt when not authenticated', async () => {
    render(<ProductManagerGraphql />);
    expect(screen.getByText('JWT Login (GraphQL)')).toBeInTheDocument();
    expect(await screen.findByText('Please sign in to manage products.')).toBeInTheDocument();
  });

  it('renders product controls when authenticated', async () => {
    renderAuthed();
    expect(await screen.findByText('Add Product')).toBeInTheDocument();
  });

  it('shows loading state while fetching products', async () => {
    const deferred = createDeferred();
    requestMock.mockReturnValueOnce(deferred.promise);
    renderAuthed();
    expect(await screen.findByText('Loading products...')).toBeInTheDocument();
    deferred.resolve({ product: [] });
    await screen.findByText('Add Product');
  });

  it('shows error state when products query fails', async () => {
    requestMock.mockRejectedValueOnce(new Error('Test error'));
    renderAuthed();
    expect(await screen.findByText('Error: Test error')).toBeInTheDocument();
  });

  it('renders product list from query', async () => {
    requestMock.mockResolvedValueOnce({
      product: [
        {
          id: 1,
          name: 'Test Product',
          comment: 'Test Comment',
          quantity: 10,
          company_id: 1,
          company: { id: 1, name: 'Test Company' },
        },
      ],
    });
    renderAuthed();
    expect(await screen.findByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText(/Test Comment/)).toBeInTheDocument();
    expect(screen.getByText(/Test Company/)).toBeInTheDocument();
  });

  it('adds a new product', async () => {
    requestMock
      .mockResolvedValueOnce({ product: [] })
      .mockResolvedValueOnce({
        insert_product_one: {
          id: 2,
          name: 'New Product',
          comment: 'New Comment',
          quantity: 5,
          company_id: 2,
          company: { id: 2, name: 'New Company' },
        },
      });

    renderAuthed();
    await screen.findByText('Add Product');

    fireEvent.change(screen.getByPlaceholderText('Product name'), {
      target: { value: 'New Product' },
    });
    fireEvent.change(screen.getByPlaceholderText('Comment'), {
      target: { value: 'New Comment' },
    });
    fireEvent.change(screen.getByPlaceholderText('Quantity'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByPlaceholderText('Company ID'), {
      target: { value: '2' },
    });

    fireEvent.click(screen.getByText('Add Product'));

    expect(await screen.findByText('New Product')).toBeInTheDocument();
    expect(screen.getByText(/New Comment/)).toBeInTheDocument();
  });

  it('updates a product', async () => {
    requestMock
      .mockResolvedValueOnce({
        product: [
          {
            id: 1,
            name: 'Old Product',
            comment: 'Old Comment',
            quantity: 1,
            company_id: 1,
            company: { id: 1, name: 'Company' },
          },
        ],
      })
      .mockResolvedValueOnce({
        update_product_by_pk: {
          id: 1,
          name: 'Updated Product',
          comment: 'New Comment',
          quantity: 2,
          company_id: 1,
          company: { id: 1, name: 'Company' },
        },
      });

    renderAuthed();
    await screen.findByText('Old Product');

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByPlaceholderText('Product name'), {
      target: { value: 'Updated Product' },
    });
    fireEvent.change(screen.getByPlaceholderText('Comment'), {
      target: { value: 'New Comment' },
    });
    fireEvent.change(screen.getByPlaceholderText('Quantity'), {
      target: { value: '2' },
    });

    fireEvent.click(screen.getByText('Update Product'));

    expect(await screen.findByText('Updated Product')).toBeInTheDocument();
    expect(screen.getByText(/New Comment/)).toBeInTheDocument();
  });

  it('deletes a product', async () => {
    requestMock
      .mockResolvedValueOnce({
        product: [
          {
            id: 1,
            name: 'Product to Delete',
            comment: 'Comment',
            quantity: 10,
            company_id: 1,
            company: { id: 1, name: 'Company' },
          },
        ],
      })
      .mockResolvedValueOnce({ delete_product_by_pk: { id: 1 } });

    renderAuthed();
    await screen.findByText('Product to Delete');

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(screen.queryByText('Product to Delete')).not.toBeInTheDocument();
    });
  });
});
