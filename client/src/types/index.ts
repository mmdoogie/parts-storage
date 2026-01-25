// Core entity types

export interface Wall {
  id: number
  name: string
  gridColumns: number
  gridGap: number
  sections?: Section[]
  cases?: Case[]
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: number
  wallId: number
  name: string
  sortOrder: number
  cases?: Case[]
  createdAt: string
  updatedAt: string
}

export interface Case {
  id: number
  wallId: number
  sectionId: number | null
  name: string
  gridColumnStart: number
  gridColumnSpan: number
  gridRowStart: number
  gridRowSpan: number
  internalColumns: number
  internalRows: number
  color: string
  drawers?: Drawer[]
  createdAt: string
  updatedAt: string
}

export interface Drawer {
  id: number
  caseId: number
  widthUnits: number
  heightUnits: number
  name: string | null
  gridColumn: number
  gridRow: number
  color: string
  parts?: Part[]
  partCount?: number
  categories?: Category[]
  createdAt: string
  updatedAt: string
}

export interface Part {
  id: number
  drawerId: number
  name: string
  notes: string | null
  sortOrder: number
  links?: PartLink[]
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string | null
  createdAt: string
  updatedAt: string
}

export interface PartLink {
  id: number
  partId: number
  url: string
  title: string | null
  sortOrder: number
  createdAt: string
}

export interface LayoutTemplate {
  id: number
  name: string
  description: string | null
  columns: number
  rows: number
  layoutData: DrawerPlacement[]
  isBuiltin: boolean
  createdAt: string
}

export interface DrawerPlacement {
  col: number
  row: number
  widthUnits: number
  heightUnits: number
}

// Search types
export interface SearchResult {
  type: 'part' | 'drawer' | 'case'
  id: number
  name: string
  matchedField: string
  matchedText: string
  score: number
  path: {
    wallId: number
    wallName: string
    caseId: number
    caseName: string
    drawerId: number
    drawerName: string | null
  }
}

// Drag and drop types
export interface DragData {
  type: 'drawer' | 'case'
  id: number
  sourceCase?: number
  widthUnits?: number
  heightUnits?: number
}

export interface DropTarget {
  type: 'case' | 'wall' | 'drawer-slot'
  id: number
  gridColumn?: number
  gridRow?: number
  accepts: string[]
}

export interface GridPosition {
  column: number
  row: number
}

// API response types
export interface ApiResponse<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}
