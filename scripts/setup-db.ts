// scripts/setup-db.ts
// Run this once to set up your local SQLite database
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPath = process.env.DATABASE_URL || './data/badtraders.db';
const migrationFile = join(process.cwd(), 'migrations', '001_create_tables.sqlite.sql');

console.log('Setting up SQLite database...');
console.log('Database path:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

try {
  const migrationSQL = readFileSync(migrationFile, 'utf-8');

  // Split the SQL file into statements
  // Remove line comments and split by semicolon
  const lines = migrationSQL.split('\n');
  let currentStatement = '';
  const statements: string[] = [];

  for (const line of lines) {
    // Remove inline comments (everything after --)
    const cleanLine = line.split('--')[0].trim();
    if (cleanLine) {
      currentStatement += cleanLine + ' ';
      // If line ends with semicolon, it's the end of a statement
      if (cleanLine.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt.length > 0 && !stmt.match(/^\s*$/)) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
  }

  // Add any remaining statement
  if (currentStatement.trim().length > 0) {
    statements.push(currentStatement.trim());
  }

  console.log(`Executing ${statements.length} SQL statements...`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement && statement.length > 5) { // Filter out tiny leftover fragments
      try {
        db.exec(statement);
        console.log(`  ✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists')) {
          console.log(`  ⚠️  Statement ${i + 1}: Already exists, skipping...`);
        } else {
          console.error(`  ❌ Error in statement ${i + 1}:`);
          console.error(`     ${statement.substring(0, 100)}...`);
          throw err;
        }
      }
    }
  }

  console.log('\n✅ Database setup complete!');

  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name: string}>;
  console.log('Tables created:', tables.map(t => t.name).join(', ') || 'none');

} catch (error) {
  console.error('\n❌ Error setting up database:', error);
  process.exit(1);
} finally {
  db.close();
}
