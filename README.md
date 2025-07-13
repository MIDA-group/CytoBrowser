## [CytoBrowser](https://mida-group.github.io/CytoBrowser/)
CytoBrowser, a JavaScript and Node.js driven environment for fast and accessible collaborative online visualization, assessment, and annotation of very large microscopy images.

<img alt="Screenshot of CytoBrowser usage" title="Example view of CytoBrowser usages" align="right" width="50%" src="../../blob/gh-pages/media/CytoBrowser_example_view.jpg">

Origintating as a fork[^1] of [TissUUmaps](https://github.com/wahlby-lab/TissUUmaps) aimed at Cytology
[^1]: TissUUmaps originally had a strict "clientside only" policy, which was incompatible with the CytoBrowser collaborative aim.
1. Handling z-stacks (focus stacks), ctrl-scroll on your mouse to focus
2. Multi-user shared view with follow options, also when changing images and annotation layers
3. URL encodes the current view and annotation layer; easy to bookmark views, copy and share
4. Point and region annotations with class label and textual comments
5. Automatic server side storage of annotations; import/export of annotations in JSON format

#### Express setup
1. Install [Node.js](https://nodejs.org/en/download) 
2. Run `npx cytobrowser --open-browser`[^2]
[^2]: If (on Windows) you get `ENOENT: no such file or directory...`, the try running `npm install -g npm`

Done! 😊

You may now populate your `./data` directory, see below for further info.  
&nbsp;


#### Slightly longer example, cloning the latest sources from GitHub (instead of using npx)
<pre>
#Clone from github
git clone https://github.com/MIDA-group/CytoBrowser.git
cd CytoBrowser

#Install the necessary dependencies
npm install
#Optionally switch to develop version `git switch develop`


#Put your OpenSeadragon compatible images in the 'data/' directory
#For converters, see e.g.: <a href="http://openseadragon.github.io/examples/creating-zooming-images/">http://openseadragon.github.io/examples/creating-zooming-images/</a>

#Or download an example image and convert it to Deep Zoom Image (dzi) format
#(There are more examples in the '<a href="https://github.com/MIDA-group/CytoBrowser/tree/master/examples">examples/</a>' directory)
./examples/Zeiss-1-Stacked.sh  #This requires bftools and libvips


#Start the web server on a free port on localhost, and open a browser
node cytobrowser.js --open-browser


#More generally, to start the web server on a specified port
# node cytobrowser.js [hostname] [port]
# node cytobrowser.js --help

  
#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host  



#Enjoy! =)
</pre>

### Branches
Current list of branches:
* **master** - Main stable branch, official releases are from this branch;
* **develop** - Main development branch, less stable but more up-to-date - most often a good choice;
* devel/multi-image - Work in progress to support multiple layers of images (for correlative multimodal analysis);
* devel/multi-image-autoload-hack - Small add-on to hide images with suffix '_FL', and autoload them together with corresponding non-hidden images with same prefix.

### Issues
We aim to support all modern browsers. Since development mostly utilizes the [Chrome](https://www.google.com/chrome/) browser, that one can be expected to give the least troublesome usage experience. Please don't be shy to report [issues](https://github.com/MIDA-group/CytoBrowser/issues) that you experience.

### Contributing
We are very happy for contributions to further improve CytoBrowser, take a look at [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

### Citing
If you find the CytoBrowser software useful in your research, please consider citing the following article:

*Rydell C and Lindblad J. "CytoBrowser: a browser-based collaborative annotation platform for whole slide images". 
F1000Research 2021, 10:226 (https://doi.org/10.12688/f1000research.51916.1)*
```
@article{ 10.12688/f1000research.51916.1,
  author = {Rydell, C and Lindblad, J},
  title = {CytoBrowser: a browser-based collaborative annotation platform for whole slide images [version 1; peer review: awaiting peer review]},
  journal = {F1000Research},
  volune = {10},
  year = {2021},
  number = {226},
  doi = {10.12688/f1000research.51916.1}
}
```

### Acknowledgement

This work is supported by: VINNOVA grants 2017-02447, 2020-03611 and 2021-01420, and Swedish Research Council proj. 2017-04385. 
