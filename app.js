// Declare required modules
const fs = require("fs");
const express = require("express");
const availableImages = require("./availableImages");
const collaboration = require("./collaboration");

// Store the address to be used from arguments
const hostname = process.argv[2] || "localhost";
const port = process.argv[3] || 0;

// Initialize the server
const app = express();
const expressWs = require("express-ws")(app);

// Serve static files
app.use(express.static("public"));
app.use("/data", express.static("data"));

// Serve the index page at the root
app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/public/index.html`);
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
    res.json({id: id});
});

// Add websocket endpoints for collaboration
app.ws("/collaboration/:id", (ws, req) => {
    const id = req.params.id;
    collaboration.joinCollab(ws, id);
    console.info(`Collab [${id}] - A connection has been opened.`);

    ws.on("message", (msg) => {
        collaboration.handleMessage(ws, id, msg);
    });

    ws.on("close", (code, reason) => {
        collaboration.leaveCollab(ws, id);
        console.info(`Collab [${id}] - A connection has been closed.`);
    });
});

// Begin listening on the specified interface
const listener = app.listen(port, hostname, () => {
    const address = listener.address().address;
    const port = listener.address().port;
    console.log(`CytoBrowser server listening at http://${address}:${port}`);
});
