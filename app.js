// Declare required modules
const fs = require("fs");
const express = require("express");

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
    // Read the available files in the data directory
    fs.readdir('./data', (err, dir) => {
        if (err) {
            console.log("Couldn't find the ./data diectory.");
            res.status(500);
            res.send("The server did not have a data directory.");
        }
        else {
            // Find all unique image names in the directory
            const nameEx = /.*_x40/g; // TODO: Haven't checked if this applies to all images
            const names = dir.map((fileOrDirName) => {
                const name = fileOrDirName.match(nameEx);
                if (name === null) {
                    return null;
                }
                else {
                    return name[0];
                }
            });
            const uniqueNames = [... new Set(names.filter((name) => name !== null))];
            res.status(200);
            res.json({imageNames: uniqueNames});
        }
    });
});

// Begin listening on the specified interface
const listener = server.listen(port, hostname, () => {
    const address = listener.address().address;
    const port = listener.address().port;
    console.log(`CytoBrowser server listening at http://${address}:${port}`);
});
