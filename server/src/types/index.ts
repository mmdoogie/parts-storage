export interface Wall {
  id: number
  name: string
  gridColumns: number
  gridGap: number
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: number
  wallId: number
  name: string
  sortOrder: number
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
  layoutData: string
  isBuiltin: boolean
  createdAt: string
}

export interface DrawerPlacement {
  col: number
  row: number
  widthUnits: number
  heightUnits: number
}

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
