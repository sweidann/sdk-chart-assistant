// Test data based on your example
export const sampleIncortaData = {
  "isSampled": false,
  "subqueryComplete": true,
  "rowHeaders": [],
  "measureHeaders": [
    {
      "label": "Category",
      "dataType": "string",
      "id": "S7_IA2is1Bp"
    }
  ],
  "data": [
    [
      {
        "value": "Bikes",
        "formatted": "Bikes"
      }
    ],
    [
      {
        "value": "Components",
        "formatted": "Components"
      }
    ],
    [
      {
        "value": "Clothing",
        "formatted": "Clothing"
      }
    ],
    [
      {
        "value": "Accessories",
        "formatted": "Accessories"
      }
    ]
  ],
  "isAggregated": false,
  "startRow": 0,
  "endRow": 4,
  "totalRows": 4,
  "complete": true,
  "raw": false
};

// More complex sample with multiple columns and numeric data
export const complexIncortaData = {
  "isSampled": false,
  "subqueryComplete": true,
  "rowHeaders": [],
  "measureHeaders": [
    {
      "label": "Product Category",
      "dataType": "string",
      "id": "category_1"
    },
    {
      "label": "Sales Amount",
      "dataType": "number",
      "id": "sales_1"
    },
    {
      "label": "Order Count",
      "dataType": "number",
      "id": "orders_1"
    }
  ],
  "data": [
    [
      { "value": "Bikes", "formatted": "Bikes" },
      { "value": 125000, "formatted": "$125,000" },
      { "value": 45, "formatted": "45" }
    ],
    [
      { "value": "Components", "formatted": "Components" },
      { "value": 89000, "formatted": "$89,000" },
      { "value": 67, "formatted": "67" }
    ],
    [
      { "value": "Clothing", "formatted": "Clothing" },
      { "value": 56000, "formatted": "$56,000" },
      { "value": 123, "formatted": "123" }
    ],
    [
      { "value": "Accessories", "formatted": "Accessories" },
      { "value": 34000, "formatted": "$34,000" },
      { "value": 89, "formatted": "89" }
    ]
  ],
  "isAggregated": true,
  "startRow": 0,
  "endRow": 4,
  "totalRows": 4,
  "complete": true,
  "raw": false
};

// Time series sample
export const timeSeriesData = {
  "isSampled": false,
  "subqueryComplete": true,
  "rowHeaders": [],
  "measureHeaders": [
    {
      "label": "Order Date",
      "dataType": "date",
      "id": "date_1"
    },
    {
      "label": "Revenue",
      "dataType": "number", 
      "id": "revenue_1"
    }
  ],
  "data": [
    [
      { "value": "2024-01-01", "formatted": "Jan 1, 2024" },
      { "value": 15000, "formatted": "$15,000" }
    ],
    [
      { "value": "2024-02-01", "formatted": "Feb 1, 2024" },
      { "value": 18000, "formatted": "$18,000" }
    ],
    [
      { "value": "2024-03-01", "formatted": "Mar 1, 2024" },
      { "value": 22000, "formatted": "$22,000" }
    ],
    [
      { "value": "2024-04-01", "formatted": "Apr 1, 2024" },
      { "value": 25000, "formatted": "$25,000" }
    ]
  ],
  "isAggregated": true,
  "startRow": 0,
  "endRow": 4,
  "totalRows": 4,
  "complete": true,
  "raw": false
};

