#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE_URL = process.env.STORAGE_API_URL || 'http://localhost:3002/api/v1';

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
  gridColumn: number;
  gridRow: number;
  color: string;
  drawerSize?: DrawerSize;
  parts?: Part[];
}

interface DrawerSize {
  id: number;
  name: string;
  widthUnits: number;
  heightUnits: number;
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
  size: string;
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

const server = new Server(
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_items',
        description: 'Search for parts, drawers, or cases by name or content. Returns matching items with their location in the storage system.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string (minimum 2 characters)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_walls',
        description: 'List all storage walls in the system.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_wall',
        description: 'Get a specific wall with all its cases and drawers.',
        inputSchema: {
          type: 'object',
          properties: {
            wallId: {
              type: 'number',
              description: 'The ID of the wall to retrieve',
            },
          },
          required: ['wallId'],
        },
      },
      {
        name: 'list_cases',
        description: 'List all cases, optionally filtered by wall.',
        inputSchema: {
          type: 'object',
          properties: {
            wallId: {
              type: 'number',
              description: 'Optional wall ID to filter cases',
            },
          },
        },
      },
      {
        name: 'get_case',
        description: 'Get a specific case with all its drawers.',
        inputSchema: {
          type: 'object',
          properties: {
            caseId: {
              type: 'number',
              description: 'The ID of the case to retrieve',
            },
          },
          required: ['caseId'],
        },
      },
      {
        name: 'get_drawer',
        description: 'Get a specific drawer with all its parts.',
        inputSchema: {
          type: 'object',
          properties: {
            drawerId: {
              type: 'number',
              description: 'The ID of the drawer to retrieve',
            },
          },
          required: ['drawerId'],
        },
      },
      {
        name: 'list_parts',
        description: 'List all parts, optionally filtered by drawer.',
        inputSchema: {
          type: 'object',
          properties: {
            drawerId: {
              type: 'number',
              description: 'Optional drawer ID to filter parts',
            },
          },
        },
      },
      {
        name: 'get_part',
        description: 'Get a specific part with its links.',
        inputSchema: {
          type: 'object',
          properties: {
            partId: {
              type: 'number',
              description: 'The ID of the part to retrieve',
            },
          },
          required: ['partId'],
        },
      },
      {
        name: 'create_part',
        description: 'Create a new part in a drawer.',
        inputSchema: {
          type: 'object',
          properties: {
            drawerId: {
              type: 'number',
              description: 'The ID of the drawer to add the part to',
            },
            name: {
              type: 'string',
              description: 'Name of the part',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the part',
            },
          },
          required: ['drawerId', 'name'],
        },
      },
      {
        name: 'update_part',
        description: 'Update an existing part.',
        inputSchema: {
          type: 'object',
          properties: {
            partId: {
              type: 'number',
              description: 'The ID of the part to update',
            },
            name: {
              type: 'string',
              description: 'New name for the part',
            },
            notes: {
              type: 'string',
              description: 'New notes for the part',
            },
          },
          required: ['partId'],
        },
      },
      {
        name: 'delete_part',
        description: 'Delete a part from a drawer.',
        inputSchema: {
          type: 'object',
          properties: {
            partId: {
              type: 'number',
              description: 'The ID of the part to delete',
            },
          },
          required: ['partId'],
        },
      },
      {
        name: 'move_part',
        description: 'Move a part to a different drawer or change its position.',
        inputSchema: {
          type: 'object',
          properties: {
            partId: {
              type: 'number',
              description: 'The ID of the part to move',
            },
            drawerId: {
              type: 'number',
              description: 'The ID of the destination drawer',
            },
            sortOrder: {
              type: 'number',
              description: 'New sort order position',
            },
          },
          required: ['partId'],
        },
      },
      {
        name: 'create_drawer',
        description: 'Create a new drawer in a case.',
        inputSchema: {
          type: 'object',
          properties: {
            caseId: {
              type: 'number',
              description: 'The ID of the case to add the drawer to',
            },
            drawerSizeId: {
              type: 'number',
              description: 'The ID of the drawer size to use',
            },
            gridColumn: {
              type: 'number',
              description: 'Column position in the case grid (1-based)',
            },
            gridRow: {
              type: 'number',
              description: 'Row position in the case grid (1-based)',
            },
            name: {
              type: 'string',
              description: 'Optional name for the drawer',
            },
          },
          required: ['caseId', 'drawerSizeId', 'gridColumn', 'gridRow'],
        },
      },
      {
        name: 'update_drawer',
        description: 'Update an existing drawer.',
        inputSchema: {
          type: 'object',
          properties: {
            drawerId: {
              type: 'number',
              description: 'The ID of the drawer to update',
            },
            name: {
              type: 'string',
              description: 'New name for the drawer',
            },
            color: {
              type: 'string',
              description: 'New color for the drawer (hex format)',
            },
          },
          required: ['drawerId'],
        },
      },
      {
        name: 'delete_drawer',
        description: 'Delete a drawer and all its contents.',
        inputSchema: {
          type: 'object',
          properties: {
            drawerId: {
              type: 'number',
              description: 'The ID of the drawer to delete',
            },
          },
          required: ['drawerId'],
        },
      },
      {
        name: 'list_drawer_sizes',
        description: 'List all available drawer sizes.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_case',
        description: 'Create a new case on a wall.',
        inputSchema: {
          type: 'object',
          properties: {
            wallId: {
              type: 'number',
              description: 'The ID of the wall to add the case to',
            },
            name: {
              type: 'string',
              description: 'Name of the case',
            },
            gridColumnStart: {
              type: 'number',
              description: 'Starting column on the wall grid',
            },
            gridColumnSpan: {
              type: 'number',
              description: 'Number of columns the case spans',
            },
            gridRowStart: {
              type: 'number',
              description: 'Starting row on the wall grid',
            },
            gridRowSpan: {
              type: 'number',
              description: 'Number of rows the case spans',
            },
            internalColumns: {
              type: 'number',
              description: 'Number of internal drawer columns',
            },
            internalRows: {
              type: 'number',
              description: 'Number of internal drawer rows',
            },
            color: {
              type: 'string',
              description: 'Case color (hex format)',
            },
          },
          required: ['wallId', 'name'],
        },
      },
      {
        name: 'update_case',
        description: 'Update an existing case.',
        inputSchema: {
          type: 'object',
          properties: {
            caseId: {
              type: 'number',
              description: 'The ID of the case to update',
            },
            name: {
              type: 'string',
              description: 'New name for the case',
            },
            color: {
              type: 'string',
              description: 'New color for the case (hex format)',
            },
            internalColumns: {
              type: 'number',
              description: 'New number of internal columns',
            },
            internalRows: {
              type: 'number',
              description: 'New number of internal rows',
            },
            gridColumnStart: {
              type: 'number',
              description: 'Starting column position on the wall grid',
            },
            gridColumnSpan: {
              type: 'number',
              description: 'Number of columns the case spans',
            },
            gridRowStart: {
              type: 'number',
              description: 'Starting row position on the wall grid',
            },
            gridRowSpan: {
              type: 'number',
              description: 'Number of rows the case spans',
            },
          },
          required: ['caseId'],
        },
      },
      {
        name: 'delete_case',
        description: 'Delete a case and all its drawers.',
        inputSchema: {
          type: 'object',
          properties: {
            caseId: {
              type: 'number',
              description: 'The ID of the case to delete',
            },
          },
          required: ['caseId'],
        },
      },
      {
        name: 'list_categories',
        description: 'List all categories for organizing parts.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_category',
        description: 'Create a new category for organizing parts.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the category',
            },
            color: {
              type: 'string',
              description: 'Color for the category (hex format, e.g., #FF5733)',
            },
            icon: {
              type: 'string',
              description: 'Optional icon identifier for the category',
            },
          },
          required: ['name', 'color'],
        },
      },
      {
        name: 'update_category',
        description: 'Update an existing category.',
        inputSchema: {
          type: 'object',
          properties: {
            categoryId: {
              type: 'number',
              description: 'The ID of the category to update',
            },
            name: {
              type: 'string',
              description: 'New name for the category',
            },
            color: {
              type: 'string',
              description: 'New color for the category (hex format)',
            },
            icon: {
              type: 'string',
              description: 'New icon identifier for the category',
            },
          },
          required: ['categoryId'],
        },
      },
      {
        name: 'delete_category',
        description: 'Delete a category.',
        inputSchema: {
          type: 'object',
          properties: {
            categoryId: {
              type: 'number',
              description: 'The ID of the category to delete',
            },
          },
          required: ['categoryId'],
        },
      },
      {
        name: 'add_part_link',
        description: 'Add a link (URL) to a part for reference documentation.',
        inputSchema: {
          type: 'object',
          properties: {
            partId: {
              type: 'number',
              description: 'The ID of the part to add the link to',
            },
            url: {
              type: 'string',
              description: 'The URL of the link',
            },
            title: {
              type: 'string',
              description: 'Optional title for the link',
            },
          },
          required: ['partId', 'url'],
        },
      },
      {
        name: 'list_layout_templates',
        description: 'List all available layout templates for cases.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_layout_template',
        description: 'Get a specific layout template with its drawer placement data.',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'number',
              description: 'The ID of the template to retrieve',
            },
          },
          required: ['templateId'],
        },
      },
      {
        name: 'create_layout_template',
        description: 'Create a new layout template for cases. Layout templates define predefined drawer arrangements.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the template',
            },
            description: {
              type: 'string',
              description: 'Description of the template',
            },
            columns: {
              type: 'number',
              description: 'Number of columns in the template grid',
            },
            rows: {
              type: 'number',
              description: 'Number of rows in the template grid',
            },
            layoutData: {
              type: 'array',
              description: 'Array of drawer placements, each with col, row, and size (drawer size name)',
              items: {
                type: 'object',
                properties: {
                  col: { type: 'number', description: 'Column position (1-based)' },
                  row: { type: 'number', description: 'Row position (1-based)' },
                  size: { type: 'string', description: 'Drawer size name (e.g., "1x1", "2x1")' },
                },
                required: ['col', 'row', 'size'],
              },
            },
          },
          required: ['name', 'columns', 'rows', 'layoutData'],
        },
      },
      {
        name: 'update_layout_template',
        description: 'Update an existing layout template. Built-in templates cannot be modified.',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'number',
              description: 'The ID of the template to update',
            },
            name: {
              type: 'string',
              description: 'New name for the template',
            },
            description: {
              type: 'string',
              description: 'New description for the template',
            },
            columns: {
              type: 'number',
              description: 'New number of columns',
            },
            rows: {
              type: 'number',
              description: 'New number of rows',
            },
            layoutData: {
              type: 'array',
              description: 'New array of drawer placements',
              items: {
                type: 'object',
                properties: {
                  col: { type: 'number' },
                  row: { type: 'number' },
                  size: { type: 'string' },
                },
                required: ['col', 'row', 'size'],
              },
            },
          },
          required: ['templateId'],
        },
      },
      {
        name: 'delete_layout_template',
        description: 'Delete a layout template. Built-in templates cannot be deleted.',
        inputSchema: {
          type: 'object',
          properties: {
            templateId: {
              type: 'number',
              description: 'The ID of the template to delete',
            },
          },
          required: ['templateId'],
        },
      },
      {
        name: 'apply_layout_template',
        description: 'Apply a layout template to a case, replacing all existing drawers with the template layout.',
        inputSchema: {
          type: 'object',
          properties: {
            caseId: {
              type: 'number',
              description: 'The ID of the case to apply the template to',
            },
            templateId: {
              type: 'number',
              description: 'The ID of the template to apply',
            },
          },
          required: ['caseId', 'templateId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_items': {
        const { query, limit = 20 } = args as { query: string; limit?: number };
        const results = await apiRequest<SearchResult[]>(
          `/search?q=${encodeURIComponent(query)}&limit=${limit}`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'list_walls': {
        const walls = await apiRequest<Wall[]>('/walls');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(walls, null, 2),
            },
          ],
        };
      }

      case 'get_wall': {
        const { wallId } = args as { wallId: number };
        const wall = await apiRequest<Wall>(`/walls/${wallId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wall, null, 2),
            },
          ],
        };
      }

      case 'list_cases': {
        const { wallId } = args as { wallId?: number };
        const endpoint = wallId ? `/cases?wallId=${wallId}` : '/cases';
        const cases = await apiRequest<Case[]>(endpoint);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cases, null, 2),
            },
          ],
        };
      }

      case 'get_case': {
        const { caseId } = args as { caseId: number };
        const caseData = await apiRequest<Case>(`/cases/${caseId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(caseData, null, 2),
            },
          ],
        };
      }

      case 'get_drawer': {
        const { drawerId } = args as { drawerId: number };
        const drawer = await apiRequest<Drawer>(`/drawers/${drawerId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(drawer, null, 2),
            },
          ],
        };
      }

      case 'list_parts': {
        const { drawerId } = args as { drawerId?: number };
        const endpoint = drawerId ? `/parts?drawerId=${drawerId}` : '/parts';
        const parts = await apiRequest<Part[]>(endpoint);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(parts, null, 2),
            },
          ],
        };
      }

      case 'get_part': {
        const { partId } = args as { partId: number };
        const part = await apiRequest<Part>(`/parts/${partId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(part, null, 2),
            },
          ],
        };
      }

      case 'create_part': {
        const { drawerId, name, notes } = args as {
          drawerId: number;
          name: string;
          notes?: string;
        };
        const part = await apiRequest<Part>('/parts', 'POST', {
          drawerId,
          name,
          notes,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Created part "${part.name}" with ID ${part.id}`,
            },
          ],
        };
      }

      case 'update_part': {
        const { partId, name, notes } = args as {
          partId: number;
          name?: string;
          notes?: string;
        };
        const part = await apiRequest<Part>(`/parts/${partId}`, 'PUT', {
          name,
          notes,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Updated part "${part.name}"`,
            },
          ],
        };
      }

      case 'delete_part': {
        const { partId } = args as { partId: number };
        await apiRequest(`/parts/${partId}`, 'DELETE');
        return {
          content: [
            {
              type: 'text',
              text: `Deleted part ${partId}`,
            },
          ],
        };
      }

      case 'move_part': {
        const { partId, drawerId, sortOrder } = args as {
          partId: number;
          drawerId?: number;
          sortOrder?: number;
        };
        const part = await apiRequest<Part>(`/parts/${partId}/move`, 'PUT', {
          drawerId,
          sortOrder,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Moved part "${part.name}" to drawer ${part.drawerId}`,
            },
          ],
        };
      }

      case 'create_drawer': {
        const { caseId, drawerSizeId, gridColumn, gridRow, name } = args as {
          caseId: number;
          drawerSizeId: number;
          gridColumn: number;
          gridRow: number;
          name?: string;
        };
        const drawer = await apiRequest<Drawer>('/drawers', 'POST', {
          caseId,
          drawerSizeId,
          gridColumn,
          gridRow,
          name,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Created drawer with ID ${drawer.id} at position (${gridColumn}, ${gridRow})`,
            },
          ],
        };
      }

      case 'update_drawer': {
        const { drawerId, name, color } = args as {
          drawerId: number;
          name?: string;
          color?: string;
        };
        const drawer = await apiRequest<Drawer>(`/drawers/${drawerId}`, 'PUT', {
          name,
          color,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Updated drawer ${drawer.id}`,
            },
          ],
        };
      }

      case 'delete_drawer': {
        const { drawerId } = args as { drawerId: number };
        await apiRequest(`/drawers/${drawerId}`, 'DELETE');
        return {
          content: [
            {
              type: 'text',
              text: `Deleted drawer ${drawerId}`,
            },
          ],
        };
      }

      case 'list_drawer_sizes': {
        const sizes = await apiRequest<DrawerSize[]>('/drawer-sizes');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sizes, null, 2),
            },
          ],
        };
      }

      case 'create_case': {
        const {
          wallId,
          name,
          gridColumnStart = 1,
          gridColumnSpan = 4,
          gridRowStart = 1,
          gridRowSpan = 3,
          internalColumns = 4,
          internalRows = 6,
          color = '#8B7355',
        } = args as {
          wallId: number;
          name: string;
          gridColumnStart?: number;
          gridColumnSpan?: number;
          gridRowStart?: number;
          gridRowSpan?: number;
          internalColumns?: number;
          internalRows?: number;
          color?: string;
        };
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
        return {
          content: [
            {
              type: 'text',
              text: `Created case "${caseData.name}" with ID ${caseData.id}`,
            },
          ],
        };
      }

      case 'update_case': {
        const {
          caseId,
          name,
          color,
          internalColumns,
          internalRows,
          gridColumnStart,
          gridColumnSpan,
          gridRowStart,
          gridRowSpan,
        } = args as {
          caseId: number;
          name?: string;
          color?: string;
          internalColumns?: number;
          internalRows?: number;
          gridColumnStart?: number;
          gridColumnSpan?: number;
          gridRowStart?: number;
          gridRowSpan?: number;
        };
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
        return {
          content: [
            {
              type: 'text',
              text: `Updated case "${caseData.name}"`,
            },
          ],
        };
      }

      case 'delete_case': {
        const { caseId } = args as { caseId: number };
        await apiRequest(`/cases/${caseId}`, 'DELETE');
        return {
          content: [
            {
              type: 'text',
              text: `Deleted case ${caseId}`,
            },
          ],
        };
      }

      case 'list_categories': {
        const categories = await apiRequest<Category[]>('/categories');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      case 'create_category': {
        const { name, color, icon } = args as {
          name: string;
          color: string;
          icon?: string;
        };
        const category = await apiRequest<Category>('/categories', 'POST', {
          name,
          color,
          icon,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Created category "${category.name}" with ID ${category.id}`,
            },
          ],
        };
      }

      case 'update_category': {
        const { categoryId, name, color, icon } = args as {
          categoryId: number;
          name?: string;
          color?: string;
          icon?: string;
        };
        const category = await apiRequest<Category>(`/categories/${categoryId}`, 'PUT', {
          name,
          color,
          icon,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Updated category "${category.name}"`,
            },
          ],
        };
      }

      case 'delete_category': {
        const { categoryId } = args as { categoryId: number };
        await apiRequest(`/categories/${categoryId}`, 'DELETE');
        return {
          content: [
            {
              type: 'text',
              text: `Deleted category ${categoryId}`,
            },
          ],
        };
      }

      case 'add_part_link': {
        const { partId, url, title } = args as {
          partId: number;
          url: string;
          title?: string;
        };
        const link = await apiRequest<PartLink>(`/parts/${partId}/links`, 'POST', {
          url,
          title,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Added link "${title || url}" to part ${partId}`,
            },
          ],
        };
      }

      case 'list_layout_templates': {
        const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(templates, null, 2),
            },
          ],
        };
      }

      case 'get_layout_template': {
        const { templateId } = args as { templateId: number };
        const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
        const template = templates.find(t => t.id === templateId);
        if (!template) {
          throw new Error(`Template ${templateId} not found`);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(template, null, 2),
            },
          ],
        };
      }

      case 'create_layout_template': {
        const { name, description, columns, rows, layoutData } = args as {
          name: string;
          description?: string;
          columns: number;
          rows: number;
          layoutData: DrawerPlacement[];
        };
        const template = await apiRequest<LayoutTemplate>('/layout-templates', 'POST', {
          name,
          description,
          columns,
          rows,
          layoutData,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Created layout template "${template.name}" with ID ${template.id}`,
            },
          ],
        };
      }

      case 'update_layout_template': {
        const { templateId, name, description, columns, rows, layoutData } = args as {
          templateId: number;
          name?: string;
          description?: string;
          columns?: number;
          rows?: number;
          layoutData?: DrawerPlacement[];
        };
        const template = await apiRequest<LayoutTemplate>(`/layout-templates/${templateId}`, 'PUT', {
          name,
          description,
          columns,
          rows,
          layoutData,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Updated layout template "${template.name}"`,
            },
          ],
        };
      }

      case 'delete_layout_template': {
        const { templateId } = args as { templateId: number };
        await apiRequest(`/layout-templates/${templateId}`, 'DELETE');
        return {
          content: [
            {
              type: 'text',
              text: `Deleted layout template ${templateId}`,
            },
          ],
        };
      }

      case 'apply_layout_template': {
        const { caseId, templateId } = args as {
          caseId: number;
          templateId: number;
        };
        const caseData = await apiRequest<Case>(`/cases/${caseId}/apply-template`, 'POST', {
          templateId,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Applied template to case "${caseData.name}". Case now has ${caseData.internalColumns}x${caseData.internalRows} grid.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'storage://walls',
        name: 'All Storage Walls',
        description: 'List of all storage walls in the system',
        mimeType: 'application/json',
      },
      {
        uri: 'storage://categories',
        name: 'All Categories',
        description: 'List of all part categories',
        mimeType: 'application/json',
      },
      {
        uri: 'storage://drawer-sizes',
        name: 'Drawer Sizes',
        description: 'Available drawer size configurations',
        mimeType: 'application/json',
      },
      {
        uri: 'storage://layout-templates',
        name: 'Layout Templates',
        description: 'Predefined case layout templates',
        mimeType: 'application/json',
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'storage://walls': {
        const walls = await apiRequest<Wall[]>('/walls');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(walls, null, 2),
            },
          ],
        };
      }

      case 'storage://categories': {
        const categories = await apiRequest<Category[]>('/categories');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      case 'storage://drawer-sizes': {
        const sizes = await apiRequest<DrawerSize[]>('/drawer-sizes');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(sizes, null, 2),
            },
          ],
        };
      }

      case 'storage://layout-templates': {
        const templates = await apiRequest<LayoutTemplate[]>('/layout-templates');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(templates, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read resource: ${message}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Storage Info MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
