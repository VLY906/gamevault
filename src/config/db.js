
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const isTiDB = process.env.DB_SSL === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  ...(isTiDB && {
    ssl: {
      ca: fs.readFileSync(
        path.join(__dirname, '../../certs/isrgrootx1.pem')
      ),
      rejectUnauthorized: true
    }
  })
});

module.exports = pool;
