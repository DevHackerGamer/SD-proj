import express from 'express';
import sql from 'mssql';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library'; // Adjust the import path as necessary
import dotenv from 'dotenv';
import { Clerk , requireAuth} from "@clerk/clerk-sdk-node";
dotenv.config();

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    },
};



const app = express();
app.use(cors({
    origin: "http://localhost:3000", // Adjust this to your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
})



// SQL Server config

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on('error', err => {
    console.error('Database connection error:', err);
});



sql.connect(config)
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection failed:', err));


const PORT = process.env.PORT || 5000;
const server = app.listen(PORT,'0.0.0.0', () => console.log(`Server running on port ${PORT}`));
server.timeout = 120000;
