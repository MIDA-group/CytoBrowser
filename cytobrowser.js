#!/usr/bin/env node
/**
 * Server component of CytoBrowser. Run `node cytobrowser.js --help` and/or check the README.md
 */

// Catch all
process.on('uncaughtException', function(e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error("\nError: Required module missing!\nTry running 'npm install'\n\n\n");
    }
    throw e;
});

// Handle command line arguments
const argv = require("minimist")(process.argv.slice(2), {
    boolean: ['open-browser'],
    alias: { b: 'open-browser' }
});
const hostname = argv._[0] || "localhost";
const port = argv._[1] || 0; //zero = 'arbitrary unused port'
const collabDir = argv.collab || argv.c || "./collab_storage";
const metadataDir = argv.metadata || argv.m || "./metadata/json";
const dataDir = argv.data || argv.d || "./data";
if (argv.h || argv.help) {
    console.info(`Usage: node cytobrowser.js [--open-browser] hostname port ` +
    `[-c collab storage path = "./collab_storage"] ` +
    `[-m image json metadata path = "./metadata/json"] ` +
    `[-d image data path = "./data"]`);
    return;
}

// Declare required modules
const express = require("express");
const availableImages = require("./server/availableImages")(dataDir);
const collaboration = require("./server/collaboration")(collabDir, metadataDir);
const open = require("open");
const { version : serverVersion } = require("./package.json");

// Initialize the server
const app = express();
const expressWs = require("express-ws")(app);

// Serve static files
app.use(express.static("public"));
app.use("/data", express.static(dataDir));
app.use(express.json());

// Serve the index page at the root
app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
});

// Get server version string (from package.json); can hardly be a security issue
app.get("/api/serverVersion", (req, res) => {
    res.status(200);
    res.json({serverVersion});
});

// Get a list of available images
app.get("/api/images", (req, res) => {
    // Get the available images and send them as a response
    const images = availableImages();
    if (images === null) {
        res.status(500);
        res.send("The server was unable to find images.");
    }
    else {
        res.status(200);
        res.json(images);
    }
});

// Get an unused collaboration id
app.get("/api/collaboration/id", (req, res) => {
    const id = collaboration.getId();
    res.status(200);
    res.json({id});
});

// Get a list of existing collaborations
app.get("/api/collaboration/available", (req, res) => {
    const image = req.query.image;
    collaboration.getAvailable(image).then(available => {
        res.status(200);
        res.json({available});
    }).catch(err => {
        console.warn(err.message);
        res.status(400);
    });
});

// Add websocket endpoints for collaboration
app.ws("/collaboration/:id", (ws, req) => {
    const id = req.params.id;
    const image = req.query.image ? req.query.image : null;
    const userId = req.query.userId ? req.query.userId : null;
    const name = req.query.name || "Unnamed";
    collaboration.joinCollab(ws, name, userId, id, image);

    ws.on("message", msg => {
        collaboration.handleMessage(ws, id, msg);
    });

    ws.on("close", (code, reason) => {
        collaboration.leaveCollab(ws, id);
    });
});

// Begin listening on the specified interface
const listener = app.listen(port, hostname, () => {
    let address = listener.address().address;
    const port = listener.address().port;

    const family = listener.address().family; //IPv6
    if (family === 'IPv6') {
        address = `[${address}]`;
    }

    console.info(`CytoBrowser server (v${serverVersion}) listening at http://${address}:${port}`);
    
    // Opens the URL in the default browser.
    if (argv['open-browser']) {
        open(`http://${address}:${port}`);  
    }
});
