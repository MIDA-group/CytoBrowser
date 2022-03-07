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


#### Example
<pre>
#Clone from github
git clone https://github.com/MIDA-group/CytoBrowser.git
cd CytoBrowser

#Install the necessary dependencies
npm install

#Start the web server on a specified host
node cytobrowser.js 127.0.0.1 8080

#Or more generally
node cytobrowser.js [hostname] [port]

#Put your OpenSeadragon compatible images in the 'data/' directory
#For converters, see e.g.: <a href="http://openseadragon.github.io/examples/creating-zooming-images/">http://openseadragon.github.io/examples/creating-zooming-images/</a>

#Or download an example image and convert it to Deep Zoom Image (dzi) format
#(There are more examples in the '<a href="https://github.com/MIDA-group/CytoBrowser/tree/master/examples">examples/</a>' directory)
./examples/Zeiss-1-Stacked.sh  #This requires bftools and libvips

#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host

#Open a web browser on your local machine, load an image and start annotating
xdg-open <a href="http://localhost:8080">http://localhost:8080</a>

#Or open a specific image directly
xdg-open http://localhost:8080/?image=image_name

#Enjoy! =)
</pre>

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

This work is supported by: VINNOVA grants 2017-02447 and 2020-03611.
