# Installation
Before the server can be run, make sure Node.js is installed. The current latest version of Node.js can be downloaded from [here](https://nodejs.org/en/download/). This includes the Node package manager (npm), which is required to install the required modules. The latest version of Node.js that CytoBrowser has been tested with is v14.15.4, which can be downloaded from [here](https://nodejs.org/download/release/v14.15.4/) in case the most recent release becomes incompatible.

Once Node.js and npm are installed, enter the top-level directory of CytoBrowser and run the following command to download and install the required modules:

```bash
npm install
```

The server requires access to three different directories. These are the data directory, where **.dzi** files are stored, the **.json** metadata directory, where metadata for each image is stored, and the collaboration storage directory, where annotation data is automatically saved from collaboration sessions; the last of these will be created automatically if not existing whereas the other two will not. 
By default, the server will assume that these directories can be found in the top-level directory of CytoBrowser as `./data`, `./metadata/json`, and `./collab_storage`. It is possible, but not necessary, to make these symbolic links to other parts of the file system. On Unix machines, this can be done for the data directory with:

```bash
ln -s /path/to/data ./data
```

On windows machines, while running as an administrator, this can be done with:

```bash
mklink /D .\data \Path\To\Data
```

With the necessary modules installed and the directories set up, run the server with the following command:

```bash
 node cytobrowser.js (hostname) (port) -m /path/to/metadata -c /path/to/collab/storage -d /path/to/data
 ```

The directory paths do not need to be specified if the default paths are used. For example, to run the server on the local host on port 8080 with the default directory paths, run the following:

```bash
node cytobrowser.js localhost 8080
```

The user interface can then be accessed by opening a modern web browser and going to `http://localhost:8080`.

## Preparing Metadata

In order to display metadata for an image, the metadata first has to be extracted and preprocessed. This requires the use of [bftools](https://docs.openmicroscopy.org/bio-formats/5.7.1/users/comlinetools/index.html). First, the metadata has to be extracted from the original microscopy images as **.ome.xml** files. For **.ndpi** files, this can be done with:

```bash
bftools/showinf -nocore -no-sas -nopix -omexml -omexml-only [filename].ndpi > [OME-XML directory]/[filename].ome.xml
```

Next, the **.ome.xml** files have to be converted to **.json** files structured in the way CytoBrowser expects them. If several **.ome.xml** have been created and stored in the same directory, this can be done with a single operation. From the CytoBrowser root directory, this is done with:

```bash
server/metadata.js [OME-XML directory] [JSON directory]
```

Note that the CytoBrowser server expects the filenames of the **.json** files to be the same as the **.dzi** files, only differing in file extension.
