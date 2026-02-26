/**
 * Express Server — Business Context Memory Engine
 * 
 * Main entry point for the API server. Sets up middleware,
 * registers route handlers, and starts the HTTP listener.
 */

const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
    res.json({
        name: 'Business Context Memory Engine',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const supplierRoutes = require('./routes/supplier.routes');
const invoiceRoutes = require('./routes/invoice.routes');

app.use('/api/suppliers', supplierRoutes);
app.use('/api/invoices', invoiceRoutes);

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------

const db = require('./db');
db.testConnection().then(() => db.initializeSchema());

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`\n🧠 Business Context Memory Engine`);
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
