# Installation
Before the server can be run, make sure Node.js is installed. The current latest version of Node.js can be downloaded from [here](https://nodejs.org/en/download/). This includes the Node package manager (npm), which is required to install the required modules. The latest version of Node.js that CytoBrowser has been tested with is v14.15.4, which can be downloaded from [here](https://nodejs.org/download/release/v14.15.4/) in case the most recent release becomes incompatible.

Once Node.js and npm are installed, enter the top-level directory of CytoBrowser and run the following command to download and install the required modules:

```bash
npm install
```

The server requires access to three different directories. These are the data directory, where **.dzi** files are stored, the storage directory, where users can manually save annotation data, and the collaboration storage directory, where annotation data is automatically saved from collaboration sessions. By default, the server will assume that these directories can be found in the top-level directory of CytoBrowser as `./data`, `./storage`, and `./collab_storage`. It's possible, but not necessary, to make these symbolic links to other parts of the file system. On Unix machines, this can be done for the data directory with:

```bash
ln -s /path/to/data ./data
```

On windows machines, while running as an administrator, this can be done with:

```bash
mklink /D .\data \Path\To\Data
```

With the necessary modules installed and the directories set up, run the server with the following command:

```bash
 node cytobrowser.js (hostname) (port) -s /path/to/storage -c /path/to/collab/storage -d /path/to/data
 ```

The directory paths do not need to be specified if the default paths are used. For example, to run the server on the local host on port 8080 with the default directory paths, run the following:

```bash
node cytobrowser.js localhost 8080
```

The user interface can then be accessed by opening a modern web browser and going to `http://localhost:8080`.
