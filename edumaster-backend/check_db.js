const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'edumaster',
  password: '123456',
  port: 5432,
});

async function run() {
  await client.connect();
  console.log("Connected to DB");

  const res = await client.query(`SELECT id, document_id, id_number, name, url FROM student_documents WHERE id_number LIKE '%036094012011%'`);
  console.log("Docs:", JSON.stringify(res.rows, null, 2));

  const studentRes = await client.query(`SELECT id, document_id, id_number, full_name, photo FROM students WHERE id_number LIKE '%036094012011%'`);
  console.log("Students:", JSON.stringify(studentRes.rows, null, 2));

  await client.end();
}

run().catch(console.error);
