import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import * as z from 'zod/v4'
import type { ScanService } from './scan-service.js'

export function createMcpHandler(
  scanServiceForRequest: (request: Request) => ScanService,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const scanService = scanServiceForRequest(request)
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    })
    const server = new McpServer({ name: 'ASP Pulse', version: '0.1.0' })

    server.registerTool(
      'preflight_x402_endpoint',
      {
        title: 'Preflight an x402 endpoint',
        description:
          'Runs a free, unauthenticated HTTPS GET preflight against a public x402 endpoint. It never sends payment or verifies protected delivery.',
        inputSchema: {
          target: z
            .string()
            .url()
            .describe('Complete public HTTPS URL of the x402 GET endpoint.'),
        },
      },
      async ({ target }) => {
        try {
          const scan = await scanService.scan(target)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    scanId: scan.id,
                    target: scan.report.target,
                    verdict: scan.report.verdict,
                    verdictLabel: scan.report.verdictLabel,
                    checks: scan.report.checks,
                    evidenceReceipt: scan.report.evidenceHash,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text:
                  error instanceof Error
                    ? error.message
                    : 'The endpoint could not be checked.',
              },
            ],
            isError: true,
          }
        }
      },
    )

    await server.connect(transport)
    return transport.handleRequest(request)
  }
}
