import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createGatePassMcpServer } from '@/lib/mcp/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
}

/**
 * GatePass MCP server (Streamable HTTP) at /api/mcp.
 * Stateless: every request gets a fresh server and a plain JSON response, which suits serverless.
 */
async function handle(request: Request): Promise<Response> {
    const server = createGatePassMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    try {
        const response = await transport.handleRequest(request)
        // Read the body before the server is closed below
        const body = response.status === 204 || response.status === 202 ? null : await response.text()
        const headers = new Headers(response.headers)
        for (const [key, value] of Object.entries(CORS)) headers.set(key, value)
        return new Response(body, { status: response.status, statusText: response.statusText, headers })
    } finally {
        // Release the per-request server
        await transport.close().catch(() => {})
        await server.close().catch(() => {})
    }
}

export const GET = handle
export const POST = handle
export const DELETE = handle

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS })
}
