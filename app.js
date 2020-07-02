// Declare required modules
const fs = require("fs");
const express = require("express");
const availableImages = require("./availableImages");

// Store the address to be used from arguments
const hostname = process.argv[2] || "localhost";
const port = process.argv[3] || 0;

// Initialize the server
const server = express();

// Serve static files
server.use("/js", express.static("js"));
server.use("/css", express.static("css"));
server.use("/misc", express.static("misc"));
server.use("/data", express.static("data"));

// Serve the index page at the root
server.get("/", (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

// Get a list of available images
server.get("/api/images", (req, res) => {
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

// Begin listening on the specified interface
const listener = server.listen(port, hostname, () => {
    const address = listener.address().address;
    const port = listener.address().port;
    console.log(`CytoBrowser server listening at http://${address}:${port}`);
});
