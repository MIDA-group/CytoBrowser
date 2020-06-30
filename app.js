// Bind required modules
const express = require("express");

// Store the address to be used from arguments
const hostname = process.argv[2] || "localhost";
const port = process.argv[3] || 0;

// Initialize the server
const server = express();

// Serve static JS and css files
server.use("/js", express.static("js"));
server.use("/css", express.static("css"));
server.use("/misc", express.static("misc"));

// Serve the index page at the root
server.get("/", (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

// Begin listening on the specified interface
const listener = server.listen(port, hostname, () => {
    const address = listener.address().address;
    const port = listener.address().port;
    console.log(`CytoBrowser server listening at http://${address}:${port}`);
});
