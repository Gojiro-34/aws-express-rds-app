require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');

const app = express();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to RDS MySQL database');
});

app.get('/test', (req, res) => {
    res.send('CI/CD is working!');
});

app.get('/', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            res.status(500).send('Database error');
            return;
        }
        res.json(results);
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
