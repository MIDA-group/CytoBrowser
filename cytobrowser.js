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

// Open URL on Win,Mac,Linux
const { exec } = require('node:child_process');
function open(url) {
    const cmd = (process.platform === "win32") ? 'start' : (process.platform === "darwin") ? 'open' : 'xdg-open';
    const command = cmd+' "'+url+'"';
    console.info("Running: ",command);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`\nFailed to open browser: ${error}`);
            console.error(`Please manually open in your preferred browser: ${url}`);
            return;
        }
    });
}

// Handle command line arguments
const argv = require("minimist")(process.argv.slice(2), {
    boolean: ['open-browser'],
    alias: { b: 'open-browser' }
});
const hostname = argv._[0] || "localhost";
const port = argv._[1] || 0; //zero = 'arbitrary unused port'
const collabDir = argv.collab || argv.c || "./collab_storage";
const dataDir = argv.data || argv.d || "./data";
const metadataDir = argv.metadata || argv.m || dataDir; //Default is datadir
const urlQuery = argv.query? "?"+argv.query : "";
if (argv.h || argv.help) {
    console.info(`Usage: node cytobrowser.js [--open-browser] host port` +
    ` [-d image data path = "./data"]` +
    ` [-c collab storage path = "./collab_storage"]` +
    ` [-m image metadata path = image data path]` +
    ` [--query url-query-string (only with '--open-browser')]` );
    return;
}

// Declare required modules
const express = require("express");
const availableImages = require("./server/availableImages")(dataDir);
const collaboration = require("./server/collaboration")(collabDir, metadataDir);
const { version : serverVersion } = require("./package.json");

// Initialize the server
const app = express();
const expressWs = require("express-ws")(app);

// Serve static files
const publicPath = `${__dirname}/public/`;
console.info('Serving resources from: ',publicPath);
app.use(express.static(publicPath));

console.info('Serving image data from: ',dataDir);
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

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
        req.socket.remoteAddress;
    console.log(`Connected from ${ip}`);

    collaboration.joinCollab(ws, name, userId, id, image);
   
    ws.on("error", err => {
        console.error(" ws_error:", err);
    });    

    // The underlying TCP socket 
    ws._socket.on("error", err => {
        if (err.code=='ECONNRESET') {
            console.error(" tcp_error: ECONNRESET (probably just a client close)");
        }
        else {
            console.error(" tcp_error: ", err);
        }
    });

    ws._socket.on("close", hadError => {
        if (hadError) console.log(" tcp_close, hadError: ", hadError);
    });

    ws.on("message", msg => {
        collaboration.handleMessage(ws, id, msg);
    });

    ws.on("close", (code, reason) => {
        console.log(` ws_close: ${code}, ${reason.toString()}`);
        collaboration.leaveCollab(ws, id);
    });

    // Monitor ws.buffer (large annotation load on slow line triggers this)
    let prev_buff=0;
    const interval = setInterval(() => {
        const curr_buff=ws.bufferedAmount;
        if (prev_buff>100 && curr_buff>100) {
            console.log("Possible ws congestion, buffered:", curr_buff);
        }
        prev_buff=curr_buff;
    }, 1000);
    function cleanup_interval() {
        clearInterval(interval);
    }
    ws.once("close", cleanup_interval);
    ws.once("error", cleanup_interval);
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
        open(`http://${address}:${port}/${urlQuery}`);  
    }
});

// Monitor event-loop lag
let last = Date.now();
setInterval(() => {
    const now = Date.now();
    const lag = now - last - 1000;

    if (lag > 500) {
        console.log("event loop lag (ms)", lag);
    }

    last = now;
}, 1000);

