// Bind required modules
const express = require("express");

// Initialize the server
const server = express();
const port = 8080;

// Serve static JS and css files
server.use("/js", express.static("js"));
server.use("/css", express.static("css"));
server.use("/misc", express.static("misc"));

// Serve the index page at the root
server.get("/", (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

server.listen(port, () => {
    console.log(`Example server listening at http://localhost:${port}`);
});
