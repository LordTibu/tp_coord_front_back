import { render, screen } from '@testing-library/react';
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
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

describe('ProductManagerGraphql', () => {
  it('renders login prompt when not authenticated', async () => {
    render(<ProductManagerGraphql />);
    expect(screen.getByText('JWT Login (GraphQL)')).toBeInTheDocument();
    expect(await screen.findByText('Please sign in to manage products.')).toBeInTheDocument();
  });

  it('renders product controls when authenticated', async () => {
    window.localStorage.setItem('jwt_token', 'test-token');
    render(<ProductManagerGraphql />);
    expect(await screen.findByText('Add Product')).toBeInTheDocument();
  });
});
