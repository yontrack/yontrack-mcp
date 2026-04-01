import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

/**
 * Creates a linked in-process MCP server+client pair.
 * Pass a register function to attach tools to the server before connecting.
 */
export async function createTestClient(
  register: (server: McpServer) => void
): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  register(server);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "0.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return client;
}
