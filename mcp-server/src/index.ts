#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod';

const API_BASE_URL = process.env.STORAGE_API_URL || 'http://localhost:3002/api/v1';
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3003;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function apiRequest<T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'API request failed');
  }

  return data.data;
}

// Types matching the API
interface Wall {
  id: number;
  name: string;
  gridColumns: number;
  cases?: Case[];
}

interface Case {
  id: number;
  wallId: number;
  name: string;
  gridColumnStart: number;
  gridColumnSpan: number;
  gridRowStart: number;
  gridRowSpan: number;
  internalColumns: number;
  internalRows: number;
  color: string;
  drawers?: Drawer[];
}

interface Drawer {
  id: number;
  caseId: number;
  name: string | null;
  widthUnits: number;
  heightUnits: number;
  gridColumn: number;
  gridRow: number;
  color: string;
  parts?: Part[];
}

interface Part {
  id: number;
  drawerId: number;
  name: string;
  notes: string | null;
  sortOrder: number;
  links?: PartLink[];
}

interface PartLink {
  id: number;
  partId: number;
  url: string;
  title: string | null;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

interface LayoutTemplate {
  id: number;
  name: string;
  description: string | null;
  columns: number;
  rows: number;
  layoutData: DrawerPlacement[];
  isBuiltin: boolean;
}

interface DrawerPlacement {
  col: number;
  row: number;
  widthUnits: number;
  heightUnits: number;
}

interface SearchResult {
  type: 'part' | 'drawer' | 'case';
  id: number;
  name: string;
  matchedField: string;
  matchedText: string;
  path: {
    wallName: string;
    caseName: string;
    drawerName: string | null;
  };
}

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'storage-info-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tools
  server.registerTool(
    'search_items',
    {
      description: 'Search for parts, drawers, or cases by name or content. Returns matching items with their location in the storage system.',
      inputSchema: {
        query: z.string().describe('Search query string (minimum 2 characters)'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
      },
    },
    async ({ query, limit = 20 }) => {
      const results = await apiRequest<SearchResult[]>(
        `/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    'list_walls',
    {
      description: 'List all storage walls in the system.',
      inputSchema: {},
    },
    async () => {
      const walls = await apiRequest<Wall[]>('/walls');
      return { content: [{ type: 'text', text: JSON.stringify(walls, null, 2) }] };
    }
  );

  server.registerTool(
    'get_wall',
    {
      description: 'Get a specific wall with all its cases and drawers.',
      inputSchema: {
        wallId: z.number().describe('The ID of the wall to retrieve'),
      },
    },
    async ({ wallId }) => {
      const wall = await apiRequest<Wall>(`/walls/${wallId}`);
      return { content: [{ type: 'text', text: JSON.stringify(wall, null, 2) }] };
    }
  );

  server.registerTool(
    'list_cases',
    {
      description: 'List all cases, optionally filtered by wall.',
      inputSchema: {
        wallId: z.number().optional().describe('Optional wall ID to filter cases'),
      },
    },
    async ({ wallId }) => {
      const endpoint = wallId ? `/cases?wallId=${wallId}` : '/cases';
      const cases = await apiRequest<Case[]>(endpoint);
      return { content: [{ type: 'text', text: JSON.stringify(cases, null, 2) }] };
    }
  );

  server.registerTool(
    'get_case',
    {
      description: 'Get a specific case with all its drawers.',
      inputSchema: {
        caseId: z.number().describe('The ID of the case to retrieve'),
      },
    },
    async ({ caseId }) => {
      const caseData = await apiRequest<Case>(`/cases/${caseId}`);
      return { content: [{ type: 'text', text: JSON.stringify(caseData, null, 2) }] };
    }
  );

  server.registerTool(
    'get_drawer',
    {
      description: 'Get a specific drawer with all its parts.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to retrieve'),
      },
    },
    async ({ drawerId }) => {
      const drawer = await apiRequest<Drawer>(`/drawers/${drawerId}`);
      return { content: [{ type: 'text', text: JSON.stringify(drawer, null, 2) }] };
    }
  );

  server.registerTool(
    'list_parts',
    {
      description: 'List all parts, optionally filtered by drawer.',
      inputSchema: {
        drawerId: z.number().optional().describe('Optional drawer ID to filter parts'),
      },
    },
    async ({ drawerId }) => {
      const endpoint = drawerId ? `/parts?drawerId=${drawerId}` : '/parts';
      const parts = await apiRequest<Part[]>(endpoint);
      return { content: [{ type: 'text', text: JSON.stringify(parts, null, 2) }] };
    }
  );

  server.registerTool(
    'get_part',
    {
      description: 'Get a specific part with its links.',
      inputSchema: {
        partId: z.number().describe('The ID of the part to retrieve'),
      },
    },
    async ({ partId }) => {
      const part = await apiRequest<Part>(`/parts/${partId}`);
      return { content: [{ type: 'text', text: JSON.stringify(part, null, 2) }] };
    }
  );

  server.registerTool(
    'create_part',
    {
      description: 'Create a new part in a drawer.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to add the part to'),
        name: z.string().describe('Name of the part'),
        notes: z.string().optional().describe('Optional notes about the part'),
      },
    },
    async ({ drawerId, name, notes }) => {
      const part = await apiRequest<Part>('/parts', 'POST', { drawerId, name, notes });
      return { content: [{ type: 'text', text: `Created part "${part.name}" with ID ${part.id}` }] };
    }
  );

  server.registerTool(
    'update_part',
    {
      description: 'Update an existing part.',
      inputSchema: {
        partId: z.number().describe('The ID of the part to update'),
        name: z.string().optional().describe('New name for the part'),
        notes: z.string().optional().describe('New notes for the part'),
      },
    },
    async ({ partId, name, notes }) => {
      const part = await apiRequest<Part>(`/parts/${partId}`, 'PUT', { name, notes });
      return { content: [{ type: 'text', text: `Updated part "${part.name}"` }] };
    }
  );

  server.registerTool(
    'delete_part',
    {
      description: 'Delete a part from a drawer.',
      inputSchema: {
        partId: z.number().describe('The ID of the part to delete'),
      },
    },
    async ({ partId }) => {
      await apiRequest(`/parts/${partId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Deleted part ${partId}` }] };
    }
  );

  server.registerTool(
    'move_part',
    {
      description: 'Move a part to a different drawer or change its position.',
      inputSchema: {
        partId: z.number().describe('The ID of the part to move'),
        drawerId: z.number().optional().describe('The ID of the destination drawer'),
        sortOrder: z.number().optional().describe('New sort order position'),
      },
    },
    async ({ partId, drawerId, sortOrder }) => {
      const part = await apiRequest<Part>(`/parts/${partId}/move`, 'PUT', { drawerId, sortOrder });
      return { content: [{ type: 'text', text: `Moved part "${part.name}" to drawer ${part.drawerId}` }] };
    }
  );

  server.registerTool(
    'create_drawer',
    {
      description: 'Create a new drawer in a case.',
      inputSchema: {
        caseId: z.number().describe('The ID of the case to add the drawer to'),
        widthUnits: z.number().optional().describe('Width of the drawer in grid units (default: 1)'),
        heightUnits: z.number().optional().describe('Height of the drawer in grid units (default: 1)'),
        gridColumn: z.number().describe('Column position in the case grid (1-based)'),
        gridRow: z.number().describe('Row position in the case grid (1-based)'),
        name: z.string().optional().describe('Optional name for the drawer'),
      },
    },
    async ({ caseId, widthUnits = 1, heightUnits = 1, gridColumn, gridRow, name }) => {
      const drawer = await apiRequest<Drawer>('/drawers', 'POST', {
        caseId,
        widthUnits,
        heightUnits,
        gridColumn,
        gridRow,
        name,
      });
      return { content: [{ type: 'text', text: `Created drawer with ID ${drawer.id} at position (${gridColumn}, ${gridRow}) with size ${widthUnits}x${heightUnits}` }] };
    }
  );

  server.registerTool(
    'update_drawer',
    {
      description: 'Update an existing drawer.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to update'),
        name: z.string().optional().describe('New name for the drawer'),
      },
    },
    async ({ drawerId, name }) => {
      const drawer = await apiRequest<Drawer>(`/drawers/${drawerId}`, 'PUT', { name });
      return { content: [{ type: 'text', text: `Updated drawer ${drawer.id}` }] };
    }
  );

  server.registerTool(
    'delete_drawer',
    {
      description: 'Delete a drawer and all its contents.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to delete'),
      },
    },
    async ({ drawerId }) => {
      await apiRequest(`/drawers/${drawerId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Deleted drawer ${drawerId}` }] };
    }
  );


  server.registerTool(
    'create_case',
    {
      description: 'Create a new case on a wall.',
      inputSchema: {
        wallId: z.number().describe('The ID of the wall to add the case to'),
        name: z.string().describe('Name of the case'),
        gridColumnStart: z.number().optional().describe('Starting column on the wall grid'),
        gridColumnSpan: z.number().optional().describe('Number of columns the case spans'),
        gridRowStart: z.number().optional().describe('Starting row on the wall grid'),
        gridRowSpan: z.number().optional().describe('Number of rows the case spans'),
        internalColumns: z.number().optional().describe('Number of internal drawer columns'),
        internalRows: z.number().optional().describe('Number of internal drawer rows'),
        color: z.string().optional().describe('Case color (hex format)'),
      },
    },
    async ({ wallId, name, gridColumnStart = 1, gridColumnSpan = 4, gridRowStart = 1, gridRowSpan = 3, internalColumns = 4, internalRows = 6, color = '#8B7355' }) => {
      const caseData = await apiRequest<Case>('/cases', 'POST', {
        wallId,
        name,
        gridColumnStart,
        gridColumnSpan,
        gridRowStart,
        gridRowSpan,
        internalColumns,
        internalRows,
        color,
      });
      return { content: [{ type: 'text', text: `Created case "${caseData.name}" with ID ${caseData.id}` }] };
    }
  );

  server.registerTool(
    'update_case',
    {
      description: 'Update an existing case.',
      inputSchema: {
        caseId: z.number().describe('The ID of the case to update'),
        name: z.string().optional().describe('New name for the case'),
        color: z.string().optional().describe('New color for the case (hex format)'),
        internalColumns: z.number().optional().describe('New number of internal columns'),
        internalRows: z.number().optional().describe('New number of internal rows'),
        gridColumnStart: z.number().optional().describe('Starting column position on the wall grid'),
        gridColumnSpan: z.number().optional().describe('Number of columns the case spans'),
        gridRowStart: z.number().optional().describe('Starting row position on the wall grid'),
        gridRowSpan: z.number().optional().describe('Number of rows the case spans'),
      },
    },
    async ({ caseId, name, color, internalColumns, internalRows, gridColumnStart, gridColumnSpan, gridRowStart, gridRowSpan }) => {
      const caseData = await apiRequest<Case>(`/cases/${caseId}`, 'PUT', {
        name,
        color,
        internalColumns,
        internalRows,
        gridColumnStart,
        gridColumnSpan,
        gridRowStart,
        gridRowSpan,
      });
      return { content: [{ type: 'text', text: `Updated case "${caseData.name}"` }] };
    }
  );

  server.registerTool(
    'delete_case',
    {
      description: 'Delete a case and all its drawers.',
      inputSchema: {
        caseId: z.number().describe('The ID of the case to delete'),
      },
    },
    async ({ caseId }) => {
      await apiRequest(`/cases/${caseId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Deleted case ${caseId}` }] };
    }
  );

  server.registerTool(
    'list_categories',
    {
      description: 'List all categories for organizing parts.',
      inputSchema: {},
    },
    async () => {
      const categories = await apiRequest<Category[]>('/categories');
      return { content: [{ type: 'text', text: JSON.stringify(categories, null, 2) }] };
    }
  );

  server.registerTool(
    'create_category',
    {
      description: 'Create a new category for organizing parts.',
      inputSchema: {
        name: z.string().describe('Name of the category'),
        color: z.string().describe('Color for the category (hex format, e.g., #FF5733)'),
        icon: z.string().optional().describe('Optional icon identifier for the category'),
      },
    },
    async ({ name, color, icon }) => {
      const category = await apiRequest<Category>('/categories', 'POST', { name, color, icon });
      return { content: [{ type: 'text', text: `Created category "${category.name}" with ID ${category.id}` }] };
    }
  );

  server.registerTool(
    'update_category',
    {
      description: 'Update an existing category.',
      inputSchema: {
        categoryId: z.number().describe('The ID of the category to update'),
        name: z.string().optional().describe('New name for the category'),
        color: z.string().optional().describe('New color for the category (hex format)'),
        icon: z.string().optional().describe('New icon identifier for the category'),
      },
    },
    async ({ categoryId, name, color, icon }) => {
      const category = await apiRequest<Category>(`/categories/${categoryId}`, 'PUT', { name, color, icon });
      return { content: [{ type: 'text', text: `Updated category "${category.name}"` }] };
    }
  );

  server.registerTool(
    'delete_category',
    {
      description: 'Delete a category.',
      inputSchema: {
        categoryId: z.number().describe('The ID of the category to delete'),
      },
    },
    async ({ categoryId }) => {
      await apiRequest(`/categories/${categoryId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Deleted category ${categoryId}` }] };
    }
  );

  server.registerTool(
    'add_part_link',
    {
      description: 'Add a link (URL) to a part for reference documentation.',
      inputSchema: {
        partId: z.number().describe('The ID of the part to add the link to'),
        url: z.string().describe('The URL of the link'),
        title: z.string().optional().describe('Optional title for the link'),
      },
    },
    async ({ partId, url, title }) => {
      const link = await apiRequest<PartLink>(`/parts/${partId}/links`, 'POST', { url, title });
      return { content: [{ type: 'text', text: `Added link "${title || url}" to part ${partId}` }] };
    }
  );

  server.registerTool(
    'add_drawer_category',
    {
      description: 'Add a category to a drawer for organization.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to add the category to'),
        categoryId: z.number().describe('The ID of the category to add'),
      },
    },
    async ({ drawerId, categoryId }) => {
      const categories = await apiRequest<Category[]>(`/drawers/${drawerId}/categories`, 'POST', { categoryId });
      return { content: [{ type: 'text', text: `Added category to drawer ${drawerId}. Drawer now has ${categories.length} category(ies).` }] };
    }
  );

  server.registerTool(
    'remove_drawer_category',
    {
      description: 'Remove a category from a drawer.',
      inputSchema: {
        drawerId: z.number().describe('The ID of the drawer to remove the category from'),
        categoryId: z.number().describe('The ID of the category to remove'),
      },
    },
    async ({ drawerId, categoryId }) => {
      await apiRequest(`/drawers/${drawerId}/categories/${categoryId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Removed category ${categoryId} from drawer ${drawerId}.` }] };
    }
  );

  server.registerTool(
    'bulk_add_drawer_category',
    {
      description: 'Add a category to multiple drawers at once.',
      inputSchema: {
        drawerIds: z.array(z.number()).describe('Array of drawer IDs to add the category to'),
        categoryId: z.number().describe('The ID of the category to add'),
      },
    },
    async ({ drawerIds, categoryId }) => {
      const results = await Promise.allSettled(
        drawerIds.map(drawerId =>
          apiRequest<Category[]>(`/drawers/${drawerId}/categories`, 'POST', { categoryId })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { content: [{ type: 'text', text: `Added category ${categoryId} to ${succeeded} drawer(s).${failed > 0 ? ` ${failed} failed.` : ''}` }] };
    }
  );

  server.registerTool(
    'bulk_remove_drawer_category',
    {
      description: 'Remove a category from multiple drawers at once.',
      inputSchema: {
        drawerIds: z.array(z.number()).describe('Array of drawer IDs to remove the category from'),
        categoryId: z.number().describe('The ID of the category to remove'),
      },
    },
    async ({ drawerIds, categoryId }) => {
      const results = await Promise.allSettled(
        drawerIds.map(drawerId =>
          apiRequest(`/drawers/${drawerId}/categories/${categoryId}`, 'DELETE')
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { content: [{ type: 'text', text: `Removed category ${categoryId} from ${succeeded} drawer(s).${failed > 0 ? ` ${failed} failed.` : ''}` }] };
    }
  );

  server.registerTool(
    'list_layout_templates',
    {
      description: 'List all available layout templates for cases.',
      inputSchema: {},
    },
    async () => {
      const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
      return { content: [{ type: 'text', text: JSON.stringify(templates, null, 2) }] };
    }
  );

  server.registerTool(
    'get_layout_template',
    {
      description: 'Get a specific layout template with its drawer placement data.',
      inputSchema: {
        templateId: z.number().describe('The ID of the template to retrieve'),
      },
    },
    async ({ templateId }) => {
      const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
      const template = templates.find(t => t.id === templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(template, null, 2) }] };
    }
  );

  server.registerTool(
    'create_layout_template',
    {
      description: 'Create a new layout template for cases. Layout templates define predefined drawer arrangements.',
      inputSchema: {
        name: z.string().describe('Name of the template'),
        description: z.string().optional().describe('Description of the template'),
        columns: z.number().describe('Number of columns in the template grid'),
        rows: z.number().describe('Number of rows in the template grid'),
        layoutData: z.array(z.object({
          col: z.number().describe('Column position (1-based)'),
          row: z.number().describe('Row position (1-based)'),
          widthUnits: z.number().describe('Width in grid units'),
          heightUnits: z.number().describe('Height in grid units'),
        })).describe('Array of drawer placements'),
      },
    },
    async ({ name, description, columns, rows, layoutData }) => {
      const template = await apiRequest<LayoutTemplate>('/layout-templates', 'POST', {
        name,
        description,
        columns,
        rows,
        layoutData,
      });
      return { content: [{ type: 'text', text: `Created layout template "${template.name}" with ID ${template.id}` }] };
    }
  );

  server.registerTool(
    'update_layout_template',
    {
      description: 'Update an existing layout template. Built-in templates cannot be modified.',
      inputSchema: {
        templateId: z.number().describe('The ID of the template to update'),
        name: z.string().optional().describe('New name for the template'),
        description: z.string().optional().describe('New description for the template'),
        columns: z.number().optional().describe('New number of columns'),
        rows: z.number().optional().describe('New number of rows'),
        layoutData: z.array(z.object({
          col: z.number(),
          row: z.number(),
          widthUnits: z.number(),
          heightUnits: z.number(),
        })).optional().describe('New array of drawer placements'),
      },
    },
    async ({ templateId, name, description, columns, rows, layoutData }) => {
      const template = await apiRequest<LayoutTemplate>(`/layout-templates/${templateId}`, 'PUT', {
        name,
        description,
        columns,
        rows,
        layoutData,
      });
      return { content: [{ type: 'text', text: `Updated layout template "${template.name}"` }] };
    }
  );

  server.registerTool(
    'delete_layout_template',
    {
      description: 'Delete a layout template. Built-in templates cannot be deleted.',
      inputSchema: {
        templateId: z.number().describe('The ID of the template to delete'),
      },
    },
    async ({ templateId }) => {
      await apiRequest(`/layout-templates/${templateId}`, 'DELETE');
      return { content: [{ type: 'text', text: `Deleted layout template ${templateId}` }] };
    }
  );

  server.registerTool(
    'apply_layout_template',
    {
      description: 'Apply a layout template to a case, replacing all existing drawers with the template layout.',
      inputSchema: {
        caseId: z.number().describe('The ID of the case to apply the template to'),
        templateId: z.number().describe('The ID of the template to apply'),
      },
    },
    async ({ caseId, templateId }) => {
      const caseData = await apiRequest<Case>(`/cases/${caseId}/apply-template`, 'POST', { templateId });
      return { content: [{ type: 'text', text: `Applied template to case "${caseData.name}". Case now has ${caseData.internalColumns}x${caseData.internalRows} grid.` }] };
    }
  );

  // Register resources
  server.registerResource(
    'walls',
    'storage://walls',
    {
      name: 'All Storage Walls',
      description: 'List of all storage walls in the system',
      mimeType: 'application/json',
    },
    async () => {
      const walls = await apiRequest<Wall[]>('/walls');
      return { contents: [{ uri: 'storage://walls', mimeType: 'application/json', text: JSON.stringify(walls, null, 2) }] };
    }
  );

  server.registerResource(
    'categories',
    'storage://categories',
    {
      name: 'All Categories',
      description: 'List of all part categories',
      mimeType: 'application/json',
    },
    async () => {
      const categories = await apiRequest<Category[]>('/categories');
      return { contents: [{ uri: 'storage://categories', mimeType: 'application/json', text: JSON.stringify(categories, null, 2) }] };
    }
  );


  server.registerResource(
    'layout-templates',
    'storage://layout-templates',
    {
      name: 'Layout Templates',
      description: 'Predefined case layout templates',
      mimeType: 'application/json',
    },
    async () => {
      const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
      return { contents: [{ uri: 'storage://layout-templates', mimeType: 'application/json', text: JSON.stringify(templates, null, 2) }] };
    }
  );

  return server;
}

// Map to store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

const app = express();
app.use(express.json());

// MCP POST endpoint
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          console.log(`Session initialized: ${newSessionId}`);
          transports[newSessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Handle GET requests for SSE streams
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Session termination request for session ${sessionId}`);
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

app.listen(MCP_PORT, () => {
  console.log(`Storage Info MCP server listening on http://localhost:${MCP_PORT}/mcp`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});
