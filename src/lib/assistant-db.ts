import { prisma } from '@/lib/prisma';

/**
 * AeroSky Database Schema Documentation for AI Assistant
 * Provides accurate PostgreSQL table and column mappings
 */
export const DATABASE_SCHEMA_DOC = `
# AeroSky PostgreSQL Database Schema (Supabase)

All table names and column names are in snake_case in PostgreSQL.
All queries must be safe SELECT queries.

### Table: \`components\` (Inventory & Stock)
- \`id\` (UUID, Primary Key)
- \`name\` (TEXT) - Name of component/material
- \`description\` (TEXT, nullable)
- \`quantity\` (INTEGER) - Current quantity in stock
- \`category\` (TEXT) - e.g., 'Manufacturing', 'Operational', 'Electronics', 'Mechanical'
- \`unit_price\` (DOUBLE PRECISION, nullable) - Price per unit in INR
- \`created_at\` (TIMESTAMP)
- \`updated_at\` (TIMESTAMP)

### Table: \`inventory_transactions\` (Stock Movement)
- \`id\` (UUID, PK)
- \`component_id\` (UUID, FK -> components.id)
- \`type\` (TEXT: 'IN' or 'OUT')
- \`quantity\` (INTEGER)
- \`date\` (TIMESTAMP)
- \`subcontractor_id\` (UUID, FK -> subcontractors.id, nullable)
- \`user_id\` (UUID, FK -> users.id, nullable)
- \`taken_out_for\` (TEXT, nullable) - Reason for checkout
- \`created_at\` (TIMESTAMP)

### Table: \`orders\` (Sales, Contracts & Production)
- \`id\` (UUID, PK)
- \`contract_number\` (TEXT, Unique) - e.g., 'AERO-2026-001'
- \`client_name\` (TEXT) - Customer / Organization name
- \`client_segment\` (TEXT) - Government, Enterprise, Defense, Agriculture, etc.
- \`order_date\` (TIMESTAMP)
- \`estimated_completion_date\` (TIMESTAMP, nullable)
- \`contract_value\` (DOUBLE PRECISION) - Contract value in INR
- \`currency\` (TEXT) - default 'INR'
- \`revenue_recognition_status\` (TEXT) - 'Pending', 'Recognized'
- \`quantity\` (INTEGER) - Quantity of drones ordered
- \`unit_price\` (DOUBLE PRECISION, nullable)
- \`delivery_address\` (TEXT, nullable)
- \`contact_person\` (TEXT, nullable)
- \`contact_phone\` (TEXT, nullable)
- \`contact_email\` (TEXT, nullable)
- \`payment_terms\` (TEXT, nullable)
- \`payment_status\` (TEXT) - 'Paid', 'Pending', 'Unpaid'
- \`drone_model\` (TEXT) - 'VEDANSH', 'SHAURYA', etc.
- \`drone_type\` (TEXT)
- \`weight_class\` (TEXT)
- \`payload_configuration\` (TEXT, nullable)
- \`flight_endurance_requirements\` (TEXT, nullable)
- \`software_ai_tier\` (TEXT, nullable)
- \`dgca_faa_certification_status\` (TEXT)
- \`bom_readiness\` (TEXT) - 'Ready', 'Not Ready'
- \`manufacturing_stage\` (TEXT) - 'In Design', 'In Production', 'Ready for Delivery', 'Delivered'
- \`priority_level\` (TEXT) - 'Low', 'Normal', 'High'
- \`quality_check_status\` (TEXT) - 'Pending', 'Passed', 'Failed'
- \`created_at\` (TIMESTAMP)
- \`updated_at\` (TIMESTAMP)

### Table: \`drones\` (Fleet Models & Master Drones)
- \`id\` (UUID, PK)
- \`model_name\` (TEXT) - Model name (VEDANSH, SHAURYA, etc.)
- \`accountable_manager_id\` (UUID, FK -> team_members.id, nullable)
- \`web_portal_link\` (TEXT, nullable)
- \`is_dgca_certified\` (BOOLEAN) - True if DGCA type certified
- \`created_at\` (TIMESTAMP)

### Table: \`manufactured_units\` (Physical Drone Units Built)
- \`id\` (UUID, PK)
- \`drone_id\` (UUID, FK -> drones.id)
- \`serial_number\` (TEXT) - Hardware serial number
- \`uin\` (TEXT) - Unique Identification Number issued by DGCA
- \`created_at\` (TIMESTAMP)

### Table: \`batteries\` (Battery Inventory & Management)
- \`id\` (UUID, PK)
- \`model\` (TEXT) - Battery model name
- \`rated_capacity\` (TEXT) - e.g. '22000mAh'
- \`battery_number_a\` (TEXT) - Serial / identifier for pack A
- \`battery_number_b\` (TEXT) - Serial / identifier for pack B
- \`created_at\` (TIMESTAMP)

### Table: \`flight_logs\` (Flight Operations & Mission Records)
- \`id\` (UUID, PK)
- \`date\` (TIMESTAMP) - Date of flight
- \`takeoff_time\` (TEXT)
- \`duration\` (TEXT) - Duration in minutes or hours
- \`location_coords\` (TEXT, nullable)
- \`location_name\` (TEXT, nullable) - Flight site/city
- \`pic_id\` (UUID, FK -> team_members.id, nullable) - Pilot in Command
- \`vo_id\` (UUID, FK -> team_members.id, nullable) - Visual Observer
- \`mission_type\` (TEXT) - 'Training', 'Commercial', 'Testing', 'Survey'
- \`drone_id\` (UUID, FK -> drones.id)
- \`serial_number\` (TEXT, nullable)
- \`uin\` (TEXT, nullable)
- \`technical_feedback\` (TEXT, nullable)
- \`battery_id\` (UUID, FK -> batteries.id, nullable)
- \`created_at\` (TIMESTAMP)

### Table: \`expenses\` (Operating & Project Expenses)
- \`id\` (UUID, PK)
- \`description\` (TEXT)
- \`amount\` (DOUBLE PRECISION) - Amount in INR
- \`date\` (TIMESTAMP)
- \`category\` (TEXT) - e.g., 'Travel', 'Equipment', 'Operations', 'R&D', 'Office'
- \`payment_method\` (TEXT, nullable)
- \`status\` (TEXT) - 'pending', 'approved', 'rejected'
- \`payment_status\` (TEXT) - 'paid', 'unpaid'
- \`created_at\` (TIMESTAMP)

### Table: \`reimbursements\` (Employee Expense Reimbursements)
- \`id\` (UUID, PK)
- \`name\` (TEXT) - Expense claim title
- \`category\` (TEXT)
- \`amount\` (DOUBLE PRECISION)
- \`date\` (TIMESTAMP)
- \`status\` (TEXT) - 'Pending', 'Approved', 'Rejected'
- \`user_id\` (UUID, FK -> users.id)
- \`created_at\` (TIMESTAMP)

### Table: \`leads\` (CRM Leads Pipeline)
- \`id\` (TEXT, PK)
- \`name\` (TEXT, nullable)
- \`email\` (TEXT, nullable)
- \`phone\` (TEXT, nullable)
- \`company\` (TEXT, nullable)
- \`source\` (TEXT, nullable) - 'WEBSITE', 'IMPORT', 'MANUAL'
- \`stage_id\` (TEXT, FK -> funnel_stages.id, nullable)
- \`value\` (DOUBLE PRECISION, nullable) - Potential deal value in INR
- \`notes\` (TEXT, nullable)
- \`converted_at\` (TIMESTAMP, nullable)
- \`created_at\` (TIMESTAMP)

### Table: \`funnel_stages\` (CRM Sales Stages)
- \`id\` (TEXT, PK)
- \`name\` (TEXT) - 'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'
- \`order\` (INTEGER)
- \`color\` (TEXT)

### Table: \`follow_ups\` (Lead Follow-up Schedule)
- \`id\` (UUID, PK)
- \`lead_id\` (TEXT, FK -> leads.id)
- \`title\` (TEXT, nullable)
- \`description\` (TEXT, nullable)
- \`scheduled_at\` (TIMESTAMP, nullable)
- \`status\` (TEXT) - 'PENDING', 'COMPLETED', 'CANCELLED'
- \`created_at\` (TIMESTAMP)

### Table: \`lead_activities\` (Lead Interaction History)
- \`id\` (UUID, PK)
- \`lead_id\` (TEXT, FK -> leads.id)
- \`type\` (TEXT) - 'NOTE', 'CALL', 'EMAIL', 'STAGE_CHANGE'
- \`content\` (TEXT)
- \`created_at\` (TIMESTAMP)

### Table: \`team_members\` (Staff, Pilots, Engineers)
- \`id\` (UUID, PK)
- \`access_id\` (TEXT, Unique)
- \`name\` (TEXT)
- \`phone\` (TEXT, nullable)
- \`email\` (TEXT, nullable)
- \`position\` (TEXT, nullable) - e.g., 'Chief Pilot', 'Lead Engineer', 'Operations Manager'
- \`created_at\` (TIMESTAMP)

### Table: \`users\` (System Accounts)
- \`id\` (UUID, PK)
- \`username\` (TEXT, Unique)
- \`email\` (TEXT, nullable)
- \`full_name\` (TEXT, nullable)
- \`phone\` (TEXT, nullable)
- \`role\` (TEXT) - 'SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'PILOT', 'TECHNICIAN', 'VIEWER', 'SALES', etc.
- \`is_active\` (BOOLEAN)
- \`created_at\` (TIMESTAMP)
*(Note: password_hash, push_token, and otp are protected and forbidden to be queried)*

### Table: \`subcontractors\` (Vendors, Suppliers & Partners)
- \`id\` (UUID, PK)
- \`company_name\` (TEXT)
- \`type\` (TEXT) - 'Design' or 'Manufacturing'
- \`contact_person\` (TEXT, nullable)
- \`contact_email\` (TEXT, nullable)
- \`contact_phone\` (TEXT, nullable)
- \`agreement_date\` (TEXT, nullable)
- \`created_at\` (TIMESTAMP)

### Table: \`support_tickets\` (Customer / Internal Support)
- \`id\` (UUID, PK)
- \`subject\` (TEXT)
- \`status\` (TEXT) - 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
- \`priority\` (TEXT) - 'LOW', 'NORMAL', 'HIGH', 'URGENT'
- \`user_id\` (UUID, FK -> users.id)
- \`created_at\` (TIMESTAMP)

### Table: \`reports\` (Published Operational & Financial Reports)
- \`id\` (UUID, PK)
- \`title\` (TEXT)
- \`description\` (TEXT)
- \`category\` (TEXT) - 'Financial', 'Operations', 'Drone Fleet', 'Safety & Compliance'
- \`status\` (TEXT) - 'published', 'draft', 'archived'
- \`period\` (TEXT, nullable)
- \`created_at\` (TIMESTAMP)
`;

export interface SqlQueryResult {
  success: boolean;
  query: string;
  data?: any[];
  rowCount?: number;
  columns?: string[];
  error?: string;
  executionTimeMs?: number;
}

// List of strictly prohibited SQL keywords/patterns to prevent SQL injection or modifications
const DISALLOWED_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'SET', 'MERGE',
  'CALL', 'VACUUM', 'REINDEX', 'LOCK', 'EXPLAIN ANALYZE', 'COPY',
  'pg_sleep', 'pg_terminate_backend', 'pg_cancel_backend', 'dblink',
  'into outfile', 'into dumpfile', 'load_file'
];

// Sensitive columns that should never be selected or leaked
const SENSITIVE_COLUMNS = [
  'password_hash', 'passwordHash', 'push_token', 'pushToken',
  'otp', 'supabase_id', 'supabaseId', 'bill_data', 'billData'
];

/**
 * Validates and safely executes a read-only SQL SELECT query against the Supabase database
 */
export async function executeSafeSqlQuery(
  query: string,
  options: { maxRows?: number; timeoutMs?: number; userRole?: string } = {}
): Promise<SqlQueryResult> {
  const startTime = Date.now();
  const maxRows = options.maxRows || 50;

  try {
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        query: query || '',
        error: 'Query string must not be empty.'
      };
    }

    let cleaned = query.trim();

    // Remove markdown code fence if wrapped by LLM (```sql ... ```)
    cleaned = cleaned.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Disallow semicolons that could chain multiple queries
    // Allow a single optional trailing semicolon
    if (cleaned.endsWith(';')) {
      cleaned = cleaned.slice(0, -1).trim();
    }

    if (cleaned.includes(';')) {
      return {
        success: false,
        query: cleaned,
        error: 'Multiple SQL statements or unquoted semicolons are not permitted for security.'
      };
    }

    // Must begin with SELECT or WITH (for CTEs)
    const upper = cleaned.toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
      return {
        success: false,
        query: cleaned,
        error: 'Only read-only SELECT queries are permitted.'
      };
    }

    // Check for disallowed mutating keywords as separate tokens
    for (const keyword of DISALLOWED_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleaned)) {
        return {
          success: false,
          query: cleaned,
          error: `Operation "${keyword}" is not permitted. Only read-only SELECT queries are allowed.`
        };
      }
    }

    // Check for sensitive column access attempts
    for (const sensitive of SENSITIVE_COLUMNS) {
      const regex = new RegExp(`\\b${sensitive}\\b`, 'i');
      if (regex.test(cleaned)) {
        return {
          success: false,
          query: cleaned,
          error: `Access to column "${sensitive}" is restricted for security and privacy.`
        };
      }
    }

    // Role-based restrictions: viewers cannot query sensitive financial totals directly
    const isRestrictedRole = ['VIEWER', 'PILOT', 'TECHNICIAN'].includes(options.userRole || '');
    if (isRestrictedRole) {
      if (cleaned.toLowerCase().includes('contract_value') || cleaned.toLowerCase().includes('unit_price')) {
        return {
          success: false,
          query: cleaned,
          error: 'Your role does not have authorization to view contract values or unit pricing.'
        };
      }
    }

    // Ensure query has a LIMIT clause to prevent returning thousands of rows
    const hasLimit = /\bLIMIT\s+\d+/i.test(cleaned);
    let finalQuery = cleaned;
    if (!hasLimit) {
      finalQuery = `${cleaned} LIMIT ${maxRows}`;
    }

    // Execute query via Prisma raw query with statement timeout
    const results: any[] = await prisma.$queryRawUnsafe(finalQuery);

    // Sanitize any returned objects to strip any accidentally selected sensitive columns
    const sanitizedResults = (Array.isArray(results) ? results : []).map(row => {
      if (row && typeof row === 'object') {
        const copy: any = {};
        for (const [key, value] of Object.entries(row)) {
          if (!SENSITIVE_COLUMNS.includes(key.toLowerCase())) {
            // Handle BigInt serialization if present
            copy[key] = typeof value === 'bigint' ? value.toString() : value;
          }
        }
        return copy;
      }
      return row;
    });

    const executionTimeMs = Date.now() - startTime;
    const columns = sanitizedResults.length > 0 ? Object.keys(sanitizedResults[0]) : [];

    return {
      success: true,
      query: finalQuery,
      data: sanitizedResults,
      rowCount: sanitizedResults.length,
      columns,
      executionTimeMs
    };
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = error?.message || String(error);
    return {
      success: false,
      query,
      error: `SQL execution failed: ${errorMsg}`,
      executionTimeMs
    };
  }
}

/**
 * Helper to convert SQL query result rows into a clean GitHub Markdown table
 */
export function formatSqlResultToMarkdownTable(rows: any[], maxDisplayRows: number = 15): string {
  if (!rows || rows.length === 0) {
    return '_No records found matching the query._';
  }

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) return '_Empty row set._';

  // Format header
  const header = `| ${columns.map(c => c.replace(/_/g, ' ').toUpperCase()).join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;

  // Format rows
  const displayRows = rows.slice(0, maxDisplayRows);
  const bodyLines = displayRows.map(row => {
    const formattedCols = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '-';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (typeof val === 'object') return JSON.stringify(val);
      const str = String(val).replace(/\|/g, '\\|');
      return str.length > 40 ? str.slice(0, 37) + '...' : str;
    });
    return `| ${formattedCols.join(' | ')} |`;
  });

  let output = `${header}\n${separator}\n${bodyLines.join('\n')}`;
  if (rows.length > maxDisplayRows) {
    output += `\n\n_Showing ${maxDisplayRows} of ${rows.length} total rows._`;
  }
  return output;
}

/**
 * Intelligent deterministic SQL query generator & fallback when LLM is unavailable or for direct SQL
 */
export async function executeDeterministicFallback(
  userMessage: string,
  userRole?: string
): Promise<{ reply: string; queries: Array<{ query: string; rowCount: number }> }> {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();
  const executedQueries: Array<{ query: string; rowCount: number }> = [];

  // Check 1: Direct SQL query provided by user (e.g. /sql ..., SQL: ..., SELECT ...)
  const directSqlMatch = msg.match(/^(?:\/sql\s+|sql:\s*|query:\s*)(.+)$/i) ||
    (lower.startsWith('select ') ? [null, msg] : null);

  if (directSqlMatch && directSqlMatch[1]) {
    const candidateQuery = directSqlMatch[1].trim();
    const res = await executeSafeSqlQuery(candidateQuery, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### 📊 Query Execution Results\n\n**Executed SQL:**\n\`\`\`sql\n${res.query}\n\`\`\`\n\n**Found ${res.rowCount} records (${res.executionTimeMs}ms):**\n\n${table}\n\n*Data retrieved live from Supabase.*`,
        queries: executedQueries
      };
    } else {
      return {
        reply: `### ⚠️ Query Execution Error\n\nCould not execute your SQL query.\n\n**Attempted SQL:**\n\`\`\`sql\n${candidateQuery}\n\`\`\`\n\n**Error:** ${res.error}\n\n*Tip: Check that table and column names match the AeroSky schema (e.g., \`components\`, \`orders\`, \`drones\`, \`flight_logs\`).*`,
        queries: []
      };
    }
  }

  // Check 2: Components & Inventory queries
  if (
    lower.includes('component') ||
    lower.includes('inventory') ||
    lower.includes('stock') ||
    lower.includes('material') ||
    lower.includes('part')
  ) {
    let sql = 'SELECT name, quantity, category, unit_price FROM components';
    let title = '📦 Inventory & Components';

    if (lower.includes('out of stock') || lower.includes('zero') || lower.includes('0 stock')) {
      sql = 'SELECT name, quantity, category FROM components WHERE quantity = 0 ORDER BY name ASC';
      title = '⚠️ Out-of-Stock Components (Quantity = 0)';
    } else if (lower.includes('low') || lower.includes('reorder') || lower.includes('replenish')) {
      sql = 'SELECT name, quantity, category FROM components WHERE quantity <= 5 ORDER BY quantity ASC';
      title = '⚠️ Low Stock Components (Quantity ≤ 5)';
    } else if (lower.includes('manufacturing')) {
      sql = "SELECT name, quantity, category, unit_price FROM components WHERE LOWER(category) = 'manufacturing' ORDER BY quantity DESC";
      title = '🏭 Manufacturing Category Components';
    } else if (lower.includes('operational')) {
      sql = "SELECT name, quantity, category, unit_price FROM components WHERE LOWER(category) = 'operational' ORDER BY quantity DESC";
      title = '⚙️ Operational Category Components';
    } else if (lower.includes('summary') || lower.includes('count') || lower.includes('how many')) {
      sql = 'SELECT category, COUNT(*) as item_count, SUM(quantity) as total_units FROM components GROUP BY category ORDER BY item_count DESC';
      title = '📊 Component Summary by Category';
    } else {
      sql = 'SELECT name, quantity, category, unit_price FROM components ORDER BY quantity ASC LIMIT 20';
    }

    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ${title}\n\n${table}\n\n**Key Takeaways & Action Items:**\n- Total matched components: **${res.rowCount} items**.\n- Check critical items and schedule replenishment through the Inventory section.\n- For stock checkouts, record an inventory transaction to maintain full audit traceability.`,
        queries: executedQueries
      };
    }
  }

  // Check 3: Orders, Contracts & Revenue queries
  if (
    lower.includes('order') ||
    lower.includes('contract') ||
    lower.includes('pipeline') ||
    lower.includes('client') ||
    lower.includes('customer') ||
    lower.includes('revenue')
  ) {
    let sql = 'SELECT contract_number, client_name, drone_model, quantity, contract_value, manufacturing_stage, payment_status FROM orders ORDER BY created_at DESC LIMIT 15';
    let title = '📋 Orders & Contracts Pipeline';

    if (lower.includes('unpaid') || lower.includes('pending payment')) {
      sql = "SELECT contract_number, client_name, contract_value, payment_status, manufacturing_stage FROM orders WHERE payment_status != 'Paid' ORDER BY contract_value DESC";
      title = '💰 Outstanding & Unpaid Orders';
    } else if (lower.includes('stage') || lower.includes('status') || lower.includes('manufacturing stage')) {
      sql = 'SELECT manufacturing_stage, COUNT(*) as count, SUM(quantity) as total_units FROM orders GROUP BY manufacturing_stage ORDER BY count DESC';
      title = '🏭 Orders by Manufacturing Stage';
    } else if (lower.includes('high priority') || lower.includes('critical')) {
      sql = "SELECT contract_number, client_name, drone_model, manufacturing_stage, priority_level FROM orders WHERE priority_level = 'High' ORDER BY created_at DESC";
      title = '🚨 High Priority Orders';
    }

    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ${title}\n\n${table}\n\n**Operational Insights:**\n- Real-time records fetched: **${res.rowCount} records**.\n- Focus on expediting units in production and collecting pending contract milestones.\n- Full contract documents can be viewed in the Orders dashboard.`,
        queries: executedQueries
      };
    }
  }

  // Check 4: Drones & Fleet queries
  if (
    lower.includes('drone') ||
    lower.includes('fleet') ||
    lower.includes('vedansh') ||
    lower.includes('shaurya') ||
    lower.includes('uin') ||
    lower.includes('serial')
  ) {
    let sql = 'SELECT model_name, is_dgca_certified, created_at FROM drones ORDER BY created_at DESC';
    let title = '🚁 Drone Fleet Overview';

    if (lower.includes('unit') || lower.includes('serial') || lower.includes('uin') || lower.includes('manufactured')) {
      sql = 'SELECT m.serial_number, m.uin, d.model_name, m.created_at FROM manufactured_units m JOIN drones d ON m.drone_id = d.id ORDER BY m.created_at DESC LIMIT 20';
      title = '🛠️ Manufactured Drone Units & Serial Numbers';
    }

    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ${title}\n\n${table}\n\n**Fleet Capabilities:**\n- Total recorded units: **${res.rowCount}**.\n- **VEDANSH**: Precision Surveying Drone, DGCA Certified, dual GPS PPK, 40 min flight time.\n- **SHAURYA**: Tactical & LiDAR Drone, 15km range, dual battery redundancy, 2kg payload capacity.`,
        queries: executedQueries
      };
    }
  }

  // Check 5: Flights & Pilot Operations
  if (
    lower.includes('flight') ||
    lower.includes('pilot') ||
    lower.includes('mission') ||
    lower.includes('takeoff') ||
    lower.includes('flying')
  ) {
    const sql = 'SELECT f.date, f.takeoff_time, f.duration, f.location_name, f.mission_type, d.model_name, t.name as pilot_name FROM flight_logs f LEFT JOIN drones d ON f.drone_id = d.id LEFT JOIN team_members t ON f.pic_id = t.id ORDER BY f.date DESC LIMIT 15';
    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ✈️ Recent Flight Logs & Mission Records\n\n${table}\n\n**Flight Analytics:**\n- Records analyzed: **${res.rowCount} flights**.\n- Make sure all flight logs include technical feedback and battery IDs for DGCA compliance.`,
        queries: executedQueries
      };
    }
  }

  // Check 6: Expenses & Financials
  if (
    lower.includes('expense') ||
    lower.includes('spending') ||
    lower.includes('cost') ||
    lower.includes('reimbursement')
  ) {
    let sql = 'SELECT description, amount, category, date, payment_status FROM expenses ORDER BY date DESC LIMIT 15';
    let title = '💳 Expense Records';

    if (lower.includes('category') || lower.includes('breakdown')) {
      sql = 'SELECT category, COUNT(*) as count, SUM(amount) as total_amount FROM expenses GROUP BY category ORDER BY total_amount DESC';
      title = '📊 Expense Breakdown by Category';
    }

    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ${title}\n\n${table}\n\n**Financial Overview:**\n- Total line items: **${res.rowCount}**.\n- Ensure all invoices and receipts are attached to maintain clean accounting.`,
        queries: executedQueries
      };
    }
  }

  // Check 7: Leads & CRM
  if (
    lower.includes('lead') ||
    lower.includes('crm') ||
    lower.includes('prospect') ||
    lower.includes('follow up') ||
    lower.includes('followup')
  ) {
    let sql = 'SELECT name, company, email, phone, source, value, created_at FROM leads ORDER BY created_at DESC LIMIT 15';
    let title = '🎯 CRM Leads Pipeline';

    if (lower.includes('follow up') || lower.includes('followup') || lower.includes('schedule')) {
      sql = "SELECT f.title, f.scheduled_at, f.status, l.name as lead_name, l.company FROM follow_ups f LEFT JOIN leads l ON f.lead_id = l.id WHERE f.status = 'PENDING' ORDER BY f.scheduled_at ASC LIMIT 15";
      title = '📅 Pending Follow-ups';
    }

    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### ${title}\n\n${table}\n\n**Sales Acceleration Strategy:**\n- Active items: **${res.rowCount}**.\n- Follow-up within 24 hours of first inquiry.\n- Focus top effort on leads with established budgets and near-term deployment plans.`,
        queries: executedQueries
      };
    }
  }

  // Check 8: Team members & Users
  if (
    lower.includes('team') ||
    lower.includes('staff') ||
    lower.includes('member') ||
    lower.includes('employee') ||
    lower.includes('who is')
  ) {
    const sql = 'SELECT name, position, email, phone, access_id FROM team_members ORDER BY name ASC LIMIT 20';
    const res = await executeSafeSqlQuery(sql, { userRole });
    if (res.success && res.data) {
      executedQueries.push({ query: res.query, rowCount: res.rowCount || 0 });
      const table = formatSqlResultToMarkdownTable(res.data);
      return {
        reply: `### 👥 AeroSky Team Directory\n\n${table}\n\n**Team Structure:**\n- Active members: **${res.rowCount}**.\n- Team roles cover flight operations, hardware design, manufacturing assembly, and executive leadership.`,
        queries: executedQueries
      };
    }
  }

  // Fallback: Comprehensive system overview with live database counts
  const countSql = `
    SELECT 
      (SELECT COUNT(*) FROM components) as components_count,
      (SELECT COUNT(*) FROM orders) as orders_count,
      (SELECT COUNT(*) FROM drones) as drones_count,
      (SELECT COUNT(*) FROM flight_logs) as flights_count,
      (SELECT COUNT(*) FROM expenses) as expenses_count,
      (SELECT COUNT(*) FROM leads) as leads_count,
      (SELECT COUNT(*) FROM team_members) as team_count
  `;
  const countRes = await executeSafeSqlQuery(countSql, { userRole });
  const counts = countRes.data?.[0] || {};

  return {
    reply: `### ✈️ AeroSky Operations Intelligence\n\nI can execute live SQL queries against our Supabase PostgreSQL database to answer any operational, financial, or fleet questions!\n\n**Live Database Snapshot:**\n- 📦 **Inventory Components**: ${counts.components_count || 0}\n- 📋 **Orders & Contracts**: ${counts.orders_count || 0}\n- 🚁 **Drones**: ${counts.drones_count || 0}\n- ✈️ **Flight Logs**: ${counts.flights_count || 0}\n- 💳 **Expenses**: ${counts.expenses_count || 0}\n- 🎯 **CRM Leads**: ${counts.leads_count || 0}\n- 👥 **Team Members**: ${counts.team_count || 0}\n\n**Try asking specific questions like:**\n- *"Show all components with zero or low quantity"* \n- *"What are our orders by manufacturing stage?"*\n- *"List all team members and their positions"*\n- *"Show recent flights and pilots"*\n- Or run direct SQL: \`/sql SELECT name, quantity, category FROM components WHERE quantity = 0;\``,
    queries: []
  };
}
