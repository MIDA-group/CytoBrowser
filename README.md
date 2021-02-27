## CytoBrowser

Fork of [TissUUmaps](https://github.com/wahlby-lab/TissUUmaps) aimed at Cytology

1. Handling z-stacks (focus stacks)
2. Multi-user shared view
3. URL encodes the current view and annotation layer; easy to bookmark views, copy and share
4. Point and region annotations with class label and textual comments
5. Server side storage of annotations


#### Example
```
#Clone from github
git clone https://github.com/MIDA-group/CytoBrowser.git
cd Cytobrowser

#Install the necessary dependencies
npm install

#Start the web server on a specified host
node cytobrowser.js 127.0.0.1 8080

#Or more generally
node cytobrowser.js [hostname] [port]

#Put your OpenSeadragon compatible images in the 'data/' directory

#Or download an example image and convert it to Deep Zoom Image (dzi) format
#(There are more examples in the 'examples/' directory)
./examples/Zeiss-1-Stacked.sh  #This requires bftools and libvips

#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host

#Open a browser on your local machine, load an image and start annotating
$BROWSER http://localhost:8080

#Or open a specific image directly
$BROWSER http://localhost:8080/?image=image_name

#Enjoy! =)
```
