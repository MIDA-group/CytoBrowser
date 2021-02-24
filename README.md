## CytoBrowser
===========

Fork of [TissUUmaps](https://github.com/wahlby-lab/TissUUmaps) aimed at Cytology

1. Handling z-stacks (focus stacks)
2. Multi-user shared view
3. Point and region annotations with class label and textual comments
4. Server side storage of annotations


#### Example
```
#Clone from github
git clone https://github.com/MIDA-group/CytoBrowser.git
cd Cytobrowser

#Install the necessary dependencies
npm install

#Put your OpenSeadragon compatible images in the 'data/' directory

#Or download an example image and convert it to Deep Zoom Image (dzi) format
./examples/Zeiss-1-Stacked.sh  #This requires bftools and libvips

#Start the web server on a specified host
node cytobrowser.js 127.0.0.1 8080

#Or more generally
node cytobrowser.js [hostname] [port]

#Optionally open an ssh-pipe from your local machine to the web server
ssh -L 8080:localhost:8080 remote.host

#Open browser on your local machine
$BROWSER http://localhost:8080/?image=filename

#Enjoy! =)
```
