// Stub API - Simulates MCP tool responses with fake data
// No network calls, returns promises for async pattern

export const stubApi = {
  // GOFR-IQ: Client intelligence
  listClients: async () => ({
    clients: [
      { guid: 'c1', name: 'Acme Fund', client_type: 'INSTITUTIONAL' },
      { guid: 'c2', name: 'Jane Doe', client_type: 'RETAIL' },
      { guid: 'c3', name: 'Global Ventures', client_type: 'INSTITUTIONAL' },
    ],
  }),

  getClientFeed: async (guid: string) => ({
    client_guid: guid,
    articles: [
      { title: 'Fed Raises Rates', impact_score: 85, ticker: 'SPY', published: '2026-01-30' },
      { title: 'Tech Sector Rally', impact_score: 72, ticker: 'QQQ', published: '2026-01-29' },
    ],
  }),

  // GOFR-NP: Network and infrastructure health
  healthCheck: async () => ({
    status: 'ok',
    services: {
      neo4j: 'up',
      chromadb: 'up',
      vault: 'up',
    },
    timestamp: new Date().toISOString(),
  }),
};
