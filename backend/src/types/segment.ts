export type LogicalOperator = 'AND' | 'OR';
export type RuleOperator = '>' | '<' | '=' | '!=' | 'contains';
export type RuleField = 'totalSpend' | 'totalOrders' | 'city' | 'categoryPurchased' | 'daysSinceLastPurchase';

export interface ConditionRule {
  type: 'condition';
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

export interface GroupRule {
  type: 'group';
  logic: LogicalOperator;
  children: SegmentRule[];
}

export type SegmentRule = ConditionRule | GroupRule;

export interface CustomerPreview {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
}

export interface SegmentPreviewStats {
  matchedAudience: number;
  averageOrderValue: number;
  potentialRevenue: number;
  topPerformingCity: string;
  averageOrdersCount: number;
  cityDistribution: { city: string; count: number; percentage: number }[];
}
