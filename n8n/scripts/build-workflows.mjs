/**
 * Generates the n8n workflow JSON files in ../workflows from one definition,
 * so every email shares the same layout and node versions.
 *
 *   node n8n/scripts/build-workflows.mjs
 *
 * Node versions match n8n 1.123.5 (pinned in docker-compose.yml).
 * Webhook paths match the event names published by backend/src/services/events.ts.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'workflows');
const SMTP = { smtp: { id: 'ddMailpitSmtp001', name: 'Mailpit SMTP (local)' } };

// ---- expression helpers (strings evaluated by n8n, not here) ----------------

/** Payload published by the API, as received by the Webhook node. */
const D = '$json.body.data';
/** HTML-escapes a user-supplied value inside an n8n expression. */
const esc = (expr) => `String(${expr} ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c])`;
const money = (expr) => `'$' + Number(${expr}).toFixed(2)`;

/** Shared branded email shell. `body` is HTML that may contain {{ }} expressions. */
const layout = (heading, body) =>
  `=<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#333">
  <div style="padding:20px 0;border-bottom:2px solid #7a1f3d">
    <span style="font-family:Georgia,serif;font-size:24px;color:#7a1f3d">DesiDrapes</span>
  </div>
  <h2 style="font-weight:normal;margin:24px 0 12px">${heading}</h2>
  ${body}
  <p style="margin-top:32px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px">
    DesiDrapes · Indian ethnic wear, delivered across Australia.<br>
    This is a demo store running locally; this email was captured by Mailpit and never sent to a real inbox.
  </p>
</div>`;

const button = (hrefExpr, label) =>
  `<p style="margin:24px 0"><a href="{{ ${hrefExpr} }}" style="background:#111;color:#fff;padding:12px 22px;text-decoration:none">${label}</a></p>`;

// ---- node builders ----------------------------------------------------------

let x = 0;
const pos = () => [(x += 260), 300];

const webhook = (event) => ({
  id: `${event}-trigger`,
  name: `On ${event}`,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2.1,
  position: pos(),
  webhookId: `desidrapes-${event}`,
  parameters: { httpMethod: 'POST', path: event, responseMode: 'onReceived', options: {} },
});

const email = (name, { to, subject, html }) => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  type: 'n8n-nodes-base.emailSend',
  typeVersion: 2.1,
  position: pos(),
  credentials: SMTP,
  // Transient SMTP failures are retried before the execution is marked as failed.
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  parameters: {
    fromEmail: '={{ $env.DESIDRAPES_FROM_EMAIL }}',
    toEmail: to,
    subject,
    emailFormat: 'html',
    html,
    options: { appendAttribution: false },
  },
});

/**
 * Rejects events that don't carry the shared secret (x-api-key == $env.DESIDRAPES_API_KEY),
 * so only the DesiDrapes API can trigger emails. The key must also be non-empty, otherwise
 * a missing header would "match" a missing env var.
 */
const keyGuard = () => ({
  id: 'verify-api-key',
  name: 'Verify API key',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: pos(),
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [
        {
          id: 'key-configured',
          leftValue: '={{ $env.DESIDRAPES_API_KEY ?? "" }}',
          rightValue: '',
          operator: { type: 'string', operation: 'notEmpty', singleValue: true },
        },
        {
          id: 'key-matches',
          leftValue: '={{ $json.headers["x-api-key"] ?? "" }}',
          rightValue: '={{ $env.DESIDRAPES_API_KEY }}',
          operator: { type: 'string', operation: 'equals' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

const rejectNode = () => ({
  id: 'reject-unauthorised',
  name: 'Reject: invalid API key',
  type: 'n8n-nodes-base.stopAndError',
  typeVersion: 1,
  position: [x, 500],
  parameters: { errorType: 'errorMessage', errorMessage: 'Rejected event: missing or invalid x-api-key header' },
});

const link = (to) => ({ node: to.name, type: 'main', index: 0 });

/**
 * Builds a workflow from a trigger and its action nodes.
 * Webhook triggers automatically get the API-key guard: trigger → guard → (true) actions / (false) reject.
 * Other triggers run their nodes as a straight chain.
 */
function workflow(id, name, nodes, { fanOut = [] } = {}) {
  const [trigger, ...rest] = nodes;
  const connections = {};
  let all;

  if (trigger.type === 'n8n-nodes-base.webhook') {
    const guard = keyGuard();
    const reject = rejectNode();
    connections[trigger.name] = { main: [[link(guard)]] };
    connections[guard.name] = { main: [[...rest, ...fanOut].map(link), [link(reject)]] };
    all = [trigger, guard, ...rest, ...fanOut, reject];
  } else {
    for (let i = 0; i < nodes.length - 1; i++) connections[nodes[i].name] = { main: [[link(nodes[i + 1])]] };
    all = [...nodes, ...fanOut];
  }

  x = 0;
  return {
    id,
    name,
    // n8n 1.123 rejects `active: true` on import (FK to its version history); bootstrap.sh
    // activates every workflow with `update:workflow --all --active=true` after importing.
    active: false,
    nodes: all,
    connections,
    settings: { executionOrder: 'v1', saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
    pinData: {},
    meta: { templateCredsSetupCompleted: true },
    tags: [],
  };
}

// ---- workflows --------------------------------------------------------------

const itemsTable = `<table style="width:100%;border-collapse:collapse;font-size:14px">
    {{ ${D}.items.map(i => '<tr><td style="padding:6px 0;border-bottom:1px solid #eee">' + ${esc('i.name')} + ' (' + ${esc('i.size')} + ') &times; ' + i.quantity + '</td><td style="text-align:right;border-bottom:1px solid #eee">' + ${money('i.lineTotal')} + '</td></tr>').join('') }}
    <tr><td style="padding:10px 0;font-weight:bold">Total paid</td><td style="text-align:right;font-weight:bold">{{ ${money(`${D}.total`)} }} {{ ${D}.currency }}</td></tr>
  </table>`;

const address = `{{ ${esc(`${D}.shippingAddress.fullName`)} }}<br>{{ ${esc(`${D}.shippingAddress.line1`)} }}<br>{{ ${esc(`${D}.shippingAddress.city`)} }} {{ ${esc(`${D}.shippingAddress.state`)} }} {{ ${esc(`${D}.shippingAddress.postcode`)} }}`;

const workflows = [];

{
  const trigger = webhook('order.paid');
  const customer = email('Email customer: order confirmation', {
    to: `={{ ${D}.email }}`,
    subject: `=Order #{{ ${D}.orderNumber }} confirmed`,
    html: layout(
      `Thank you, {{ ${esc(`${D}.customerName`)} }}!`,
      `<p>We've received your payment and are getting your order ready.</p>
  <p style="color:#777">Order #{{ ${D}.orderNumber }}</p>
  ${itemsTable}
  <p style="margin-top:20px"><strong>Shipping to</strong><br>${address}</p>
  ${button(`${D}.orderUrl`, 'View your order')}`,
    ),
  });
  const admin = email('Email admin: new order', {
    to: '={{ $env.DESIDRAPES_ADMIN_EMAIL }}',
    subject: `=New order #{{ ${D}.orderNumber }}: {{ ${money(`${D}.total`)} }}`,
    html: layout(
      `New paid order #{{ ${D}.orderNumber }}`,
      `<p>{{ ${esc(`${D}.customerName`)} }} ({{ ${esc(`${D}.email`)} }}) just paid.</p>${itemsTable}
  <p>Ready to fulfil from the admin dashboard.</p>`,
    ),
  });
  workflows.push(['order-paid', workflow('ddOrderPaid00001', 'DesiDrapes: order paid → confirmation + admin alert', [trigger, customer], { fanOut: [admin] })]);
}

{
  const messages = `({SHIPPED:'Good news, your order is on its way!',DELIVERED:'Your order has been delivered. We hope you love it!',PROCESSING:'We are preparing your order.',CANCELLED:'Your order was cancelled. If you were charged, a refund has been issued.'})[${D}.to] || ('Your order is now ' + String(${D}.to).toLowerCase() + '.')`;
  workflows.push([
    'order-status',
    workflow('ddOrderStatus001', 'DesiDrapes: order status update → customer', [
      webhook('order.status_changed'),
      email('Email customer: status update', {
        to: `={{ ${D}.email }}`,
        subject: `=Order #{{ ${D}.orderNumber }}: {{ String(${D}.to).charAt(0) + String(${D}.to).slice(1).toLowerCase() }}`,
        html: layout(`Hi {{ ${esc(`${D}.customerName`)} }},`, `<p>{{ ${messages} }}</p>${button(`${D}.orderUrl`, 'Track your order')}`),
      }),
    ]),
  ]);
}

workflows.push([
  'payment-failed',
  workflow('ddPaymentFail001', 'DesiDrapes: payment failed → customer', [
    webhook('payment.failed'),
    email('Email customer: payment failed', {
      to: `={{ ${D}.email }}`,
      subject: '=Your payment did not go through',
      html: layout(
        `Hi {{ ${esc(`${D}.name`)} }},`,
        `<p>Your payment of {{ ${money(`${D}.total`)} }} couldn't be completed, so we cancelled the order and released the items back to stock.</p>
  <p>No money was taken. You're welcome to try again any time.</p>
  ${button('$env.DESIDRAPES_STORE_URL + "/cart"', 'Return to the store')}`,
      ),
    }),
  ]),
]);

workflows.push([
  'welcome',
  workflow('ddWelcomeMail001', 'DesiDrapes: new customer → welcome email', [
    webhook('user.registered'),
    email('Email customer: welcome', {
      to: `={{ ${D}.email }}`,
      subject: '=Welcome to DesiDrapes 🌸',
      html: layout(
        `Welcome, {{ ${esc(`${D}.name`)} }}!`,
        `<p>Thanks for joining DesiDrapes. Discover lehengas, sarees, kurtas and sherwanis for every celebration.</p>
  <p>Here's 10% off your first order: <strong style="font-size:18px;letter-spacing:1px">WELCOME10</strong></p>
  ${button('$env.DESIDRAPES_STORE_URL + "/collection"', 'Start shopping')}`,
      ),
    }),
  ]),
]);

workflows.push([
  'password-reset',
  workflow('ddPasswordRst001', 'DesiDrapes: password reset → link email', [
    webhook('password.reset_requested'),
    email('Email customer: reset link', {
      to: `={{ ${D}.email }}`,
      subject: '=Reset your DesiDrapes password',
      html: layout(
        `Hi {{ ${esc(`${D}.name`)} }},`,
        `<p>We received a request to reset your password. This link expires in {{ ${D}.expiresInMinutes }} minutes.</p>
  ${button(`${D}.resetUrl`, 'Choose a new password')}
  <p style="color:#777;font-size:13px">If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
      ),
    }),
  ]),
]);

workflows.push([
  'low-stock',
  workflow('ddLowStockAlrt01', 'DesiDrapes: low stock → admin alert', [
    webhook('inventory.low'),
    email('Email admin: low stock', {
      to: `={{ ${D}.adminEmail || $env.DESIDRAPES_ADMIN_EMAIL }}`,
      subject: `={{ ${D}.stock === 0 ? 'Sold out' : 'Low stock' }}: {{ ${D}.name }} ({{ ${D}.size }})`,
      html: layout(
        '{{ ' + D + ".stock === 0 ? 'A size just sold out' : 'Stock is running low' }}",
        `<p><strong>{{ ${esc(`${D}.name`)} }}</strong>, size {{ ${esc(`${D}.size`)} }}: <strong>{{ ${D}.stock }}</strong> left (alert threshold {{ ${D}.threshold }}).</p>
  ${button('$env.DESIDRAPES_STORE_URL + "/admin/products"', 'Restock in admin')}`,
      ),
    }),
  ]),
]);

{
  const schedule = {
    id: 'daily-schedule',
    name: 'Every day at 8am',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.3,
    position: pos(),
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * *' }] } },
  };
  const fetchReport = {
    id: 'fetch-report',
    name: 'Fetch yesterday’s sales from API',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: pos(),
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: '={{ $env.DESIDRAPES_API_URL }}/api/internal/reports/daily',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-api-key', value: '={{ $env.DESIDRAPES_API_KEY }}' }] },
      options: { timeout: 15000 },
    },
  };
  const R = '$json';
  const report = email('Email admin: daily report', {
    to: '={{ $env.DESIDRAPES_ADMIN_EMAIL }}',
    subject: `=Daily sales {{ ${R}.date }}: {{ ${money(`${R}.revenue`)} }} from {{ ${R}.paidOrders }} order(s)`,
    html: layout(
      `Sales report for {{ ${R}.date }}`,
      `<table style="font-size:15px;line-height:1.8">
    <tr><td>Revenue</td><td style="padding-left:24px"><strong>{{ ${money(`${R}.revenue`)} }}</strong></td></tr>
    <tr><td>Paid orders</td><td style="padding-left:24px">{{ ${R}.paidOrders }}</td></tr>
    <tr><td>Orders placed</td><td style="padding-left:24px">{{ ${R}.ordersPlaced }}</td></tr>
    <tr><td>New customers</td><td style="padding-left:24px">{{ ${R}.newCustomers }}</td></tr>
    <tr><td>Low-stock sizes</td><td style="padding-left:24px">{{ ${R}.lowStockCount }}</td></tr>
  </table>
  <p style="margin-top:16px"><strong>Restock soon:</strong><br>{{ ${R}.lowStock.slice(0, 10).map(v => ${esc('v.name')} + ' (' + v.size + '): ' + v.stock).join('<br>') || 'Nothing, all healthy.' }}</p>`,
    ),
  });
  // A manual trigger lets the report be run on demand (n8n UI or `n8n execute`).
  const manual = {
    id: 'manual-run',
    name: 'Run now (manual)',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [260, 500],
    parameters: {},
  };
  const wf = workflow('ddDailyReport001', 'DesiDrapes: daily sales report (n8n → API → email)', [schedule, fetchReport, report]);
  wf.nodes.push(manual);
  wf.connections[manual.name] = { main: [[{ node: fetchReport.name, type: 'main', index: 0 }]] };
  workflows.push(['daily-report', wf]);
}

/** n8n requires a versionId; derive it from content so it changes exactly when the workflow does. */
function withVersionId(wf) {
  const h = createHash('sha1').update(JSON.stringify(wf)).digest('hex');
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  return { ...wf, versionId: uuid };
}

mkdirSync(OUT, { recursive: true });
for (const [file, raw] of workflows) {
  const wf = withVersionId(raw);
  writeFileSync(join(OUT, `${file}.json`), JSON.stringify(wf, null, 2) + '\n');
  console.log(`wrote workflows/${file}.json  (${wf.nodes.length} nodes)`);
}
