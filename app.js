// Declare required modules
const fs = require("fs");
const express = require("express");
const availableImages = require("./availableImages");
const collaboration = require("./collaboration");
const serverStorage = require("./serverStorage");

// Store the address to be used from arguments
const hostname = process.argv[2] || "localhost";
const port = process.argv[3] || 0;

// Initialize the server
const app = express();
const expressWs = require("express-ws")(app);

// Serve static files
app.use(express.static("public"));
app.use("/data", express.static("data"));
app.use("/storage", express.static("storage"));
app.use(express.json());

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

// Get a list of files stored on the server
app.get("/api/storage", (req, res) => {
    serverStorage.files().then(data => {
        res.status(200);
        res.json({files: data});
    })
    .catch(err => {
        console.warn(err);
        res.status(500);
        res.send();
    });
});

// Load JSON file from server
/*
app.get("/api/storage/:filename", (req, res) => {
    serverStorage.loadJSON(req.params.filename).then(data => {
        res.status(200);
        res.json(data);
    })
    .catch(err => {
        console.warn(err);
        res.status(500);
        res.send();
    });
});
*/
// Add a JSON file to the server
app.post("/api/storage/:filename", (req, res) => {
    const overwrite = Boolean(Number(req.query.overwrite));
    try {
        serverStorage.saveJSON(req.body, req.params.filename, overwrite)
        .then(() => {
            res.status(201);
            res.send();
        })
        .catch(err => {
            console.warn(err);
            res.status(500);
            res.send();
        });
    }
    catch (err) {
        if (err === serverStorage.duplicateFile) {
            res.status(300);
            res.send();
        }
        else {
            console.warn(err);
            res.status(400);
            res.send();
        }
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
    const image = req.query.image;
    const name = req.query.name || "Unnamed";
    collaboration.joinCollab(ws, name, id, image);

    ws.on("message", msg => {
        collaboration.handleMessage(ws, id, msg);
    });

    ws.on("close", (code, reason) => {
        collaboration.leaveCollab(ws, id);
    });
});

// Begin listening on the specified interface
const listener = app.listen(port, hostname, () => {
    const address = listener.address().address;
    const port = listener.address().port;
    console.info(`CytoBrowser server listening at http://${address}:${port}`);
});
