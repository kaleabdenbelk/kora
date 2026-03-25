import pkg from 'pg';
const { Client } = pkg;

async function main() {
  const connectionString = "postgresql://postgres:postgres@localhost:5432/postgres";
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to default 'postgres' database.");
    
    // Check if kora_dev exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'kora_dev'");
    if (res.rowCount === 0) {
      console.log("Creating database 'kora_dev'...");
      await client.query("CREATE DATABASE kora_dev");
      console.log("Database 'kora_dev' created successfully.");
    } else {
      console.log("Database 'kora_dev' already exists.");
    }
  } catch (err) {
    console.error("Error creating database:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
