import { compileRuleToSql } from './segmentCompiler';
import { SegmentRule } from '../types/segment';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function runTests() {
  console.log('--- Running Segment Engine AST Compiler Unit Tests ---');

  // Test Case 1: Single Condition
  const singleCondition: SegmentRule = {
    type: 'condition',
    field: 'totalSpend',
    operator: '>',
    value: 5000
  };
  const params1: any[] = [];
  const sql1 = compileRuleToSql(singleCondition, params1);
  
  assert(sql1 === 'total_spend > $1', 'Single condition compiles correctly');
  assert(params1.length === 1 && params1[0] === 5000, 'Single condition value binds correctly');

  // Test Case 2: AND Conditions
  const andConditions: SegmentRule = {
    type: 'group',
    logic: 'AND',
    children: [
      {
        type: 'condition',
        field: 'city',
        operator: '=',
        value: 'Mumbai'
      },
      {
        type: 'condition',
        field: 'totalOrders',
        operator: '>',
        value: 3
      }
    ]
  };
  const params2: any[] = [];
  const sql2 = compileRuleToSql(andConditions, params2);
  
  assert(sql2 === '(city = $1 AND total_orders > $2)', 'AND conditions compiles correctly');
  assert(params2.length === 2 && params2[0] === 'Mumbai' && params2[1] === 3, 'AND conditions bind correctly');

  // Test Case 3: OR Conditions
  const orConditions: SegmentRule = {
    type: 'group',
    logic: 'OR',
    children: [
      {
        type: 'condition',
        field: 'city',
        operator: '=',
        value: 'Mumbai'
      },
      {
        type: 'condition',
        field: 'city',
        operator: '=',
        value: 'Delhi'
      }
    ]
  };
  const params3: any[] = [];
  const sql3 = compileRuleToSql(orConditions, params3);
  
  assert(sql3 === '(city = $1 OR city = $2)', 'OR conditions compiles correctly');
  assert(params3.length === 2 && params3[0] === 'Mumbai' && params3[1] === 'Delhi', 'OR conditions bind correctly');

  // Test Case 4: Nested Groups
  const nestedGroup: SegmentRule = {
    type: 'group',
    logic: 'AND',
    children: [
      {
        type: 'condition',
        field: 'totalSpend',
        operator: '>',
        value: 5000
      },
      {
        type: 'group',
        logic: 'OR',
        children: [
          {
            type: 'condition',
            field: 'city',
            operator: '=',
            value: 'Mumbai'
          },
          {
            type: 'condition',
            field: 'city',
            operator: '=',
            value: 'Delhi'
          }
        ]
      }
    ]
  };
  const params4: any[] = [];
  const sql4 = compileRuleToSql(nestedGroup, params4);
  
  assert(sql4 === '(total_spend > $1 AND (city = $2 OR city = $3))', 'Nested logical groups compile correctly');
  assert(
    params4.length === 3 && 
    params4[0] === 5000 && 
    params4[1] === 'Mumbai' && 
    params4[2] === 'Delhi',
    'Nested logical group parameters bind correctly'
  );

  // Test Case 5: Contains operator
  const containsCondition: SegmentRule = {
    type: 'condition',
    field: 'categoryPurchased',
    operator: 'contains',
    value: 'Fashion'
  };
  const params5: any[] = [];
  const sql5 = compileRuleToSql(containsCondition, params5);
  
  assert(sql5 === 'categories_purchased ILIKE $1', 'Contains operator compiles to ILIKE');
  assert(params5.length === 1 && params5[0] === '%Fashion%', 'Contains operator adds percentage wildcards to values');

  console.log('--- All Unit Tests Completed Successfully ---');
}

// Run if called directly
runTests();
