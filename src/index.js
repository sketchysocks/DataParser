'use strict';

const cluster = require('cluster');
const express = require('express');
const app = express();

const config = require('./config.json');
const WebhookController = require('./services/webhook.js');
const instances = config.clusters || 4;

// TODO: Add raw proto to redis
// TODO: Loop redis insert into mysql

if (cluster.isMaster) {
    console.log(`[Cluster] Master ${process.pid} is running`);
  
    // Fork workers
    for (let i = 0; i < instances; i++) {
        cluster.fork();
    }

    // If worker gets disconnected, start new one. 
    cluster.on('disconnect', function (worker) {
        console.error(`[Cluster] Worker disconnect: ${worker.id}`);
        let newWorker = cluster.fork();
        console.log('[Cluster] New worker started with process id %s', newWorker.process.pid);
    });
  
    cluster.on('online', function (worker) {
        console.log(`[Cluster] New worker online with id ${worker.id}`);
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Cluster] Worker ${worker.process.pid} died with error code ${code}`);
    });
} else {
    const RouteController = require('./routes/index.js');
    const routes = new RouteController();

    app.use(express.json({ limit: '50mb' }));

    app.post('/', (req, res) => {
        const body = req.body;
        console.log('[Webhook Test] Received', body.length, 'webhook payloads:', body);
        res.send('OK');
    });

    app.get('/', (req, res) => res.send('OK'));
    app.post('/raw', async (req, res) => await routes.handleRawData(req, res));

    app.listen(config.port, config.host, () => console.log(`Listening on ${config.host}:${config.port}...`));

    if (config.webhooks.enabled && config.webhooks.urls.length > 0) {
        WebhookController.instance.start();
    }
}