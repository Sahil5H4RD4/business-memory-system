/**
 * Demo Script — Complete Business Scenario Simulation
 *
 * Run: node src/demo.js
 *
 * This script demonstrates the full pipeline end-to-end:
 *   1. Seeds suppliers, invoices, and issues into PostgreSQL
 *   2. Runs the context retrieval pipeline
 *   3. Shows scored results with explanations
 *   4. Demonstrates conflict resolution and trend detection
 */

const db = require('./db');
const SupplierModel = require('./models/supplier.model');
const InvoiceModel = require('./models/invoice.model');
const IssueModel = require('./models/issue.model');
const lifecycle = require('./engines/lifecycle.engine');
const relevance = require('./engines/relevance.engine');
const retrieval = require('./engines/retrieval.engine');
const conflict = require('./engines/conflict.engine');
const explain = require('./engines/explainability.engine');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function header(title) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

function subheader(title) {
    const pad = Math.max(0, 50 - title.length);
    console.log(`\n  ── ${title} ${'─'.repeat(pad)}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Clean Database
// ---------------------------------------------------------------------------

async function cleanDatabase() {
    await db.query('DELETE FROM issues');
    await db.query('DELETE FROM invoices');
    await db.query('DELETE FROM suppliers');
    // Reset sequences
    await db.query('ALTER SEQUENCE suppliers_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE invoices_id_seq RESTART WITH 1');
    await db.query('ALTER SEQUENCE issues_id_seq RESTART WITH 1');
    console.log('  🗑  Database cleaned');
}

// ---------------------------------------------------------------------------
// SCENARIO 1: Supplier Invoice Risk Assessment
// ---------------------------------------------------------------------------

async function scenario1() {
    header('SCENARIO 1: Supplier Invoice Risk Assessment');
    console.log('  A new invoice arrives from a supplier with quality issues.');
    console.log('  The system flags risks and explains its reasoning.\n');

    // Step 1: Seed suppliers
    subheader('Step 1: Create Suppliers');

    const acme = await SupplierModel.createSupplier({
        name: 'Acme Manufacturing Co.',
        industry: 'Manufacturing',
        rating: 0.35,
        contact: 'john@acme.com'
    });
    console.log(`  ✅ Created: ${acme.name} (ID: ${acme.id}, Rating: ${acme.rating})`);

    const globex = await SupplierModel.createSupplier({
        name: 'Globex Electronics',
        industry: 'Electronics',
        rating: 0.85,
        contact: 'jane@globex.com'
    });
    console.log(`  ✅ Created: ${globex.name} (ID: ${globex.id}, Rating: ${globex.rating})`);

    // Step 2: Seed issues for Acme (problematic supplier)
    subheader('Step 2: Log Quality Issues for Acme');

    const issues = [
        { supplier_id: acme.id, description: 'Defective batch of steel components — 15% failure rate', severity: 4, status: 'open' },
        { supplier_id: acme.id, description: 'Late delivery — shipment arrived 3 weeks past due date', severity: 3, status: 'resolved' },
        { supplier_id: acme.id, description: 'Quality degradation in summer batches — material softening', severity: 5, status: 'open' },
        { supplier_id: acme.id, description: 'Invoice discrepancy — charged for undelivered items', severity: 3, status: 'resolved' },
    ];

    for (const issue of issues) {
        const created = await IssueModel.createIssue(issue);
        console.log(`  ⚠️  Issue #${created.id}: [Sev ${created.severity}] ${created.description.substring(0, 50)}...`);
    }

    // Step 3: Seed invoices
    subheader('Step 3: Create Invoice History');

    await InvoiceModel.createInvoice({
        supplier_id: acme.id, amount: 12500, payment_status: 'paid',
        invoice_date: '2026-01-10', description: 'Q4 steel components'
    });
    console.log('  💰 Invoice: $12,500 (paid) — Q4 steel components');

    const overdueInv = await InvoiceModel.createInvoice({
        supplier_id: acme.id, amount: 8900, payment_status: 'pending',
        invoice_date: '2026-01-15', due_date: '2026-02-15',
        description: 'January batch — disputed quality'
    });
    console.log('  💰 Invoice: $8,900 (pending/overdue) — January batch');

    // Step 4: NEW invoice arrives — trigger retrieval
    subheader('Step 4: New Invoice Arrives → Trigger Context Retrieval');

    const newInvoice = await InvoiceModel.createInvoice({
        supplier_id: acme.id, amount: 15000, payment_status: 'pending',
        invoice_date: '2026-02-26', due_date: '2026-03-28',
        description: 'February batch — new order'
    });
    console.log(`  📄 NEW Invoice #${newInvoice.id}: $15,000 from Acme Manufacturing`);
    console.log('  🔍 Running context retrieval pipeline...\n');

    // Run the full pipeline
    const result = await retrieval.retrieveContext(acme.id, {
        keywords: ['quality', 'defective', 'overdue', 'invoice'],
        topK: 5
    });

    // Conflict resolution
    let conflictResult = null;
    if (result.items.length > 0) {
        conflictResult = await conflict.resolveConflicts(acme.id, result.items);
        result.items = conflictResult.adjustedItems;
    }

    // Generate explanation
    const explanation = explain.generateExplanation({
        supplier: result.supplier,
        items: result.items,
        reasons: result.reasons,
        trendInfo: conflictResult?.trendInfo || null,
        summary: result.summary,
    });

    // Print results
    explain.printExplanation(explanation);

    // Print detailed scoring
    subheader('Detailed Scoring Breakdown');
    result.items.forEach((item, idx) => {
        console.log(`\n  #${idx + 1} [${(item.record_type || 'memory').toUpperCase()}]`);
        console.log(`     ${(item.description || '').substring(0, 60)}`);
        console.log(`     Temporal:   ${item.scores?.temporal?.toFixed(4) || 'N/A'}`);
        console.log(`     Relational: ${item.scores?.relational?.toFixed(4) || 'N/A'}`);
        console.log(`     Semantic:   ${item.scores?.semantic?.toFixed(4) || 'N/A'}`);
        console.log(`     Final:      ${item.scores?.finalScore?.toFixed(4) || 'N/A'}`);
        if (item.conflictAdjustment && item.conflictAdjustment !== 'none') {
            console.log(`     Conflict:   ${item.conflictAdjustment} (×${item.scores?.conflictMultiplier})`);
        }
    });

    // Lifecycle demo
    subheader('Lifecycle Scores');
    console.log(`  Temporal score (today):     ${lifecycle.calculateTemporalScore(new Date()).toFixed(4)}`);
    console.log(`  Temporal score (30d ago):    ${lifecycle.calculateTemporalScore(new Date(Date.now() - 30 * 86400000)).toFixed(4)}`);
    console.log(`  Temporal score (180d ago):   ${lifecycle.calculateTemporalScore(new Date(Date.now() - 180 * 86400000)).toFixed(4)}`);
    console.log(`  Temporal score (730d ago):   ${lifecycle.calculateTemporalScore(new Date(Date.now() - 730 * 86400000)).toFixed(4)}`);

    console.log(`\n  Age class (today):     ${lifecycle.classifyAge(new Date())}`);
    console.log(`  Age class (7mo ago):   ${lifecycle.classifyAge(new Date(Date.now() - 210 * 86400000))}`);
    console.log(`  Age class (3yr ago):   ${lifecycle.classifyAge(new Date(Date.now() - 1095 * 86400000))}`);
}

// ---------------------------------------------------------------------------
// SCENARIO 2: Customer Escalation & Positive Trend
// ---------------------------------------------------------------------------

async function scenario2() {
    header('SCENARIO 2: Reliable Supplier — Positive Context');
    console.log('  An invoice arrives from a high-rated supplier.');
    console.log('  The system should show NO flags.\n');

    // Use Globex (created in scenario 1)
    const suppliers = await SupplierModel.getAllSuppliers();
    const globex = suppliers.find(s => s.name.includes('Globex'));

    if (!globex) {
        console.log('  ❌ Globex not found, skipping scenario 2');
        return;
    }

    // Add a minor resolved issue
    await IssueModel.createIssue({
        supplier_id: globex.id,
        description: 'Minor packaging issue — resolved same day',
        severity: 1,
        status: 'resolved'
    });
    console.log('  ℹ️  Minor issue logged (resolved)');

    // Add good invoices
    await InvoiceModel.createInvoice({
        supplier_id: globex.id, amount: 25000, payment_status: 'paid',
        invoice_date: '2026-02-01', description: 'Premium electronics batch'
    });
    console.log('  💰 Invoice: $25,000 (paid on time)');

    // New invoice
    const newInvoice = await InvoiceModel.createInvoice({
        supplier_id: globex.id, amount: 30000, payment_status: 'pending',
        invoice_date: '2026-02-26', due_date: '2026-03-26',
        description: 'March electronics order'
    });
    console.log(`  📄 NEW Invoice #${newInvoice.id}: $30,000 from Globex Electronics`);
    console.log('  🔍 Running context retrieval...\n');

    const result = await retrieval.retrieveContext(globex.id, {
        keywords: ['invoice', 'payment'],
        topK: 5
    });

    const explanation = explain.generateExplanation({
        supplier: result.supplier,
        items: result.items,
        reasons: result.reasons,
        trendInfo: null,
        summary: result.summary,
    });

    explain.printExplanation(explanation);
}

// ---------------------------------------------------------------------------
// SCENARIO 3: Trend Detection Demo
// ---------------------------------------------------------------------------

async function scenario3() {
    header('SCENARIO 3: Trend Analysis Comparison');
    console.log('  Comparing severity trends across suppliers.\n');

    const suppliers = await SupplierModel.getAllSuppliers();

    for (const sup of suppliers) {
        const trend = await conflict.detectTrend(sup.id);
        const issues = await IssueModel.getRecentIssues(sup.id, 365);
        const weightedSev = conflict.weightedAverageSeverity(issues);

        console.log(`  📊 ${sup.name}`);
        console.log(`     Trend:             ${trend.trend.toUpperCase()}`);
        console.log(`     Recent avg sev:    ${trend.recentAvg}`);
        console.log(`     Older avg sev:     ${trend.olderAvg}`);
        console.log(`     Delta:             ${trend.delta > 0 ? '+' : ''}${trend.delta}`);
        console.log(`     Weighted severity: ${weightedSev}`);
        console.log(`     Total issues:      ${trend.totalIssues}`);
        console.log('');
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('\n🧠 ══════════════════════════════════════════════════════════');
    console.log('   BUSINESS CONTEXT MEMORY ENGINE — DEMO');
    console.log('   ══════════════════════════════════════════════════════════\n');

    try {
        await db.testConnection();
        await db.initializeSchema();
        await cleanDatabase();

        await scenario1();
        await sleep(200);
        await scenario2();
        await sleep(200);
        await scenario3();

        header('DEMO COMPLETE');
        console.log('  ✅ All scenarios executed successfully');
        console.log('  📊 System demonstrated: retrieval, scoring, conflict resolution,');
        console.log('     lifecycle decay, trend analysis, and explainability.\n');

    } catch (err) {
        console.error('\n❌ Demo error:', err.message);
        console.error(err.stack);
    } finally {
        await db.pool.end();
        process.exit(0);
    }
}

main();
