# Installation.

This file presents the *installation from github* option. For a faster *npx* option (stable only) which does not require installing `git`, see `./README.md`.

Before the server can be run, make sure Node.js is installed. The current latest version of Node.js can be downloaded from [here](https://nodejs.org/en/download/). This includes the Node package manager (npm), which is needed to install the required modules. 

Once Node.js and npm are installed, go ahead and clone the git repository: `git clone https://github.com/MIDA-group/CytoBrowser.git` (requires that you have `git` installed).
Enter the top-level directory of CytoBrowser (`cd CytoBrowser`.).
Consider switching to the `develop` branch (`git switch develop`) to enjoy the latest features, or stay with the `stable`, for a more well tested experience. (You can switch back and forth later, but make sure to run `npm install`, since different branches may depend on different packages.) 

To download required dependencies, run the following command:
```bash
npm install
```

The server requires access to three directories. These are the data directory, where **.dzi** files are stored, the metadata directory, where **.json** metadata for each image is stored, and the collaboration storage directory, where annotation data is automatically saved from collaboration sessions; the last of these will be created automatically if not existing whereas the other two will not. 
By default, the server will assume that these directories can be found in the top-level directory of CytoBrowser as `./data`, `./data` (i.e., same as the data directory), and `./collab_storage`. 
Using command line parameters `-d`, `-m`, and `-c`, it is possible to change these directories. It is also possible to use symbolic links (using `ln` or `mklink` commands) to direct to other parts of the file system.

To populate the data directory with **.dzi** files, see a few examples in `./examples/`.


## Start the server
With the necessary modules installed and the directories set up, run the server with the following command:

```bash
 node cytobrowser.js (host) (port) 
```

The `host` parameter determines which network interfaces the server will listen on, default is `localhost` (127.0.0.1 for IPv4 or ::1 for IPv6) making the server accessible only from the same machine. Set `host` to `0.0.0.0` to make the server listen on all available network interfaces; do take care about possible security implications, the `./public` directory is exposed by the server.

If no `port` parameter is given, the server will look for a free port to use - presented in the terminal so you know which one it is.

To list all command line options, type
```bash
 node cytobrowser.js --help 
```

## Access the interface

The user interface is accessed via any modern web browser (development is mostly using Chrome).
For example, if starting the server with 
```bash
node cytobrowser.js localhost 8080
```
going to `http://localhost:8080` in your browser will present the CytoBrowser interface.

A convenient parameter for automatically launching a browser is `--open-browser`, which saves you from entering the URL manually.
Thus, the following will start the server using a free port on localhost, and opening the user interface on the default browser. 
```bash
node cytobrowser.js --open-browser
```


## Preparing Metadata

In order to display metadata, such as image resolution, for an image, the metadata first has to be extracted and preprocessed. This requires the use of [bftools](https://docs.openmicroscopy.org/bio-formats/latest/users/comlinetools/index.html). First, the metadata has to be extracted from the original microscopy images as **.ome.xml** files. For **.ndpi** files, this can be done with:

```bash
bftools/showinf -nocore -no-sas -nopix -omexml -omexml-only [filename].ndpi > [filename].ome.xml
```

Next, the **.ome.xml** files have to be converted to **.json** files structured in the way CytoBrowser expects them.
This is done with:
```bash
node server/metadata.js [OME-XML-file(s)] [metadata directory]
```

The CytoBrowser server expects the filenames of metadata **.json** files to be the same as the **.dzi** files, only differing in file extension.
